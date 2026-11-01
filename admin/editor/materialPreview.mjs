import { createMaterialListData } from '../../site/runtime/materialListData.mjs';

export async function loadMaterialPreview(page, signal) {
    const [sectionsResponse, materialsResponse, pagesResponse] = await Promise.all([
        fetch('/api/site/material-sections', { signal }),
        fetch('/api/site/materials', { signal }),
        fetch('/api/pages', { signal }),
    ]);
    if (!sectionsResponse.ok || !materialsResponse.ok || !pagesResponse.ok) {
        throw new Error('Не удалось загрузить материалы для предпросмотра.');
    }
    const [sections, materials, pages] = await Promise.all([
        sectionsResponse.json(), materialsResponse.json(), pagesResponse.json(),
    ]);
    const published = materials.filter(({ status }) => status === 'published');
    const materialTemplates = pages.filter((candidate) => candidate.type === 'detail')
        .map((candidate) => ({ ...candidate, materialSectionId: pages.find(({ id }) => id === candidate.detailParentId)?.materialSectionId }));
    const materialsBySection = Object.fromEntries(sections.map((section) => [section.id, createMaterialListData(
        published.filter(({ sectionId }) => sectionId === section.id).map((material) => ({
            ...material, coverUrl: material.coverMediaId ? `/api/media/${material.coverMediaId}` : null,
        })),
        materialTemplates.find(({ materialSectionId }) => materialSectionId === section.id),
    )]));

    if (page.type === 'list' && page.dataSource === 'materials') {
        const selected = materialsBySection[page.materialSectionId] ?? { items: [], detailTemplate: null };
        return { status: selected.items.length ? 'success' : 'empty', record: null, materials: materialsBySection };
    }
    if (page.type !== 'detail') return { status: 'idle', record: null, materials: materialsBySection };

    const parentResponse = await fetch(`/api/pages/${encodeURIComponent(page.detailParentId)}`, { signal });
    if (!parentResponse.ok) throw new Error('Не удалось загрузить родительскую страницу.');
    const parent = await parentResponse.json();
    if (parent.dataSource !== 'materials') return { status: 'idle', record: null, materials: materialsBySection };
    const material = published.find(({ sectionId }) => sectionId === parent.materialSectionId);
    if (!material) return { status: 'empty', record: null, materials: materialsBySection };
    return {
        status: 'success', materials: materialsBySection,
        record: { ...material, coverUrl: material.coverMediaId ? `/api/media/${material.coverMediaId}` : null },
    };
}
