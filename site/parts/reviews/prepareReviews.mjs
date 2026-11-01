/**
 * @kroy-title Отзывы
 * @kroy-category Контент
 * @kroy-contract reviews
 * @kroy-default-widget @kroy/reviews-slider
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @param {'auto'|'manual'} props.mode - Режим подбора
 * @param {number} props.limit - Максимальное количество отзывов
 * @param {string[]} props.reviewIds - Выбранные отзывы
 * @param {boolean} props.showSubmitButton - Показывать кнопку "Оставить отзыв"
 * @param {boolean} props.showAllReviewsButton - Показывать кнопку "Все отзывы"
 *
 * @kroy title widget=input
 * @kroy mode widget=select
 * @kroy limit widget=number
 * @kroy reviewIds widget=review-list
 * @kroy showSubmitButton widget=checkbox
 * @kroy showAllReviewsButton widget=checkbox
 */
export default function prepareReviews({ props, reviews = [] }) {
    const { title = 'Отзывы', mode = 'auto', limit = 0, reviewIds = [], showSubmitButton = false, showAllReviewsButton = false } = props;
    const selected = mode === 'manual'
        ? reviewIds.map((id) => reviews.find((review) => review.id === id)).filter(Boolean)
        : reviews.slice(0, Number(limit) > 0 ? Number(limit) : undefined);
    return { title, reviews: selected, showSubmitButton, showAllReviewsButton };
}
