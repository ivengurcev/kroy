export function createMaterialListData(materials, detailTemplate) {
    return {
        items: materials.filter(({ status }) => status === 'published')
            .map(({ slug, title, summary, coverUrl }) => ({ slug, title, summary, coverUrl: coverUrl ?? null, status: 'published' })),
        detailTemplate: detailTemplate ? { path: detailTemplate.path, routeParam: detailTemplate.routeParam } : null,
    };
}

export function attachMaterialLists(pages, materialsBySection, templates) {
    return pages.map((page) => ({
        ...page,
        ...(page.type === 'list' && page.dataSource === 'materials' ? { materialSectionId: page.materialSectionId } : {}),
        materials: Object.fromEntries(Object.entries(materialsBySection).map(([sectionId, sectionMaterials]) => [
            sectionId,
            createMaterialListData(sectionMaterials, templates.find((template) => template.materialSectionId === sectionId)),
        ])),
    }));
}
