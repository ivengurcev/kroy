import sharp from 'sharp';
import {
    DEFAULT_MEDIA_WIDTH,
    MAX_MEDIA_PIXELS,
    MAX_MEDIA_SIZE,
    MAX_MEDIA_WIDTH,
} from './storage.mjs';

sharp.cache({ memory: 64, files: 0, items: 100 });
sharp.concurrency(1);

function requestedWidth(value) {
    const width = Number(value);
    return Number.isInteger(width) && width > 0
        ? Math.min(width, MAX_MEDIA_WIDTH)
        : DEFAULT_MEDIA_WIDTH;
}

export default async function processImage(bytes, { maxWidth, square = false } = {}) {
    const image = sharp(bytes, {
        limitInputPixels: MAX_MEDIA_PIXELS,
        sequentialRead: true,
    });
    const metadata = await image.metadata();

    if (
        !['jpeg', 'png', 'webp'].includes(metadata.format)
        || !Number.isInteger(metadata.width)
        || !Number.isInteger(metadata.height)
        || metadata.width <= 0
        || metadata.height <= 0
        || metadata.width * metadata.height > MAX_MEDIA_PIXELS
    ) {
        throw new Error('Invalid image');
    }

    const width = requestedWidth(maxWidth);
    const resized = square
        ? image.rotate().resize({
            width: Math.min(width, metadata.width, metadata.height),
            height: Math.min(width, metadata.width, metadata.height),
            fit: 'cover',
        })
        : image.rotate().resize({ width, withoutEnlargement: true });
    const output = await resized.webp({ quality: 82 }).toBuffer();

    if (output.length <= 0 || output.length > MAX_MEDIA_SIZE) {
        throw new Error('Invalid image');
    }

    return output;
}
