export async function apiRequest(url, options) {
    const response = await fetch(url, options);
    if (response.ok && options?.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
        window.dispatchEvent(new Event('kroy:saved'));
    }
    return response;
}
