import MaterialDisplay from '../../runtime/MaterialDisplay.jsx';

/**
 * @kroy-title Содержимое материала
 * @kroy-category Контент
 * @kroy-contract material
 */
export default function ArticleContent({ data }) {
    return <MaterialDisplay record={data?.title ? data : null} />;
}
