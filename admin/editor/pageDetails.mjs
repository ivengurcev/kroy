export function toEditorPage(page) {
    return {
        id: page.id,
        title: page.title,
        ...(page.seo ? { seo: page.seo } : {}),
        ...(page.appearance ? { appearance: page.appearance } : {}),
        path: page.path,
        type: page.type ?? 'standard',
        ...(page.legalVersion !== undefined ? { isLegalDocument: Boolean(page.isLegalDocument), legalVersion: page.legalVersion } : {}),
        dataSource: page.dataSource ?? null,
        materialSectionId: page.materialSectionId ?? null,
        routeParam: page.routeParam ?? null,
        detailParentId: page.detailParentId ?? null,
    };
}
