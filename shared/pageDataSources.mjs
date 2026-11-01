export const PAGE_DATA_SOURCES = [
    { id: 'materials', title: 'Материалы' },
    { id: 'products', title: 'Товары' },
    { id: 'reviews', title: 'Отзывы' },
];

export function isPageDataSource(value) {
    return PAGE_DATA_SOURCES.some(({ id }) => id === value);
}
