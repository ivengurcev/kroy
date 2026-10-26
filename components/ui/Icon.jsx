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
import SeoIcon from './icons/seo.svg';
import SettingsIcon from './icons/settings.svg';
import SunIcon from './icons/sun.svg';
import TabletIcon from './icons/tablet.svg';
import TrashIcon from './icons/trash.svg';
import UpIcon from './icons/up.svg';
import styles from './Icon.module.css';

const icons = {
    add: AddIcon,
    edit: EditIcon,
    delete: DeleteIcon,
    restore: RestoreIcon,
    save: SaveIcon,
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
