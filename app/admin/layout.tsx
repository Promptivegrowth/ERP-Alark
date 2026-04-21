'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import {
    BarChart3,
    Building2,
    Truck,
    Users,
    FileText,
    Settings,
    LogOut,
    Menu,
    AlertTriangle,
    CalendarDays,
    RefreshCw,
    UploadCloud,
    Eye,
    FileDown,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, rol, loading } = useUser();
    const [collapsed, setCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const supabase = createClient();

    if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;
    if (rol !== 'ADMIN' && rol !== 'SUPERVISOR') return null;
    const isSupervisor = rol === 'SUPERVISOR';

    async function handleLogout() {
        await supabase.auth.signOut();
        window.location.href = '/login';
    }

    const menuItems = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: BarChart3 },
        { name: 'Comedores', href: '/admin/comedores', icon: Building2 },
        { name: 'Solicitudes', href: '/admin/solicitudes', icon: AlertTriangle },
        { name: 'Logística', href: '/admin/logistica', icon: Truck },
        { name: 'Recursos Humanos', href: '/admin/rrhh', icon: Users },
        { name: 'Reportes', href: '/admin/reportes', icon: FileText },
        { name: '↳ Semanal', href: '/admin/reportes/semanal', icon: CalendarDays, sub: true },
        { name: '↳ Cruce Diario', href: '/admin/reportes/cruce', icon: RefreshCw, sub: true },
        { name: '↳ Consolidado', href: '/admin/reportes/consolidado', icon: FileDown, sub: true },
        { name: '↳ Sistema Interno', href: '/admin/reportes/sistema', icon: UploadCloud, sub: true },
        { name: 'Configuración', href: '/admin/configuracion', icon: Settings, adminOnly: true },
    ].filter(i => !(i as any).adminOnly || !isSupervisor);

    const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
        <nav className="flex-1 overflow-y-auto py-6">
            <ul className="space-y-2 px-3">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/admin/reportes' && pathname.startsWith(item.href));
                    const isSub = (item as any).sub;
                    return (
                        <li key={item.name}>
                            <Link
                                href={item.href}
                                onClick={() => mobile && setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 rounded-lg transition-all duration-200 group ${isSub ? 'px-3 py-1.5 ml-3' : 'px-3 py-2.5'
                                    } ${isActive ? 'bg-[#2D6A4F] shadow-lg' : 'hover:bg-[#2D6A4F]/40'}`}
                            >
                                <item.icon size={isSub ? 15 : 20} className={isActive ? 'text-white' : 'text-emerald-300 group-hover:text-white'} />
                                {(!collapsed || mobile) && <span className={`${isSub ? 'text-xs' : 'text-sm font-bold'} ${isActive ? 'text-white' : 'text-emerald-100'}`}>{item.name}</span>}
                            </Link>
                        </li>
                    );
                })}
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
                <div className="h-16 flex items-center justify-between px-4 border-b border-emerald-800">
                    <span className="font-black text-lg tracking-tight uppercase">Almark Peru Admin</span>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="text-white p-1.5">
                        <Menu size={24} />
                    </button>
                </div>
                <NavContent mobile />
            </aside>

            {/* Desktop Sidebar */}
            <aside
                className={`${collapsed ? 'w-16' : 'w-64'
                    } bg-[#1B4332] text-white transition-all duration-300 flex flex-col hidden lg:flex shadow-xl`}
            >
                <div className="h-16 flex items-center justify-between px-4 border-b border-emerald-800">
                    {!collapsed && <span className="font-black text-lg tracking-tight uppercase">Almark Peru Admin</span>}
                    <button onClick={() => setCollapsed(!collapsed)} className="text-white hover:bg-emerald-800 p-1.5 rounded-lg transition-colors">
                        <Menu size={20} />
                    </button>
                </div>
                <NavContent />
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden bg-zinc-50 relative">
                <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-zinc-200 shadow-sm z-30">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="lg:hidden text-zinc-500 p-1 hover:bg-zinc-100 rounded"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-xl font-black text-zinc-800 tracking-tight truncate max-w-[150px] sm:max-w-none">
                            PLATAFORMA ERP
                        </h1>
                        {isSupervisor ? (
                            <span className="px-3 py-1 text-[10px] font-black bg-amber-100 text-amber-800 rounded-full uppercase tracking-widest hidden xs:inline-flex items-center gap-1">
                                <Eye size={12} /> Modo supervisor (solo lectura)
                            </span>
                        ) : (
                            <span className="px-3 py-1 text-[10px] font-black bg-emerald-100 text-[#1B4332] rounded-full uppercase tracking-widest hidden xs:inline">
                                Panel Control
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hidden lg:inline">
                            {user?.email}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-red-600 transition-colors"
                        >
                            <LogOut size={18} />
                            <span className="hidden sm:inline">Cerrar Sesión</span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-4 md:p-6 pb-24">
                    {children}
                </div>
            </main>
        </div>
    );
}
