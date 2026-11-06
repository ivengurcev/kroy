import { isValidPagePath, isValidRouteParameter } from '../../shared/pageFields.mjs';

export function pageFieldErrors(body = {}) {
    const fields = {};
    if (Object.hasOwn(body || {}, 'title') && (typeof body.title !== 'string' || !body.title.trim())) fields.title = 'Укажите название';
    if (Object.hasOwn(body || {}, 'path') && !isValidPagePath(body.path)) fields.path = 'Укажите корректный путь: / и латинские буквы в нижнем регистре, цифры и дефисы';
    if (Object.hasOwn(body || {}, 'routeParam') && !isValidRouteParameter(body.routeParam)) fields.routeParam = 'Начните с латинской буквы; используйте буквы, цифры и подчёркивания';
    if (body?.type === 'list' && body.dataSource === 'materials' && !body.materialSectionId) fields.materialSectionId = 'Выберите раздел';
    return fields;
}

export function pageConflictFields(error) {
    return error?.constraint === 'pages_one_active_material_list_per_section'
        ? { materialSectionId: 'У этого раздела уже есть страница-список' }
        : { path: 'Такой адрес уже используется' };
}
