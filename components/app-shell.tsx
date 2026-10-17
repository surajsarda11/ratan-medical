"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/lib/actions';

const ownerNav = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard' },
  { href: '/bookings/new', icon: '＋', label: 'New Booking' },
  { href: '/bookings', icon: '▤', label: 'All Bookings' },
  { href: '/imports', icon: '⇧', label: 'Purchase CSV Import' },
  { href: '/ready', icon: '✓', label: 'Ready for Pickup' },
  { href: '/settlements', icon: '₹', label: 'Settlements' },
  { href: '/reminders', icon: '◷', label: 'Reminder History' },
  { href: '/staff', icon: '♙', label: 'Staff Members' },
  { href: '/settings', icon: '⚙', label: 'Settings' },
];
const staffNav = [
  { href: '/staff-booking', icon: '＋', label: 'Quick Booking' },
];

export function AppShell({ children, email, role = 'owner' }: { children: React.ReactNode; email: string; role?: 'owner' | 'staff' }) {
  const currentPath = usePathname();
  const nav = role === 'staff' ? staffNav : ownerNav;
  const title = nav.find((item) => currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href)))?.label ?? 'Medicine Booking & Settlement Manager';
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/dashboard" className="brand">
        <div className="brand-mark">✚</div>
        <div className="brand-copy"><div className="brand-title">Ratan Medical Hall</div><div className="brand-subtitle">Booking & Settlement</div></div>
      </Link>
      <div className="nav-caption">Workspace</div>
      <nav className="nav-links">
        {nav.map((item) => <Link href={item.href} key={item.href} className={`nav-link ${currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href)) ? 'active' : ''}`} title={item.label}>
          <span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span>
        </Link>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-user">Signed in as<br /><strong>{email}</strong></div>
        <form action={logoutAction}><button className="logout-button" type="submit">⇥ <span className="logout-label">Sign out</span></button></form>
      </div>
    </aside>
    <div className="main-area">
      <header className="topbar">
        <div><div className="topbar-kicker">RATAN MEDICAL HALL / WORKSPACE</div><div className="topbar-title">{title}</div></div>
        <div className="topbar-right"><span className="topbar-status"><span className="online-dot" /> Private workspace</span></div>
      </header>
      <main className="main-content">{children}</main>
    </div>
  </div>;
}
