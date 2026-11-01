import { resolveDetailPath } from '../../../shared/pageFields.mjs';

/**
 * @kroy-title Список материалов
 * @kroy-category Контент
 * @kroy-contract materials-list
 * @kroy-default-widget @kroy/material-cards
 * @param {string} props.sectionId
 * @kroy sectionId widget=material-section label=Раздел
 */
export default function prepareMaterialList({ props, materials, materialSectionId }) {
    const sectionId = materialSectionId || props.sectionId;
    const section = sectionId ? materials?.[sectionId] : null;
    const template = section?.detailTemplate;
    return (section?.items ?? []).filter(({ status }) => status === 'published')
        .map(({ slug, title, summary, coverUrl }) => ({
            slug, title, summary, coverUrl,
            href: template ? resolveDetailPath(template.path, template.routeParam, slug) : null,
        }));
}
