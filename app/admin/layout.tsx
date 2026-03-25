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
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, rol, loading } = useUser();
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const supabase = createClient();

    if (loading) return <div className="flex h-screen items-center justify-center">Cargando...</div>;
    if (rol !== 'ADMIN') return null;

    async function handleLogout() {
        await supabase.auth.signOut();
        window.location.href = '/login';
    }

    const menuItems = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: BarChart3 },
        { name: 'Comedores', href: '/admin/comedores', icon: Building2 },
        { name: 'Logística', href: '/admin/logistica', icon: Truck },
        { name: 'Recursos Humanos', href: '/admin/rrhh', icon: Users },
        { name: 'Reportes', href: '/admin/reportes', icon: FileText },
        { name: 'Configuración', href: '/admin/configuracion', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
            <aside
                className={`${collapsed ? 'w-16' : 'w-64'
                    } bg-[#5850EC] text-white transition-all duration-300 flex flex-col hidden sm:flex`}
            >
                <div className="h-16 flex items-center justify-between px-4 border-b border-indigo-500">
                    {!collapsed && <span className="font-bold text-lg truncate">Admin Panel</span>}
                    <button onClick={() => setCollapsed(!collapsed)} className="text-white hover:bg-indigo-500 p-1 rounded">
                        <Menu size={20} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-4">
                    <ul className="space-y-1 px-2">
                        {menuItems.map((item) => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <li key={item.name}>
                                    <Link
                                        href={item.href}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-indigo-700' : 'hover:bg-indigo-600'
                                            }`}
                                    >
                                        <item.icon size={20} />
                                        {!collapsed && <span>{item.name}</span>}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="md:hidden">
                            <Menu size={24} className="text-zinc-500" />
                        </div>
                        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
                            Panel Administrativo
                        </h1>
                        <span className="px-2 py-1 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full">
                            Admin
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hidden sm:inline">
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

                <div className="flex-1 overflow-auto p-4 md:p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
