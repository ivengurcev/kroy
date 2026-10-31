export function createClientPageRegistry(pages) {
    return Object.fromEntries(
        pages
            .filter(({ record }) => record === undefined)
            .map(({ path, title, content, articles }) => [path, {
                path, title, content,
                ...(articles ? { articles } : {}),
            }]),
    );
}

export function serializePagePayload(page) {
    return JSON.stringify(page).replaceAll('<', '\\u003c');
}
