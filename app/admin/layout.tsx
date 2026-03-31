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
        { name: 'Solicitudes', href: '/admin/solicitudes', icon: AlertTriangle },
        { name: 'Logística', href: '/admin/logistica', icon: Truck },
        { name: 'Recursos Humanos', href: '/admin/rrhh', icon: Users },
        { name: 'Reportes', href: '/admin/reportes', icon: FileText },
        { name: 'Configuración', href: '/admin/configuracion', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
            <aside
                className={`${collapsed ? 'w-16' : 'w-64'
                    } bg-[#1B4332] text-white transition-all duration-300 flex flex-col hidden sm:flex shadow-xl`}
            >
                <div className="h-16 flex items-center justify-between px-4 border-b border-emerald-800">
                    {!collapsed && <span className="font-black text-lg tracking-tight uppercase">Alark Admin</span>}
                    <button onClick={() => setCollapsed(!collapsed)} className="text-white hover:bg-emerald-800 p-1.5 rounded-lg transition-colors">
                        <Menu size={20} />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-6">
                    <ul className="space-y-2 px-3">
                        {menuItems.map((item) => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <li key={item.name}>
                                    <Link
                                        href={item.href}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive ? 'bg-[#2D6A4F] shadow-lg scale-[1.02]' : 'hover:bg-[#2D6A4F]/40'
                                            }`}
                                    >
                                        <item.icon size={20} className={isActive ? 'text-white' : 'text-emerald-300 group-hover:text-white'} />
                                        {!collapsed && <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-emerald-100'}`}>{item.name}</span>}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden bg-zinc-50">
                <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-zinc-200 shadow-sm z-20">
                    <div className="flex items-center gap-4">
                        <div className="md:hidden">
                            <Menu size={24} className="text-zinc-500" />
                        </div>
                        <h1 className="text-xl font-black text-zinc-800 tracking-tight">
                            PLATAFORMA ERP
                        </h1>
                        <span className="px-3 py-1 text-[10px] font-black bg-emerald-100 text-[#1B4332] rounded-full uppercase tracking-widest">
                            Panel Control
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
