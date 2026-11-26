import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createElement, act } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

let CardCarousel;
let bundlePath;
let dom;
const geometry = { slots: 4, gap: 24, cardWidth: 342 };
const observers = [];

function card(key, text = `Card ${key}`) {
    return createElement('article', { key }, createElement('a', { href: `#${key}` }, text));
}

function setGeometry({ slots, gap = 24, width }) {
    geometry.slots = slots;
    geometry.gap = gap;
    geometry.cardWidth = (width - (slots - 1) * gap) / slots;
}

function resetObservers() {
    observers.length = 0;
}

class FakeResizeObserver {
    constructor(callback) {
        this.callback = callback;
        this.observed = null;
        observers.push(this);
    }

    observe(element) { this.observed = element; }

    disconnect() { this.observed = null; }
}

before(async () => {
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
    const { window } = dom;
    globalThis.window = window;
    globalThis.document = window.document;
    globalThis.navigator = window.navigator;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.Node = window.Node;
    globalThis.Event = window.Event;
    globalThis.MouseEvent = window.MouseEvent;
    globalThis.KeyboardEvent = window.KeyboardEvent;
    globalThis.getComputedStyle = () => ({
        getPropertyValue: (name) => (name === '--card-carousel-slots' ? String(geometry.slots) : ''),
        columnGap: `${geometry.gap}px`,
        gap: `${geometry.gap}px`,
    });
    window.getComputedStyle = globalThis.getComputedStyle;
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    const viewportWidth = () => geometry.cardWidth * geometry.slots + (geometry.slots - 1) * geometry.gap;
    Object.defineProperties(window.HTMLElement.prototype, {
        clientWidth: { get: () => viewportWidth() },
        scrollWidth: {
            get() {
                return Math.max(viewportWidth(), this.children.length * (geometry.cardWidth + geometry.gap) - geometry.gap);
            },
        },
    });
    window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
        const isCard = this.hasAttribute('data-card-carousel-item');
        const width = isCard ? geometry.cardWidth : viewportWidth();
        const index = isCard ? Array.prototype.indexOf.call(this.parentElement.children, this) : 0;
        const left = isCard ? index * (geometry.cardWidth + geometry.gap) - this.parentElement.scrollLeft : 0;
        return { left, right: left + width, width };
    };
    Object.defineProperty(window.Element.prototype, 'scrollLeft', {
        configurable: true,
        get() { return this.__scrollLeft ?? 0; },
        set(value) { this.__scrollLeft = value; },
    });
    window.Element.prototype.scrollTo = function scrollTo(options) {
        const left = typeof options === 'number' ? options : options.left;
        this.__scrollLeft = left;
        if (this.__autoSettle !== false) this.dispatchEvent(new window.Event('scrollend'));
    };
    window.ResizeObserver = FakeResizeObserver;
    globalThis.ResizeObserver = FakeResizeObserver;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
    globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);

    bundlePath = new URL(`.CardCarousel-${randomUUID()}.mjs`, import.meta.url);
    const result = await build({
        entryPoints: [new URL('./CardCarousel.jsx', import.meta.url).pathname],
        bundle: true,
        write: false,
        outfile: bundlePath.pathname,
        format: 'esm',
        platform: 'node',
        packages: 'external',
        jsx: 'automatic',
        loader: { '.module.css': 'local-css' },
    });
    await writeFile(bundlePath, result.outputFiles.find(({ path }) => path === bundlePath.pathname).contents);
    ({ default: CardCarousel } = await import(bundlePath.href));
});

after(async () => {
    if (bundlePath) await rm(bundlePath, { force: true });
    dom?.window.close();
});

async function mount(children, label = 'Материалы') {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(createElement(CardCarousel, { label }, children));
    });
    return { container, root };
}

async function click(element) {
    await act(async () => { element.click(); });
}

async function key(element, value) {
    await act(async () => {
        element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true }));
    });
}

test('a short list keeps the slot width, hides controls and applies no inert', async () => {
    setGeometry({ slots: 4, width: 1440 });
    resetObservers();
    const { container } = await mount([card('a'), card('b')]);
    const carousel = container.querySelector('[role="group"]');
    const viewport = container.querySelector('ul');
    const items = [...container.querySelectorAll('[data-card-carousel-item]')];
    assert.equal(carousel.dataset.count, '2');
    assert.equal(container.querySelectorAll('button').length, 0);
    assert.equal(container.querySelector('[aria-live]'), null);
    assert.equal(container.querySelector('p'), null);
    assert.equal(viewport.tabIndex, -1);
    assert.deepEqual(items.map((item) => item.hasAttribute('inert')), [false, false]);
    assert.equal(items[0].getBoundingClientRect().width, 342);
});

test('a long list exposes one-step controls, a live counter and inert off-window cards', async () => {
    setGeometry({ slots: 2, width: 768 });
    resetObservers();
    const children = Array.from({ length: 6 }, (_, index) => card(`k${index}`));
    const { container } = await mount(children);
    const viewport = container.querySelector('ul');
    const buttons = [...container.querySelectorAll('button')];
    assert.equal(buttons.length, 2);
    assert.equal(buttons[0].getAttribute('aria-disabled'), 'true');
    assert.equal(buttons[1].getAttribute('aria-disabled'), null);
    assert.equal(container.querySelector('[aria-live]').textContent, 'Карточки 1–2 из 6');
    assert.equal(viewport.tabIndex, 0);
    assert.equal(buttons[0].getAttribute('aria-controls'), viewport.id);
    assert.deepEqual([...container.querySelectorAll('[data-card-carousel-item]')].map((item) => item.hasAttribute('inert')),
        [false, false, true, true, true, true]);

    await click(buttons[1]);
    assert.equal(viewport.__scrollLeft, 396);
    assert.equal(container.querySelector('[aria-live]').textContent, 'Карточки 2–3 из 6');
    assert.deepEqual([...container.querySelectorAll('[data-card-carousel-item]')].map((item) => item.hasAttribute('inert')),
        [true, false, false, true, true, true]);

    await click(container.querySelectorAll('button')[0]);
    assert.equal(viewport.__scrollLeft, 0);
    assert.equal(container.querySelector('[aria-live]').textContent, 'Карточки 1–2 из 6');
});

test('rapid commands accumulate from the pending target and settle once', async () => {
    setGeometry({ slots: 2, width: 768 });
    resetObservers();
    const { container } = await mount(Array.from({ length: 7 }, (_, index) => card(`r${index}`)));
    const viewport = container.querySelector('ul');
    viewport.__autoSettle = false;
    const next = container.querySelectorAll('button')[1];
    await click(next);
    await click(next);
    assert.equal(viewport.__scrollLeft, 792);
    assert.equal(container.querySelector('[aria-live]').textContent, 'Карточки 1–2 из 7');
    await act(async () => {
        viewport.dispatchEvent(new dom.window.Event('scrollend'));
    });
    assert.equal(container.querySelector('[aria-live]').textContent, 'Карточки 3–4 из 7');
});

test('keyboard, Home and End move exactly one card and ignore card targets', async () => {
    setGeometry({ slots: 3, width: 984 });
    resetObservers();
    const { container } = await mount(Array.from({ length: 8 }, (_, index) => card(`t${index}`)));
    const viewport = container.querySelector('ul');
    viewport.__autoSettle = false;
    await key(viewport, 'ArrowRight');
    assert.equal(viewport.__scrollLeft, 336);
    await key(viewport, 'End');
    assert.equal(viewport.__scrollLeft, 336 * 5);
    await key(viewport, 'Home');
    assert.equal(viewport.__scrollLeft, 0);
    const link = viewport.querySelector('a');
    await act(async () => {
        link.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    assert.equal(viewport.__scrollLeft, 0);
});

test('resize preserves the anchor, clamps the end and returns focus to the viewport', async () => {
    setGeometry({ slots: 2, width: 768 });
    resetObservers();
    const { container } = await mount(Array.from({ length: 4 }, (_, index) => card(`z${index}`)));
    const viewport = container.querySelector('ul');
    await click(container.querySelectorAll('button')[1]);
    assert.equal(container.querySelector('[aria-live]').textContent, 'Карточки 2–3 из 4');
    const next = container.querySelectorAll('button')[1];
    next.focus();
    setGeometry({ slots: 4, width: 1440 });
    await act(async () => {
        observers.at(-1).callback([]);
        await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.equal(container.querySelectorAll('button').length, 0);
    assert.equal(viewport.tabIndex, -1);
    assert.equal(document.activeElement, viewport);
    assert.equal(viewport.__scrollLeft, 0);
    assert.equal(container.querySelector('[aria-live]'), null);
});

test('focus in an off-window card moves to the viewport before inert is applied', async () => {
    setGeometry({ slots: 2, width: 768 });
    resetObservers();
    const { container } = await mount(Array.from({ length: 6 }, (_, index) => card(`f${index}`)));
    const viewport = container.querySelector('ul');
    const link = viewport.querySelectorAll('a')[5];
    link.focus();
    assert.equal(document.activeElement, link);
    await click(container.querySelectorAll('button')[1]);
    assert.equal(document.activeElement, viewport);
    assert.equal(viewport.querySelectorAll('[data-card-carousel-item]')[5].hasAttribute('inert'), true);
});

test('React keys and DOM instances survive stepping and resizing', async () => {
    setGeometry({ slots: 2, width: 768 });
    resetObservers();
    const { container } = await mount(Array.from({ length: 5 }, (_, index) => card(`s${index}`)));
    const viewport = container.querySelector('ul');
    const articles = [...viewport.querySelectorAll('article')];
    await click(container.querySelectorAll('button')[1]);
    setGeometry({ slots: 3, width: 984 });
    await act(async () => {
        observers.at(-1).callback([]);
        await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.deepEqual([...viewport.querySelectorAll('article')], articles);
    assert.equal(viewport.__scrollLeft, 336);
});

test('mounting works without ResizeObserver and commands still measure the live layout', async () => {
    setGeometry({ slots: 2, width: 768 });
    const saved = globalThis.ResizeObserver;
    const savedWindow = dom.window.ResizeObserver;
    delete globalThis.ResizeObserver;
    delete dom.window.ResizeObserver;
    try {
        resetObservers();
        const { container } = await mount(Array.from({ length: 6 }, (_, index) => card(`n${index}`)));
        const viewport = container.querySelector('ul');
        assert.equal(container.querySelectorAll('button').length, 2);
        await click(container.querySelectorAll('button')[1]);
        assert.equal(viewport.__scrollLeft, 396);
        setGeometry({ slots: 4, width: 1440 });
        await act(async () => {
            dom.window.dispatchEvent(new dom.window.Event('resize'));
            await new Promise((resolve) => setTimeout(resolve, 40));
        });
        const resized = container.querySelector('ul');
        assert.equal(container.querySelector('[aria-live]').textContent, 'Карточки 2–5 из 6');
        assert.equal(resized.tabIndex, 0);
        assert.equal(container.querySelectorAll('button').length, 2);
    } finally {
        globalThis.ResizeObserver = saved;
        dom.window.ResizeObserver = savedWindow;
    }
});

test('list updates add and remove controls while preserving mounted cards', async () => {
    setGeometry({ slots: 2, width: 768 });
    resetObservers();
    const base = Array.from({ length: 2 }, (_, index) => card(`u${index}`));
    const { container, root } = await mount(base);
    const articles = [...container.querySelectorAll('article')];
    assert.equal(container.querySelectorAll('button').length, 0);
    await act(async () => {
        root.render(createElement(CardCarousel, { label: 'Материалы' }, [...base, card('u2'), card('u3'), card('u4'), card('u5')]));
    });
    assert.equal(container.querySelectorAll('button').length, 2);
    assert.equal(container.querySelector('[aria-live]').textContent, 'Карточки 1–2 из 6');
    assert.deepEqual([...container.querySelectorAll('article')].slice(0, 2), articles);
    await act(async () => {
        root.render(createElement(CardCarousel, { label: 'Материалы' }, base.slice(0, 2)));
    });
    assert.equal(container.querySelectorAll('button').length, 0);
    assert.equal(container.querySelector('[aria-live]'), null);
});

test('two carousels get distinct viewport ids and controls', async () => {
    setGeometry({ slots: 2, width: 768 });
    resetObservers();
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);
    const rootA = createRoot(first);
    const rootB = createRoot(second);
    const long = Array.from({ length: 5 }, (_, index) => card(`a${index}`));
    const other = Array.from({ length: 5 }, (_, index) => card(`b${index}`));
    await act(async () => {
        rootA.render(createElement(CardCarousel, { label: 'Материалы' }, long));
        rootB.render(createElement(CardCarousel, { label: 'Отзывы' }, other));
    });
    const viewports = [first.querySelector('ul'), second.querySelector('ul')];
    assert.notEqual(viewports[0].id, viewports[1].id);
    const buttons = [first.querySelectorAll('button')[1], second.querySelectorAll('button')[1]];
    await click(buttons[0]);
    assert.equal(viewports[0].__scrollLeft, 396);
    assert.equal(viewports[1].__scrollLeft ?? 0, 0);
});

test('removing the focused card moves focus to the viewport', async () => {
    setGeometry({ slots: 2, width: 768 });
    resetObservers();
    const initial = Array.from({ length: 5 }, (_, index) => card(`p${index}`));
    const { container, root } = await mount(initial);
    const link = container.querySelectorAll('[data-card-carousel-item]')[4].querySelector('a');
    link.focus();
    assert.equal(document.activeElement, link);
    await act(async () => {
        root.render(createElement(CardCarousel, { label: 'Материалы' }, initial.slice(0, 4)));
    });
    assert.equal(document.activeElement, container.querySelector('ul'));
    assert.equal(container.querySelectorAll('[data-card-carousel-item]').length, 4);
});

test('scroll fallback settles once after the position stops changing', async () => {
    setGeometry({ slots: 2, width: 768 });
    resetObservers();
    const { container } = await mount(Array.from({ length: 7 }, (_, index) => card(`o${index}`)));
    const viewport = container.querySelector('ul');
    viewport.__autoSettle = false;
    viewport.scrollLeft = 792;
    await act(async () => {
        viewport.dispatchEvent(new dom.window.Event('scroll'));
        await new Promise((resolve) => setTimeout(resolve, 350));
    });
    assert.equal(container.querySelector('[aria-live]').textContent, 'Карточки 3–4 из 7');
});

test('server markup hydrates without recoverable errors and enables controls afterwards', async () => {
    setGeometry({ slots: 3, width: 984 });
    resetObservers();
    const children = Array.from({ length: 7 }, (_, index) => card(`h${index}`));
    const element = createElement(CardCarousel, { label: 'Отзывы' }, children);
    const html = renderToString(element);
    assert.match(html, /data-count="5"/);
    assert.match(html, /Чтобы увидеть остальные карточки/);
    assert.doesNotMatch(html, /aria-label="Следующая карточка"/);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const recoverable = [];
    let root;
    await act(async () => {
        root = hydrateRoot(container, element, { onRecoverableError: (error) => recoverable.push(error) });
    });
    assert.deepEqual(recoverable, []);
    assert.equal(container.querySelectorAll('button').length, 2);
    assert.equal(container.querySelector('ul').__scrollLeft ?? 0, 0);
});
