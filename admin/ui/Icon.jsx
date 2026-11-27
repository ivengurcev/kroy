import AddIcon from './icons/add.svg';
import BackIcon from './icons/back.svg';
import ChevronRightIcon from './icons/chevron-right.svg';
import CloseIcon from './icons/close.svg';
import DeleteIcon from './icons/delete.svg';
import DesktopIcon from './icons/desktop.svg';
import DownIcon from './icons/down.svg';
import EditIcon from './icons/edit.svg';
import ForwardIcon from './icons/forward.svg';
import GlobeIcon from './icons/globe.svg';
import HomeIcon from './icons/home.svg';
import LogoutIcon from './icons/logout.svg';
import MoreIcon from './icons/more.svg';
import MoonIcon from './icons/moon.svg';
import PagesIcon from './icons/pages.svg';
import PhoneIcon from './icons/phone.svg';
import PreviewIcon from './icons/preview.svg';
import PublishIcon from './icons/publish.svg';
import RestoreIcon from './icons/restore.svg';
import SaveIcon from './icons/save.svg';
import SearchIcon from './icons/search.svg';
import SeoIcon from './icons/seo.svg';
import SettingsIcon from './icons/settings.svg';
import SunIcon from './icons/sun.svg';
import TabletIcon from './icons/tablet.svg';
import TrashIcon from './icons/trash.svg';
import UpIcon from './icons/up.svg';
import MaterialsIcon from './icons/materials.svg';
import CatalogIcon from './icons/catalog.svg';
import ReviewsIcon from './icons/reviews.svg';
import PaymentsIcon from './icons/payments.svg';
import MenuIcon from './icons/menu.svg';
import styles from './Icon.module.css';
import FolderIcon from './icons/folder.svg';
import FileIcon from './icons/file.svg';
import DocumentIcon from './icons/document.svg';
import ListBulletIcon from './icons/list-bullet.svg';
import ListOrderedIcon from './icons/list-ordered.svg';
import ParagraphIcon from './icons/paragraph.svg';
import Heading2Icon from './icons/heading-2.svg';
import Heading3Icon from './icons/heading-3.svg';
import BoldIcon from './icons/bold.svg';
import ItalicIcon from './icons/italic.svg';
import UnderlineIcon from './icons/underline.svg';
import LinkIcon from './icons/link.svg';
import HorizontalRuleIcon from './icons/horizontal-rule.svg';
import TableIcon from './icons/table.svg';
import AlignLeftIcon from './icons/align-left.svg';
import AlignCenterIcon from './icons/align-center.svg';
import AlignRightIcon from './icons/align-right.svg';
import AlignJustifyIcon from './icons/align-justify.svg';
import CalloutIcon from './icons/callout.svg';

const icons = {
    alignLeft: AlignLeftIcon,
    alignCenter: AlignCenterIcon,
    alignRight: AlignRightIcon,
    alignJustify: AlignJustifyIcon,
    callout: CalloutIcon,
    paragraph: ParagraphIcon,
    heading2: Heading2Icon,
    heading3: Heading3Icon,
    bold: BoldIcon,
    italic: ItalicIcon,
    underline: UnderlineIcon,
    link: LinkIcon,
    horizontalRule: HorizontalRuleIcon,
    table: TableIcon,
    listBullet: ListBulletIcon,
    listOrdered: ListOrderedIcon,
    folder: FolderIcon,
    file: FileIcon,
    document: DocumentIcon,
    add: AddIcon,
    edit: EditIcon,
    delete: DeleteIcon,
    restore: RestoreIcon,
    save: SaveIcon,
    search: SearchIcon,
    close: CloseIcon,
    settings: SettingsIcon,
    pages: PagesIcon,
    trash: TrashIcon,
    publish: PublishIcon,
    preview: PreviewIcon,
    up: UpIcon,
    down: DownIcon,
    back: BackIcon,
    forward: ForwardIcon,
    globe: GlobeIcon,
    seo: SeoIcon,
    home: HomeIcon,
    logout: LogoutIcon,
    more: MoreIcon,
    moon: MoonIcon,
    chevronRight: ChevronRightIcon,
    desktop: DesktopIcon,
    tablet: TabletIcon,
    phone: PhoneIcon,
    materials: MaterialsIcon,
    catalog: CatalogIcon,
    reviews: ReviewsIcon,
    payments: PaymentsIcon,
    menu: MenuIcon,
    sun: SunIcon,
};

export default function Icon({ name, size = 20, className = '', ...props }) {
    const SvgIcon = icons[name];

    return (
        <SvgIcon
            className={`${styles.icon} ${className}`}
            width={size}
            height={size}
            aria-hidden="true"
            focusable="false"
            {...props}
        />
    );
}
