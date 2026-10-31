import ArticleDisplay from '../../layout/ArticleDisplay.jsx';

/**
 * @kroy-title Содержимое статьи
 * @kroy-category Контент
 * @kroy-contract article
 */
export default function ArticleContent({ record }) {
    return <ArticleDisplay record={record} />;
}
