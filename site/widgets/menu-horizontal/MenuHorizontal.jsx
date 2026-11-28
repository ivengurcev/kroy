import { useEffect, useRef } from 'react';
import { useWidgetSpacing } from '../../runtime/widgetDisplay.js';
import useActiveMenuSection from './useActiveMenuSection.js';
import styles from './menuHorizontal.module.css';

/**
 * @kroy-title Горизонтальное меню
 * @kroy-contract menu
 * @param {object} props
 * @param {boolean} [props.sticky=false] - Закреплять при прокрутке
 * @kroy sticky widget=switch
 */
export default function MenuHorizontal({ data, options = {}, context }) {
    const menu = context.pageMenu;
    const nav = useRef(null);
    const mobile = useRef(null);
    const toggle = useRef(null);
    const spacing = useWidgetSpacing();
    const section = useActiveMenuSection(nav, data, menu);

    useEffect(() => {
        if (!data.length) return undefined;
        const details = mobile.current;
        function dismissOutside(event) {
            if (details.open && !details.contains(event.target)) details.open = false;
        }
        function dismissOnEscape(event) {
            if (event.key !== 'Escape' || !details.open || event.defaultPrevented || !toggle.current.getClientRects().length) return;
            details.open = false;
            if (details.contains(document.activeElement)) {
                event.preventDefault();
                toggle.current.focus();
            }
        }
        document.addEventListener('pointerdown', dismissOutside);
        document.addEventListener('keydown', dismissOnEscape);
        return () => {
            document.removeEventListener('pointerdown', dismissOutside);
            document.removeEventListener('keydown', dismissOnEscape);
        };
    }, [data.length]);

    useEffect(() => {
        if (!options.sticky || !nav.current) return undefined;
        const element = nav.current.closest('[data-page-menu-sticky]');
        if (!element) return undefined;
        const region = element.parentElement;
        const update = () => region.style.setProperty('--site-menu-height', `${element.offsetHeight}px`);
        update();
        if (typeof ResizeObserver === 'undefined') return () => region.style.removeProperty('--site-menu-height');
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => {
            observer.disconnect();
            region.style.removeProperty('--site-menu-height');
        };
    }, [options.sticky, data.length]);

    if (!data.length) return null;
    const activeAnchor = data.some(({ type, href }) => type === 'anchor' && href === section);

    function links(className, isMobile = false) {
        return <ul className={className}>
            {data.map(({ type, href, label }, index) => {
                const isPage = type === 'page';
                const isAnchor = type === 'anchor';
                const current = isAnchor && href === section ? 'location'
                    : isPage && !activeAnchor && href === menu?.path ? 'page' : undefined;
                return <li key={`${type}-${href}-${index}`}>
                    <a href={isPage ? menu?.pageHref?.(href) ?? href : href}
                        aria-current={current}
                        data-native-navigation={type === 'external' || undefined}
                        data-site-menu-page={isPage || undefined}
                        onClick={isMobile ? (event) => {
                            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                            if (mobile.current.contains(document.activeElement)) toggle.current.focus({ preventScroll: true });
                            mobile.current.open = false;
                        } : undefined}><span>{label}</span></a>
                </li>;
            })}
        </ul>;
    }

    return <nav ref={nav} className={styles.menu} style={spacing} aria-label="Меню">
        <details className={styles.mobile} ref={mobile}>
            <summary className={styles.toggle} ref={toggle} aria-label="Меню">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
                    <path d="M3 6h18M3 12h18M3 18h18" />
                </svg>
            </summary>
            {links(styles.mobileLinks, true)}
        </details>
        {links(styles.desktopLinks)}
    </nav>;
}
