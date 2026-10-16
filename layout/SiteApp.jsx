import Page from './Page.jsx';

export default function SiteApp({ page, parts }) {
    return <Page content={page.content} parts={parts} />;
}
