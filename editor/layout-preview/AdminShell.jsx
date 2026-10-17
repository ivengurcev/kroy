import AdminHeader from './AdminHeader.jsx';
import EditorFooter from './EditorFooter.jsx';
import EditorToolbar from './EditorToolbar.jsx';
import EditorWorkspace from './EditorWorkspace.jsx';
import styles from './AdminShell.module.css';

export default function AdminShell() {
    return (
        <div className={styles.adminShell}>
            <header className={styles.header}>
                <AdminHeader />
                <EditorToolbar />
            </header>
            <main className={styles.scrollArea}>
                <EditorWorkspace />
            </main>
            <EditorFooter />
        </div>
    );
}
