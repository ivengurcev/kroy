import { useEffect, useState } from 'react';

function scrollRoot(element) {
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (/^(auto|scroll|hidden|overlay)$/.test(getComputedStyle(parent).overflowY)
            && parent !== document.scrollingElement) return parent;
    }
    return null;
}

export default function useActiveMenuSection(nav, data, menu) {
    const [active, setActive] = useState(undefined);

    useEffect(() => {
        if (!nav.current || typeof IntersectionObserver === 'undefined') return;
        const bar = nav.current;
        const targets = [...new Set(data.filter(({ type }) => type === 'anchor').map(({ href }) => href))]
            .map((href) => document.getElementById(href.slice(1))).filter(Boolean);
        if (!targets.length) {
            setActive(null);
            return;
        }

        const root = scrollRoot(bar);
        const region = bar.closest('[data-menu-sticky-region]');
        const sticky = region?.firstElementChild;
        let viewportObserver;
        let boundaryObserver;
        let current;

        function observe() {
            viewportObserver?.disconnect();
            boundaryObserver?.disconnect();
            const height = root?.clientHeight ?? document.documentElement.clientHeight;
            const style = getComputedStyle(bar);
            const adminInset = parseFloat(style.getPropertyValue('--site-menu-sticky-offset')) || 0;
            const stickyInset = sticky ? (parseFloat(getComputedStyle(sticky).top) || 0) + sticky.offsetHeight : 0;
            const anchorGap = parseFloat(style.getPropertyValue('--menu-anchor-gap')) || 0;
            const inset = Math.max(0, Math.min(Math.max(adminInset, stickyInset) + anchorGap + 1, height - 1));
            const band = Math.min(8, height - inset);

            function update() {
                const top = root ? root.getBoundingClientRect().top + root.clientTop : 0;
                const start = top + inset;
                const end = top + height;
                const visible = targets.map((target) => ({ target, rect: target.getBoundingClientRect() }))
                    .filter(({ rect }) => rect.height > 0 && rect.bottom > start && rect.top < end);
                // Keep the current section while it still overlaps the narrow reading band.
                const atBoundary = visible.filter(({ rect }) => rect.top < start + band);
                const nearest = atBoundary.find(({ target }) => target === current) ?? atBoundary.at(-1) ?? visible[0];
                current = nearest?.target;
                setActive(current ? `#${current.id}` : null);
            }

            viewportObserver = new IntersectionObserver(update, { root, rootMargin: `-${inset}px 0px 0px 0px` });
            boundaryObserver = new IntersectionObserver(update, { root, rootMargin: `-${inset}px 0px -${height - inset - band}px 0px` });
            for (const target of targets) {
                viewportObserver.observe(target);
                boundaryObserver.observe(target);
            }
            update();
        }

        const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(observe);
        if (root) resize?.observe(root);
        if (sticky) resize?.observe(sticky);
        window.addEventListener('resize', observe);
        observe();
        return () => {
            resize?.disconnect();
            viewportObserver?.disconnect();
            boundaryObserver?.disconnect();
            window.removeEventListener('resize', observe);
        };
    }, [nav, data, menu]);

    return active === undefined ? menu?.hash : active;
}
