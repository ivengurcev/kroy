export function listItemSummary(item, fields = {}, index = 0) {
    const text = (value) => typeof value === 'string' && !/^(?:https?:\/\/|\/|data:)/i.test(value.trim())
        ? value.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
    const entries = Object.entries(fields).filter(([, field]) => !['list', 'image'].includes(field.type));
    const name = ['title', 'name', ...entries.map(([key]) => key)]
        .find((key) => fields[key]?.type !== 'image' && text(item?.[key]));
    const primary = name ? text(item[name]) : `Элемент №${index + 1}`;
    const extra = entries.find(([key, field]) => key !== name && !['title', 'name'].includes(key)
        && ['string', 'number'].includes(typeof item?.[key])
        && ['input', 'number'].includes(field.type) && text(String(item?.[key] ?? ''))
        && String(item[key]).length <= 40);
    return extra ? `${primary} · ${text(String(item[extra[0]]))}` : primary;
}

export function mergeListItem(current, draft, fields = {}) {
    return {
        ...current,
        ...Object.fromEntries(Object.entries(draft).filter(([name]) => fields[name]?.type !== 'list')),
    };
}

export function moveListItem(items, index, direction) {
    const target = index + direction;
    if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

export function updateListDraft(current, session, changes) {
    if (!current || current.session !== session) return current;
    return { ...current, draft: { ...current.draft, ...changes } };
}
