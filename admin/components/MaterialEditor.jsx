import RichTextEditor from '../ui/RichTextEditor.jsx';

export default function MaterialEditor(props) {
    return <RichTextEditor {...props} variant="full" label="Текст материала" name="content" minHeight="360px" />;
}
