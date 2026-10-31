export function createClientPageRegistry(pages) {
    return Object.fromEntries(
        pages
            .filter(({ record }) => record === undefined)
            .map(({ path, title, content }) => [path, { path, title, content }]),
    );
}

export function serializePagePayload(page) {
    return JSON.stringify(page).replaceAll('<', '\\u003c');
}
