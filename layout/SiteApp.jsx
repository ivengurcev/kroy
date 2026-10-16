import { useEffect, useRef, useState } from 'react';
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

function getPageDataUrl(pathname) {
    return pathname === '/'
        ? '/_kroy/pages/index.json'
        : `/_kroy/pages${pathname}/index.json`;
}

export default function SiteApp({ page: initialPage, parts }) {
    const [page, setPage] = useState(initialPage);
    const request = useRef();

    useEffect(() => {
        async function navigate(url, push) {
            request.current?.abort();
            const controller = new AbortController();
            request.current = controller;

            try {
                const response = await fetch(getPageDataUrl(url.pathname), {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Страница не найдена: ${url.pathname}`);
                }

                const nextPage = await response.json();

                if (
                    nextPage?.path !== url.pathname
                    || typeof nextPage.title !== 'string'
                    || !Array.isArray(nextPage.content)
                ) {
                    throw new Error(`Некорректные данные страницы: ${url.pathname}`);
                }

                if (request.current !== controller) return;

                setPage(nextPage);
                document.title = nextPage.title;

                if (push) {
                    history.pushState(null, '', url);
                }
            } catch (error) {
                if (error.name === 'AbortError') return;

                if (push) {
                    window.location.assign(url.href);
                } else {
                    window.location.reload();
                }
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
            void navigate(url, true);
        }

        function handlePopState() {
            void navigate(new URL(window.location.href), false);
        }

        document.addEventListener('click', handleClick);
        window.addEventListener('popstate', handlePopState);

        return () => {
            request.current?.abort();
            document.removeEventListener('click', handleClick);
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    return <Page content={page.content} parts={parts} />;
}
