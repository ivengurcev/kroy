import AdminHeader from './AdminHeader.jsx';
import EditorWorkspace from '../../editor/EditorWorkspace.jsx';
import AdminLayout from './AdminLayout.jsx';

export default function AdminShell({
    page,
    content,
    metadata,
    parts,
    loadStatus,
    saveStatus,
    isDirty,
    theme,
    contacts,
    catalog,
    reviews,
    onAddPart,
    onRemovePart,
    onMovePart,
    onPropChange,
    onSave,
    onPageDetailsChange,
}) {
    return (
        <AdminLayout header={(
                <AdminHeader
                    page={page}
                    loadStatus={loadStatus}
                    saveStatus={saveStatus}
                    isDirty={isDirty}
                    onSave={onSave}
                    onPageDetailsChange={onPageDetailsChange}
                />
            )}>
                <EditorWorkspace
                    content={content}
                    metadata={metadata}
                    parts={parts}
                    loadStatus={loadStatus}
                    theme={theme}
                    contacts={contacts}
                    catalog={catalog}
                    reviews={reviews}
                    onAddPart={onAddPart}
                    onRemovePart={onRemovePart}
                    onMovePart={onMovePart}
                    onPropChange={onPropChange}
                />
        </AdminLayout>
    );
}
