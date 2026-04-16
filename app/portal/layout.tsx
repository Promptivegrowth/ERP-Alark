'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import {
    Home,
    Calendar,
    CalendarDays,
    History,
    User,
    LogOut,
    Menu,
} from 'lucide-react';
import { IncidenceModal } from '@/components/IncidenceModal';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const { user, comedorNombre, rol, loading } = useUser();
    const [collapsed, setCollapsed] = useState(false);
    // semanalOpen state hidden (generic items not shown in nav)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const supabase = createClient();

    if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;
    if (rol !== 'COMEDOR') return null;

    async function handleLogout() {
        await supabase.auth.signOut();
        window.location.href = '/login';
    }

    const menuItems = [
        { name: 'Dashboard', href: '/portal/dashboard', icon: Home },
        { name: 'Reporte del día', href: '/portal/diario', icon: Calendar },
        { name: 'Reporte Semanal', href: '/portal/semanal/reporte', icon: CalendarDays },
    ];

    const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
        <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-2">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <li key={item.name}>
                            <Link
                                href={item.href}
                                onClick={() => mobile && setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-[#2D6A4F]' : 'hover:bg-[#2D6A4F]/70'
                                    }`}
                            >
                                <item.icon size={20} />
                                {(!collapsed || mobile) && <span>{item.name}</span>}
                            </Link>
                        </li>
                    );
                })}



                <li>
                    <Link
                        href="/portal/historial"
                        onClick={() => mobile && setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${pathname === '/portal/historial' ? 'bg-[#2D6A4F]' : 'hover:bg-[#2D6A4F]/70'}`}
                    >
                        <History size={20} />
                        {(!collapsed || mobile) && <span>Historial</span>}
                    </Link>
                </li>
                <li>
                    <Link
                        href="/portal/perfil"
                        onClick={() => mobile && setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${pathname === '/portal/perfil' ? 'bg-[#2D6A4F]' : 'hover:bg-[#2D6A4F]/70'}`}
                    >
                        <User size={20} />
                        {(!collapsed || mobile) && <span>Perfil</span>}
                    </Link>
                </li>
            </ul>
        </nav>
    );

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside
                className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#1B4332] text-white transition-transform duration-300 transform lg:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="h-16 flex items-center justify-between px-4 border-b border-[#2D6A4F]">
                    <span className="font-bold text-lg">Comedores</span>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="text-white p-1">
                        <Menu size={24} />
                    </button>
                </div>
                <NavContent mobile />
            </aside>

            {/* Desktop Sidebar */}
            <aside
                className={`${collapsed ? 'w-16' : 'w-64'
                    } bg-[#1B4332] text-white transition-all duration-300 flex flex-col hidden lg:flex`}
            >
                <div className="h-16 flex items-center justify-between px-4 border-b border-[#2D6A4F]">
                    {!collapsed && <span className="font-bold text-lg truncate">Comedores</span>}
                    <button onClick={() => setCollapsed(!collapsed)} className="text-white hover:bg-[#2D6A4F] p-1 rounded">
                        <Menu size={20} />
                    </button>
                </div>
                <NavContent />
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Header */}
                <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm z-30">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="lg:hidden text-zinc-500 p-1 hover:bg-zinc-100 rounded"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 truncate max-w-[200px] sm:max-w-none">
                            {comedorNombre || 'Cargando Comedor...'}
                        </h1>
                        <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full hidden xs:inline">
                            Comedor
                        </span>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-red-600 transition-colors"
                    >
                        <LogOut size={18} />
                        <span className="hidden sm:inline">Cerrar Sesión</span>
                    </button>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-4 md:p-6 pb-24">
                    {children}
                    <IncidenceModal />
                </div>
            </main>
        </div>
    );
}
