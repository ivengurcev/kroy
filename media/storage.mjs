import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import isUuid from '../api/isUuid.mjs';

export const MAX_MEDIA_SIZE = 10 * 1024 * 1024;
export const MEDIA_ROOT = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'media'
);

const MEDIA_FILENAME_PATTERN = /^([0-9a-f-]{36})\.(jpg|png|webp)$/i;
const formats = [
    {
        extension: 'jpg',
        mimeType: 'image/jpeg',
        matches: (bytes) => bytes.length >= 3
            && bytes[0] === 0xff
            && bytes[1] === 0xd8
            && bytes[2] === 0xff,
    },
    {
        extension: 'png',
        mimeType: 'image/png',
        matches: (bytes) => bytes.length >= 8
            && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    },
    {
        extension: 'webp',
        mimeType: 'image/webp',
        matches: (bytes) => bytes.length >= 12
            && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
            && bytes.subarray(8, 12).toString('ascii') === 'WEBP',
    },
];

export function detectImageFormat(bytes) {
    return formats.find(({ matches }) => matches(bytes)) ?? null;
}

export function getMediaPath(siteId, filename) {
    const match = MEDIA_FILENAME_PATTERN.exec(filename);

    if (!isUuid(siteId) || !match || !isUuid(match[1])) return null;

    return resolve(MEDIA_ROOT, siteId, filename);
}
