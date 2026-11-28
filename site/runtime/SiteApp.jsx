import { useEffect, useState } from 'react';
import Page from './Page.jsx';
import SiteRoot, { SiteTheme } from './SiteRoot.jsx';
import OysiteBranding from './OysiteBranding.jsx';
import { footerBlock } from '../../shared/footerSettings.mjs';
import { isStickyMenu, pageMenuContext } from '../../shared/pageMenu.mjs';
import updatePageMeta from './updatePageMeta.mjs';
import menuStyles from './pageMenu.module.css';

const RESERVED_PATHS = [
    '/_kroy',
    '/admin',
    '/api',
    '/assets',
    '/public',
    '/static',
    '/uploads',
];

function isReservedPath(pathname) {
    return RESERVED_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`)
    );
}

export function normalizePathname(pathname) {
    return pathname.length > 1 && pathname.endsWith('/')
        ? pathname.slice(0, -1)
        : pathname;
}

function defaultPathFromUrl(url) {
    return normalizePathname(url.pathname);
}

function defaultUrlForPath(path, url) {
    return url ?? path;
}

function renderPageFlow(groups, sources, anchorTargets, notFound, path) {
    const flow = [];
    let region;
    for (const { name, content, theme, tokens } of groups) {
        const writeChunk = (start, end, sticky = false) => {
            const key = `${name}-${start}${sticky ? '-sticky' : ''}`;
            const Theme = name === 'page' && start === 0 && !sticky ? SiteRoot : SiteTheme;
            const blocks = content?.slice(start, end);
            (region ?? flow).push(
                <Theme key={key} tokens={tokens} theme={theme}
                    className={sticky ? menuStyles.stickyMenu : undefined}
                    data-menu-continuation={start > 0 || undefined}
                    data-menu-continues={end < content?.length || undefined}>
                    {blocks ? <Page key={path} content={blocks} anchorTargets={anchorTargets} {...sources} /> : notFound}
                </Theme>
            );
        };
        let start = 0;
        content?.forEach((block, index) => {
            if (!isStickyMenu(block, sources.context.pageMenu.anchors)) return;
            if (start < index || (name === 'page' && start === 0)) writeChunk(start, index);
            // The next sticky menu ends this region so the menus cannot overlap.
            region = [];
            flow.push(<div key={`${name}-region-${index}`} className={menuStyles.stickyRegion} data-menu-sticky-region>{region}</div>);
            writeChunk(index, index + 1, true);
            start = index + 1;
        });
        if (start < content?.length || (name === 'page' && start === 0)) writeChunk(start, content?.length);
    }
    return flow;
}

export default function SiteApp({
    pages,
    path,
    initialPage,
    parts,
    partTitles = {},
    widgets,
    pathFromUrl = defaultPathFromUrl,
    urlForPath = defaultUrlForPath,
    notFound,
    tokens,
    theme,
    contacts,
    footer,
    templates = [],
    siteName = footer?.siteName,
    catalog,
    reviews,
}) {
    const [currentPath, setCurrentPath] = useState(path);
    const [menuHash, setMenuHash] = useState('');
    const page = initialPage?.path === currentPath ? initialPage : pages[currentPath];

    useEffect(() => setCurrentPath(path), [path]);

    useEffect(() => {
        const syncHash = () => setMenuHash(window.location.hash);
        syncHash();
        window.addEventListener('hashchange', syncHash);
        return () => window.removeEventListener('hashchange', syncHash);
    }, []);

    useEffect(() => {
        const hash = window.location.hash;
        if (hash.startsWith('#oysite-section-')) {
            document.getElementById(hash.slice(1))?.scrollIntoView();
        }
    }, [currentPath]);

    useEffect(() => {
        if (page?.meta) updatePageMeta(page.meta, document);
    }, [page]);

    useEffect(() => {
        function navigate(url, push) {
            const nextPath = normalizePathname(pathFromUrl(url));
            const nextPage = initialPage?.path === nextPath ? initialPage : pages[nextPath];

            if (!nextPage && notFound === undefined) {
                window.location.assign(url.href);
                return;
            }

            setCurrentPath(nextPath);
            if (!nextPage?.meta) document.title = nextPage?.title ?? 'Страница не найдена';

            if (push) {
                history.pushState(null, '', urlForPath(nextPath, url));
            }
            setMenuHash(window.location.hash);
        }

        function handleClick(event) {
            if (
                event.defaultPrevented
                || event.button !== 0
                || event.metaKey
                || event.ctrlKey
                || event.shiftKey
                || event.altKey
                || !(event.target instanceof Element)
            ) {
                return;
            }

            const link = event.target.closest('a[href]');

            if (
                !link
                || (link.target && link.target !== '_self')
                || link.hasAttribute('download')
                || link.hasAttribute('data-native-navigation')
            ) {
                return;
            }

            const url = new URL(link.href);
            const adaptedMenuLink = link.hasAttribute('data-site-menu-page')
                && urlForPath !== defaultUrlForPath
                && urlForPath(pathFromUrl(url)) === `${url.pathname}${url.search}`;

            if (
                url.origin !== window.location.origin
                || url.hash
                || (isReservedPath(url.pathname) && !adaptedMenuLink)
            ) {
                return;
            }

            event.preventDefault();
            navigate(url, true);
        }

        function handlePopState() {
            navigate(new URL(window.location.href), false);
        }

        document.addEventListener('click', handleClick);
        window.addEventListener('popstate', handlePopState);

        return () => {
            document.removeEventListener('click', handleClick);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [initialPage, notFound, pages, pathFromUrl, urlForPath]);

    const template = templates[page?.templateIndex];
    const { anchors, targets } = pageMenuContext(
        [...(template?.before ?? []), ...(page?.content ?? []), ...(template?.after ?? [])],
        (part) => Object.hasOwn(parts, part) ? partTitles[part] : undefined,
    );
    const pageMenu = { anchors, path: currentPath, hash: menuHash, pageHref: urlForPath };
    const sources = { parts, widgets, contacts, catalog, reviews, materials: page?.materials,
        materialSectionId: page?.materialSectionId, context: { params: {}, siteName, ...page?.context, pageMenu }, record: page?.record };
    const groups = [
        { name: 'before', content: template?.before, theme, tokens },
        { name: 'page', content: page?.content, theme: page?.theme ? { ...theme, ...page.theme } : theme, tokens: page?.theme ? undefined : tokens },
        { name: 'after', content: template?.after, theme, tokens },
    ];

    return (
        <>
        {renderPageFlow(groups, sources, targets, notFound, currentPath)}
        {footer && <SiteTheme tokens={tokens} theme={theme}>
            <Page content={[footerBlock(footer)]} parts={parts} widgets={widgets} contacts={contacts} />
        </SiteTheme>}
        {!footer && <OysiteBranding />}
        </>
    );
}
