import { isValidPagePath, isValidPageRoutePattern, isValidRouteParameter, routePatternsOverlap, resolveDetailPath } from '../../api/pageFields.mjs';

export function createArticlePages(templates, articles) {
    if (!Array.isArray(templates) || !Array.isArray(articles)) {
        throw new TypeError('Templates and articles must be arrays');
    }

    return templates.flatMap((template) => {
        const suffix = `/:${template.route_param}`;
        if (
            !isValidRouteParameter(template.route_param)
            || !isValidPageRoutePattern(template.path)
            || !template.path.endsWith(suffix)
            || !Array.isArray(template.content)
        ) {
            throw new Error(`Invalid article detail template: ${template.path}`);
        }

        return articles.map((article) => {
            return {
                path: resolveDetailPath(template.path, template.route_param, article.slug),
                title: article.title,
                content: template.content,
                context: { params: { [template.route_param]: article.slug } },
                record: {
                    slug: article.slug,
                    title: article.title,
                    summary: article.summary,
                    content: article.content,
                    coverUrl: article.coverUrl ?? null,
                },
            };
        });
    });
}

export function assertArticlePathsAvailable(articlePages, reservedPaths = []) {
    const paths = [...reservedPaths];
    for (const page of articlePages) {
        if (!isValidPagePath(page.path) || paths.some((path) => routePatternsOverlap(page.path, path))) {
            throw new Error(`Article page path collision or invalid path: ${page.path}`);
        }
        paths.push(page.path);
    }
}
