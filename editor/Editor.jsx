
import { useEffect, useRef, useState } from 'react';

import { parts } from '../dist/kroy/parts.mjs';
import metadata from '../dist/kroy/parts.json';

import AdminShell from '../components/admin/AdminShell.jsx';
import { createPart } from './partModel.js';

export default function Editor() {
    const [content, setContent] = useState([]);
    const [page, setPage] = useState({ id: null, title: '', path: '' });
    const [loadStatus, setLoadStatus] = useState('loading');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [isDirty, setIsDirty] = useState(false);
    const [theme, setTheme] = useState();
    const [contacts, setContacts] = useState();
    const revision = useRef(0);

    useEffect(() => {
        const controller = new AbortController();
        const match = window.location.pathname.match(
            /^\/admin\/pages\/([^/]+)$/
        );
        const pageUrl = match
            ? `/api/pages/${encodeURIComponent(match[1])}`
            : '/api/pages?path=/';

        async function loadPage() {
            try {
                const response = await fetch(pageUrl, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Не удалось загрузить страницу: ${response.status}`);
                }

                const page = await response.json();

                const loadedContent = page.content.map(({ part, props }) =>
                    createPart(part, metadata[part]?.fields, props)
                );

                setContent(loadedContent);
                setPage({ id: page.id, title: page.title, path: page.path });
                if (page.path === '/' && window.location.pathname !== '/admin') {
                    window.history.replaceState({}, '', '/admin');
                }
                setIsDirty(false);
                setSaveStatus('success');
                revision.current = 0;
                setLoadStatus('success');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setLoadStatus('error');
                }
            }
        }

        loadPage();

        return () => controller.abort();
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        fetch('/api/site/preview', { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error('Не удалось загрузить тему сайта.');
                return response.json();
            })
            .then(({ theme: nextTheme, contacts: nextContacts }) => {
                setTheme(nextTheme);
                setContacts(nextContacts);
            })
            .catch((error) => {
                if (error.name !== 'AbortError') setTheme(undefined);
            });

        return () => controller.abort();
    }, []);

    const pageContent = content.map(({ part, props }) => ({ part, props }));

    function markDirty() {
        revision.current += 1;
        setIsDirty(true);
        setSaveStatus((current) => current === 'saving' ? current : 'idle');
    }

    async function savePage() {
        if (!page.id || !isDirty || saveStatus === 'saving') return;

        const savedContent = pageContent;
        const savedRevision = revision.current;
        setSaveStatus('saving');

        try {
            const response = await fetch(`/api/pages/${page.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: savedContent }),
            });

            if (!response.ok) {
                throw new Error(`Не удалось сохранить страницу: ${response.status}`);
            }

            if (revision.current === savedRevision) {
                setIsDirty(false);
                setSaveStatus('success');
            } else {
                setSaveStatus('idle');
            }
        } catch {
            setSaveStatus('error');
        }
    }

    function addPart(part, position) {
        const fields = metadata[part]?.fields ?? {};
        const newPart = createPart(part, fields);

        markDirty();
        setContent((previous) => {
            const insertionIndex = Math.max(0, Math.min(position, previous.length));

            return [
                ...previous.slice(0, insertionIndex),
                newPart,
                ...previous.slice(insertionIndex),
            ];
        });
    }

    function removePart(id) {
        if (!content.some((item) => item.id === id)) return;

        const nextContent = content.filter((item) => item.id !== id);

        markDirty();
        setContent(nextContent);
    }

    function movePart(id, direction) {
        const index = content.findIndex((item) => item.id === id);
        const target = index + direction;

        if (index === -1 || target < 0 || target >= content.length) return;

        const nextContent = [...content];

        [nextContent[index], nextContent[target]] = [
            nextContent[target],
            nextContent[index],
        ];

        markDirty();
        setContent(nextContent);
    }

    function updateProp(id, name, value) {
        markDirty();
        setContent((previous) =>
            previous.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        props: {
                            ...item.props,
                            [name]: value,
                        },
                    }
                    : item
            )
        );
    }

    function updatePageDetails(updatedPage) {
        setPage({
            id: updatedPage.id,
            title: updatedPage.title,
            path: updatedPage.path,
        });
    }

    return (
        <AdminShell
            page={page}
            content={content}
            metadata={metadata}
            parts={parts}
            loadStatus={loadStatus}
            saveStatus={saveStatus}
            isDirty={isDirty}
            theme={theme}
            contacts={contacts}
            onAddPart={addPart}
            onRemovePart={removePart}
            onMovePart={movePart}
            onPropChange={updateProp}
            onSave={savePage}
            onPageDetailsChange={updatePageDetails}
        />
    );
}
