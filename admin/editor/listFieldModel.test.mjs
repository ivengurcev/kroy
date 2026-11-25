import assert from 'node:assert/strict';
import test from 'node:test';
import { listItemSummary, mergeListItem, moveListItem, updateListDraft } from './listFieldModel.mjs';
import { toLexicalDocument } from '../ui/richTextState.mjs';

const fields = {
    title: { type: 'input' },
    items: { type: 'list', fields: { name: { type: 'input' }, price: { type: 'input' } } },
    notes: { type: 'list', fields: { text: { type: 'textarea' } } },
};

test('editing a parent preserves both child lists and adjacent objects', () => {
    const items = [{ name: 'Первая', price: '3000' }, { name: 'Вторая' }, { name: 'Третья' }];
    const parent = { title: 'Категория', items, notes: [{ text: 'Заметка' }] };
    const draft = structuredClone(parent);
    draft.title = 'Новое название';
    draft.items = [];
    const next = mergeListItem(parent, draft, fields);
    assert.equal(parent.title, 'Категория');
    assert.equal(next.title, 'Новое название');
    assert.equal(next.items, items);
    assert.equal(next.notes, parent.notes);
    const changed = mergeListItem(items[0], { name: 'Изменено', price: '4000' }, fields.items.fields);
    assert.equal(items[0].name, 'Первая');
    assert.deepEqual(changed, { name: 'Изменено', price: '4000' });
});

test('moving within a list preserves all child references and never mutates the source', () => {
    const first = { title: 'Первая', items: [{ name: 'А' }] };
    const second = { title: 'Вторая', items: [{ name: 'Б' }, { name: 'В' }] };
    const source = [first, second];
    const moved = moveListItem(source, 0, 1);
    assert.deepEqual(source, [first, second]);
    assert.equal(moved[0], second);
    assert.equal(moved[1].items, first.items);
    assert.equal(moveListItem(source, 0, -1), source);
    assert.equal(moveListItem(source, 1, 1), source);
    assert.equal(moveListItem(source, -1, 1), source);
    const children = moveListItem(second.items, 1, -1);
    assert.equal(children[0], second.items[1]);
    assert.equal(first.items[0].name, 'А');
});

test('summaries prefer names, include short prices, and omit images, lists and long descriptions', () => {
    const schema = { icon: { type: 'image' }, name: { type: 'input' }, price: { type: 'input' }, description: { type: 'textarea' }, items: { type: 'list' } };
    assert.equal(listItemSummary({ name: 'УЗИ', price: '2500 ₽', icon: '/api/media/id', description: 'Описание'.repeat(50), items: [{ name: 'Вложенный' }] }, schema), 'УЗИ · 2500 ₽');
    assert.equal(listItemSummary({ icon: '/api/media/id', items: ['Данные'] }, schema, 2), 'Элемент №3');
    assert.equal(listItemSummary({ description: 'Текст\nописания' }, schema), 'Текст описания');
    assert.equal(listItemSummary({ title: 'А'.repeat(200) }, fields).length, 100);
    assert.equal(listItemSummary({ name: 'https://example.com' }, schema), 'Элемент №1');
});

test('late image uploads cannot change a closed or newly opened draft', () => {
    const oldSession = Symbol();
    const nextSession = Symbol();
    const current = { session: nextSession, draft: { title: 'Другой элемент', icon: '' } };
    const upload = { icon: { src: '/api/media/example', mimeType: 'image/svg+xml' } };
    assert.equal(updateListDraft(null, oldSession, upload), null);
    assert.equal(updateListDraft(current, oldSession, upload), current);
    assert.equal(current.draft.icon, '');
    const updated = updateListDraft(current, nextSession, upload);
    assert.equal(updated.draft.icon, upload.icon);
    assert.equal(updated.draft.title, 'Другой элемент');
});

test('richtext stays in the local category draft; cancel, switching and reopening preserve the right value', () => {
    const schema = { description: { type: 'richtext' }, note: { type: 'richtext' } };
    const a = { title: 'A', description: 'Строка A', note: '' };
    const b = { title: 'B', description: 'Строка B', note: '' };
    const sessionA = Symbol();
    let dialog = { session: sessionA, draft: structuredClone(a) };
    const formatted = toLexicalDocument('Форматированный текст');
    formatted.root.children[0].children[0].format = 1;
    dialog = updateListDraft(dialog, sessionA, { description: formatted, note: toLexicalDocument('Примечание') });
    assert.equal(a.description, 'Строка A');
    const saved = mergeListItem(a, dialog.draft, schema);
    assert.deepEqual(structuredClone(saved).description, formatted);
    dialog = null;
    assert.equal(updateListDraft(dialog, sessionA, { description: 'Позднее изменение' }), null);
    const sessionB = Symbol();
    dialog = { session: sessionB, draft: structuredClone(b) };
    assert.equal(dialog.draft.description, 'Строка B');
    assert.equal(updateListDraft(dialog, sessionA, { description: formatted }), dialog);
    dialog = { session: Symbol(), draft: structuredClone(saved) };
    assert.deepEqual(dialog.draft.description, formatted);
    assert.equal(dialog.draft.note.root.children[0].children[0].text, 'Примечание');
});
