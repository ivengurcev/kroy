import { validateContent } from './pageContent.mjs';
import { availableFooterPages, projectHeader } from './footerSettings.mjs';

export const FOOTER_PART = '@kroy/footer';

export function resolvePageTemplate(page, defaultTemplateId, templates) {
    const main = templates.find(({ isMain }) => isMain);
    if (!main) throw new Error('Основной шаблон сайта не найден.');

    switch (page.templateMode ?? 'inherit') {
        case 'none':
            return null;
        case 'inherit':
        case 'template': {
            const id = page.templateMode === 'template' ? page.templateId : defaultTemplateId ?? main.id;
            const template = templates.find((candidate) => candidate.id === id);
            if (!template) throw new Error('Выбранный шаблон страницы не найден.');
            return template;
        }
        default:
            throw new Error('Неизвестный режим выбора шаблона страницы.');
    }
}

function hasValidSlot(content, slotIndex) {
    return Array.isArray(content) && Number.isInteger(slotIndex)
        && slotIndex >= 0 && slotIndex <= content.length;
}

export function splitTemplateContent({ content, slotIndex }) {
    if (!hasValidSlot(content, slotIndex)) throw new Error('Некорректная позиция содержимого страницы.');
    return { before: content.slice(0, slotIndex), after: content.slice(slotIndex) };
}

export function projectPageLayouts(pages, defaultId, templates, linkPages) {
    const eligible = availableFooterPages(linkPages);
    const project = (content) => content.map((block) => projectHeader(block, eligible));
    const layouts = [];
    const indexes = new Map();
    const rendered = pages.map(({ templateMode, templateId, ...page }) => {
        const template = resolvePageTemplate({ templateMode, templateId }, defaultId, templates);
        const result = { ...page, content: project(page.content) };
        if (!template) return result;
        const { before, after } = splitTemplateContent(template);
        if (!before.length && !after.length) return result;
        if (!indexes.has(template.id)) {
            indexes.set(template.id, layouts.length);
            layouts.push({ before: project(before), after: project(after) });
        }
        return { ...result, templateIndex: indexes.get(template.id) };
    });
    return { pages: rendered, templates: layouts };
}

export function validateDocumentContent(content, parts, widgets, options) {
    const errors = validateContent(content, parts, widgets, options);
    if (!Array.isArray(content)) return errors;

    for (const [index, block] of content.entries()) {
        if (block?.part === FOOTER_PART) {
            errors.push({
                path: `content[${index}].part`,
                code: 'global_footer',
                message: 'Глобальный футер нельзя добавлять в содержимое страницы или шаблона.',
            });
        }
    }
    return errors;
}

export function validateTemplateContent({ content, slotIndex }, parts, widgets, options) {
    const errors = validateDocumentContent(content, parts, widgets, options);
    if (Array.isArray(content) && !hasValidSlot(content, slotIndex)) {
        errors.push({
            path: 'slotIndex',
            code: 'invalid_slot',
            message: 'Укажите позицию содержимого страницы между блоками шаблона.',
        });
    }
    return errors;
}
