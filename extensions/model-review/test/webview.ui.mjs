import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { proposalHash } from '../src/model.mjs';

const proposal = JSON.parse(await readFile(new URL('../examples/library.proposal.json', import.meta.url), 'utf8'));

async function open(page, input = proposal) {
  await page.addInitScript(() => {
    window.reviewMessages = [];
    window.acquireVsCodeApi = () => ({ postMessage: message => window.reviewMessages.push(message) });
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.reviewMessages.some(message => message.type === 'ready'))).toBe(true);
  await page.evaluate(data => window.postMessage(data, '*'), {
    type: 'proposal', proposal: input, hash: proposalHash(input), source: 'design/library.proposal.json', example: false,
  });
  await expect(page.getByRole('heading', { name: input.title, exact: true })).toBeVisible();
}

test('questions start unanswered, block approval, and submit feedback to the host', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'Approve Proposal' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit Answers' })).toBeDisabled();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Yes', exact: false }).first().check();
  await page.getByLabel('Feedback', { exact: true }).fill('Retain completed loans with append-only corrections.');
  await page.getByRole('button', { name: 'Submit Answers' }).click();
  const message = await page.evaluate(() => window.reviewMessages.at(-1));
  expect(message.submission.action).toBe('requestChanges');
  expect(message.submission.answers.emptyBook).toBe('Yes');
  expect(message.hash).toBe(proposalHash(proposal));
});

test('answered questions offer submission instead of a permanently disabled approval', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'Approve Proposal' })).toHaveCount(0);
  const submit = page.getByRole('button', { name: 'Submit Answers' });
  await expect(submit).toBeDisabled();
  await page.getByRole('radio', { name: 'Yes', exact: false }).first().check();
  await page.getByRole('radio', { name: 'Both required', exact: false }).check();
  await page.getByRole('textbox', { name: 'How should incorrect completed loans be corrected while retaining history?' }).fill('Append correction events.');
  await page.getByRole('textbox', { name: 'How should lost or damaged copies be retired, and can active loans be renewed?' }).fill('Retire copies without deleting them; no renewals.');
  await expect(page.getByText('4 of 4 answered.', { exact: false })).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();
  const message = await page.evaluate(() => window.reviewMessages.at(-1));
  expect(message.submission.action).toBe('requestChanges');
  expect(Object.keys(message.submission.answers)).toHaveLength(4);
});

test('resolved proposal allows explicit approval; feedback and stale revisions disable it', async ({ page }) => {
  await open(page, { ...proposal, questions: [] });
  const approve = page.getByRole('button', { name: 'Approve Proposal' });
  await expect(approve).toBeEnabled();
  await page.getByLabel('Feedback', { exact: true }).fill('Change borrower requirement.');
  await expect(approve).toBeDisabled();
  await page.getByLabel('Feedback', { exact: true }).fill('');
  await approve.click();
  expect(await page.evaluate(() => window.reviewMessages.at(-1).submission.action)).toBe('approve');
  await page.evaluate(() => window.postMessage({ type: 'error', message: 'Save failed' }, '*'));
  await expect(page.getByRole('alert')).toHaveText('Save failed');
  await expect(approve).toBeEnabled();
  await page.evaluate(() => window.postMessage({ type: 'stale' }, '*'));
  await expect(approve).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Defer', exact: true })).toBeEnabled();
});

test('a revised proposal resets submitted state and requires a fresh approval in the same page', async ({ page }) => {
  await open(page);
  await page.getByRole('radio', { name: 'Yes', exact: false }).first().check();
  await page.getByLabel('Feedback', { exact: true }).fill('Clarify the lifecycle.');
  await page.getByRole('button', { name: 'Submit Answers' }).click();
  await page.evaluate(() => window.postMessage({ type: 'saved', result: {
    status: 'changes_requested', recordPath: '.local/model-reviews/previous.json',
  } }, '*'));
  await expect(page.getByRole('button', { name: 'Submit Answers' })).toBeDisabled();
  const revised = { ...proposal, summary: 'The clarified lifecycle.', questions: [] };
  await page.evaluate(data => window.postMessage(data, '*'), {
    type: 'proposal', proposal: revised, hash: proposalHash(revised), source: 'design/library.proposal.json', example: false,
  });
  await expect(page.getByText(revised.summary, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Feedback', { exact: true })).toHaveValue('');
  const approve = page.getByRole('button', { name: 'Approve Proposal' });
  await expect(approve).toBeEnabled();
  expect(await page.evaluate(() => window.reviewMessages.filter(message => message.submission?.action === 'approve').length)).toBe(0);
  await approve.click();
  const message = await page.evaluate(() => window.reviewMessages.at(-1));
  expect(message.hash).toBe(proposalHash(revised));
  expect(message.submission).toEqual({ action: 'approve', feedback: '', answers: {} });
});

test('models and diagram render in the desktop editor', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await open(page);
  await expect(page.getByRole('table')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await mkdir('test-results/screenshots', { recursive: true });
  await page.screenshot({ path: 'test-results/screenshots/models.png', fullPage: true });
  await page.getByRole('button', { name: 'Relationships', exact: true }).click();
  const diagram = page.getByRole('img', { name: 'Model relationship diagram' });
  await expect(diagram.locator('svg')).toBeVisible();
  await expect(diagram.locator('svg rect').first()).toBeVisible();
  await expect(diagram.locator('svg text').filter({ hasText: 'Book' }).first()).toBeVisible();
  await expect(diagram.locator('svg text').filter({ hasText: 'Copy' }).first()).toBeVisible();
  await expect(diagram.locator('svg text').filter({ hasText: 'Loan' }).first()).toBeVisible();
  const size = await diagram.locator('svg').boundingBox();
  expect(size.width).toBeGreaterThan(200);
  expect(size.height).toBeGreaterThan(50);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/screenshots/relationships.png', fullPage: true });
  await page.getByRole('button', { name: 'Rules & Migration', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Migration & Existing Data' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('diagram follows live editor colors without replacing the SVG', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Relationships', exact: true }).click();
  const diagram = page.getByRole('img', { name: 'Model relationship diagram' });
  await expect(diagram.locator('svg text').filter({ hasText: 'Book' }).first()).toBeVisible();
  const svgId = await diagram.locator('svg').getAttribute('id');
  for (const palette of [
    { background: 'rgb(25, 30, 35)', foreground: 'rgb(226, 238, 230)' },
    { background: 'rgb(255, 255, 255)', foreground: 'rgb(15, 55, 90)' },
  ]) {
    await page.evaluate(colors => {
      document.body.style.setProperty('--vscode-editor-background', colors.background);
      document.body.style.setProperty('--vscode-editor-foreground', colors.foreground);
    }, palette);
    await expect.poll(() => diagram.evaluate(element => {
      const style = selector => getComputedStyle(element.querySelector(selector));
      return {
        background: getComputedStyle(element).backgroundColor,
        nodeFill: style('.node rect').fill,
        nodeStroke: style('.node rect').stroke,
        text: style('.node text').fill,
        line: style('.relationshipLine').stroke,
        marker: style('.marker').stroke,
        labelBackground: style('.edgeLabel .label rect').fill,
      };
    })).toEqual({
      background: palette.background, nodeFill: palette.background, nodeStroke: palette.foreground,
      text: palette.foreground, line: palette.foreground, marker: palette.foreground,
      labelBackground: palette.background,
    });
    await expect(diagram.locator('svg')).toHaveAttribute('id', svgId);
  }
});

test('proposal strings are rendered as text, not executable markup', async ({ page }) => {
  const title = '<img src=x onerror="window.reviewInjected=true">';
  await open(page, { ...proposal, title });
  expect(await page.evaluate(() => window.reviewInjected)).toBeUndefined();
  await expect(page.locator('h1 img')).toHaveCount(0);
});
