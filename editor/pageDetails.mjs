export function toEditorPage(page) {
    return {
        id: page.id,
        title: page.title,
        path: page.path,
        type: page.type ?? 'standard',
        routeParam: page.routeParam ?? null,
    };
}
