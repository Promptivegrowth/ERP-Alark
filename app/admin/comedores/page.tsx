'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, User as UserIcon, Building } from 'lucide-react';

export default function ComedoresPage() {
    const { loading } = useUser();
    const supabase = createClient();
    const [comedores, setComedores] = useState<any[]>([]);
    const [dataLoaded, setDataLoaded] = useState(false);

    useEffect(() => {
        async function loadComedores() {
            const { data } = await supabase.from('comedores').select('*').order('nombre');
            if (data) setComedores(data);
            setDataLoaded(true);
        }
        loadComedores();
    }, [supabase]);

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500">Cargando comedores...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100">Gestión de Comedores</h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Listado Comercial</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Cliente/Empresa</TableHead>
                                <TableHead>Ubicación</TableHead>
                                <TableHead>Responsable</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {comedores.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-semibold">{c.nombre}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                                            <Building size={14} /> {c.cliente_empresa || 'N/A'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                                            <MapPin size={14} /> {c.direccion || 'Desc'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                                            <UserIcon size={14} /> {c.responsable || 'Sin asignar'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${c.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                            {c.activo ? 'Operativo' : 'Inactivo'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link
                                            href={`/admin/comedores/${c.id}`}
                                            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors hover:underline"
                                        >
                                            Ver Detalle
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
