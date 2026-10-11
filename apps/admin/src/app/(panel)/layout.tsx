'use client';

import { STAFF_ROLE_LABELS, type StaffRole } from '@kirilovskiy/shared';
import {
  Ban,
  Bell,
  BellOff,
  Cake,
  ClipboardList,
  Clock,
  FolderTree,
  History,
  LogOut,
  MapPinned,
  Menu,
  Settings,
  Ticket,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { OrderEventsProvider, useOrderEvents } from '@/lib/order-events';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  roles?: StaffRole[];
  counter?: 'new';
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Работа',
    items: [
      { href: '/orders', label: 'Заказы', icon: <ClipboardList size={18} />, counter: 'new' },
      { href: '/stop-list', label: 'Стоп-лист', icon: <Ban size={18} /> },
    ],
  },
  {
    section: 'Каталог',
    items: [
      { href: '/products', label: 'Товары', icon: <Cake size={18} />, roles: ['ADMIN', 'MANAGER'] },
      { href: '/categories', label: 'Категории', icon: <FolderTree size={18} />, roles: ['ADMIN', 'MANAGER'] },
      { href: '/promo-codes', label: 'Промокоды', icon: <Ticket size={18} />, roles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    section: 'Доставка',
    items: [
      { href: '/delivery/slots', label: 'Интервалы', icon: <Clock size={18} />, roles: ['ADMIN', 'MANAGER'] },
      { href: '/delivery/zones', label: 'Зоны доставки', icon: <MapPinned size={18} />, roles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    section: 'Управление',
    items: [
      { href: '/audit', label: 'Журнал действий', icon: <History size={18} />, roles: ['ADMIN', 'MANAGER'] },
      { href: '/staff', label: 'Сотрудники', icon: <Users size={18} />, roles: ['ADMIN', 'MANAGER'] },
      { href: '/settings', label: 'Настройки', icon: <Settings size={18} />, roles: ['ADMIN', 'MANAGER'] },
    ],
  },
];

function Shell({ children }: { children: ReactNode }) {
  const { staff, logout, can } = useAuth();
  const { counts, connection, soundOn, enableSound, disableSound } = useOrderEvents();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const newPaid = counts ? counts.new - counts.unpaid : 0;

  useEffect(() => setMenuOpen(false), [pathname]);

  const connectionLabel =
    connection === 'online' ? 'Онлайн' : connection === 'connecting' ? 'Подключение…' : 'Нет связи';

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">АК</div>
          <div>
            <div className="brand-title">Кондитерская Кирилловского</div>
            <div className="brand-sub">Админ-панель</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((group) => {
            const items = group.items.filter((i) => !i.roles || can(...i.roles));
            if (!items.length) return null;
            return (
              <div key={group.section}>
                <div className="nav-section">{group.section}</div>
                {items.map((item) => (
                  <Link key={item.href} href={item.href} className={pathname.startsWith(item.href) ? 'active' : ''}>
                    {item.icon}
                    {item.label}
                    {item.counter === 'new' && newPaid > 0 ? <span className="count">{newPaid}</span> : null}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="strong">{staff?.name}</div>
          <div className="brand-sub">{staff ? STAFF_ROLE_LABELS[staff.role] : ''}</div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost icon-btn menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Меню">
            <Menu size={20} />
          </button>
          <span className="row small muted" title="Поток новых заказов">
            <span className={`dot dot-${connection}`} /> {connectionLabel}
          </span>
          <div className="spacer" />
          {soundOn ? (
            <button className="btn btn-sm" onClick={disableSound} title="Звуковой сигнал о новых заказах включён">
              <Bell size={16} /> Звук включён
            </button>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={enableSound} title="Браузер разрешает звук только после нажатия">
              <BellOff size={16} /> Включить звук
            </button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={logout}>
            <LogOut size={16} /> Выйти
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  const { staff, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !staff) router.replace('/login');
  }, [loading, staff, router]);

  if (loading || !staff) return <Spinner />;
  return (
    <OrderEventsProvider>
      <Shell>{children}</Shell>
    </OrderEventsProvider>
  );
}
