export function buildPageTree(pages, showDeleted = false) {
    const root = { path: '', children: new Map(), pages: [] };
    for (const page of pages) {
        if (page.deleted_at && !showDeleted) continue;
        let node = root;
        const segments = page.path === '/' ? [''] : page.path.slice(1).split('/');
        for (const segment of segments) {
            const path = `${node.path}/${segment}`;
            if (!node.children.has(segment)) node.children.set(segment, { path, segment, pages: [], children: new Map() });
            node = node.children.get(segment);
        }
        node.pages.push(page);
    }
    function sorted(node) {
        return {
            ...node,
            pages: node.pages.sort((a, b) => Boolean(a.deleted_at) - Boolean(b.deleted_at) || a.id.localeCompare(b.id)),
            children: [...node.children.values()].sort((a, b) => a.segment < b.segment ? -1 : a.segment > b.segment ? 1 : 0).map(sorted),
        };
    }
    return sorted(root).children;
}

export function visiblePageRows(nodes, collapsed = new Set(), depth = 0) {
    return nodes.flatMap((node) => [
        { ...node, depth },
        ...(collapsed.has(node.path) ? [] : visiblePageRows(node.children, collapsed, depth + 1)),
    ]);
}

export function pageRedirects(page) {
    return page.deleted_at || page.type === 'detail' ? [] : [...new Set(page.redirects ?? [])]
        .filter((path) => path !== page.path).sort();
}
