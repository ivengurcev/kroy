import ArticleDisplay from '../../runtime/ArticleDisplay.jsx';

/**
 * @kroy-title Содержимое статьи
 * @kroy-category Контент
 * @kroy-contract article
 */
export default function ArticleContent({ data }) {
    return <ArticleDisplay record={data?.title ? data : null} />;
}
