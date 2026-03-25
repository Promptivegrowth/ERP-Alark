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
import { AlertCircle, CheckCircle2, Factory } from 'lucide-react';

export default function LogisticaPage() {
    const { loading } = useUser();
    const supabase = createClient();
    const [alertas, setAlertas] = useState<any[]>([]);
    const [dataLoaded, setDataLoaded] = useState(false);

    async function loadAlertas() {
        const { data } = await supabase
            .from('logistica_alertas')
            .select('*, comedores(nombre)')
            .order('atendido', { ascending: true })
            .order('created_at', { ascending: false });

        if (data) setAlertas(data);
        setDataLoaded(true);
    }

    useEffect(() => {
        loadAlertas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase]);

    async function marcarAtendido(id: string) {
        try {
            const { error } = await supabase
                .from('logistica_alertas')
                .update({ atendido: true, fecha_atencion: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            toast.success('Alerta marcada como atendida');
            loadAlertas(); // reload
        } catch (e) {
            console.error(e);
            toast.error('Error al actualizar la alerta');
        }
    }

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500">Cargando módulo de logística...</div>;

    const pendientes = alertas.filter(a => !a.atendido).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100">Logística y Despacho</h2>
                    <p className="text-zinc-500">Gestión de alertas de stock y pedidos de comedores.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-amber-800 dark:text-amber-500 text-sm font-semibold">Alertas Críticas Pendientes</CardTitle>
                        <AlertCircle className="text-amber-600 h-5 w-5" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-600">{pendientes}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bandeja de Alertas</CardTitle>
                    <CardDescription>Atiende los pedidos de pan y las rupturas de stock reportadas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-40">Fecha/Hora</TableHead>
                                <TableHead className="w-48">Comedor</TableHead>
                                <TableHead className="w-32">Tipo</TableHead>
                                <TableHead>Mensaje Detalle</TableHead>
                                <TableHead className="w-32">Estado</TableHead>
                                <TableHead className="text-right w-32">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {alertas.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-zinc-500">No hay alertas logísticas registradas</TableCell></TableRow>
                            ) : alertas.map((a) => (
                                <TableRow key={a.id} className={a.atendido ? 'opacity-60 bg-zinc-50 dark:bg-zinc-900/50' : ''}>
                                    <TableCell className="font-medium text-xs">
                                        {format(new Date(a.created_at), 'dd MMM yy HH:mm')}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 font-semibold">
                                            <Factory size={14} className="text-zinc-400" />
                                            {a.comedores?.nombre || 'Desconocido'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={a.tipo === 'STOCK_CRITICO' ? 'border-red-200 text-red-700 bg-red-50' : 'border-blue-200 text-blue-700 bg-blue-50'}>
                                            {a.tipo.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">{a.mensaje}</TableCell>
                                    <TableCell>
                                        {a.atendido ? (
                                            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={14} /> Atendido</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600"><AlertCircle size={14} /> Pendiente</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {!a.atendido && (
                                            <Button size="sm" onClick={() => marcarAtendido(a.id)} className="bg-indigo-600 hover:bg-indigo-700">
                                                Atender
                                            </Button>
                                        )}
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
