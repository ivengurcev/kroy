
import { useEffect, useState } from 'react';
import './editor.css';

import Page from '../layout/Page.jsx';
import { parts } from '../dist/kroy/parts.mjs';
import metadata from '../dist/kroy/parts.json';

import PartsPanel from './PartsPanel.jsx';
import { createPart } from './partModel.js';

export default function Editor() {
    const [content, setContent] = useState([]);
    const [pageId, setPageId] = useState(null);
    const [loadStatus, setLoadStatus] = useState('loading');
    const [saveStatus, setSaveStatus] = useState('idle');

    useEffect(() => {
        const controller = new AbortController();
        const match = window.location.pathname.match(
            /^\/admin\/pages\/([^/]+)\/edit$/
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

                setContent(page.content.map(({ part, props }) =>
                    createPart(part, metadata[part]?.fields, props)
                ));
                setPageId(page.id);
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

    const pageContent = content.map(({ part, props }) => ({ part, props }));

    async function savePage() {
        if (!pageId || saveStatus === 'saving') return;

        setSaveStatus('saving');

        try {
            const response = await fetch(`/api/pages/${pageId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: pageContent }),
            });

            if (!response.ok) {
                throw new Error(`Не удалось сохранить страницу: ${response.status}`);
            }

            setSaveStatus('success');
        } catch {
            setSaveStatus('error');
        }
    }

    function addPart(part) {
        const fields = metadata[part]?.fields ?? {};

        setSaveStatus('idle');
        setContent((previous) => [
            ...previous,
            createPart(part, fields),
        ]);
    }

    function removePart(id) {
        setSaveStatus('idle');
        setContent((previous) =>
            previous.filter((item) => item.id !== id)
        );
    }

    function movePart(id, direction) {
        setSaveStatus('idle');
        setContent((previous) => {
            const index = previous.findIndex((item) => item.id === id);
            const target = index + direction;

            if (
                index === -1 ||
                target < 0 ||
                target >= previous.length
            ) {
                return previous;
            }

            const next = [...previous];

            [next[index], next[target]] = [
                next[target],
                next[index],
            ];

            return next;
        });
    }

    function updateProp(id, name, value) {
        setSaveStatus('idle');
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

    if (loadStatus === 'loading') {
        return <main className="editor-status">Загрузка страницы…</main>;
    }

    if (loadStatus === 'error') {
        return (
            <main className="editor-status" role="alert">
                Не удалось загрузить страницу.
            </main>
        );
    }

    return (
        <main className="editor">
            <PartsPanel
                content={content}
                metadata={metadata}
                onAdd={addPart}
                onRemove={removePart}
                onMove={movePart}
                onPropChange={updateProp}
            />

            <div className="result">
                <div className="save-bar">
                    <button
                        type="button"
                        onClick={savePage}
                        disabled={!pageId || saveStatus === 'saving'}
                    >
                        {saveStatus === 'saving' ? 'Сохранение…' : 'Сохранить'}
                    </button>

                    <span className="save-status" aria-live="polite">
                        {saveStatus === 'success' && 'Сохранено'}
                        {saveStatus === 'error' && 'Не удалось сохранить страницу'}
                    </span>
                </div>

                <h2>Результат</h2>

                <Page content={content} parts={parts} />

                <h2>Данные страницы</h2>
                <pre>{JSON.stringify(pageContent, null, 2)}</pre>
            </div>
        </main>
    );
}
