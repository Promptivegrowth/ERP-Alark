'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    ChevronRight,
    UtensilsCrossed
} from 'lucide-react';
import { calcularCruceSemanal } from '@/lib/calculations/cruce-semanal';

interface Solicitud {
    id: string;
    comedor_id: string;
    fecha_reporte: string;
    datos_json: any;
    motivo: string;
    estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
    created_at: string;
    comedores: { nombre: string };
}

interface Incidencia {
    id: string;
    comedor_id: string;
    fecha: string;
    tipo: string;
    descripcion: string;
    estado: string;
    created_at: string;
    comedores: { nombre: string };
}

export default function SolicitudesPage() {
    const supabase = createClient();
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [adminComment, setAdminComment] = useState<Record<string, string>>({});

    useEffect(() => {
        loadSolicitudes();

        // Realtime subscription
        const channel = supabase
            .channel('admin_audit')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'reporte_diario_solicitudes'
            }, () => {
                loadSolicitudes();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'incidencias'
            }, () => {
                loadSolicitudes();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function loadSolicitudes() {
        setLoading(true);
        const [solRes, incRes] = await Promise.all([
            supabase.from('reporte_diario_solicitudes').select('*, comedores(nombre)').order('created_at', { ascending: false }),
            supabase.from('incidencias').select('*, comedores(nombre)').eq('estado', 'ABIERTA').order('created_at', { ascending: false })
        ]);

        if (solRes.error) toast.error('Error al cargar solicitudes');
        else setSolicitudes(solRes.data as any[]);

        if (incRes.error) toast.error('Error al cargar incidencias');
        else setIncidencias(incRes.data as any[]);

        setLoading(false);
    }

    async function handleCerrarIncidencia(id: string) {
        setProcessingId(id);
        const { error } = await supabase.from('incidencias').update({ estado: 'CERRADA' } as any).eq('id', id);
        if (error) toast.error('Error al cerrar incidencia');
        else {
            toast.success('Incidencia cerrada ✓');
            loadSolicitudes();
        }
        setProcessingId(null);
    }

    async function handleAprobar(sol: Solicitud) {
        setProcessingId(sol.id);
        try {
            const { reporte, campos_detalle } = sol.datos_json;

            // 1. Upsert reporte_diario header
            const { data: rd, error: rdErr } = await supabase
                .from('reporte_diario')
                .upsert({
                    comedor_id: sol.comedor_id,
                    fecha: sol.fecha_reporte,
                    tiene_coffe_break: reporte.tiene_coffe_break,
                    descripcion_coffe: reporte.descripcion_coffe,
                    monto_coffe: reporte.monto_coffe,
                    observaciones: reporte.observaciones,
                    subtotal: sol.datos_json.totales.monto,
                    updated_at: new Date().toISOString()
                } as any, { onConflict: 'comedor_id,fecha' })
                .select('id')
                .single();

            if (rdErr) throw rdErr;
            const reporteId = (rd as any).id;

            // 2. Upsert values
            const valoresInserts = campos_detalle.map((c: any) => ({
                reporte_id: reporteId,
                campo_id: c.id,
                cantidad: c.cantidad,
                monto: c.monto
            }));

            const { error: vErr } = await supabase.from('reporte_diario_valores').upsert(valoresInserts as any, { onConflict: 'reporte_id,campo_id' });
            if (vErr) throw vErr;

            // 3. Upsert totals
            const categorias = Array.from(new Set(campos_detalle.map((c: any) => c.categoria)));
            const totalesInserts = categorias.map(cat => {
                const catCampos = campos_detalle.filter((c: any) => c.categoria === cat);
                return {
                    reporte_id: reporteId,
                    categoria: cat,
                    label_total: `TOTAL ${cat}`,
                    total_cantidad: catCampos.reduce((acc: number, c: any) => acc + c.cantidad, 0),
                    total_monto: catCampos.reduce((acc: number, c: any) => acc + c.monto, 0)
                };
            });

            await supabase.from('reporte_diario_totales').upsert(totalesInserts as any, { onConflict: 'reporte_id,categoria' });

            // 4. Update Solicitud status
            await supabase
                .from('reporte_diario_solicitudes')
                .update({
                    estado: 'APROBADO',
                    admin_observacion: (adminComment[sol.id] || 'Aprobado por administración')
                } as any)
                .eq('id', sol.id);

            // 5. Trigger Cruce
            try {
                const { data: semId } = await (supabase.rpc as any)('get_or_create_semana', {
                    p_comedor_id: sol.comedor_id,
                    p_fecha: sol.fecha_reporte
                });
                if (semId) await calcularCruceSemanal(sol.comedor_id, semId);
            } catch (e) {
                console.error('Cruce trigger failed', e);
            }

            toast.success('Solicitud aprobada y reporte actualizado ✓');
            loadSolicitudes();
        } catch (err: any) {
            toast.error('Error al aprobar: ' + err.message);
        } finally {
            setProcessingId(null);
        }
    }

    async function handleRechazar(sol: Solicitud) {
        if (!adminComment[sol.id]) {
            toast.error('Por favor ingresa un motivo para el rechazo');
            return;
        }
        setProcessingId(sol.id);
        try {
            await supabase
                .from('reporte_diario_solicitudes')
                .update({
                    estado: 'RECHAZADO',
                    admin_observacion: adminComment[sol.id]
                } as any)
                .eq('id', sol.id);

            toast.success('Solicitud rechazada');
            loadSolicitudes();
        } catch (err) {
            toast.error('Error al procesar rechazo');
        } finally {
            setProcessingId(null);
        }
    }

    if (loading) return <div className="p-8 text-center">Cargando solicitudes...</div>;

    const pendientes = solicitudes.filter(s => s.estado === 'PENDIENTE');
    const procesadas = solicitudes.filter(s => s.estado !== 'PENDIENTE');

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-zinc-800 flex items-center gap-3 tracking-tighter">
                        <AlertTriangle className="text-[#2D6A4F]" />
                        SOLICITUDES DE EMERGENCIA
                    </h1>
                    <p className="text-zinc-500 font-medium">Gestión de reportes extemporáneos enviados por los comedores.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-[#2D6A4F] animate-pulse" />
                    <span className="text-[10px] font-black text-[#1B4332] uppercase tracking-widest">Sistema de Auditoría Activo</span>
                </div>
            </div>

            <section className="space-y-4">
                <h2 className="text-xl font-black text-zinc-700 flex items-center gap-2 uppercase tracking-tight">
                    <Clock size={20} className="text-[#2D6A4F]" />
                    Pendientes de Revisión ({pendientes.length})
                </h2>

                {pendientes.length === 0 ? (
                    <Card className="bg-zinc-50 border-dashed border-2">
                        <CardContent className="py-12 text-center text-zinc-400 font-bold italic">
                            No hay solicitudes pendientes en este momento.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                        {pendientes.map(sol => (
                            <Card key={sol.id} className="border-t-4 border-t-[#2D6A4F] shadow-xl hover:shadow-2xl transition-all duration-300 glass overflow-hidden">
                                <CardHeader className="py-4 px-6 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg font-black text-zinc-800 uppercase">
                                            {sol.comedores?.nombre || 'Comedor'}
                                        </CardTitle>
                                        <CardDescription className="font-medium text-zinc-500">
                                            Reporte para el: <span className="text-zinc-900">{format(new Date(sol.fecha_reporte + 'T12:00:00'), 'PP', { locale: es })}</span>
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                        PENDIENTE
                                    </Badge>
                                </CardHeader>
                                <CardContent className="px-6 pb-6 space-y-4">
                                    <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                                        <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Motivo del Comedor:</p>
                                        <p className="text-sm italic text-zinc-700">"{sol.motivo}"</p>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                                            <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Resumen de Datos:</p>
                                            <div className="space-y-1">
                                                {sol.datos_json.totales.cantidad > 0 && (
                                                    <div className="flex justify-between text-xs font-black whitespace-nowrap">
                                                        <span className="text-zinc-500">TOTAL PAX:</span>
                                                        <span className="text-zinc-900">{sol.datos_json.totales.cantidad}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-xs font-black whitespace-nowrap">
                                                    <span className="text-zinc-500">MONTO TOTAL:</span>
                                                    <span className="text-[#1B4332]">S/ {sol.datos_json.totales.monto.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Textarea
                                                placeholder="Comentario administrativo (opcional para aprobar, obligatorio para rechazar)..."
                                                className="text-xs resize-none"
                                                rows={2}
                                                value={adminComment[sol.id] || ''}
                                                onChange={e => setAdminComment(prev => ({ ...prev, [sol.id]: e.target.value }))}
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-black h-10 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                                                    disabled={processingId === sol.id}
                                                    onClick={() => handleAprobar(sol)}
                                                >
                                                    <CheckCircle2 size={16} className="mr-2" />
                                                    APROBAR
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    className="flex-1 font-bold h-9"
                                                    disabled={processingId === sol.id}
                                                    onClick={() => handleRechazar(sol)}
                                                >
                                                    <XCircle size={16} className="mr-2" />
                                                    RECHAZAR
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-black text-amber-600 flex items-center gap-2 uppercase tracking-tight">
                    <AlertTriangle size={20} />
                    Incidencias Reportadas ({incidencias.length})
                </h2>

                {incidencias.length === 0 ? (
                    <Card className="bg-amber-50/30 border-dashed border-2 border-amber-100">
                        <CardContent className="py-8 text-center text-amber-400 font-bold italic">
                            No hay incidencias abiertas.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                        {incidencias.map(inc => (
                            <Card key={inc.id} className="border-l-4 border-l-amber-500 shadow-sm border border-zinc-100">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge className="bg-amber-100 text-amber-800 border-none text-[10px]">{inc.tipo}</Badge>
                                        <span className="text-[10px] text-zinc-400 font-bold">{format(new Date(inc.fecha + 'T12:00:00'), 'dd/MM')}</span>
                                    </div>
                                    <h4 className="font-black text-zinc-800 text-sm mb-1 uppercase">{inc.comedores?.nombre}</h4>
                                    <p className="text-xs text-zinc-600 line-clamp-3 mb-4 italic">"{inc.descripcion}"</p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full h-8 text-[10px] font-black border-amber-200 text-amber-700 hover:bg-amber-50"
                                        onClick={() => handleCerrarIncidencia(inc.id)}
                                        disabled={processingId === inc.id}
                                    >
                                        MARCAR COMO RESUELTA
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            <section className="pt-8 opacity-75">
                <h2 className="text-lg font-bold text-zinc-500 flex items-center gap-2 mb-4">
                    Procesadas Recientemente
                </h2>
                <div className="space-y-3">
                    {procesadas.slice(0, 10).map(sol => (
                        <div key={sol.id} className="flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-lg text-sm">
                            <div className="flex items-center gap-3">
                                {sol.estado === 'APROBADO' ? (
                                    <CheckCircle2 size={18} className="text-emerald-500" />
                                ) : (
                                    <XCircle size={18} className="text-rose-500" />
                                )}
                                <div>
                                    <p className="font-bold text-zinc-700">{sol.comedores?.nombre}</p>
                                    <p className="text-[10px] text-zinc-400">Reporte {sol.fecha_reporte}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <Badge variant="outline" className={sol.estado === 'APROBADO' ? 'text-emerald-700 border-emerald-200' : 'text-rose-700 border-rose-200'}>
                                    {sol.estado}
                                </Badge>
                                <p className="text-[10px] text-zinc-400 mt-1">{format(new Date(sol.created_at), 'Pp', { locale: es })}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
