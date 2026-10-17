import BlockInspector from './BlockInspector.jsx';
import styles from './AdminShell.module.css';
import Button from './ui/Button.jsx';

export default function EditorWorkspace() {
    return (
        <div className={styles.workspace}>
            <section className={styles.pageCanvas} aria-label="Макет страницы">
                <article className={`${styles.mockSection} ${styles.mockHero}`}>
                    <span className={styles.sectionBadge}>Герой</span>
                    <div className={styles.sectionActions}>
                        <Button variant="compact" disabled>⠿</Button>
                        <Button variant="compact" disabled>✎ <span>Изменить блок</span></Button>
                        <Button variant="compact" disabled>•••</Button>
                    </div>
                    <div className={styles.mockCopy}>
                        <span className={styles.mockPill} />
                        <span className={`${styles.mockLine} ${styles.title}`} />
                        <span className={`${styles.mockLine} ${styles.title} ${styles.titleShort}`} />
                        <span className={`${styles.mockLine} ${styles.lead}`} />
                        <span className={`${styles.mockLine} ${styles.lead} ${styles.leadShort}`} />
                        <div className={styles.mockButtons}><i /><i /></div>
                    </div>
                    <div className={styles.mockImage}><span>◇</span></div>
                    <div className={styles.mockFeatures}>
                        <span><i /><b /></span><span><i /><b /></span><span><i /><b /></span>
                    </div>
                </article>

                <article className={`${styles.mockSection} ${styles.mockContent}`}>
                    <div className={`${styles.mockCopy} ${styles.compactCopy}`}>
                        <span className={`${styles.mockLine} ${styles.lead}`} />
                        <span className={`${styles.mockLine} ${styles.lead} ${styles.long}`} />
                        <span className={`${styles.mockLine} ${styles.lead} ${styles.leadShort}`} />
                        <div className={styles.mockCards}><i /><i /><i /></div>
                    </div>
                    <div className={`${styles.mockImage} ${styles.smallImage}`}><span>◇</span></div>
                </article>

                <article className={`${styles.mockSection} ${styles.mockRow}`}><i /><i /><i /><i /></article>
            </section>
            <BlockInspector />
        </div>
    );
}
