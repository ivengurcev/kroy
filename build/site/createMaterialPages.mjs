import { isValidPagePath, isValidPageRoutePattern, isValidRouteParameter, routePatternsOverlap, resolveDetailPath } from '../../shared/pageFields.mjs';

export function createMaterialPages(templates, materialsBySection) {
    if (!Array.isArray(templates) || !materialsBySection || typeof materialsBySection !== 'object') {
        throw new TypeError('Templates and materials by section are required');
    }
    return templates.flatMap((template) => {
        const suffix = `/:${template.route_param}`;
        if (!isValidRouteParameter(template.route_param) || !isValidPageRoutePattern(template.path)
            || !template.path.endsWith(suffix) || !Array.isArray(template.content)) {
            throw new Error(`Invalid material detail template: ${template.path}`);
        }
        return (materialsBySection[template.materialSectionId] ?? []).map((material) => ({
            path: resolveDetailPath(template.path, template.route_param, material.slug),
            title: material.title,
            dataSource: 'materials',
            content: template.content,
            context: { params: { [template.route_param]: material.slug } },
            record: {
                slug: material.slug,
                title: material.title,
                summary: material.summary,
                content: material.content,
                coverUrl: material.coverUrl ?? null,
            },
        }));
    });
}

export function assertMaterialPathsAvailable(materialPages, reservedPaths = []) {
    const paths = [...reservedPaths];
    for (const page of materialPages) {
        if (!isValidPagePath(page.path) || paths.some((path) => routePatternsOverlap(page.path, path))) {
            throw new Error(`Material page path collision or invalid path: ${page.path}`);
        }
        paths.push(page.path);
    }
}
