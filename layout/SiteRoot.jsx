import { useEffect, useState } from 'react';
import styles from '../styles/SiteTheme.module.css';

function getPaletteStyle(theme, palette) {
    if (!theme || !['light', 'dark'].includes(palette)) return undefined;
    return { ...theme[palette], colorScheme: palette };
}

export default function SiteRoot({ children, tokens, theme }) {
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

    return <div className={styles.theme} style={tokens ?? getPaletteStyle(theme, palette)}>{children}</div>;
}
