import { resolveDetailPath } from '../../../api/pageFields.mjs';

/**
 * @kroy-title Список статей
 * @kroy-category Контент
 * @kroy-contract articles-list
 * @kroy-default-widget @kroy/article-cards
 */
export default function prepareArticleList({ articles }) {
    const template = articles?.detailTemplate;
    return (articles?.items ?? []).filter(({ status }) => status === 'published')
        .map(({ slug, title, summary, coverUrl }) => ({
            slug, title, summary, coverUrl,
            href: template ? resolveDetailPath(template.path, template.routeParam, slug) : null,
        }));
}
