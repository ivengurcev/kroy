import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { getSiteFingerprint } from '../../db/siteFingerprint.mjs';
import getActiveRelease from '../../build/publication/getActiveRelease.mjs';

const SITES_DIR = fileURLToPath(new URL('../../dist/sites/', import.meta.url));

export async function getSitePublicationState(site, { nginxDir, sitesDir = SITES_DIR } = {}) {
    const releaseId = await getActiveRelease(site.slug, nginxDir);
    if (!releaseId) return { hasChanges: true };
    let publishedFingerprint;
    try {
        const path = join(sitesDir, site.slug, releaseId, 'source-fingerprint.json');
        publishedFingerprint = JSON.parse(await readFile(path, 'utf8')).fingerprint;
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    // Legacy releases have no source snapshot. Never claim they are up to date.
    return { releaseId, hasChanges: !publishedFingerprint || publishedFingerprint !== await getSiteFingerprint(site.id) };
}
