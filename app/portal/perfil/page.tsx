'use client';

import { useUser } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User, Store, Mail, Shield, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PerfilPage() {
    const { user, comedorNombre, rol, loading } = useUser();

    if (loading) return <div className="p-8 text-center text-zinc-500">Cargando perfil...</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <User size={32} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 border-none">Mi Perfil</h2>
                    <p className="text-zinc-500">Información de tu cuenta y acceso al comedor.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Datos del Usuario</CardTitle>
                    <CardDescription>Detalles de tu cuenta registrada en Almark Peru ERP.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 bg-zinc-50">
                        <Mail className="text-zinc-400" size={20} />
                        <div>
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Correo Electrónico</p>
                            <p className="font-medium">{user?.email}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 bg-zinc-50">
                        <Shield className="text-zinc-400" size={20} />
                        <div>
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Rol de Acceso</p>
                            <p className="font-medium">{rol}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 bg-zinc-50">
                        <Calendar className="text-zinc-400" size={20} />
                        <div>
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Miembro desde</p>
                            <p className="font-medium">
                                {user?.created_at ? format(new Date(user.created_at), 'dd MMMM yyyy', { locale: es }) : 'N/A'}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-blue-100 bg-blue-50/30">
                <CardHeader>
                    <CardTitle className="text-blue-900 flex items-center gap-2">
                        <Store size={20} /> Comedor Asignado
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="p-4 rounded-lg bg-white border border-blue-200 shadow-sm">
                        <p className="text-lg font-bold text-blue-800">{comedorNombre || 'Sin comedor asignado'}</p>
                        <p className="text-sm text-blue-600 mt-1">
                            Tienes acceso completo para registrar operaciones y ver el historial de este local.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
