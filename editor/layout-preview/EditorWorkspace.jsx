import Page from '../../layout/Page.jsx';
import BlockInspector from './BlockInspector.jsx';
import styles from './AdminShell.module.css';
import Card from './ui/Card.jsx';

export default function EditorWorkspace({
    content,
    metadata,
    parts,
    selectedPartId,
    loadStatus,
    onSelectPart,
    onAddPart,
    onRemovePart,
    onMovePart,
    onPropChange,
}) {
    if (loadStatus !== 'success') {
        return (
            <Card className={styles.workspaceStatus} role={loadStatus === 'error' ? 'alert' : undefined}>
                {loadStatus === 'loading'
                    ? 'Загрузка страницы…'
                    : 'Не удалось загрузить страницу.'}
            </Card>
        );
    }

    const selectedPart = content.find(({ id }) => id === selectedPartId) ?? null;

    function selectPart(event, id) {
        if (event.target.closest?.('a')) {
            event.preventDefault();
        }

        onSelectPart(id);
    }

    return (
        <div className={styles.workspace}>
            <section className={styles.pageCanvas} aria-label="Предпросмотр страницы">
                {content.map((item) => (
                    <div
                        className={`${styles.previewPart} ${item.id === selectedPartId ? styles.selectedPart : ''}`}
                        onClickCapture={(event) => selectPart(event, item.id)}
                        key={item.id}
                    >
                        <Page content={[item]} parts={parts} />
                    </div>
                ))}

                {content.length === 0 && (
                    <div className={styles.emptyPreview}>Страница пока не содержит запчастей.</div>
                )}
            </section>

            <BlockInspector
                content={content}
                metadata={metadata}
                selectedPart={selectedPart}
                onAddPart={onAddPart}
                onRemovePart={onRemovePart}
                onMovePart={onMovePart}
                onPropChange={onPropChange}
            />
        </div>
    );
}
