import { useEffect, useRef } from 'react';
import { useWidgetSpacing } from '../../runtime/widgetDisplay.js';
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
        const element = nav.current;
        const region = element.closest('[data-menu-sticky-region]');
        if (!region) return undefined;
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
    const activeAnchor = data.some(({ type, href }) => type === 'anchor' && href === menu?.hash);

    function links(className, isMobile = false) {
        return <ul className={className}>
            {data.map(({ type, href, label }, index) => {
                const isPage = type === 'page';
                const isAnchor = type === 'anchor';
                const current = isAnchor && href === menu?.hash ? 'location'
                    : isPage && !activeAnchor && href === menu?.path ? 'page' : undefined;
                return <li key={`${type}-${href}-${index}`}>
                    <a href={isPage ? menu?.pageHref?.(href) ?? href : href}
                        aria-current={current}
                        data-native-navigation={type === 'external' || undefined}
                        data-site-menu-page={isPage || undefined}
                        onClick={(event) => {
                            if (isMobile) {
                                if (mobile.current.contains(document.activeElement)) toggle.current.focus({ preventScroll: true });
                                mobile.current.open = false;
                            }
                            if (isAnchor && menu?.onAnchorNavigate && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                                event.preventDefault();
                                menu.onAnchorNavigate(href);
                            }
                        }}>{label}</a>
                </li>;
            })}
        </ul>;
    }

    return <nav ref={nav} className={styles.menu} style={spacing} aria-label="Меню">
        <details className={styles.mobile} ref={mobile}>
            <summary className={styles.toggle} ref={toggle}>Меню</summary>
            {links(styles.mobileLinks, true)}
        </details>
        {links(styles.desktopLinks)}
    </nav>;
}
