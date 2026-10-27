import { useEffect, useState } from 'react';
import Page from './Page.jsx';
import SiteRoot from './SiteRoot.jsx';

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

export default function SiteApp({
    pages,
    path,
    parts,
    pathFromUrl = defaultPathFromUrl,
    urlForPath = defaultUrlForPath,
    notFound,
    tokens,
    theme,
    contacts,
}) {
    const [currentPath, setCurrentPath] = useState(path);
    const page = pages[currentPath];

    useEffect(() => setCurrentPath(path), [path]);

    useEffect(() => {
        function navigate(url, push) {
            const nextPath = normalizePathname(pathFromUrl(url));
            const nextPage = pages[nextPath];

            if (!nextPage && notFound === undefined) {
                window.location.assign(url.href);
                return;
            }

            setCurrentPath(nextPath);
            document.title = nextPage?.title ?? 'Страница не найдена';

            if (push) {
                history.pushState(null, '', urlForPath(nextPath, url));
            }
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
            ) {
                return;
            }

            const url = new URL(link.href);

            if (
                url.origin !== window.location.origin
                || url.hash
                || isReservedPath(url.pathname)
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
    }, [notFound, pages, pathFromUrl, urlForPath]);

    return (
        <SiteRoot tokens={tokens} theme={theme}>
            {page
                ? <Page key={page.path} content={page.content} parts={parts} contacts={contacts} />
                : notFound}
        </SiteRoot>
    );
}
