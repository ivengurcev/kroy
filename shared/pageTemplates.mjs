import { validateContent } from './pageContent.mjs';

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
