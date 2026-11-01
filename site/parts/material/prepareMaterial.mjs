/**
 * @kroy-title Материал
 * @kroy-category Контент
 * @kroy-contract material
 * @kroy-default-widget @kroy/material-content
 */
export default function prepareMaterial({ record = null }) {
    if (!record) return null;
    return {
        slug: record.slug,
        title: record.title,
        summary: record.summary,
        content: record.content,
        coverUrl: record.coverUrl ?? null,
    };
}
