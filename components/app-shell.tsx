"use client";
import { Suspense, useEffect, useState } from "react";
import ActionToast from "@/components/action-toast";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/lib/actions';

const nav = [
  { href: '/dashboard', icon: '▦', label: 'Dashboard' },
  { href: '/bookings/new', icon: '＋', label: 'New Booking' },
  { href: '/bookings', icon: '▤', label: 'All Bookings' },
  { href: '/ready', icon: '✓', label: 'Ready for Pickup' },
  { href: '/settlements', icon: '₹', label: 'Settlements' },
  { href: '/reminders', icon: '◷', label: 'Reminder History' },
  { href: '/settings', icon: '⚙', label: 'Settings' },
];

export function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const currentPath = usePathname();
  const [sidebarMode, setSidebarMode] = useState<"auto" | "expanded" | "collapsed">("auto");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ratan-medical-sidebar-mode");
      if (saved === "expanded" || saved === "collapsed") {
        setSidebarMode(saved);
        return;
      }
    } catch {
      // Keep the responsive CSS default when browser storage is unavailable.
    }

    setSidebarMode(window.matchMedia("(max-width: 1050px)").matches ? "collapsed" : "expanded");
  }, []);

  const toggleSidebar = () => {
    const nextMode = sidebarMode === "expanded" ? "collapsed" : "expanded";
    setSidebarMode(nextMode);
    try {
      window.localStorage.setItem("ratan-medical-sidebar-mode", nextMode);
    } catch {
      // The menu still responds for this session when storage is unavailable.
    }
  };
  const title = nav.find((item) => currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href)))?.label ?? 'Medicine Booking & Settlement Manager';
  return <div className="app-shell">
    <aside className={`sidebar ${sidebarMode === "expanded" ? "sidebar-expanded" : sidebarMode === "collapsed" ? "sidebar-collapsed" : ""}`}>
      <Link href="/dashboard" className="brand">
        <div className="brand-mark">✚</div>
        <div className="brand-copy"><div className="brand-title">Ratan Medical Hall</div><div className="brand-subtitle">Booking & Settlement</div></div>
      </Link>
      <div className="nav-caption">Workspace</div>
      <nav id="workspace-navigation" className="nav-links">
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
        <div className="topbar-right"><button
            type="button"
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-expanded={sidebarMode === "expanded"}
            aria-controls="workspace-navigation"
            title={sidebarMode === "expanded" ? "Collapse navigation" : "Expand navigation"}
          ><span aria-hidden="true">{sidebarMode === "expanded" ? "⇤" : "☰"}</span><span>{sidebarMode === "expanded" ? "Collapse menu" : "Expand menu"}</span></button><span className="topbar-status"><span className="online-dot" /> Private workspace</span></div>
      </header>
      <main className="main-content"><Suspense fallback={null}><ActionToast /></Suspense>{children}</main>
    </div>
  </div>;
}
