export function createArticleListData(articles, detailTemplate) {
    return {
        items: articles.filter(({ status }) => status === 'published')
            .map(({ slug, title, summary, coverUrl }) => ({ slug, title, summary, coverUrl: coverUrl ?? null, status: 'published' })),
        detailTemplate: detailTemplate ? { path: detailTemplate.path, routeParam: detailTemplate.routeParam } : null,
    };
}

export function attachArticleLists(pages, articles, templates) {
    return pages.map((page) => page.type === 'list' && page.dataSource === 'articles'
        ? {
            ...page,
            articles: createArticleListData(articles, templates.find((template) => template.detailParentId === page.id)),
        }
        : page);
}
