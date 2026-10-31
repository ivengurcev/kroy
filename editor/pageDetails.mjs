export function toEditorPage(page) {
    return {
        id: page.id,
        title: page.title,
        path: page.path,
        type: page.type ?? 'standard',
        dataSource: page.dataSource ?? null,
        routeParam: page.routeParam ?? null,
        detailParentId: page.detailParentId ?? null,
    };
}
