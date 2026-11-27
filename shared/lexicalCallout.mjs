// Editor/server-only. The public renderer handles callout JSON without Lexical.
import { $applyNodeReplacement, ParagraphNode, getStaticNodeConfig } from 'lexical';

const paragraphImport = getStaticNodeConfig(ParagraphNode).ownNodeConfig.importDOM.p;

export class CalloutNode extends ParagraphNode {
    $config() {
        return this.config('callout', {
            extends: ParagraphNode,
            children: 'inline',
            importDOM: {
                p: (element) => {
                    if (element.getAttribute('data-oysite-callout') !== 'true') return null;
                    const converter = paragraphImport(element);
                    return { ...converter, priority: 2, conversion: (dom) => {
                        const converted = converter.conversion(dom);
                        const paragraph = converted.node;
                        return { ...converted, node: $createCalloutNode()
                            .setFormat(paragraph.getFormatType())
                            .setDirection(paragraph.getDirection())
                            .setIndent(paragraph.getIndent()) };
                    } };
                },
            },
        });
    }

    static importJSON(serialized) {
        return $createCalloutNode().updateFromJSON(serialized);
    }

    createDOM(config) {
        const element = super.createDOM(config);
        element.setAttribute('data-oysite-callout', 'true');
        const classes = (config.theme.callout ?? '').split(/\s+/).filter(Boolean);
        if (classes.length) element.classList.add(...classes);
        return element;
    }

    // Preserve the supported block when copying even a partial text fragment.
    extractWithChild() {
        return true;
    }
}

export function $createCalloutNode() {
    return $applyNodeReplacement(new CalloutNode());
}

export function $getTextBlock(node) {
    for (let current = node; current; current = current.getParent()) {
        if (['paragraph', 'callout', 'heading', 'listitem'].includes(current.getType())) return current;
    }
    return null;
}
