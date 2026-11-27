const conflicts = new Set([
    'footer_conflict', 'template_conflict', 'selection_conflict',
    'default_template_changed', 'legal_document_conflict',
]);

export function isSaveConflict(error) {
    return Boolean(error && (error.status === 409 || conflicts.has(error.code)));
}

export function saveErrorMessage(error) {
    if (!error.status) return 'Не удалось подтвердить сохранение из-за ошибки связи. Изменения остались в редакторе. Повторите сохранение.';
    if (error.status >= 500) return `Не удалось сохранить: ошибка сервера (HTTP ${error.status}). Изменения остались в редакторе. Повторите попытку.`;
    return error.message;
}
