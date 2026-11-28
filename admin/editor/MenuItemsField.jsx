import { menuExternalHref, menuPages, PAGE_MENU_ITEM } from '../../shared/pageMenu.mjs';
import { Input, Select } from '../ui/NativeControls.jsx';
import FormField from '../ui/FormField.jsx';
import Switch from '../ui/Switch.jsx';
import ListField from './ListField.jsx';

const defaultItems = [PAGE_MENU_ITEM];

export default function MenuItemsField({ pages, value, onChange }) {
    const eligible = menuPages(pages);
    return <ListField
        label="Пункты меню"
        itemLabel="Пункт меню"
        value={value ?? defaultItems}
        onChange={onChange}
        createItem={() => ({ type: 'page' })}
        isFixedItem={(item) => item.type === 'anchors'}
        normalizeItem={(item) => {
            if (item.type === 'page') return { type: 'page', pageId: item.pageId };
            const url = menuExternalHref(item.url);
            return { type: 'external', label: item.label?.trim() || new URL(url).hostname, url };
        }}
        itemSummary={(item) => {
            if (item.type === 'anchors') return 'Меню страницы';
            if (item.type === 'external') return item.label;
            return eligible.find(({ id }) => id === item.pageId)?.title ?? 'Недоступная страница';
        }}
        renderItem={(item, _index, change) => <>
            <Switch label="Внешняя ссылка" checked={item.type === 'external'}
                onChange={(event) => change({ type: event.target.checked ? 'external' : 'page' })} />
            {item.type === 'external' ? <FormField label="URL">
                <Input name="url" type="url" required value={item.url ?? ''} onChange={(event) => change({ url: event.target.value })}
                    data-validation-message={item.url && !menuExternalHref(item.url) ? 'Введите ссылку HTTP или HTTPS.' : undefined} />
            </FormField> : <FormField label="Страница">
                <Select name="pageId" required value={item.pageId ?? ''} onChange={(event) => change({ pageId: event.target.value })}
                    data-validation-message={item.pageId && !eligible.some(({ id }) => id === item.pageId) ? 'Выберите доступную страницу.' : undefined}>
                    <option value="">Выберите страницу</option>
                    {item.pageId && !eligible.some(({ id }) => id === item.pageId)
                        && <option value={item.pageId} disabled>Недоступная страница</option>}
                    {eligible.map(({ id, title, path }) => <option value={id} key={id}>{title} — {path}</option>)}
                </Select>
            </FormField>}
        </>}
    />;
}
