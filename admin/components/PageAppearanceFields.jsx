import { useEffect, useState } from 'react';
import AdminPanel from '../ui/AdminPanel.jsx';
import Button from '../ui/Button.jsx';
import { ThemeModeControl, ThemePicker, TokenTable } from './AppearanceControls.jsx';
import { resolveAppearanceSettings, appearanceEditorModel, setPageAppearanceToken, changePageAppearanceTheme, resolveAppearanceTheme } from '../../shared/pageAppearance.mjs';
import styles from '../pages/SitePage.module.css';

export default function PageAppearanceFields({ value, onChange, onPreviewChange }) {
    const [source, setSource] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/site/theme', { signal: controller.signal }).then(async (response) => {
            if (!response.ok) throw new Error('Не удалось загрузить оформление сайта.');
            return response.json();
        }).then(setSource).catch((error) => { if (error.name !== 'AbortError') setError(error.message); });
        return () => controller.abort();
    }, []);
    useEffect(() => {
        if (source?.theme) onPreviewChange?.(resolveAppearanceTheme(source.settings, value, source.themes, source.theme));
    }, [source, value, onPreviewChange]);
    if (error) return <p role="alert">{error}</p>;
    if (!source) return <p role="status">Загрузка оформления…</p>;
    const { settings, themes, metadata } = source;
    const effective = resolveAppearanceSettings(settings, value);
    const base = appearanceEditorModel(resolveAppearanceSettings(settings, { themeId: value.themeId, themeMode: value.themeMode }), themes);
    const ownTheme = value.themeId && value.themeId !== settings.themeId;
    const updateToken = (palette, token, next) => onChange(setPageAppearanceToken(value, base, palette, token, next));
    return <div className={styles.content}>
        <AdminPanel className={styles.panel}>
            <div className={styles.sectionHeading}>
                <p>Неизменённые параметры наследуются. Разделитель — общий для сайта.</p>
                <Button disabled={!Object.keys(value).length} onClick={() => onChange({})}>Как на сайте</Button>
            </div>
            <ThemePicker themes={themes} selectedId={value.themeId} inheritedId={settings.themeId}
                onChange={(themeId) => { if (themeId !== (value.themeId ?? null)) onChange(changePageAppearanceTheme(value, themeId)); }} />
            <ThemeModeControl value={value.themeMode} inherit onChange={(themeMode) => {
                    const next = { ...value };
                    if (themeMode) next.themeMode = themeMode;
                    else delete next.themeMode;
                    onChange(next);
                }} />
            {ownTheme && <p>Цвета — из выбранной темы. Шрифты, размеры и отступы наследуются от сайта; собственные настройки сохраняются при смене темы.</p>}
        </AdminPanel>
        <AdminPanel className={styles.tokensPanel} noPadding>
            <TokenTable theme={base} draft={value} metadata={metadata ?? {}}
                disabledPalette={effective.themeMode === 'light' ? 'dark' : effective.themeMode === 'dark' ? 'light' : null}
                resetLabel={ownTheme ? 'Вернуть значение выбранной темы' : 'Вернуть значение сайта'}
                onChange={updateToken} onReset={(palette, token) => updateToken(palette, token, undefined)} />
        </AdminPanel>
    </div>;
}
