import { isValidPagePath } from './pageFields.mjs';
import { isSupportedLexicalDocument } from './richText.mjs';
export { isSupportedLexicalDocument as isDocumentText } from './richText.mjs';

export const LEGAL_DOCUMENT_PART = '@kroy/document';
export const LEGAL_CONTENT_ERROR = 'Добавьте хотя бы один блок «Правовой документ» с корректным форматированным текстом.';

export function isLegalPagePath(path) {
    return isValidPagePath(path) && !/^\/(?:auth|assets)(?:\/|$)/.test(path);
}

export function legalDocumentBlock(content, viewProps = {}) {
    return { part: LEGAL_DOCUMENT_PART, props: { content }, view: { name: LEGAL_DOCUMENT_PART, props: viewProps } };
}

export function isLegalDocumentContent(content) {
    const documents = Array.isArray(content) ? content.filter((item) => item?.part === LEGAL_DOCUMENT_PART) : [];
    return documents.length > 0 && documents.every((item) =>
        item.view?.name === LEGAL_DOCUMENT_PART && isSupportedLexicalDocument(item.props?.content));
}

export function firstDocumentBlock(content) {
    return content.find((item) => item?.part === LEGAL_DOCUMENT_PART);
}

export function updateFirstDocumentText(content, text) {
    const first = firstDocumentBlock(content);
    return content.map((item) => item === first ? { ...item, props: { ...item.props, content: text } } : item);
}
