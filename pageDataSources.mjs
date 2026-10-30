export const PAGE_DATA_SOURCES = [
    { id: 'articles', title: 'Статьи' },
    { id: 'products', title: 'Товары' },
    { id: 'reviews', title: 'Отзывы' },
];

export function isPageDataSource(value) {
    return PAGE_DATA_SOURCES.some(({ id }) => id === value);
}
