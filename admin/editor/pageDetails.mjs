export function toEditorPage(page) {
    return {
        id: page.id,
        title: page.title,
        ...(page.seo ? { seo: page.seo } : {}),
        path: page.path,
        type: page.type ?? 'standard',
        dataSource: page.dataSource ?? null,
        materialSectionId: page.materialSectionId ?? null,
        routeParam: page.routeParam ?? null,
        detailParentId: page.detailParentId ?? null,
    };
}
