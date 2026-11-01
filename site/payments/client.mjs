export async function paymentIsAvailable(signal) {
    const response = await fetch('/api/payments/status', { signal, cache: 'no-store' });
    if (!response.ok) return false;
    return (await response.json()).enabled === true;
}

export function createPaymentStarter(productId, { onLoading, onError, navigate }) {
    let pending = false;
    return async () => {
        if (pending) return;
        pending = true;
        onLoading(true);
        onError('');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
            const response = await fetch('/api/payments/start', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: controller.signal,
                body: JSON.stringify({ productId }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                onError(typeof result?.error === 'string' ? result.error : 'Не удалось начать оплату. Попробуйте позже.');
                return;
            }
            if (typeof result?.url !== 'string') throw new Error('Invalid payment response');
            navigate(result.url);
        } catch {
            onError('Не удалось начать оплату. Попробуйте позже.');
        } finally {
            clearTimeout(timeout);
            pending = false;
            onLoading(false);
        }
    };
}
