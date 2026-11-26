import assert from 'node:assert/strict';
import test from 'node:test';
import {
    carouselGeometry,
    clampStart,
    counterLabel,
    maxStartFor,
    nextStart,
    normalizeSlots,
    offsetForStart,
    resolveAnchorIndex,
    startIndexForOffset,
    visibleRange,
} from './cardCarouselGeometry.mjs';

test('empty list has no geometry and no navigation range', () => {
    assert.deepEqual(carouselGeometry({ count: 0, slots: 4, width: 1440, gap: 24 }), {
        count: 0, slots: 4, cardWidth: 342, visible: 0, maxStart: 0, rowWidth: 0, freeSpace: 0,
    });
    assert.deepEqual(visibleRange(0, 4, 0), { start: 0, end: 0 });
    assert.equal(counterLabel(0, 4, 0), '');
});

test('one and two cards keep the four-slot width on a wide container', () => {
    const one = carouselGeometry({ count: 1, slots: 4, width: 1440, gap: 24 });
    const two = carouselGeometry({ count: 2, slots: 4, width: 1440, gap: 24 });
    assert.equal(one.cardWidth, 342);
    assert.equal(two.cardWidth, 342);
    assert.equal(one.visible, 1);
    assert.equal(two.visible, 2);
    assert.equal(one.maxStart, 0);
    assert.equal(two.maxStart, 0);
    assert.equal(one.freeSpace, 1098);
    assert.equal(two.freeSpace, 732);
    assert.equal(one.rowWidth, 342);
    assert.equal(two.rowWidth, 708);
});

test('a full window has no free space and N = K exposes no controls', () => {
    const exact = carouselGeometry({ count: 4, slots: 4, width: 1440, gap: 24 });
    const next = carouselGeometry({ count: 5, slots: 4, width: 1440, gap: 24 });
    assert.equal(exact.freeSpace, 0);
    assert.equal(exact.maxStart, 0);
    assert.equal(next.freeSpace, 0);
    assert.equal(next.maxStart, 1);
    assert.equal(offsetForStart(next.maxStart, next.cardWidth, 24), next.rowWidth - 1440);
});

test('single-slot and long lists clamp at both boundaries', () => {
    assert.equal(maxStartFor(2, 1), 1);
    assert.equal(maxStartFor(100, 4), 96);
    assert.equal(nextStart(0, 1, 1), 1);
    assert.equal(nextStart(1, 1, 1), 1);
    assert.equal(nextStart(0, -1, 96), 0);
    assert.equal(nextStart(96, 1, 96), 96);
    assert.equal(clampStart(500, 96), 96);
    assert.equal(clampStart(-4, 96), 0);
});

test('navigation advances by one card and returns without leaving the range', () => {
    const geometry = carouselGeometry({ count: 6, slots: 3, width: 984, gap: 24 });
    assert.equal(geometry.cardWidth, 312);
    assert.equal(geometry.maxStart, 3);
    let position = 1;
    position = nextStart(position, 1, geometry.maxStart);
    assert.equal(position, 2);
    position = nextStart(position, -1, geometry.maxStart);
    assert.equal(position, 1);
    assert.equal(nextStart(geometry.maxStart, 1, geometry.maxStart), 3);
    assert.equal(nextStart(0, -1, geometry.maxStart), 0);
});

test('rapid commands accumulate from the pending target', () => {
    const maxStart = 4;
    let pending = 1;
    pending = nextStart(pending, 1, maxStart);
    pending = nextStart(pending, 1, maxStart);
    assert.equal(pending, 3);
    assert.equal(nextStart(pending, 1, maxStart), 4);
    assert.equal(nextStart(4, 1, maxStart), 4);
});

test('resize from two to four slots at the end keeps the last window filled', () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const wide = maxStartFor(keys.length, 4);
    const narrow = maxStartFor(keys.length, 2);
    assert.equal(resolveAnchorIndex(keys, 'g', 6, narrow), 6);
    assert.equal(resolveAnchorIndex(keys, 'g', 6, wide), 4);
    assert.equal(resolveAnchorIndex(keys, 'a', 0, maxStartFor(keys.length, 1)), 0);
});

test('list reordering keeps the anchor key and falls back when it disappears', () => {
    const original = ['a', 'b', 'c', 'd', 'e'];
    const reordered = ['x', 'b', 'a', 'c', 'd', 'e'];
    assert.equal(resolveAnchorIndex(reordered, original[1], 1, 3), 1);
    assert.equal(resolveAnchorIndex(['b', 'c'], 'a', 3, 0), 0);
    assert.equal(resolveAnchorIndex(reordered, 'missing', 2, 4), 2);
    assert.equal(resolveAnchorIndex(reordered, 'missing', 99, 4), 4);
});

test('shrinking and emptying a list clamps the existing position', () => {
    assert.equal(clampStart(6, maxStartFor(3, 2)), 1);
    assert.equal(clampStart(1, maxStartFor(0, 2)), 0);
    assert.equal(clampStart(0, maxStartFor(1, 2)), 0);
});

test('offset positions select the nearest valid card, including fractional values', () => {
    const cardWidth = 300;
    const gap = 20;
    const maxStart = 5;
    assert.equal(startIndexForOffset(0, cardWidth, gap, maxStart), 0);
    assert.equal(startIndexForOffset(319, cardWidth, gap, maxStart), 1);
    assert.equal(startIndexForOffset(320, cardWidth, gap, maxStart), 1);
    assert.equal(startIndexForOffset(1600, cardWidth, gap, maxStart), 5);
    assert.equal(startIndexForOffset(9999, cardWidth, gap, maxStart), 5);
    assert.equal(startIndexForOffset(-120, cardWidth, gap, maxStart), 0);
    assert.equal(startIndexForOffset(2000, 0, 0, maxStart), 0);
    assert.equal(offsetForStart(5, cardWidth, gap), 1600);
});

test('slot values are normalized and counters describe the confirmed range', () => {
    assert.equal(normalizeSlots(undefined), 1);
    assert.equal(normalizeSlots('3'), 3);
    assert.equal(normalizeSlots(0), 1);
    assert.equal(normalizeSlots(9), 4);
    assert.deepEqual(visibleRange(4, 3, 12), { start: 4, end: 7 });
    assert.equal(counterLabel(0, 4, 12), 'Карточки 1–4 из 12');
    assert.equal(counterLabel(2, 1, 12), 'Карточка 3 из 12');
    assert.equal(counterLabel(8, 4, 12), 'Карточки 9–12 из 12');
    assert.equal(counterLabel(20, 4, 12), 'Карточки 9–12 из 12');
});
