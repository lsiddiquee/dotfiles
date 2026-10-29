import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { createDecision, parseProposal, proposalHash } from './model.mjs';

const MAX_FILE_BYTES = 512 * 1024;
const activeReviews = new Map();
const reviewPanels = new Map();

async function readProposal(uri) {
  const stat = await vscode.workspace.fs.stat(uri);
  if (stat.size > MAX_FILE_BYTES) { throw new Error('Proposal exceeds 512 KiB.'); }
  const bytes = await vscode.workspace.fs.readFile(uri);
  if (bytes.length > MAX_FILE_BYTES) { throw new Error('Proposal exceeds 512 KiB.'); }
  return parseProposal(JSON.parse(Buffer.from(bytes).toString('utf8')));
}

async function workspaceProposal(relativePath) {
  if (!vscode.workspace.isTrusted) { throw new Error('Model Review requires a trusted workspace.'); }
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length !== 1) { throw new Error('Open one workspace folder to select a proposal unambiguously.'); }
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath) || !relativePath.endsWith('.json')) {
    throw new Error('Provide a workspace-relative .json proposal path.');
  }
  const root = await realpath(folders[0].uri.fsPath);
  const target = await realpath(path.resolve(root, relativePath));
  const relative = path.relative(root, target);
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error('Proposal must remain inside the workspace, including symlink targets.');
  }
  return vscode.Uri.file(target);
}

async function workspaceDirectory(relativePath) {
  if (!vscode.workspace.isTrusted) { throw new Error('Model Review requires a trusted workspace.'); }
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length !== 1) { throw new Error('Open one workspace folder to save decisions unambiguously.'); }
  if (typeof relativePath !== 'string' || !relativePath.trim() || path.isAbsolute(relativePath)) {
    throw new Error('Provide the confirmed workspace-relative decisionDirectory.');
  }
  const root = await realpath(folders[0].uri.fsPath);
  const target = path.resolve(root, relativePath);
  const inside = value => {
    const relative = path.relative(root, value);
    return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) &&
      !relative.split(path.sep).includes('.git');
  };
  if (target === root || !inside(target)) { throw new Error('Decision directory must remain inside the workspace and outside .git.'); }
  let ancestor = target;
  while (true) {
    try {
      if (!inside(await realpath(ancestor))) { throw new Error('Decision directory symlink must remain inside the workspace and outside .git.'); }
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') { throw error; }
      ancestor = path.dirname(ancestor);
    }
  }
  return vscode.Uri.file(target);
}

async function chooseDecisionDirectory() {
  return vscode.window.showInputBox({
    title: 'Model Review Decision Storage',
    prompt: 'Workspace-relative receipt directory from repository policy (.local/ for ignored records, or a committed directory)',
    placeHolder: '.local/model-reviews or docs/model-reviews',
    ignoreFocusOut: true,
  });
}

function html(webview, extensionUri) {
  const nonce = randomBytes(24).toString('hex');
  const asset = name => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', name));
  const policy = `default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:;`;
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><link rel="stylesheet" href="${asset('review.css')}"><title>Model Review</title></head><body><div id="root"></div><script type="module" nonce="${nonce}" src="${asset('review.js')}"></script></body></html>`;
}

async function review(context, sourceUri, decisionDirectory, token, example = false) {
  const key = sourceUri.toString();
  if (activeReviews.has(key)) {
    activeReviews.get(key).reveal();
    throw new Error('This proposal is already being reviewed. Finish or close that review first.');
  }
  const directory = await workspaceDirectory(decisionDirectory);
  const proposal = await readProposal(sourceUri);
  if (token?.isCancellationRequested) { throw new vscode.CancellationError(); }
  const displayedHash = proposalHash(proposal);
  const existingPanel = reviewPanels.get(key);
  const panel = existingPanel ?? vscode.window.createWebviewPanel('modelReview', `Model Review: ${proposal.title}`,
    vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
    });
  if (!existingPanel) {
    reviewPanels.set(key, panel);
    panel.onDidDispose(() => reviewPanels.delete(key));
  }
  activeReviews.set(key, panel);

  return new Promise(resolve => {
    let finished = false;
    let submitting = false;
    const subscriptions = [];
    const display = () => panel.webview.postMessage({ type: 'proposal', proposal, hash: displayedHash,
      source: example ? 'Bundled example (practice only)' : vscode.workspace.asRelativePath(sourceUri), example });
    const finish = result => {
      if (finished) { return; }
      finished = true;
      activeReviews.delete(key);
      subscriptions.forEach(subscription => subscription.dispose());
      resolve(result);
    };
    const deferred = reason => ({
      status: 'deferred', proposalHash: displayedHash, reason,
      destructiveOperationsAuthorized: false, example,
    });
    subscriptions.push(panel.onDidDispose(() => finish(deferred('Review closed without approval.'))));
    if (token) {
      subscriptions.push(token.onCancellationRequested(() => {
        finish(deferred('Review cancelled.'));
        panel.dispose();
      }));
    }
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(path.dirname(sourceUri.fsPath)), path.basename(sourceUri.fsPath)));
    subscriptions.push(watcher);
    const stale = () => panel.webview.postMessage({ type: 'stale' });
    subscriptions.push(watcher.onDidChange(stale), watcher.onDidDelete(stale), watcher.onDidCreate(stale));
    subscriptions.push(panel.webview.onDidReceiveMessage(async message => {
      if (finished || !message || typeof message !== 'object') { return; }
      if (message.type === 'ready') {
        await display();
      }
      if (message.type !== 'decision' || submitting) { return; }
      submitting = true;
      let record;
      let committed = false;
      try {
        if (message.hash !== displayedHash) { throw new Error('Review revision does not match.'); }
        const current = message.submission?.action === 'defer' ? proposal : await readProposal(sourceUri);
        if (finished) { return; }
        const decision = createDecision(current, displayedHash, message.submission);
        await workspaceDirectory(decisionDirectory);
        await vscode.workspace.fs.createDirectory(directory);
        await workspaceDirectory(decisionDirectory);
        if (finished) { return; }
        record = vscode.Uri.joinPath(directory, `${displayedHash}-${randomBytes(8).toString('hex')}.json`);
        const source = example ? 'Bundled example (practice only)' : vscode.workspace.asRelativePath(sourceUri, false);
        const result = { ...decision, example, source, recordPath: record.fsPath };
        await vscode.workspace.fs.writeFile(record, Buffer.from(`${JSON.stringify({ ...decision, example, source, proposal }, null, 2)}\n`));
        if (finished) { return; }
        if (decision.status !== 'deferred') {
          const latest = await readProposal(sourceUri);
          if (finished) { return; }
          if (proposalHash(latest) !== displayedHash) {
            throw new Error('Proposal changed while saving. Reopen and review the current revision.');
          }
        }
        committed = true;
        finish(result);
        if (decision.status === 'changes_requested') {
          await panel.webview.postMessage({ type: 'saved', result });
        } else {
          panel.dispose();
        }
      } catch (error) {
        if (!finished) {
          await panel.webview.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
        }
      } finally {
        if (record && !committed) { await vscode.workspace.fs.delete(record); }
        submitting = false;
      }
    }));
    if (existingPanel) {
      panel.title = `Model Review: ${proposal.title}`;
      panel.reveal();
      void display();
    } else {
      panel.webview.html = html(panel.webview, context.extensionUri);
    }
  });
}

export function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('modelReview.openDemo', async () => {
    try {
      const directory = await chooseDecisionDirectory();
      if (directory === undefined) { return; }
      await review(context, vscode.Uri.joinPath(context.extensionUri, 'examples', 'library.proposal.json'), directory, undefined, true);
    } catch (error) { vscode.window.showErrorMessage(String(error)); }
  }));
  context.subscriptions.push(vscode.commands.registerCommand('modelReview.openProposal', async () => {
    try {
      const selected = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { 'Model proposal': ['json'] } });
      if (!selected?.[0]) { return; }
      const source = await workspaceProposal(vscode.workspace.asRelativePath(selected[0], false));
      const directory = await chooseDecisionDirectory();
      if (directory === undefined) { return; }
      await review(context, source, directory);
    } catch (error) { vscode.window.showErrorMessage(String(error)); }
  }));
  context.subscriptions.push(vscode.lm.registerTool('modelReview_reviewModelProposal', {
    async invoke(options, token) {
      if (options.input.proposalPath === undefined) {
        const schemaUri = vscode.Uri.joinPath(context.extensionUri, 'proposal.schema.json');
        const schema = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(schemaUri)).toString('utf8'));
        const example = await readProposal(vscode.Uri.joinPath(context.extensionUri, 'examples', 'library.proposal.json'));
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify({ status: 'format', schema, example }))]);
      }
      const source = await workspaceProposal(options.input.proposalPath);
      const result = await review(context, source, options.input.decisionDirectory, token);
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(result))]);
    },
  }));
}
