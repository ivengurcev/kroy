import { isValidPagePath, isValidRouteParameter } from '../../shared/pageFields.mjs';
import { SLUG_MESSAGE, isValidMaterialSlug } from '../../shared/materialFields.mjs';

export function fieldValidationMessage(field) {
    const value = field.value?.trim() || '';
    if (field.required && !value) {
        if (['title', 'name'].includes(field.name)) return 'Укажите название';
        if (field.name === 'sectionId' || field.name === 'materialSectionId') return 'Выберите раздел';
        return 'Заполните это поле';
    }
    if (field.name === 'slug' && !isValidMaterialSlug(value)) return SLUG_MESSAGE;
    if (field.name === 'path' && !field.disabled && !isValidPagePath(value)) return 'Укажите путь, начиная с /: латинские буквы в нижнем регистре, цифры и дефисы. Служебные адреса недоступны.';
    if (field.name === 'routeParam' && !isValidRouteParameter(value)) return 'Начните с латинской буквы; используйте буквы, цифры и подчёркивания';
    if (field.validity?.typeMismatch && field.type === 'email') return 'Укажите корректный email';
    if (field.validity?.typeMismatch && field.type === 'url') return 'Укажите корректную HTTPS-ссылку';
    if (field.validity?.patternMismatch) return field.dataset?.formatMessage || SLUG_MESSAGE;
    if (field.validity?.rangeUnderflow || field.validity?.rangeOverflow) return `Укажите значение от ${field.min || '−∞'} до ${field.max || '∞'}`;
    if (field.validity?.badInput) return 'Укажите число';
    if (field.validity?.tooLong) return `Не более ${field.maxLength} символов`;
    return '';
}

export function showFieldErrors(form, fields) {
    form?.dispatchEvent(new CustomEvent('kroy:field-errors', { detail: fields }));
}

// Only structured, known field errors are exposed. Raw server exceptions are never UI text.
export async function formResponseError(response, form, fallback = 'Не удалось сохранить. Повторите попытку.') {
    const result = await response.json().catch(() => ({}));
    if (result.fields && typeof result.fields === 'object' && response.status < 500) showFieldErrors(form, result.fields);
    return fallback;
}
