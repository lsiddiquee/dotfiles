import assert from 'node:assert/strict';
import { test } from 'node:test';
import { proposalHash, parseProposal, createDecision } from '../src/model.mjs';

const proposal = () => ({
  schemaVersion: 1,
  title: 'Library copies',
  summary: 'Track individual physical copies and their loans.',
  models: [{
    name: 'Copy', description: 'One physical copy',
    fields: [{ name: 'id', type: 'Identifier', required: true,
      description: 'Permanent identity', storage: 'stored', mutability: 'Immutable', constraints: ['Unique'] }],
  }],
  relationships: [], lifecycle: ['Available -> On loan -> Available'],
  invariants: ['At most one active loan per copy.'],
  migration: ['Preserve existing data.'], assumptions: [], questions: [],
});

test('validates fields and rejects ambiguous or invalid proposal data', () => {
  assert.equal(parseProposal(proposal()).models[0].fields[0].required, true);
  const invalid = proposal();
  invalid.models[0].fields[0].required = 'yes';
  assert.throws(() => parseProposal(invalid));
  assert.throws(() => parseProposal({ ...proposal(), injectedApproval: true }));
  assert.throws(() => parseProposal({ ...proposal(), models: [] }));
});

test('relationship references must resolve and identifiers must be unique', () => {
  assert.throws(() => parseProposal({ ...proposal(), relationships: [{
    from: 'Copy', to: 'Loan', cardinality: 'one-to-many', description: 'Records loans',
  }] }));
  const duplicate = proposal();
  duplicate.models.push(structuredClone(duplicate.models[0]));
  assert.throws(() => parseProposal(duplicate));
});

test('hash ignores object key order but detects field and rule changes', () => {
  const original = proposal();
  const reordered = Object.fromEntries(Object.entries(original).reverse());
  assert.equal(proposalHash(original), proposalHash(reordered));
  const changed = structuredClone(original);
  changed.models[0].fields[0].type = 'Integer';
  assert.notEqual(proposalHash(original), proposalHash(changed));
});

test('approval is explicit and bound to the displayed proposal revision', () => {
  const original = parseProposal(proposal());
  const hash = proposalHash(original);
  const decision = createDecision(original, hash, { action: 'approve', feedback: '', answers: {} });
  assert.equal(decision.status, 'approved');
  assert.equal(decision.proposalHash, hash);
  assert.equal(decision.destructiveOperationsAuthorized, false);
  assert.throws(() => createDecision({ ...original, summary: 'Changed' }, hash,
    { action: 'approve', feedback: '', answers: {} }), /changed/i);
  assert.throws(() => createDecision(original, hash,
    { action: 'enable', feedback: '', answers: {} }));
});

test('open questions block approval even after answers; revision must incorporate answers', () => {
  const original = parseProposal({ ...proposal(), questions: [{
    id: 'retirement', prompt: 'Can lost copies be retired?', options: ['Yes', 'No'],
  }] });
  const hash = proposalHash(original);
  assert.throws(() => createDecision(original, hash,
    { action: 'approve', feedback: '', answers: { retirement: 'Yes' } }), /unresolved/i);
  const result = createDecision(original, hash,
    { action: 'requestChanges', feedback: '', answers: { retirement: 'Yes' } });
  assert.equal(result.status, 'changes_requested');
  assert.equal(result.answers.retirement, 'Yes');
});

test('changes require feedback or answers, defer does not approve', () => {
  const original = parseProposal(proposal());
  const hash = proposalHash(original);
  assert.throws(() => createDecision(original, hash,
    { action: 'requestChanges', feedback: '', answers: {} }), /feedback/i);
  assert.throws(() => createDecision(original, hash,
    { action: 'approve', feedback: 'Change identity', answers: {} }), /feedback/i);
  assert.throws(() => createDecision(original, hash,
    { action: 'defer', feedback: '', answers: { invented: 'yes' } }));
  assert.equal(createDecision(original, hash,
    { action: 'defer', feedback: '', answers: {} }).status, 'deferred');
});
