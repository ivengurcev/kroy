import { firstDocumentBlock } from '../../shared/legalDocuments.mjs';

export function ensureLegalDocumentBlock(content, enabled, createDocument) {
    return enabled && !firstDocumentBlock(content) ? [...content, createDocument()] : content;
}

// A modal save changes the saved document; a local draft still belongs to its original revision.
export function reconcileLegalDocumentDraft(content, savedContent, draftVersion, nextContent, nextVersion) {
    return content === savedContent
        ? { content: nextContent, version: nextVersion }
        : { content, version: draftVersion };
}
