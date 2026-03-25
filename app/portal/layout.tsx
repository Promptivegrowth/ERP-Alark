'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import {
    Home,
    Calendar,
    TableProperties,
    Upload,
    History,
    User,
    LogOut,
    Menu,
    ChevronDown,
    Package,
    Cake,
    Wheat,
    Receipt,
    Coffee
} from 'lucide-react';
import { IncidenceModal } from '@/components/IncidenceModal';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const { user, comedorNombre, rol, loading } = useUser();
    const [collapsed, setCollapsed] = useState(false);
    const [semanalOpen, setSemanalOpen] = useState(false);
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
        { name: 'Liquidación del día', href: '/portal/diario', icon: Calendar },
    ];

    const semanalItems = [
        { name: 'Kardex Snacks', href: '/portal/semanal/kardex-snacks', icon: Package },
        { name: 'Kardex Pasteles', href: '/portal/semanal/kardex-pasteles', icon: Cake },
        { name: 'Pedido de Pan', href: '/portal/semanal/pedido-pan', icon: Wheat },
        { name: 'Gastos', href: '/portal/semanal/gastos', icon: Receipt },
        { name: 'Coffe & Otros', href: '/portal/semanal/coffe-otros', icon: Coffee },
    ];

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* Sidebar */}
            <aside
                className={`${collapsed ? 'w-16' : 'w-64'
                    } bg-[#1A56DB] text-white transition-all duration-300 flex flex-col hidden sm:flex`}
            >
                <div className="h-16 flex items-center justify-between px-4 border-b border-blue-600">
                    {!collapsed && <span className="font-bold text-lg truncate">Comedores</span>}
                    <button onClick={() => setCollapsed(!collapsed)} className="text-white hover:bg-blue-600 p-1 rounded">
                        <Menu size={20} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-4">
                    <ul className="space-y-1 px-2">
                        {menuItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.name}>
                                    <Link
                                        href={item.href}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-blue-600' : 'hover:bg-blue-700'
                                            }`}
                                    >
                                        <item.icon size={20} />
                                        {!collapsed && <span>{item.name}</span>}
                                    </Link>
                                </li>
                            );
                        })}

                        <li>
                            <button
                                onClick={() => setSemanalOpen(!semanalOpen)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors hover:bg-blue-700`}
                            >
                                <div className="flex items-center gap-3">
                                    <TableProperties size={20} />
                                    {!collapsed && <span>Ingreso semanal</span>}
                                </div>
                                {!collapsed && <ChevronDown size={16} className={`transition-transform ${semanalOpen ? 'rotate-180' : ''}`} />}
                            </button>

                            {semanalOpen && !collapsed && (
                                <ul className="mt-1 ml-6 space-y-1">
                                    {semanalItems.map((sub) => (
                                        <li key={sub.name}>
                                            <Link
                                                href={sub.href}
                                                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${pathname === sub.href ? 'bg-blue-600' : 'hover:bg-blue-700'
                                                    }`}
                                            >
                                                <sub.icon size={16} />
                                                <span>{sub.name}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>

                        <li>
                            <Link href="/portal/reporte-sistema" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${pathname === '/portal/reporte-sistema' ? 'bg-blue-600' : 'hover:bg-blue-700'}`}>
                                <Upload size={20} />
                                {!collapsed && <span>Reporte Sistema</span>}
                            </Link>
                        </li>
                        <li>
                            <Link href="/portal/historial" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${pathname === '/portal/historial' ? 'bg-blue-600' : 'hover:bg-blue-700'}`}>
                                <History size={20} />
                                {!collapsed && <span>Historial</span>}
                            </Link>
                        </li>
                        <li>
                            <Link href="/portal/perfil" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${pathname === '/portal/perfil' ? 'bg-blue-600' : 'hover:bg-blue-700'}`}>
                                <User size={20} />
                                {!collapsed && <span>Perfil</span>}
                            </Link>
                        </li>
                    </ul>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="md:hidden">
                            <Menu size={24} className="text-zinc-500" />
                        </div>
                        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
                            {comedorNombre || 'Cargando Comedor...'}
                        </h1>
                        <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
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

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 md:p-6 pb-24 relative">
                    {children}
                    <IncidenceModal />
                </div>
            </main>
        </div>
    );
}
