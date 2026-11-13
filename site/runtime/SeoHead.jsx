import { metaTags } from '../../shared/seo.mjs';

export default function SeoHead({ meta }) {
    return <>
        <title>{meta.title}</title>
        {meta.canonical && <link data-kroy-seo="" rel="canonical" href={meta.canonical} />}
        {metaTags(meta).map(([attribute, key, value]) => <meta data-kroy-seo="" key={key} {...{ [attribute]: key }} content={value} />)}
    </>;
}
