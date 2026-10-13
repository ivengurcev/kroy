import { useState } from 'react';

export default function Test() {
    const [count, setCount] = useState(0);

    return (
        <main>
            <h1>Тестовая страница Kroy</h1>
            <button type="button" onClick={() => setCount(count + 1)}>
                Счётчик: {count}
            </button>
        </main>
    );
}
