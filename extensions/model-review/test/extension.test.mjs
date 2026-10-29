import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { proposalHash } from '../src/model.mjs';

const require = createRequire(import.meta.url);
const bundle = await readFile(new URL('../dist/extension.cjs', import.meta.url), 'utf8');
const example = JSON.parse(await readFile(new URL('../examples/library.proposal.json', import.meta.url), 'utf8'));

function event() {
  const listeners = new Set();
  return {
    subscribe(listener) { listeners.add(listener); return { dispose() { listeners.delete(listener); } }; },
    async emit(value) { await Promise.all([...listeners].map(listener => listener(value))); },
  };
}

async function host(t, proposal = example) {
  const directory = await mkdtemp(path.join(tmpdir(), 'model-review-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'workspace');
  const storage = path.join(directory, 'storage');
  await mkdir(root);
  const source = path.join(root, 'proposal.json');
  await writeFile(source, JSON.stringify(proposal));
  const received = event();
  const disposed = event();
  const cancelled = event();
  const changed = event();
  const messages = [];
  const posted = event();
  let panelCount = 0;
  let closed = false;
  let opened;
  const panelReady = new Promise(resolve => { opened = resolve; });
  const uri = value => ({ fsPath: value, toString: () => `file://${value}` });
  const fs = {
    async stat(value) { return { size: (await readFile(value.fsPath)).length }; },
    readFile: value => readFile(value.fsPath),
    createDirectory: value => mkdir(value.fsPath, { recursive: true }),
    writeFile: (value, content) => writeFile(value.fsPath, content),
    delete: value => rm(value.fsPath, { force: true }),
  };
  const panel = {
    reveal() {}, dispose() { closed = true; void disposed.emit(); }, onDidDispose: disposed.subscribe,
    webview: { cspSource: 'https://webview.test', asWebviewUri: value => value.toString(),
      onDidReceiveMessage: received.subscribe,
      async postMessage(value) { messages.push(value); await posted.emit(value); return true; } },
  };
  const tools = new Map();
  const vscode = {
    Uri: { file: uri, joinPath: (base, ...parts) => uri(path.join(base.fsPath, ...parts)) },
    workspace: { isTrusted: true, workspaceFolders: [{ uri: uri(root) }], fs,
      asRelativePath: value => path.relative(root, value.fsPath),
      createFileSystemWatcher() { return { dispose() {}, onDidChange: changed.subscribe,
        onDidDelete: changed.subscribe, onDidCreate: changed.subscribe }; } },
    RelativePattern: class {}, ViewColumn: { Active: 1 },
    window: { createWebviewPanel() { panelCount += 1; opened(); return panel; } },
    commands: { registerCommand() { return { dispose() {} }; } },
    lm: { registerTool(name, tool) { tools.set(name, tool); return { dispose() {} }; } },
    LanguageModelToolResult: class { constructor(content) { this.content = content; } },
    LanguageModelTextPart: class { constructor(value) { this.value = value; } },
  };
  const module = { exports: {} };
  vm.runInNewContext(bundle, { module, exports: module.exports, Buffer, console,
    require: name => name === 'vscode' ? vscode : require(name) });
  module.exports.activate({ extensionUri: uri(path.resolve('.')), storageUri: uri(storage), subscriptions: [] });
  const tool = tools.get('modelReview_reviewModelProposal');
  const token = { isCancellationRequested: false, onCancellationRequested: cancelled.subscribe };
  return { root, storage, source, fs, tools, panel, panelReady, received, cancelled, changed, messages, posted,
    get panelCount() { return panelCount; },
    get closed() { return closed; },
    invoke: input => tool.invoke({ input: input ?? { proposalPath: 'proposal.json', decisionDirectory: '.local/model-reviews' } }, token),
    submit: (action, hash = proposalHash(proposal)) => received.emit({ type: 'decision', hash,
      submission: { action, feedback: '', answers: {} } }),
  };
}

test('empty tool input returns the authoring format without requesting approval', async t => {
  const app = await host(t);
  const result = JSON.parse((await app.invoke({})).content[0].value);
  assert.equal(result.status, 'format');
  assert.equal(result.schema.type, 'object');
  assert.deepEqual(result.example, example);
});

test('tool waits for an explicit decision; close and cancellation defer', async t => {
  for (const action of ['close', 'cancel']) {
    const app = await host(t);
    const pending = app.invoke();
    await app.panelReady;
    if (action === 'close') { app.panel.dispose(); } else { await app.cancelled.emit(); }
    const result = JSON.parse((await pending).content[0].value);
    assert.equal(result.status, 'deferred');
    assert.equal(result.destructiveOperationsAuthorized, false);
  }
});

test('host rejects a stale proposal, then allows safe deferral', async t => {
  const original = { ...example, questions: [] };
  const app = await host(t, original);
  const pending = app.invoke();
  await app.panelReady;
  await writeFile(app.source, JSON.stringify({ ...original, summary: 'A different model.' }));
  await app.changed.emit();
  assert.equal(app.messages.at(-1).type, 'stale');
  await app.submit('approve');
  assert.equal(app.messages.at(-1).type, 'error');
  await app.submit('defer');
  const result = JSON.parse((await pending).content[0].value);
  assert.equal(result.status, 'deferred');
});

test('host saves an explicit approval with the exact proposal snapshot', async t => {
  const original = { ...example, questions: [] };
  const app = await host(t, original);
  const pending = app.invoke();
  await app.panelReady;
  await app.submit('approve');
  const result = JSON.parse((await pending).content[0].value);
  assert.equal(result.status, 'approved');
  assert.equal(result.proposalHash, proposalHash(original));
  const saved = JSON.parse(await readFile(result.recordPath, 'utf8'));
  assert.deepEqual(saved.proposal, original);
});

test('completed approval or deferral saves its result and closes the review tab', async t => {
  for (const action of ['approve', 'defer']) {
    const app = await host(t, { ...example, questions: [] });
    const pending = app.invoke();
    await app.panelReady;
    await app.submit(action);
    const result = JSON.parse((await pending).content[0].value);
    assert.equal(result.status, action === 'approve' ? 'approved' : 'deferred');
    assert.equal(JSON.parse(await readFile(result.recordPath, 'utf8')).status, result.status);
    assert.equal(app.closed, true);
  }
});

test('a failed save keeps the review tab open for retry', async t => {
  const app = await host(t, { ...example, questions: [] });
  const write = app.fs.writeFile;
  app.fs.writeFile = async () => { throw new Error('Storage unavailable'); };
  const pending = app.invoke();
  await app.panelReady;
  await app.submit('approve');
  assert.equal(app.messages.at(-1).type, 'error');
  assert.equal(app.closed, false);
  app.fs.writeFile = write;
  await app.submit('approve');
  assert.equal(JSON.parse((await pending).content[0].value).status, 'approved');
  assert.equal(app.closed, true);
});

test('cancellation during save cannot leave an approval record', async t => {
  const app = await host(t, { ...example, questions: [] });
  let release;
  let began;
  const saving = new Promise(resolve => { began = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const write = app.fs.writeFile;
  app.fs.writeFile = async (...args) => { began(); await blocked; await write(...args); };
  const pending = app.invoke();
  await app.panelReady;
  const submitting = app.submit('approve');
  await saving;
  await app.cancelled.emit();
  release();
  await submitting;
  assert.equal(JSON.parse((await pending).content[0].value).status, 'deferred');
  assert.deepEqual(await readdir(path.join(app.root, '.local/model-reviews')), []);
});

test('receipts stay in the explicitly chosen workspace directory', async t => {
  for (const decisionDirectory of ['.local/model-reviews', 'docs/model-reviews']) {
    const app = await host(t, { ...example, questions: [] });
    const pending = app.invoke({ proposalPath: 'proposal.json', decisionDirectory });
    await app.panelReady;
    await app.submit('approve');
    const result = JSON.parse((await pending).content[0].value);
    assert.equal(path.dirname(result.recordPath), path.join(app.root, decisionDirectory));
    assert.equal(result.source, 'proposal.json');
    const receipt = JSON.parse(await readFile(result.recordPath, 'utf8'));
    assert.equal(receipt.source, 'proposal.json');
    assert.equal(receipt.recordPath, undefined);
    await assert.rejects(readdir(app.storage), { code: 'ENOENT' });
  }
});

test('receipt location must be explicit, workspace-contained and outside git internals', async t => {
  const app = await host(t);
  await symlink(path.dirname(app.root), path.join(app.root, 'outside'));
  for (const decisionDirectory of [undefined, '', '..', '/tmp', '.git/reviews', 'outside/reviews']) {
    await assert.rejects(app.invoke({ proposalPath: 'proposal.json', decisionDirectory }), /directory|workspace/i);
  }
  assert.equal(app.panelCount, 0);
});

test('a revised proposal reuses its completed review tab with a fresh revision', async t => {
  const original = { ...example, questions: [] };
  const app = await host(t, original);
  const first = app.invoke();
  await app.panelReady;
  await app.received.emit({ type: 'decision', hash: proposalHash(original),
    submission: { action: 'requestChanges', feedback: 'Clarify the lifecycle.', answers: {} } });
  assert.equal(JSON.parse((await first).content[0].value).status, 'changes_requested');
  assert.equal(app.closed, false);
  const revised = { ...original, summary: 'The clarified lifecycle.' };
  await writeFile(app.source, JSON.stringify(revised));
  const displayed = new Promise(resolve => app.posted.subscribe(message => {
    if (message.type === 'proposal') { resolve(message); }
  }));
  const second = app.invoke();
  const message = await displayed;
  assert.equal(app.panelCount, 1);
  assert.equal(message.hash, proposalHash(revised));
  await app.submit('approve', message.hash);
  assert.equal(JSON.parse((await second).content[0].value).status, 'approved');
});

test('tool rejects traversal and symlink escape outside the workspace', async t => {
  const app = await host(t);
  const outside = path.join(app.root, '..', 'outside.json');
  await writeFile(outside, JSON.stringify(example));
  await symlink(outside, path.join(app.root, 'escape.json'));
  await assert.rejects(app.invoke({ proposalPath: '../outside.json' }), /inside/);
  await assert.rejects(app.invoke({ proposalPath: 'escape.json' }), /inside/);
});
