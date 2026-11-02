import assert from 'node:assert/strict';
import test from 'node:test';
import { materialRequestBody } from './materialRequest.mjs';

test('saving an existing material omits its siteId from the PATCH body', () => {
    const material = {
        id: 'material-id',
        siteId: 'site-id',
        sectionId: 'section-id',
        slug: 'existing-material',
        title: 'Existing material',
        summary: '',
        content: null,
        coverMediaId: null,
        status: 'draft',
    };

    assert.deepEqual(materialRequestBody(material), {
        sectionId: 'section-id',
        slug: 'existing-material',
        title: 'Existing material',
        summary: '',
        content: null,
        coverMediaId: null,
        status: 'draft',
    });
});
