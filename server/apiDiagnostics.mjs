const publicReasons = new Set(['Invalid UUID', 'Invalid request', 'Invalid content', 'Page not found', 'Internal server error', 'Not found', 'Unauthorized', 'Forbidden', 'Доступ запрещён']);

// Log only response metadata and validation paths/codes, never request bodies or query strings.
export function withApiDiagnostics(handler, route) {
    return async (c) => {
        const method = c.req.method;
        const url = `/api${route}`;
        try {
            const result = await handler(c);
            if (process.env.NODE_ENV === 'development' && result instanceof Response && result.status >= 400) {
                const body = await result.clone().json().catch(() => ({}));
                console.error(JSON.stringify({ method, url, status: result.status, reason: publicReasons.has(body.error) ? body.error : 'HTTP error',
                    details: Array.isArray(body.details) ? body.details.map(({ path, code, message }) => ({ path, code, message })) : undefined }));
            }
            return result;
        } catch (error) {
            console.error(JSON.stringify({ method, url, status: 500, reason: 'Unhandled API exception',
                name: error?.name, frames: typeof error?.stack === 'string' ? error.stack.split('\n').filter((line) => /^\s+at /.test(line)) : [] }));
            return c.json({ error: 'Internal server error' }, 500);
        }
    };
}
