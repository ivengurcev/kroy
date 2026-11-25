import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { MAX_MEDIA_SIZE } from './storage.mjs';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';
// No script execution or resource loading is enabled in this server-only DOM.
const { window } = new JSDOM('');
const purifier = createDOMPurify(window);
const parser = new window.DOMParser();
const serializer = new window.XMLSerializer();

const elements = [
    '#text', 'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
    'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'text', 'tspan', 'linearGradient', 'radialGradient', 'stop', 'mask', 'clipPath',
];
const attributes = [
    'xmlns', 'xmlns:xlink', 'id', 'viewBox', 'preserveAspectRatio',
    'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
    'd', 'points', 'transform', 'opacity', 'fill', 'fill-opacity', 'fill-rule',
    'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin',
    'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'vector-effect',
    'clip-path', 'clip-rule', 'mask', 'maskUnits', 'maskContentUnits',
    'gradientUnits', 'gradientTransform', 'spreadMethod', 'fx', 'fy', 'fr',
    'offset', 'stop-color', 'stop-opacity', 'href', 'xlink:href',
    'font-family', 'font-size', 'font-style', 'font-weight', 'text-anchor',
    'dominant-baseline', 'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust',
];
const drawableElements = new Set([
    'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'use',
]);
const referenceElements = new Set(['use', 'linearGradient', 'radialGradient']);
const colorAttributes = new Set(['fill', 'stroke', 'stop-color']);
// These expressions validate small attribute-value grammars, not XML or markup.
const identifier = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const localUrl = /^url\(\s*(['"]?)#([A-Za-z_][A-Za-z0-9_.:-]*)\1\s*\)$/;
const color = /^(?:[a-zA-Z]+|#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9.,%+\-\s/]+\))$/;

purifier.addHook('uponSanitizeAttribute', (node, data) => {
    const name = data.attrName;
    const value = data.attrValue.trim();
    const attribute = [...node.attributes].find((item) => item.name.toLowerCase() === name);
    if (attribute?.namespaceURI && !(
        (attribute.namespaceURI === XLINK_NAMESPACE && name === 'xlink:href')
        || (attribute.namespaceURI === 'http://www.w3.org/2000/xmlns/' && (name === 'xmlns' || name === 'xmlns:xlink'))
    )) {
        data.keepAttr = false;
        return;
    }
    if (name === 'xmlns' || name === 'xmlns:xlink') {
        data.keepAttr = value === (name === 'xmlns' ? SVG_NAMESPACE : XLINK_NAMESPACE);
    } else if (name === 'id') {
        data.keepAttr = identifier.test(value);
    } else if (name === 'href' || name === 'xlink:href') {
        data.keepAttr = referenceElements.has(node.localName)
            && value.startsWith('#') && identifier.test(value.slice(1));
    } else if (colorAttributes.has(name)) {
        data.keepAttr = color.test(value) || (name !== 'stop-color' && localUrl.test(value));
    } else if (name === 'mask' || name === 'clip-path') {
        data.keepAttr = value === 'none' || localUrl.test(value);
    }
});

function parseSvg(source) {
    const document = parser.parseFromString(source, 'image/svg+xml');
    const root = document.documentElement;
    if (
        document.doctype
        || document.getElementsByTagName('parsererror').length
        || root?.localName !== 'svg'
        || (root.namespaceURI !== SVG_NAMESPACE && root.namespaceURI !== null)
    ) throw new Error('Invalid image');
    return document;
}

export default function sanitizeSvg(bytes) {
    if (bytes.length <= 0 || bytes.length > MAX_MEDIA_SIZE) throw new Error('Invalid image');
    let document = parseSvg(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    // Common icon exports omit xmlns. Parse again to assign the SVG namespace
    // to their unprefixed elements before DOMPurify checks namespaces.
    if (document.documentElement.namespaceURI === null) {
        document.documentElement.setAttribute('xmlns', SVG_NAMESPACE);
        document = parseSvg(serializer.serializeToString(document.documentElement));
    }
    const root = document.documentElement;
    purifier.sanitize(root, {
        IN_PLACE: true,
        NAMESPACE: SVG_NAMESPACE,
        ALLOWED_NAMESPACES: [SVG_NAMESPACE],
        ALLOWED_TAGS: elements,
        ALLOWED_ATTR: attributes,
        ALLOW_ARIA_ATTR: false,
        ALLOW_DATA_ATTR: false,
        KEEP_CONTENT: false,
    });

    // Resolve only surviving fragment references, and prevent references from
    // escaping into another document even when the input used an XML base URI.
    const nodes = [root, ...root.querySelectorAll('*')];
    const ids = new Set(nodes.map((node) => node.getAttribute('id')).filter(Boolean));
    for (const node of nodes) {
        for (const attribute of [...node.attributes]) {
            const name = attribute.localName;
            const value = attribute.value.trim();
            const target = name === 'href' ? value.slice(1) : localUrl.exec(value)?.[2];
            if (target !== undefined && !ids.has(target)) node.removeAttributeNode(attribute);
        }
    }

    // A document stripped down to metadata/definitions is not an image.
    const hasGraphics = nodes.some((node) => {
        if (!drawableElements.has(node.localName)) return false;
        if (node.closest('defs, symbol, mask, clipPath')) return false;
        if (node.localName === 'use') return node.hasAttribute('href') || node.hasAttributeNS(XLINK_NAMESPACE, 'href');
        if (node.localName === 'text') return Boolean(node.textContent.trim());
        return true;
    });
    if (!hasGraphics) throw new Error('Invalid image');

    const output = Buffer.from(serializer.serializeToString(root));
    if (output.length <= 0 || output.length > MAX_MEDIA_SIZE) throw new Error('Invalid image');
    const verified = parseSvg(output.toString('utf8'));
    if (verified.documentElement.namespaceURI !== SVG_NAMESPACE) throw new Error('Invalid image');
    return output;
}
