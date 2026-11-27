import { $createParagraphNode, $getRoot, $getSelection, $isRangeSelection } from 'lexical';
import {
    $deleteTableColumnAtSelection, $deleteTableRowAtSelection,
    $getNodeTriplet, $getTableCellNodeFromLexicalNode, $isTableSelection,
    $insertTableColumnAtSelection, $insertTableRowAtSelection,
    $setTableColumnIsHeader, $setTableRowIsHeader, TableCellHeaderStates,
} from '@lexical/table';

export function $selectedTable() {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) && !$isTableSelection(selection)) return null;
    const cell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
    return cell ? $getNodeTriplet(cell)[2] : null;
}

export function $tableHeaders(table) {
    const rows = table.getChildren();
    return {
        row: rows[0].getChildren().every((cell) => cell.hasHeaderState(TableCellHeaderStates.ROW)),
        column: rows.every((row) => row.getFirstChild().hasHeaderState(TableCellHeaderStates.COLUMN)),
    };
}

export function $applyTableAction(action) {
    const table = $selectedTable();
    if (!table) return;
    switch (action) {
        case 'row-before': $insertTableRowAtSelection(false); break;
        case 'row-after': $insertTableRowAtSelection(true); break;
        case 'column-before': $insertTableColumnAtSelection(false); break;
        case 'column-after': $insertTableColumnAtSelection(true); break;
        case 'delete-row': $deleteTableRowAtSelection(); break;
        case 'delete-column': $deleteTableColumnAtSelection(); break;
        case 'header-row': $setTableRowIsHeader(table, 0, !$tableHeaders(table).row); break;
        case 'header-column': $setTableColumnIsHeader(table, 0, !$tableHeaders(table).column); break;
        case 'delete-table': {
            const paragraph = $createParagraphNode();
            table.insertAfter(paragraph);
            table.remove();
            paragraph.select();
            break;
        }
    }
    if ($getRoot().isEmpty()) $getRoot().append($createParagraphNode()).selectEnd();
}
