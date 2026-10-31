import ArticleDisplay from '../../layout/ArticleDisplay.jsx';

/**
 * @kroy-title Статья
 * @kroy-category Контент
 * @kroy-contract article
 */
export default function Article({ record }) {
    return <ArticleDisplay record={record} />;
}
