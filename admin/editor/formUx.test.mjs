import assert from 'node:assert/strict';
import test from 'node:test';
import { generatedSlug } from './autoSlug.mjs';
import { isValidMaterialSlug, materialFieldErrors } from '../../shared/materialFields.mjs';
import { fieldValidationMessage, formResponseError } from '../ui/formValidation.mjs';
import { formStateLabel, publicationStateLabel, publicationBlocked } from './actionState.mjs';
import { apiRequest } from './apiRequest.mjs';

test('generated slug transliterates, strips slash and punctuation, and fits API limits', () => {
    assert.equal(generatedSlug('/ Ёжик, Щука и Чай! '), 'ezhik-shchuka-i-chai');
    assert.equal(generatedSlug(' Hello   WORLD -- 123 '), 'hello-world-123');
    assert.equal(generatedSlug('!!!'), '');
    assert.equal(generatedSlug('Новая страница', { prefix: '/' }), '/novaya-stranitsa');
    assert.ok(isValidMaterialSlug(generatedSlug('щ'.repeat(300))));
    assert.equal(generatedSlug('ab cd', { maxLength: 3 }), 'ab');
});

test('slug validation rejects paths, uppercase, repeated or trailing hyphens and excessive length', () => {
    for (const value of ['', '/hello', 'Hello', 'привет', 'two--words', '-hello', 'hello-', 'hello_world', 'a'.repeat(201), 123, null]) {
        assert.equal(isValidMaterialSlug(value), false, value);
        assert.ok(materialFieldErrors({ slug: value }, { partial: true }).slug);
    }
    assert.equal(isValidMaterialSlug('hello-123'), true);
    assert.deepEqual(materialFieldErrors({ slug: 'hello-123' }, { partial: true }), {});
});

test('validation produces actionable messages and treats whitespace-only titles as empty', () => {
    assert.equal(fieldValidationMessage({ name: 'title', required: true, value: '  ' }), 'Укажите название');
    assert.match(fieldValidationMessage({ name: 'slug', value: '/invalid' }), /латинские буквы/);
    assert.match(fieldValidationMessage({ name: 'path', value: '/admin' }), /Служебные адреса/);
    assert.equal(fieldValidationMessage({ name: 'path', value: '/my-page' }), '');
    assert.equal(fieldValidationMessage({ name: 'email', value: 'bad', type: 'email', validity: { typeMismatch: true } }), 'Укажите корректный email');
});

test('raw server exceptions are not exposed to the user', async () => {
    const message = await formResponseError(new Response(JSON.stringify({ error: 'SQL internal private details' }), { status: 500 }), null, 'Не удалось сохранить');
    assert.equal(message, 'Не удалось сохранить');
});

test('structured API field errors reach the form, while server exceptions do not', async () => {
    const form = new EventTarget();
    const received = [];
    form.addEventListener('kroy:field-errors', (event) => received.push(event.detail));
    await formResponseError(new Response(JSON.stringify({ fields: { slug: 'Такой адрес уже используется' } }), { status: 409 }), form);
    assert.deepEqual(received, [{ slug: 'Такой адрес уже используется' }]);
    await formResponseError(new Response(JSON.stringify({ fields: { title: 'private SQL' } }), { status: 500 }), form);
    assert.equal(received.length, 1);
});

test('saving a material notifies the header without making a site-publication request', async (t) => {
    const events = new EventTarget();
    const previousWindow = globalThis.window;
    globalThis.window = events;
    t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
    let savedEvents = 0;
    events.addEventListener('kroy:saved', () => { savedEvents += 1; });
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push([url, options.method]);
        return new Response('{}', { status: options.method === 'PATCH' ? 200 : 400 });
    });
    await apiRequest('/api/site/materials/material-id', { method: 'PATCH', body: '{}' });
    await apiRequest('/api/site/materials', { method: 'POST', body: '{}' });
    assert.deepEqual(requests, [['/api/site/materials/material-id', 'PATCH'], ['/api/site/materials', 'POST']]);
    assert.equal(savedEvents, 1);
});

test('saving a form and publishing a site have independent state transitions', () => {
    assert.equal(formStateLabel(true, 'idle'), 'Есть несохранённые изменения');
    assert.equal(formStateLabel(true, 'saving'), 'Сохранение...');
    assert.equal(formStateLabel(false, 'success'), 'Сохранено');
    assert.equal(publicationStateLabel({ status: 'success', hasChanges: true }), 'Есть неопубликованные изменения');
    assert.equal(publicationStateLabel({ status: 'building' }), 'Публикация...');
    assert.equal(publicationStateLabel({ status: 'publishing' }), 'Публикация...');
    assert.equal(publicationStateLabel({ status: 'success', hasChanges: false }), 'Сайт опубликован');
    assert.equal(publicationStateLabel({ status: 'error', hasChanges: true }), 'Ошибка публикации');
    assert.equal(publicationStateLabel({ status: 'idle' }), 'Проверка публикации...');
    assert.equal(publicationBlocked(true, 'idle'), true);
    assert.equal(publicationBlocked(false, 'saving'), true);
    assert.equal(publicationBlocked(false, 'success'), false);
});
