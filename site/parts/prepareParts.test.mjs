import assert from 'node:assert/strict';
import test from 'node:test';
import prepareAbout from './about/prepareAbout.mjs';
import prepareMaterial from './material/prepareMaterial.mjs';
import prepareHero from './hero/prepareHero.mjs';
import prepareLinks from './links/prepareLinks.mjs';
import prepareContacts from './contacts/prepareContacts.mjs';
import prepareServices from './services/prepareServices.mjs';
import prepareReviews from './reviews/prepareReviews.mjs';
import prepareProductSelection from './product-selection/prepareProductSelection.mjs';
import prepareCategoryProducts from './category-products/prepareCategoryProducts.mjs';

test('prepares material data from record without mixing route context and settings', () => {
    const record = { slug: 'story', title: 'Material', summary: 'Summary', content: { root: {} }, coverUrl: '/cover.webp' };
    assert.deepEqual(prepareMaterial({ props: { title: 'Setting' }, record, context: { params: { slug: 'route' } } }), record);
    assert.equal(prepareMaterial({ props: {}, record: null }), null);
});

test('selects reviews only in the data part and preserves manual order and flags', () => {
    const reviews = [{ id: 'first' }, { id: 'second' }, { id: 'third' }];
    assert.deepEqual(prepareReviews({ props: { mode: 'auto', limit: 2 }, reviews }).reviews, [reviews[0], reviews[1]]);
    const props = { title: 'Отзывы', mode: 'manual', reviewIds: ['third', 'missing', 'first'], showSubmitButton: true };
    const snapshot = JSON.stringify(props);
    const data = prepareReviews({ props, reviews });
    assert.deepEqual(data.reviews, [reviews[2], reviews[0]]);
    assert.equal(data.showSubmitButton, true);
    assert.equal(JSON.stringify(props), snapshot);
    assert.deepEqual(prepareReviews({ props: {} }).reviews, []);
});

test('selects catalog products by ordered ids and category before rendering', () => {
    const products = [
        { id: 'one', categoryId: 'category', status: 'published' },
        { id: 'hidden', categoryId: 'category', status: 'draft' },
        { id: 'two', categoryId: null, status: 'published' },
    ];
    const catalog = { products };
    assert.deepEqual(prepareProductSelection({ props: { productIds: ['two', 'hidden', 'missing', 'one'] }, catalog }).products, [products[2], products[0]]);
    assert.deepEqual(prepareCategoryProducts({ props: { categoryId: '__all__', limit: 1 }, catalog }).products, [products[0]]);
    assert.deepEqual(prepareCategoryProducts({ props: { categoryId: '__uncategorized__' }, catalog }).products, [products[2]]);
    assert.deepEqual(prepareCategoryProducts({ props: { categoryId: 'category' }, catalog }).products, [products[0]]);
    assert.deepEqual(prepareProductSelection({ props: {} }).products, []);
});

test('prepares shared contacts and normalizes source data without mutating it', () => {
    const contacts = { phone: '+79999999999', address: 'Address', socials: [{ name: ' Link ', link: ' /path ' }, { name: '', link: '/' }] };
    const snapshot = JSON.stringify(contacts);
    const hero = prepareHero({ props: { title: 'Hero' }, contacts });
    assert.equal(hero.title, 'Hero');
    assert.equal(hero.socials.length, 1);
    assert.equal(hero.socials[0].name, 'Link');
    assert.equal(hero.socials[0].link, '/path');
    const links = prepareLinks({ props: {}, contacts });
    assert.equal(links.socials.length, 1);
    assert.equal(links.socials[0].name, 'Link');
    assert.equal(prepareContacts({ props: { title: 'Contacts', zoom: 10 }, contacts }).phone, '+79999999999');
    assert.equal(JSON.stringify(contacts), snapshot);
    assert.deepEqual(prepareAbout({ props: { title: 'About', text: ' First\n\n Second ' } }).paragraphs, ['First', 'Second']);
    assert.deepEqual(prepareServices({ props: { categories: null } }).categories, []);
});
