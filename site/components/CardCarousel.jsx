import { Children, isValidElement, useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import styles from './CardCarousel.module.css';
import {
    clampStart,
    counterLabel,
    maxStartFor,
    normalizeSlots,
    resolveAnchorIndex,
    startIndexForOffset,
    visibleCount,
} from './cardCarouselGeometry.mjs';

const HINT = 'Чтобы увидеть остальные карточки, прокрутите список вбок или перейдите в него клавишей Tab и используйте стрелки.';

function nextFrame(callback) {
    if (typeof requestAnimationFrame === 'function') {
        return { id: requestAnimationFrame(callback), timeout: false };
    }
    return { id: setTimeout(callback, 0), timeout: true };
}

function cancelFrame(handle) {
    if (!handle) return;
    if (handle.timeout) clearTimeout(handle.id);
    else if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle.id);
}

function readMetrics(viewport) {
    const width = viewport.getBoundingClientRect().width;
    if (!width) return null;
    return { width, slots: normalizeSlots(getComputedStyle(viewport).getPropertyValue('--card-carousel-slots')) };
}

function positionOf(viewport, index) {
    const left = viewport.getBoundingClientRect().left;
    return Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth,
        viewport.scrollLeft + viewport.children[index].getBoundingClientRect().left - left));
}

function nearestStart(viewport, limit) {
    if (!limit) return 0;
    const left = viewport.scrollLeft;
    const step = positionOf(viewport, limit) / limit;
    return startIndexForOffset(left, step, 0, limit);
}

export default function CardCarousel({ label = 'Карточки', children }) {
    const items = Children.toArray(children).filter(isValidElement);
    return items.length ? <Carousel label={label || 'Карточки'} items={items} /> : null;
}

function Carousel({ label, items }) {
    const count = items.length;
    const keys = items.map((item) => String(item.key));
    const signature = JSON.stringify(keys);
    const baseId = useId();
    const viewportId = `${baseId}-viewport`;

    const [state, setState] = useState({ slots: 1, index: 0, ready: false });
    const stateRef = useRef(state);
    const latestRef = useRef({ count, keys });
    const viewportRef = useRef(null);
    const toolbarRef = useRef(null);
    const pendingRef = useRef(null);
    const anchorKeyRef = useRef(null);
    const overflowRef = useRef(false);
    const reducedRef = useRef(false);
    const layoutBusyRef = useRef(false);
    const observedWidthRef = useRef(0);
    const measuredWidthRef = useRef(0);
    const touchingRef = useRef(false);
    const mountedRef = useRef(false);
    const alignFrameRef = useRef(null);
    const settleTimerRef = useRef(0);
    const settleFrameRef = useRef(null);
    const snapFrameRef = useRef(null);
    const snapStyleRef = useRef(null);
    const focusTrackerRef = useRef(null);

    stateRef.current = state;
    latestRef.current = { count, keys };

    function commit(index, metrics) {
        const { count: total, keys: currentKeys } = latestRef.current;
        const limit = maxStartFor(total, metrics.slots);
        const next = { slots: metrics.slots, index: clampStart(index, limit), ready: true };
        const overflow = total > next.slots;
        const viewport = viewportRef.current;

        const active = document.activeElement;
        const focusedItem = active?.closest('[data-card-carousel-item]');
        const items = viewport.children;
        const itemIndex = focusedItem?.parentElement === viewport ? Array.prototype.indexOf.call(items, focusedItem) : -1;
        const visible = visibleCount(total, metrics.slots);
        if ((!overflow && toolbarRef.current?.contains(active))
            || (itemIndex >= 0 && (itemIndex < next.index || itemIndex >= next.index + visible))) {
            viewport.focus({ preventScroll: true });
        }
        overflowRef.current = overflow;
        measuredWidthRef.current = metrics.width;
        pendingRef.current = null;
        anchorKeyRef.current = currentKeys[next.index] ?? null;

        const previous = stateRef.current;
        stateRef.current = next;
        if (previous.ready !== next.ready || previous.slots !== next.slots || previous.index !== next.index) {
            setState(next);
        }
    }

    function setInstantPosition(viewport, left, force = false) {
        if (!force && Math.abs(viewport.scrollLeft - left) <= 1) return;
        cancelFrame(snapFrameRef.current);
        if (snapStyleRef.current !== null) {
            viewport.style.scrollSnapType = snapStyleRef.current;
            snapStyleRef.current = null;
        }
        snapStyleRef.current = viewport.style.scrollSnapType;
        viewport.style.scrollSnapType = 'none';
        viewport.scrollLeft = left;
        snapFrameRef.current = nextFrame(() => {
            snapFrameRef.current = null;
            viewport.style.scrollSnapType = snapStyleRef.current ?? '';
            snapStyleRef.current = null;
        });
    }

    function align(mode) {
        const viewport = viewportRef.current;
        layoutBusyRef.current = false;
        const metrics = viewport && readMetrics(viewport);
        if (!metrics) return;
        const { count: total, keys: currentKeys } = latestRef.current;
        const limit = maxStartFor(total, metrics.slots);
        const index = mode === 'initial'
            ? nearestStart(viewport, limit)
            : resolveAnchorIndex(currentKeys, anchorKeyRef.current, stateRef.current.index, limit);
        setInstantPosition(viewport, positionOf(viewport, index), pendingRef.current !== null);
        commit(index, metrics);
    }

    function settle() {
        settleFrameRef.current = null;
        if (layoutBusyRef.current || touchingRef.current) return;
        const viewport = viewportRef.current;
        if (!viewport) return;
        const metrics = readMetrics(viewport);
        if (!metrics) return;
        const { count: total } = latestRef.current;
        if (!total) return;
        if (metrics.width !== measuredWidthRef.current || metrics.slots !== stateRef.current.slots) {
            align(stateRef.current.ready ? 'anchor' : 'initial');
            return;
        }
        const index = nearestStart(viewport, maxStartFor(total, metrics.slots));
        setInstantPosition(viewport, positionOf(viewport, index));
        commit(index, metrics);
    }

    function scheduleSettle() {
        window.clearTimeout(settleTimerRef.current);
        cancelFrame(settleFrameRef.current);
        settleFrameRef.current = null;
        settleTimerRef.current = window.setTimeout(() => {
            const viewport = viewportRef.current;
            if (!viewport) return;
            const check = (lastLeft, stableFrames) => {
                if (!viewportRef.current) return;
                const left = viewport.scrollLeft;
                if (Math.abs(left - lastLeft) < 0.5) {
                    if (stableFrames >= 1) {
                        settle();
                        return;
                    }
                    settleFrameRef.current = nextFrame(() => check(left, stableFrames + 1));
                    return;
                }
                settleFrameRef.current = nextFrame(() => check(left, 0));
            };
            check(viewport.scrollLeft, 0);
        }, 140);
    }

    function refreshMetrics() {
        const viewport = viewportRef.current;
        if (!viewport) return null;
        const metrics = readMetrics(viewport);
        if (!metrics) return null;
        const { count: total } = latestRef.current;
        const limit = maxStartFor(total, metrics.slots);
        if (metrics.width !== measuredWidthRef.current || stateRef.current.slots !== metrics.slots) {
            align(stateRef.current.ready ? 'anchor' : 'initial');
        }
        return { viewport, maxStart: limit };
    }

    function scrollToStart(viewport, index) {
        const left = positionOf(viewport, index);
        window.clearTimeout(settleTimerRef.current);
        cancelFrame(settleFrameRef.current);
        settleFrameRef.current = null;
        if (Math.abs(viewport.scrollLeft - left) <= 1) {
            setInstantPosition(viewport, left, true);
            commit(index, readMetrics(viewport));
            return;
        }
        const behavior = reducedRef.current ? 'auto' : 'smooth';
        if (typeof viewport.scrollTo === 'function') viewport.scrollTo({ left, behavior });
        else viewport.scrollLeft = left;
    }

    function moveBy(delta) {
        const context = refreshMetrics();
        if (!context) return;
        const base = pendingRef.current ?? stateRef.current.index;
        const next = clampStart(base + delta, context.maxStart);
        if (next === base) return;
        pendingRef.current = next;
        scrollToStart(context.viewport, next);
    }

    function moveTo(index) {
        const context = refreshMetrics();
        if (!context) return;
        const next = clampStart(index, context.maxStart);
        const base = pendingRef.current ?? stateRef.current.index;
        if (next === base) return;
        pendingRef.current = next;
        scrollToStart(context.viewport, next);
    }

    function handleKeyDown(event) {
        const viewport = viewportRef.current;
        if (!viewport || event.target !== viewport) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (!overflowRef.current) return;
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            moveBy(1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            moveBy(-1);
        } else if (event.key === 'Home') {
            event.preventDefault();
            moveTo(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            moveTo(latestRef.current.count);
        }
    }

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => { reducedRef.current = media.matches; };
        update();
        media.addEventListener?.('change', update);
        return () => media.removeEventListener?.('change', update);
    }, []);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return undefined;
        if (!mountedRef.current) {
            mountedRef.current = true;
            align('initial');
        } else {
            align('anchor');
        }
        observedWidthRef.current = measuredWidthRef.current;
        anchorKeyRef.current = anchorKeyRef.current ?? latestRef.current.keys[stateRef.current.index] ?? null;

        const onScroll = () => scheduleSettle();
        const onScrollEnd = () => {
            window.clearTimeout(settleTimerRef.current);
            cancelFrame(settleFrameRef.current);
            settleFrameRef.current = null;
            settle();
        };
        const onGesture = () => { pendingRef.current = null; };
        const onTouchStart = () => {
            touchingRef.current = true;
            onGesture();
        };
        const onTouchEnd = (event) => {
            if (event.touches.length) return;
            touchingRef.current = false;
            scheduleSettle();
        };
        const onWindowResize = () => {
            layoutBusyRef.current = true;
            cancelFrame(alignFrameRef.current);
            alignFrameRef.current = nextFrame(() => align('anchor'));
        };
        const onObserverResize = (entries) => {
            const width = entries?.[0]?.contentRect?.width;
            if (Number.isFinite(width)) {
                if (width === observedWidthRef.current) return;
                observedWidthRef.current = width;
            }
            onWindowResize();
        };

        viewport.addEventListener('scroll', onScroll, { passive: true });
        viewport.addEventListener('scrollend', onScrollEnd);
        viewport.addEventListener('pointerdown', onGesture, { passive: true });
        viewport.addEventListener('touchstart', onTouchStart, { passive: true });
        viewport.addEventListener('touchend', onTouchEnd, { passive: true });
        viewport.addEventListener('touchcancel', onTouchEnd, { passive: true });
        viewport.addEventListener('wheel', onGesture, { passive: true });

        let observer = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(onObserverResize);
            observer.observe(viewport);
        } else if (typeof window !== 'undefined') {
            window.addEventListener('resize', onWindowResize);
        }

        const focused = focusTrackerRef.current;
        if (focused && !focused.isConnected && document.activeElement === document.body) {
            viewport.focus({ preventScroll: true });
        }
        return () => {
            viewport.removeEventListener('scroll', onScroll);
            viewport.removeEventListener('scrollend', onScrollEnd);
            viewport.removeEventListener('pointerdown', onGesture);
            viewport.removeEventListener('touchstart', onTouchStart);
            viewport.removeEventListener('touchend', onTouchEnd);
            viewport.removeEventListener('touchcancel', onTouchEnd);
            viewport.removeEventListener('wheel', onGesture);
            observer?.disconnect();
            window.removeEventListener('resize', onWindowResize);
            window.clearTimeout(settleTimerRef.current);
            cancelFrame(settleFrameRef.current);
            cancelFrame(alignFrameRef.current);
            cancelFrame(snapFrameRef.current);
            if (snapStyleRef.current !== null) {
                viewport.style.scrollSnapType = snapStyleRef.current;
                snapStyleRef.current = null;
            }
            settleFrameRef.current = null;
            alignFrameRef.current = null;
            snapFrameRef.current = null;
        };
    }, [signature]);

    const overflow = state.ready && count > state.slots;
    const limit = maxStartFor(count, state.slots);
    const visible = visibleCount(count, state.slots);
    const atStart = state.index <= 0;
    const atEnd = state.index >= limit;
    const countAttribute = String(Math.min(count, 5));
    const viewportTabIndex = state.ready && !overflow ? -1 : 0;

    return <div className={styles.carousel} role="group" aria-label={label} data-count={countAttribute}
        onFocusCapture={(event) => { focusTrackerRef.current = event.target; }}
        onBlurCapture={(event) => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) focusTrackerRef.current = null;
        }}>
        {state.ready && overflow && <div className={styles.toolbar} ref={toolbarRef}>
            <p className={styles.counter} aria-live="polite" aria-atomic="true">{counterLabel(state.index, state.slots, count)}</p>
            <div className={styles.buttons}>
                <button className={styles.arrow} type="button" onClick={() => { if (!atStart) moveBy(-1); }}
                    aria-label="Предыдущая карточка" aria-controls={viewportId}
                    aria-disabled={atStart ? 'true' : undefined}>
                    <Icon name="chevron-left" />
                </button>
                <button className={styles.arrow} type="button" onClick={() => { if (!atEnd) moveBy(1); }}
                    aria-label="Следующая карточка" aria-controls={viewportId}
                    aria-disabled={atEnd ? 'true' : undefined}>
                    <Icon name="chevron-right" />
                </button>
            </div>
        </div>}
        {!state.ready && <p className={styles.hint}>{HINT}</p>}
        <ul className={styles.viewport} id={viewportId} ref={viewportRef}
            tabIndex={viewportTabIndex} role="list" aria-label={label} onKeyDown={handleKeyDown}>
            {items.map((item, index) => {
                const hidden = overflow && (index < state.index || index >= state.index + visible);
                return <li className={styles.item} data-card-carousel-item="" key={item.key}
                    inert={hidden ? true : undefined}>
                    {item}
                </li>;
            })}
        </ul>
    </div>;
}
