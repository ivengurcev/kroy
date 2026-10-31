export async function loadArticlePreview(page, signal) {
    if (page.type !== 'detail') return { status: 'idle', record: null };

    const parentResponse = await fetch(`/api/pages/${encodeURIComponent(page.detailParentId)}`, { signal });
    if (!parentResponse.ok) throw new Error('Не удалось загрузить родительскую страницу.');
    const parent = await parentResponse.json();
    if (parent.dataSource !== 'articles') return { status: 'idle', record: null };

    const response = await fetch('/api/site/articles', { signal });
    if (!response.ok) throw new Error('Не удалось загрузить статью для предпросмотра.');
    const articles = await response.json();
    const article = articles.find(({ status }) => status === 'published');
    if (!article) return { status: 'empty', record: null };

    return {
        status: 'success',
        record: {
            slug: article.slug,
            title: article.title,
            summary: article.summary,
            content: article.content,
            coverUrl: article.coverMediaId ? `/api/media/${article.coverMediaId}` : null,
        },
    };
}
