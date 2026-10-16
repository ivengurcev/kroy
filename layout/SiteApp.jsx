import { useEffect, useState } from 'react';
import Page from './Page.jsx';

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

export default function SiteApp({ pages, path, parts }) {
    const [page, setPage] = useState(() => pages[path]);

    useEffect(() => {
        function navigate(url, push) {
            const nextPage = pages[url.pathname];

            if (!nextPage) {
                window.location.assign(url.href);
                return;
            }

            setPage(nextPage);
            document.title = nextPage.title;

            if (push) {
                history.pushState(null, '', url);
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
    }, [pages]);

    return <Page key={page.path} content={page.content} parts={parts} />;
}
