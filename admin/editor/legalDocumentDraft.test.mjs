import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileLegalDocumentDraft } from './legalDocumentDraft.mjs';

test('a modal save adopts the new revision only if the parent has no content draft', () => {
    const saved = [{ props: { content: 'Original' } }];
    const draft = [{ props: { content: 'Unsaved parent edits' } }];
    const next = [{ props: { content: 'Saved in the modal' } }];
    const footerDraft = { description: 'Unsaved footer description' };
    const initial = { content: draft, footer: footerDraft, version: '10' };
    const result = { ...initial, ...reconcileLegalDocumentDraft(initial.content, saved, initial.version, next, '11') };
    assert.equal(result.content, draft);
    assert.equal(result.version, '10');
    assert.equal(result.footer, footerDraft);
    assert.deepEqual(reconcileLegalDocumentDraft(saved, saved, '10', next, '11'), { content: next, version: '11' });
});
