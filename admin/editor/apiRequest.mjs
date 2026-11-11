export async function apiRequest(url, options) {
    const response = await fetch(url, options);
    if (response.ok && options?.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
        window.dispatchEvent(new Event('kroy:saved'));
    }
    return response;
}

export async function readApiError(response) {
    const body = await response.json().catch(() => ({}));
    const details = Array.isArray(body.details) ? body.details : [];
    const description = details.map(({ path, message }) => `${path}: ${message}`).join(' ');
    const error = new Error(description || body.error || `Ошибка сохранения (HTTP ${response.status}).`);
    error.details = details;
    error.status = response.status;
    return error;
}
