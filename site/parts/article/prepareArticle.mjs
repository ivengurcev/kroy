/**
 * @kroy-title Статья
 * @kroy-category Контент
 * @kroy-contract article
 * @kroy-default-widget @kroy/article-content
 */
export default function prepareArticle({ record = null }) {
    if (!record) return null;
    return {
        slug: record.slug,
        title: record.title,
        summary: record.summary,
        content: record.content,
        coverUrl: record.coverUrl ?? null,
    };
}
