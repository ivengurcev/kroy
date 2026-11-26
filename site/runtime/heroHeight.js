export function heroHeightMode(options = {}) {
    return ['compact', 'spacious'].includes(options.heightMode) ? options.heightMode : 'normal';
}

export function heroHeightStyle(options = {}) {
    // Loaded documents receive heightMode=normal from metadata too. Keep the
    // historical lower bound in that mode, not only when heightMode is absent.
    return heroHeightMode(options) === 'normal'
        && typeof options.minHeight === 'number'
        && Number.isFinite(options.minHeight)
        && options.minHeight >= 0
        ? { '--hero-min-height': `${options.minHeight}px` }
        : {};
}
