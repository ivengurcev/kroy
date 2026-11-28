import { useEffect, useState } from 'react';
import styles from '../styles/SiteTheme.module.css';
import PaymentResult from '../payments/PaymentResult.jsx';
import SeparatorContext from './separatorContext.js';

function getPaletteStyle(theme, palette) {
    if (!theme || !['light', 'dark'].includes(palette)) return undefined;
    return { ...theme[palette], colorScheme: palette };
}

export function SiteTheme({ children, tokens, theme, className, ...attributes }) {
    const [systemPalette, setSystemPalette] = useState('light');
    const mode = theme?.mode;
    const palette = mode === 'system' ? systemPalette : mode;

    useEffect(() => {
        if (mode !== 'system') return undefined;

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const update = () => setSystemPalette(media.matches ? 'dark' : 'light');
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, [mode]);

    const separator = theme?.separatorUrl ? { src: theme.separatorUrl, mimeType: theme.separatorMimeType } : null;
    return <SeparatorContext.Provider value={separator}><div {...attributes} className={className ? `${styles.theme} ${className}` : styles.theme} style={tokens ?? getPaletteStyle(theme, palette)}>{children}</div></SeparatorContext.Provider>;
}

export default function SiteRoot({ children, ...props }) {
    return <SiteTheme {...props}><PaymentResult />{children}</SiteTheme>;
}
