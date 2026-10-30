import AdminHeader from './AdminHeader.jsx';
import EditorWorkspace from '../../editor/EditorWorkspace.jsx';
import AdminLayout from './AdminLayout.jsx';

export default function AdminShell({
    page,
    content,
    metadata,
    parts,
    widgets,
    widgetMetadata,
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
    onViewChange,
    onViewPropChange,
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
                    widgets={widgets}
                    widgetMetadata={widgetMetadata}
                    loadStatus={loadStatus}
                    theme={theme}
                    contacts={contacts}
                    catalog={catalog}
                    reviews={reviews}
                    onAddPart={onAddPart}
                    onRemovePart={onRemovePart}
                    onMovePart={onMovePart}
                    onPropChange={onPropChange}
                    onViewChange={onViewChange}
                    onViewPropChange={onViewPropChange}
                />
        </AdminLayout>
    );
}
