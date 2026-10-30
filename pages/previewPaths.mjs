import { routePatternsOverlap } from '../api/pageFields.mjs';

export function isDetailTemplatePath(path, templates = []) {
    return templates.some(({ path: templatePath }) =>
        routePatternsOverlap(path, templatePath)
    );
}
