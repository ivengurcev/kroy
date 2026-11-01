export function createClientPageRegistry(pages) {
    return Object.fromEntries(
        pages
            .filter(({ record }) => record === undefined)
            .map(({ path, title, content, materials, materialSectionId }) => [path, {
                path, title, content,
                ...(materials ? { materials } : {}),
                ...(materialSectionId ? { materialSectionId } : {}),
            }]),
    );
}

export function serializePagePayload(page) {
    return JSON.stringify(page).replaceAll('<', '\\u003c');
}
