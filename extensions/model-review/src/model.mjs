import { createHash } from 'node:crypto';
import { z } from 'zod';

const text = z.string().trim().min(1).max(12000);
const identifier = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,79}$/);
const texts = z.array(text).max(100);
const field = z.strictObject({
  name: identifier, type: text, required: z.boolean(), description: text,
  storage: z.enum(['stored', 'derived']), mutability: text, constraints: texts,
});

export const proposalSchema = z.strictObject({
  schemaVersion: z.literal(1), title: text, summary: text,
  models: z.array(z.strictObject({
    name: identifier, description: text, fields: z.array(field).min(1).max(100),
  })).min(1).max(40),
  relationships: z.array(z.strictObject({
    from: identifier, to: identifier,
    cardinality: z.enum(['one-to-one', 'one-to-many', 'one-to-zero-or-many', 'many-to-many']),
    description: text,
  })).max(100),
  lifecycle: texts, invariants: texts, migration: texts, assumptions: texts,
  questions: z.array(z.strictObject({
    id: identifier, prompt: text, options: texts.optional(), recommended: text.optional(),
  })).max(40),
});

export function parseProposal(input) {
  const proposal = proposalSchema.parse(input);
  const names = new Set();
  for (const model of proposal.models) {
    if (names.has(model.name)) { throw new Error(`Duplicate model: ${model.name}`); }
    names.add(model.name);
    const fields = new Set();
    for (const entry of model.fields) {
      if (fields.has(entry.name)) { throw new Error(`Duplicate field: ${model.name}.${entry.name}`); }
      fields.add(entry.name);
    }
  }
  for (const relationship of proposal.relationships) {
    if (!names.has(relationship.from) || !names.has(relationship.to)) {
      throw new Error('Relationship references an unknown model.');
    }
  }
  const questionIds = new Set();
  for (const question of proposal.questions) {
    if (questionIds.has(question.id)) { throw new Error(`Duplicate question: ${question.id}`); }
    questionIds.add(question.id);
    if (question.recommended && question.options?.length && !question.options.includes(question.recommended)) {
      throw new Error('Question recommendation must match an option.');
    }
  }
  return proposal;
}

function canonical(value) {
  if (Array.isArray(value)) { return value.map(canonical); }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function proposalHash(proposal) {
  return createHash('sha256').update(JSON.stringify(canonical(proposal))).digest('hex');
}

const submissionSchema = z.strictObject({
  action: z.enum(['approve', 'requestChanges', 'defer']),
  feedback: z.string().trim().max(20000),
  answers: z.record(z.string(), z.string().trim().max(12000)),
});

export function createDecision(proposal, displayedHash, input) {
  if (proposalHash(proposal) !== displayedHash) {
    throw new Error('Proposal changed. Reopen it and review the current revision.');
  }
  const submission = submissionSchema.parse(input);
  for (const [questionId, answer] of Object.entries(submission.answers)) {
    const question = proposal.questions.find(entry => entry.id === questionId);
    if (!question) { throw new Error('Answer references an unknown question.'); }
    if (question.options?.length && answer && !question.options.includes(answer)) {
      throw new Error('Answer must match a question option.');
    }
  }
  if (submission.action === 'approve' && proposal.questions.length) {
    throw new Error('Resolve unresolved questions in a revised proposal before approval.');
  }
  if (submission.action === 'approve' && submission.feedback) {
    throw new Error('Submit feedback as requested changes before approving a revised proposal.');
  }
  if (submission.action === 'requestChanges' && !submission.feedback &&
      !Object.values(submission.answers).some(Boolean)) {
    throw new Error('Provide feedback or question answers before requesting changes.');
  }
  const statuses = { approve: 'approved', requestChanges: 'changes_requested', defer: 'deferred' };
  return {
    status: statuses[submission.action], proposalHash: displayedHash,
    decidedAt: new Date().toISOString(), feedback: submission.feedback, answers: submission.answers,
    destructiveOperationsAuthorized: false,
  };
}
