const MAX_SLOTS = 4;

export function normalizeSlots(value) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number) || number < 1) return 1;
    return Math.min(MAX_SLOTS, number);
}

export function clampStart(index, maxStart) {
    const limit = Math.max(0, Math.floor(Number(maxStart) || 0));
    const value = Number.isFinite(Number(index)) ? Math.round(Number(index)) : 0;
    return Math.min(limit, Math.max(0, value));
}

export function cardWidthFor(width, slots, gap) {
    const count = normalizeSlots(slots);
    const available = Math.max(0, Number(width) || 0);
    const space = Math.max(0, Number(gap) || 0);
    return Math.max(0, (available - (count - 1) * space) / count);
}

export function offsetForStart(index, cardWidth, gap) {
    const start = Math.max(0, Math.round(Number(index) || 0));
    const step = Math.max(0, Number(cardWidth) || 0) + Math.max(0, Number(gap) || 0);
    return start * step;
}

export function startIndexForOffset(offset, cardWidth, gap, maxStart) {
    const step = Math.max(0, Number(cardWidth) || 0) + Math.max(0, Number(gap) || 0);
    if (!step) return 0;
    return clampStart((Number(offset) || 0) / step, maxStart);
}

export function resolveAnchorIndex(keys, anchorKey, fallbackIndex, maxStart) {
    const list = Array.isArray(keys) ? keys : [];
    const found = anchorKey == null ? -1 : list.indexOf(anchorKey);
    return clampStart(found >= 0 ? found : fallbackIndex, maxStart);
}

export function visibleCount(count, slots) {
    return Math.min(Math.max(0, Math.floor(Number(count) || 0)), normalizeSlots(slots));
}

export function maxStartFor(count, slots) {
    return Math.max(0, Math.floor(Number(count) || 0) - normalizeSlots(slots));
}

export function carouselGeometry({ count, slots, width, gap }) {
    const total = Math.max(0, Math.floor(Number(count) || 0));
    const available = normalizeSlots(slots);
    const cardWidth = cardWidthFor(width, available, gap);
    const visible = visibleCount(total, available);
    const maxStart = maxStartFor(total, available);
    const rowWidth = total > 0 ? total * cardWidth + (total - 1) * Math.max(0, Number(gap) || 0) : 0;
    const freeSpace = total > 0 ? Math.max(0, (Number(width) || 0) - rowWidth) : 0;
    return { count: total, slots: available, cardWidth, visible, maxStart, rowWidth, freeSpace };
}

export function nextStart(current, delta, maxStart) {
    return clampStart((Number(current) || 0) + (Number(delta) || 0), maxStart);
}

export function visibleRange(index, slots, count) {
    const start = clampStart(index, maxStartFor(count, slots));
    return { start, end: start + visibleCount(count, slots) };
}

export function counterLabel(index, slots, count) {
    const total = Math.max(0, Math.floor(Number(count) || 0));
    const range = visibleRange(index, slots, total);
    if (!total || !range.end) return '';
    if (range.end - range.start === 1) return `Карточка ${range.start + 1} из ${total}`;
    return `Карточки ${range.start + 1}–${range.end} из ${total}`;
}
