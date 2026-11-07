export function formStateLabel(dirty, status) {
    if (status === 'saving') return 'Сохранение...';
    if (status === 'error') return 'Ошибка сохранения';
    return dirty ? 'Есть несохранённые изменения' : 'Сохранено';
}

export function publicationStateLabel(publication) {
    if (['building', 'publishing'].includes(publication.status)) return 'Публикация...';
    if (publication.status === 'error') return 'Ошибка публикации';
    if (publication.hasChanges === true) return 'Есть неопубликованные изменения';
    if (publication.hasChanges === false) return publication.releaseId ? `Опубликован релиз ${publication.releaseId}` : 'Сайт опубликован';
    return 'Проверка публикации...';
}

export function createPublicationRequestTracker() {
    let version = 0;
    return { next: () => ++version, isCurrent: (request) => request === version };
}

export function publicationBlocked(isDirty, saveStatus) {
    return isDirty || saveStatus === 'saving';
}
