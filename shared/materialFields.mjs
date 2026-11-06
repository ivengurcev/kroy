export const SLUG_MESSAGE = 'Адрес может содержать только латинские буквы в нижнем регистре, цифры и дефисы';
export function isValidMaterialSlug(value) {
    return typeof value === 'string' && value.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function materialFieldErrors(value, { partial = false } = {}) {
    const errors = {};
    if (!value || typeof value !== 'object') return { title: 'Укажите название' };
    const check = (name) => !partial || Object.hasOwn(value, name);
    if (check('title') && (typeof value.title !== 'string' || !value.title.trim())) errors.title = 'Укажите название';
    else if (check('title') && value.title.length > 300) errors.title = 'Название должно быть не длиннее 300 символов';
    if (check('slug') && !isValidMaterialSlug(typeof value.slug === 'string' ? value.slug.trim() : value.slug)) errors.slug = SLUG_MESSAGE;
    if (check('sectionId') && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.sectionId || '')) errors.sectionId = 'Выберите раздел';
    if (check('summary') && value.summary != null && (typeof value.summary !== 'string' || value.summary.length > 2000)) errors.summary = 'Описание должно быть не длиннее 2000 символов';
    if (Object.hasOwn(value, 'status') && !['draft', 'published'].includes(value.status)) errors.status = 'Выберите статус материала';
    if (value.coverMediaId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.coverMediaId)) errors.coverMediaId = 'Загрузите изображение повторно';
    return errors;
}
