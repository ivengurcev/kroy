import assert from 'node:assert/strict';
import test from 'node:test';
import { renderNginxConfig } from './generateNginxConfig.mjs';

test('renders Nginx proxy, release and routing rules', async () => {
    const config = await renderNginxConfig('demo', ['demo.example.test'], {
        routing: {
            redirects: [{ status: 301, from: '/old', to: '/new' }],
            gone: ['/removed'],
        },
        siteRoot: 'demo/20261025010101000',
        sitesRoot: '/srv/sites',
        upstream: '127.0.0.1:3000',
        listen: '8080',
        releaseId: '20261025010101000',
    });

    assert.match(config, /listen 8080/);
    assert.match(config, /server_name "demo\.example\.test"/);
    assert.match(config, /proxy_set_header Host \$http_host/);
    assert.match(config, /alias "\/srv\/sites\/demo\//);
    assert.match(config, /return 301 "\/new"/);
    assert.match(config, /return 410/);
});
