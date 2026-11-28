import { isValidPagePath } from './pageFields.mjs';
import { normalizeHref } from './safeHref.mjs';

export const MENU_PART = '@kroy/menu';
export const MENU_HORIZONTAL_WIDGET = '@kroy/menu-horizontal';
export const PAGE_MENU_ITEM = Object.freeze({ type: 'anchors' });
export const PAGE_MENU_ANCHOR = 'pageMenuAnchor';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function supportsPageMenuAnchor(part) {
    return Boolean(part) && part !== MENU_PART && part !== '@kroy/footer';
}

export function isPageMenuAnchor(value) {
    return typeof value?.id === 'string' && uuid.test(value.id) && typeof value.enabled === 'boolean'
        && Object.keys(value).length === 2;
}

export function menuPages(pages) {
    return pages.filter((page) => page.id && !page.deleted_at && !page.deletedAt
        && page.type !== 'detail' && page.page_type !== 'detail' && isValidPagePath(page.path));
}

export function menuExternalHref(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value.trim()) ? normalizeHref(value.trim()) : '';
}

export function validMenuItems(items) {
    return Array.isArray(items) && items.filter((item) => item?.type === 'anchors').length === 1
        && items.every((item) => {
            switch (item?.type) {
                case 'anchors':
                    return Object.keys(item).length === 1;
                case 'page':
                    return Object.keys(item).length === 2 && typeof item.pageId === 'string' && uuid.test(item.pageId);
                case 'external':
                    return Object.keys(item).length === 3 && typeof item.label === 'string' && !!item.label.trim()
                        && !!menuExternalHref(item.url);
                default:
                    return false;
            }
        });
}

export function projectMenu(block, pagesById) {
    if (block.part !== MENU_PART) return block;
    const items = Array.isArray(block.props?.items) ? block.props.items : [PAGE_MENU_ITEM];
    const resolvedItems = items.flatMap((item) => {
        switch (item?.type) {
            case 'page': {
                const page = typeof item.pageId === 'string' && pagesById.get(item.pageId.toLowerCase());
                return page ? [{ type: 'page', href: page.path, label: page.title }] : [];
            }
            case 'external': {
                const href = menuExternalHref(item.url);
                const label = typeof item.label === 'string' && item.label.trim();
                return href && label ? [{ type: 'external', href, label }] : [];
            }
            case 'anchors':
                return [PAGE_MENU_ITEM];
            default:
                return [];
        }
    });
    return { ...block, props: { ...block.props, resolvedItems } };
}

export function pageMenuContext(content, titleForPart) {
    const anchors = [];
    const targets = new Map();
    const ids = new Set();
    for (const block of content) {
        const setting = block.props?.[PAGE_MENU_ANCHOR];
        if (!supportsPageMenuAnchor(block.part) || !isPageMenuAnchor(setting) || !setting.enabled) continue;
        const label = titleForPart(block.part);
        if (!label) continue;
        const id = `oysite-section-${setting.id.toLowerCase()}`;
        if (ids.has(id)) continue;
        ids.add(id);
        targets.set(block, id);
        anchors.push({ type: 'anchor', href: `#${id}`, label });
    }
    return { anchors, targets };
}

export function resolveMenuItems(resolvedItems, anchors = []) {
    return (resolvedItems ?? [PAGE_MENU_ITEM]).flatMap((item) => item.type === 'anchors' ? anchors : [item]);
}

export function isStickyMenu(block, anchors) {
    return block.part === MENU_PART && block.view?.name === MENU_HORIZONTAL_WIDGET
        && block.view.props?.sticky === true && resolveMenuItems(block.props.resolvedItems, anchors).length > 0;
}
