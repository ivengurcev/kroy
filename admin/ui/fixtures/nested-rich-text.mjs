// Synthetic regression for the reported shapes; no user-provided JSON was attached.
const text = (value, format = 0) => ({ type: 'text', version: 1, text: value, format, detail: 0, mode: 'normal', style: '' });
const element = (type, children, fields = {}) => ({ type, version: 1, direction: null, format: '', indent: 0, children, ...fields });
const link = (url, children) => element('link', children, { url, target: '_blank', rel: 'noopener noreferrer' });
const item = (children) => element('listitem', children, { value: 1 });
const list = (listType, children, start = 1) => element('list', children, { listType, tag: listType === 'number' ? 'ol' : 'ul', start });

export default {
    root: element('root', [
        element('paragraph', [
            text('До заголовка. '),
            element('heading', [text('Условия договора', 1 | 2 | 8)], { tag: 'h2' }),
            text(' После заголовка. ', 2),
            link('https://example.org/terms', [text('Ознакомиться', 8)]),
        ]),
        list('number', [
            item([
                element('paragraph', [text('Первый пункт', 1)]),
                list('bullet', [
                    item([text('Подпункт', 2), list('number', [item([link('/contacts', [text('Контакты', 1 | 8)])])], 4)]),
                ]),
            ]),
            list('bullet', [item([text('Список непосредственно внутри списка', 8)])]),
            item([text('Заключительный пункт')]),
        ], 3),
    ]),
};
