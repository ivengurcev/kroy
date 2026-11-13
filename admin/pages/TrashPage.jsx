import PagesPage from './PagesPage.jsx';

// Compatibility for existing bookmarks; deleted pages use the same tree.
export default function TrashPage() {
    return <PagesPage initiallyShowDeleted />;
}
