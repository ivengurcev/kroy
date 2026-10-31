import ArticleDisplay from '../../layout/ArticleDisplay.jsx';

/**
 * @kroy-title Статья
 * @kroy-category Контент
 * @kroy-contract article
 */
export default function Article({ title, content, coverUrl }) {
    return <ArticleDisplay record={title ? { title, content, coverUrl } : null} />;
}
