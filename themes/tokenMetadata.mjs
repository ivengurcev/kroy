const explicitMetadata = {
    '--site-color-bg': { label: 'Фон', type: 'color' },
    '--site-color-text': { label: 'Основной текст', type: 'color' },
    '--site-color-text-secondary': { label: 'Вторичный текст', type: 'color' },
    '--site-color-accent': { label: 'Акцент', type: 'color' },
    '--site-color-accent-hover': { label: 'Акцент при наведении', type: 'color' },
    '--site-color-border': { label: 'Граница', type: 'color' },
    '--site-color-surface': { label: 'Поверхность', type: 'color' },
    '--site-color-surface-soft': { label: 'Мягкая поверхность', type: 'color' },
    '--site-font-body': { label: 'Шрифт текста', type: 'font' },
    '--site-font-heading': { label: 'Шрифт заголовков', type: 'font' },
    '--site-font-size-base': { label: 'Размер текста', type: 'dimension', units: ['px', 'rem'] },
    '--site-line-height': { label: 'Межстрочный интервал', type: 'number', units: [''] },
    '--site-container-max': { label: 'Максимальная ширина', type: 'dimension', units: ['px', 'rem'] },
    '--site-page-gutter': { label: 'Боковой отступ', type: 'dimension', units: ['px', 'rem', 'vw'] },
    '--site-radius-sm': { label: 'Малое скругление', type: 'dimension', units: ['px', 'rem'] },
    '--site-radius-md': { label: 'Среднее скругление', type: 'dimension', units: ['px', 'rem'] },
    '--site-radius-lg': { label: 'Большое скругление', type: 'dimension', units: ['px', 'rem'] },
};

export function getTokenMetadata(token) {
    if (explicitMetadata[token]) return explicitMetadata[token];
    if (token.startsWith('--site-space-')) {
        return { label: `Отступ ${token.replace('--site-space-', '')}`, type: 'dimension', units: ['px', 'rem'] };
    }
    return { label: token, type: 'text' };
}

export function getAllTokenMetadata() {
    return { ...explicitMetadata };
}
