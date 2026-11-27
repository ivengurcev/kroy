import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureLegalDocumentBlock, reconcileLegalDocumentDraft } from './legalDocumentDraft.mjs';
import { firstDocumentBlock, isDocumentText, legalDocumentBlock } from '../../shared/legalDocuments.mjs';
import { toLexicalDocument } from '../ui/richTextState.mjs';

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

test('enabling legal purpose appends a valid block only if none exists; disable and cancel retain content', () => {
    const original = [{ id: 'hero', part: '@kroy/hero', props: {}, view: { name: '@kroy/hero', props: {} } }];
    let created = 0;
    const create = () => ({ id: `document-${++created}`, ...legalDocumentBlock(toLexicalDocument()) });
    const enabled = ensureLegalDocumentBlock(original, true, create);
    assert.equal(original.length, 1);
    assert.equal(enabled.length, 2);
    assert.equal(enabled[0], original[0]);
    assert.equal(isDocumentText(enabled[1].props.content), true);
    assert.equal(firstDocumentBlock(enabled), enabled[1]);
    const disabled = ensureLegalDocumentBlock(enabled, false, create);
    assert.equal(disabled, enabled);
    assert.equal(ensureLegalDocumentBlock(disabled, true, create), enabled);
    const multiple = [...enabled, create()];
    assert.equal(ensureLegalDocumentBlock(multiple, true, create), multiple);
    assert.equal(created, 2);
    const reordered = [multiple[2], original[0], multiple[1]];
    assert.equal(firstDocumentBlock(reordered), multiple[2]);
    assert.equal(ensureLegalDocumentBlock(original, false, create), original);
    // Cancellation restores the saved array and flag, not the auto-added block.
    const saved = { content: original, isLegalDocument: false };
    const cancelled = { ...saved };
    assert.equal(cancelled.content, original);
    assert.equal(cancelled.isLegalDocument, false);
});
