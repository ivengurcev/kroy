import { metaTags } from '../../shared/seo.mjs';

export default function updatePageMeta(meta, document) {
    document.title = meta.title;
    for (const node of document.head.querySelectorAll('[data-kroy-seo]')) node.remove();
    if (meta.canonical) {
        const link = document.createElement('link');
        link.setAttribute('data-kroy-seo', '');
        link.setAttribute('rel', 'canonical');
        link.setAttribute('href', meta.canonical);
        document.head.appendChild(link);
    }
    for (const [attribute, key, value] of metaTags(meta)) {
        const node = document.createElement('meta');
        node.setAttribute('data-kroy-seo', '');
        node.setAttribute(attribute, key);
        node.setAttribute('content', value);
        document.head.appendChild(node);
    }
}
