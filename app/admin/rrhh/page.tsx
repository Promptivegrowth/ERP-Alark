'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UsersRound, AlertTriangle } from 'lucide-react';

export default function RRHHPage() {
    const { loading } = useUser();
    const supabase = createClient();
    const [incidencias, setIncidencias] = useState<any[]>([]);
    const [dataLoaded, setDataLoaded] = useState(false);

    async function loadIncidencias() {
        const { data } = await supabase
            .from('incidencias')
            .select('*, comedores(nombre)')
            .order('estado', { ascending: true }) // ABIERTA comes first alphabetically usually, or we can sort by date
            .order('created_at', { ascending: false });

        if (data) {
            // Custom sort to prioritize ABIERTA > EN_PROCESO > RESUELTA
            const orderMap: Record<string, number> = { 'ABIERTA': 1, 'EN_PROCESO': 2, 'RESUELTA': 3 };
            const sorted = data.sort((a, b) => (orderMap[a.estado] || 9) - (orderMap[b.estado] || 9));
            setIncidencias(sorted);
        }
        setDataLoaded(true);
    }

    useEffect(() => {
        loadIncidencias();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase]);

    async function actualizarEstado(id: string, nuevoEstado: string) {
        try {
            const { error } = await supabase
                .from('incidencias')
                .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            toast.success(`Incidencia marcada como ${nuevoEstado}`);
            loadIncidencias(); // reload
        } catch (e) {
            console.error(e);
            toast.error('Error al actualizar la incidencia');
        }
    }

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500">Cargando módulo de RRHH...</div>;

    const abiertas = incidencias.filter(i => i.estado === 'ABIERTA').length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                        <UsersRound /> Recursos Humanos
                    </h2>
                    <p className="text-zinc-500">Gestión de personal e incidencias operativas de comedores.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-red-800 dark:text-red-500 text-sm font-semibold">Incidencias Críticas Abiertas</CardTitle>
                        <AlertTriangle className="text-red-600 h-5 w-5" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">{abiertas}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bandeja de Incidencias Operativas</CardTitle>
                    <CardDescription>Atiende los reportes de los encargados respecto a personal, equipamiento e insumos.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-40">Fecha/Hora</TableHead>
                                <TableHead className="w-48">Comedor</TableHead>
                                <TableHead className="w-32">Categoría</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead className="w-40">Estado</TableHead>
                                <TableHead className="text-right w-40">Cambiar Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {incidencias.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-zinc-500">No hay incidencias registradas</TableCell></TableRow>
                            ) : incidencias.map((i) => (
                                <TableRow key={i.id} className={i.estado === 'RESUELTA' ? 'opacity-60 bg-zinc-50 dark:bg-zinc-900/50' : ''}>
                                    <TableCell className="font-medium text-xs">
                                        {format(new Date(i.created_at), 'dd MMM yy HH:mm')}
                                    </TableCell>
                                    <TableCell className="font-semibold text-sm">
                                        {i.comedores?.nombre || 'Desconocido'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-white">
                                            {i.tipo}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">{i.descripcion}</TableCell>
                                    <TableCell>
                                        <Badge className={
                                            i.estado === 'ABIERTA' ? 'bg-red-100 text-red-800 hover:bg-red-200' :
                                                i.estado === 'EN_PROCESO' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' :
                                                    'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                        }>
                                            {i.estado.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Select
                                            disabled={i.estado === 'RESUELTA'}
                                            defaultValue={i.estado}
                                            onValueChange={(val) => actualizarEstado(i.id, val)}
                                        >
                                            <SelectTrigger className="w-full text-xs h-8">
                                                <SelectValue placeholder="Estado" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ABIERTA">Abierta</SelectItem>
                                                <SelectItem value="EN_PROCESO">En Proceso</SelectItem>
                                                <SelectItem value="RESUELTA">Resuelta</SelectItem>
                                            </SelectContent>
                                        </Select>
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
