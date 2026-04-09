'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cancelarSolicitudEmergencia } from '@/app/actions/reporte_solicitudes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { calcularCruceSemanal } from '@/lib/calculations/cruce-semanal';
import { Save, Coffee, ChevronDown, ChevronUp, AlertCircle, Calendar as CalendarIcon, Send, Clock, CheckCircle2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { subDays, isAfter, isBefore, startOfDay } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Campo {
    id: string;
    nombre_campo: string;
    categoria: string;
    orden: number;
    activo: boolean;
    es_readonly: boolean;
    formula: string | null;
}

interface FieldValue {
    campo_id: string;
    cantidad: number;
    monto: number;
    precio: number;
}

interface ReporteDiarioState {
    fecha: string;
    observaciones: string;
    tiene_coffe_break: boolean;
    descripcion_coffe: string;
    monto_coffe: number;
    valores: Record<string, { campo_id: string; cantidad: number; monto: number; precio: number }>;
}

// ─── Category styles ──────────────────────────────────────────────────────────
const CATEGORIA_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
    DESAYUNO: { label: '🍳 Desayunos', color: 'text-amber-800', border: 'border-amber-300', bg: 'bg-amber-50' },
    ALMUERZO: { label: '🍽️ Almuerzos', color: 'text-emerald-800', border: 'border-emerald-300', bg: 'bg-emerald-50' },
    CENA: { label: '🌙 Cenas', color: 'text-indigo-800', border: 'border-indigo-300', bg: 'bg-indigo-50' },
    AMANECIDA: { label: '🌅 Amanecidas', color: 'text-purple-800', border: 'border-purple-300', bg: 'bg-purple-50' },
    LONCHE: { label: '🥐 Lonches', color: 'text-orange-800', border: 'border-orange-300', bg: 'bg-orange-50' },
    PAN: { label: '🍞 Pan', color: 'text-yellow-800', border: 'border-yellow-300', bg: 'bg-yellow-50' },
    BEBIDA: { label: '🥤 Bebidas', color: 'text-cyan-800', border: 'border-cyan-300', bg: 'bg-cyan-50' },
    EXTRA: { label: '⭐ Extra / Combos', color: 'text-rose-800', border: 'border-rose-300', bg: 'bg-rose-50' },
    OTRO: { label: '📋 Otros', color: 'text-zinc-800', border: 'border-zinc-300', bg: 'bg-zinc-50' },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReporteDiario() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();

    const [campos, setCampos] = useState<Campo[]>([]);
    const [comedorNombre, setComedorNombre] = useState('');
    const [reporte, setReporte] = useState<ReporteDiarioState>({
        fecha: format(new Date(), 'yyyy-MM-dd'),
        tiene_coffe_break: false,
        descripcion_coffe: '',
        monto_coffe: 0,
        observaciones: '',
        valores: {},
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [isEmergencyMode, setIsEmergencyMode] = useState(false);
    const [pendingRequest, setPendingRequest] = useState<any>(null);
    const [reportingEmergency, setReportingEmergency] = useState(false);
    const today = startOfDay(new Date());
    const minDate = subDays(today, 7);

    // Load fields
    useEffect(() => {
        if (!comedorId) return;
        async function load() {
            const { data: c } = await supabase.from('comedores').select('nombre').eq('id', comedorId as any).single();
            if (c) setComedorNombre((c as any).nombre);

            const { data: camposData } = await supabase
                .from('comedor_campos_reporte')
                .select('*')
                .eq('comedor_id', comedorId as any)
                .eq('activo', true)
                .order('orden');

            if (camposData) setCampos(camposData as Campo[]);
            setDataLoaded(true);
        }
        load();
    }, [comedorId, supabase]);

    const loadExisting = useCallback(async () => {
        if (!comedorId || !reporte.fecha || !dataLoaded) return;
        try {
            const { data: rd } = await supabase
                .from('reporte_diario')
                .select(`
                    *,
                    reporte_diario_valores(
                        *,
                        comedor_campos_reporte(*)
                    )
                `)
                .eq('comedor_id', comedorId as any)
                .eq('fecha', reporte.fecha)
                .maybeSingle();

            if (rd) {
                const valores: Record<string, { campo_id: string; cantidad: number; monto: number; precio: number }> = {};
                ((rd as any).reporte_diario_valores || []).forEach((v: any) => {
                    valores[v.campo_id] = {
                        campo_id: v.campo_id,
                        cantidad: v.cantidad,
                        monto: v.monto,
                        precio: v.precio_unitario || (v.monto / (v.cantidad || 1))
                    };
                });
                setReporte(prev => ({
                    ...prev,
                    tiene_coffe_break: (rd as any).tiene_coffe_break,
                    descripcion_coffe: (rd as any).descripcion_coffe || '',
                    monto_coffe: (rd as any).monto_coffe || 0,
                    observaciones: (rd as any).observaciones || '',
                    valores
                }));
            } else {
                setReporte(prev => ({
                    ...prev,
                    tiene_coffe_break: false,
                    descripcion_coffe: '',
                    monto_coffe: 0,
                    observaciones: '',
                    valores: {}
                }));
            }

            const { data: pending } = await supabase
                .from('reporte_diario_solicitudes')
                .select('*')
                .eq('comedor_id', comedorId as any)
                .eq('estado', 'PENDIENTE')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            setPendingRequest(pending);
        } catch (err) {
            console.error('Error loading existing report:', err);
        }
    }, [comedorId, reporte.fecha, dataLoaded, supabase]);

    useEffect(() => {
        loadExisting();
    }, [loadExisting]);

    // Realtime subscription
    useEffect(() => {
        if (!comedorId) return;

        const channel = supabase
            .channel(`reporte_diario_solicitudes_${comedorId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'reporte_diario_solicitudes',
                filter: `comedor_id=eq.${comedorId}`
            }, () => {
                loadExisting();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [comedorId, loadExisting, supabase]);

    // Handle value change
    const handleCantidad = (campoId: string, val: number) => {
        setReporte(prev => {
            const currentPrecio = prev.valores[campoId]?.precio || 0;
            return {
                ...prev,
                valores: {
                    ...prev.valores,
                    [campoId]: {
                        ...prev.valores[campoId],
                        campo_id: campoId,
                        cantidad: val,
                        precio: currentPrecio,
                        monto: val * currentPrecio
                    }
                }
            };
        });
    };

    const handlePrecio = (campoId: string, val: number) => {
        setReporte(prev => {
            const currentCant = prev.valores[campoId]?.cantidad || 0;
            return {
                ...prev,
                valores: {
                    ...prev.valores,
                    [campoId]: {
                        ...prev.valores[campoId],
                        campo_id: campoId,
                        precio: val,
                        cantidad: currentCant,
                        monto: val * currentCant
                    }
                }
            };
        });
    };

    // Computed readonly
    function getReadonlyCantidad(campo: Campo): number {
        if (!campo.es_readonly || !campo.formula) return reporte.valores[campo.id]?.cantidad || 0;
        const cat = campo.categoria;
        const camposCat = campos.filter(c => c.categoria === cat && !c.es_readonly);
        const prefix = campo.nombre_campo.split(' ')[0];
        const solicitado = camposCat.find(c => c.nombre_campo.includes(prefix) && c.nombre_campo.includes('SOLICITADOS'));
        const consumido = camposCat.find(c => c.nombre_campo.includes(prefix) && c.nombre_campo.includes('CONSUMIDOS'));
        const s = solicitado ? (reporte.valores[solicitado.id]?.cantidad || 0) : 0;
        const c = consumido ? (reporte.valores[consumido.id]?.cantidad || 0) : 0;
        return s - c;
    }

    const categorias = Array.from(new Set(campos.map(c => c.categoria)));

    function subtotalCat(cat: string) {
        return campos
            .filter(c => c.categoria === cat)
            .reduce((acc, c) => {
                const qty = c.es_readonly ? getReadonlyCantidad(c) : (reporte.valores[c.id]?.cantidad || 0);
                return acc + qty;
            }, 0);
    }

    function subtotalMontoCat(cat: string) {
        return campos
            .filter(c => c.categoria === cat)
            .reduce((acc, c) => acc + (reporte.valores[c.id]?.monto || 0), 0);
    }

    function grandTotal() {
        return {
            cantidad: categorias.reduce((acc, cat) => acc + subtotalCat(cat), 0),
            monto: categorias.reduce((acc, cat) => acc + subtotalMontoCat(cat), 0) + (reporte.monto_coffe || 0),
        };
    }

    const totales = grandTotal();

    async function handleSubmit() {
        if (!comedorId) return;
        if (isEmergencyMode) {
            if (!reporte.observaciones || reporte.observaciones.trim().length < 8) {
                toast.error('❌ Para reportes de emergencia, debes ingresar un motivo detallado en Observaciones (mínimo 8 caracteres).');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            if (isEmergencyMode) {
                const fullData = {
                    reporte,
                    totales: grandTotal(),
                    campos_detalle: campos.map(c => ({
                        id: c.id,
                        nombre: c.nombre_campo,
                        categoria: c.categoria,
                        cantidad: c.es_readonly ? getReadonlyCantidad(c) : (reporte.valores[c.id]?.cantidad || 0),
                        monto: reporte.valores[c.id]?.monto || 0
                    }))
                };

                const { error: solErr } = await (supabase.from('reporte_diario_solicitudes') as any).insert({
                    comedor_id: comedorId,
                    fecha_reporte: reporte.fecha,
                    datos_json: fullData,
                    motivo: reporte.observaciones,
                    estado: 'PENDIENTE'
                });

                if (solErr) throw solErr;

                await loadExisting();

                toast.success('Solicitud de emergencia enviada para revisión del administrador ✓');
                setIsEmergencyMode(false);
                setReportingEmergency(true);
                setReporte(prev => ({ ...prev, fecha: format(new Date(), 'yyyy-MM-dd') }));

                setTimeout(() => {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }, 500);

                setTimeout(() => setReportingEmergency(false), 5000);
                return;
            }

            const headerData = {
                comedor_id: comedorId,
                fecha: reporte.fecha,
                tiene_coffe_break: reporte.tiene_coffe_break,
                descripcion_coffe: reporte.descripcion_coffe,
                monto_coffe: reporte.monto_coffe,
                observaciones: reporte.observaciones,
                subtotal: grandTotal().monto,
                updated_at: new Date().toISOString(),
            };

            const { data: existingReport } = await (supabase
                .from('reporte_diario') as any)
                .select('id')
                .eq('comedor_id', comedorId)
                .eq('fecha', reporte.fecha)
                .maybeSingle();

            let reporteId = existingReport?.id;

            if (reporteId) {
                await (supabase.from('reporte_diario') as any).update(headerData).eq('id', reporteId);
            } else {
                const { data, error } = await (supabase.from('reporte_diario') as any).insert(headerData).select('id').single();
                if (error) throw error;
                reporteId = data?.id;
            }

            const valoresInserts = campos.map(campo => ({
                reporte_id: reporteId,
                campo_id: campo.id,
                cantidad: campo.es_readonly ? getReadonlyCantidad(campo) : (reporte.valores[campo.id]?.cantidad || 0),
                monto: reporte.valores[campo.id]?.monto || 0,
                precio_unitario: reporte.valores[campo.id]?.precio || 0
            }));

            await (supabase.from('reporte_diario_valores').upsert(valoresInserts as any, { onConflict: 'reporte_id,campo_id' }) as any);

            const totalesInserts = categorias.map(cat => ({
                reporte_id: reporteId,
                categoria: cat,
                label_total: `TOTAL ${cat}`,
                total_cantidad: subtotalCat(cat),
                total_monto: subtotalMontoCat(cat),
            }));

            await (supabase.from('reporte_diario_totales').upsert(totalesInserts as any, { onConflict: 'reporte_id,categoria' }) as any);

            try {
                const { data: semId, error: semErr } = await (supabase.rpc as any)('get_or_create_semana', {
                    p_comedor_id: comedorId,
                    p_fecha: reporte.fecha
                });
                if (!semId || semErr) throw new Error('No se pudo identificar la semana para el cruce');
                await calcularCruceSemanal(comedorId as string, semId as string);
            } catch (cruceErr) {
                console.error('Error calculating cruce:', cruceErr);
            }

            toast.success('Reporte diario guardado ✓');
        } catch (err: any) {
            console.error(err);
            toast.error(`Error al procesar: ${err.message || 'Intenta nuevamente'}`);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleCancelarSolicitud() {
        if (!pendingRequest || !confirm('¿Estás seguro de cancelar esta solicitud de actualización?')) return;
        setIsSubmitting(true);
        try {
            const result = await cancelarSolicitudEmergencia(pendingRequest.id);

            if (!result.success) {
                console.error('Server Action failed:', result.error);
                toast.error(`❌ Error: ${result.error}`);
            } else {
                toast.success('Solicitud cancelada ✓');
                setPendingRequest(null);

                setTimeout(async () => {
                    await loadExisting();
                }, 1000);
            }
        } catch (err) {
            console.error('Cancellation exception:', err);
            toast.error('Error al procesar la cancelación');
        } finally {
            setIsSubmitting(false);
        }
    }

    if (loading || !dataLoaded) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-sm text-zinc-500">Cargando formulario...</p>
                </div>
            </div>
        );
    }

    if (campos.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center p-8 border-2 border-dashed border-zinc-200 rounded-xl">
                    <p className="text-zinc-500 font-medium">No hay campos configurados para este comedor.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mb-1">Panel de Control</p>
                    <p className="text-2xl font-black text-[#1B4332] tracking-tighter uppercase">{comedorNombre}</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-sm font-black text-zinc-500 uppercase">Fecha:</label>
                    <Input
                        type="date"
                        className="w-44 border-[#2D6A4F] font-black focus:ring-[#2D6A4F]"
                        value={reporte.fecha}
                        onChange={e => setReporte(prev => ({ ...prev, fecha: e.target.value }))}
                    />
                </div>
            </div>

            {categorias.map(cat => {
                const config = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG.OTRO;
                const camposCat = campos.filter(c => c.categoria === cat);
                return (
                    <Card key={cat} className={`border-l-4 ${config.border} shadow-md overflow-hidden bg-white/50 backdrop-blur-sm`}>
                        <CardHeader className={`${config.bg} py-3 px-4 flex flex-row items-center justify-between`}>
                            <CardTitle className={`text-base font-black uppercase tracking-tight ${config.color}`}>
                                {config.label}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-[#1B4332]/5 text-[#1B4332] text-xs">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Concepto / Servicio</th>
                                            <th className="px-4 py-2 text-right w-24">Cant.</th>
                                            <th className="px-4 py-2 text-right w-24">Precio S/</th>
                                            <th className="px-4 py-2 text-right w-32 font-bold bg-[#1B4332]/10">Total S/</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {camposCat.map((campo) => {
                                            const val = reporte.valores[campo.id];
                                            return (
                                                <tr key={campo.id} className="hover:bg-zinc-50 border-zinc-100">
                                                    <td className="px-4 py-3 font-medium text-zinc-900 border-r border-zinc-100">{campo.nombre_campo}</td>
                                                    <td className="px-2 py-2 border-r border-zinc-100">
                                                        <Input
                                                            type="number"
                                                            value={val?.cantidad || ''}
                                                            onChange={(e) => handleCantidad(campo.id, Number(e.target.value))}
                                                            className="h-9 text-right font-black text-lg border-emerald-100 focus:ring-emerald-500"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2 border-r border-zinc-100">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={val?.precio || ''}
                                                            onChange={(e) => handlePrecio(campo.id, Number(e.target.value))}
                                                            className="h-9 text-right font-medium text-emerald-800 bg-emerald-50/30 border-emerald-100 focus:ring-emerald-500"
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-black text-xl text-[#1B4332] bg-[#1B4332]/5">
                                                        {(val?.monto || 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className={`${config.bg} font-black`}>
                                        <tr>
                                            <td className="px-4 py-2 text-right">TOTAL {config.label.split(' ')[1]}</td>
                                            <td className="px-4 py-2 text-right text-lg border-x border-zinc-200">{subtotalCat(cat)}</td>
                                            <td className="px-4 py-2 border-r border-zinc-200"></td>
                                            <td className="px-4 py-2 text-right text-lg text-[#1B4332] bg-[#1B4332]/10">
                                                S/. {subtotalMontoCat(cat).toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            {/* Coffe Break */}
            <Card className="border-l-4 border-l-amber-400 shadow-md bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-amber-50 py-3 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-black uppercase tracking-tight text-amber-800">
                        ☕ Coffe Break / Eventos
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">¿Hubo Coffe?</label>
                        <Switch
                            checked={reporte.tiene_coffe_break}
                            onCheckedChange={val => setReporte(prev => ({ ...prev, tiene_coffe_break: val }))}
                        />
                    </div>
                </CardHeader>
                {reporte.tiene_coffe_break && (
                    <CardContent className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase">Descripción</label>
                                <Input
                                    value={reporte.descripcion_coffe}
                                    onChange={e => setReporte(prev => ({ ...prev, descripcion_coffe: e.target.value }))}
                                    className="font-bold border-zinc-200"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase">Monto S/</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={reporte.monto_coffe}
                                    onChange={e => setReporte(prev => ({ ...prev, monto_coffe: parseFloat(e.target.value) || 0 }))}
                                    className="font-black border-zinc-200 text-amber-700"
                                />
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Observaciones */}
            <Card className="border-l-4 border-l-zinc-400 shadow-md bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-zinc-50 py-3 px-4">
                    <CardTitle className="text-base font-black uppercase tracking-tight text-zinc-800">
                        💬 Observaciones Generales
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <Textarea
                        placeholder="Cualquier aclaración adicional..."
                        value={reporte.observaciones}
                        onChange={e => setReporte(prev => ({ ...prev, observaciones: e.target.value }))}
                        className="font-medium border-zinc-200 min-h-[80px]"
                    />
                </CardContent>
            </Card>

            {/* ─── EMERGENCY SECTION (AT THE BOTTOM) ─── */}
            <div className="pt-10 space-y-6">
                <div className="flex items-center gap-4">
                    <div className="h-[2px] flex-1 bg-zinc-100" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Zona de Emergencias</span>
                    <div className="h-[2px] flex-1 bg-zinc-100" />
                </div>

                {/* Emergency Banner */}
                <div className="flex flex-col sm:flex-row items-center justify-between bg-zinc-900 text-white p-4 rounded-xl shadow-lg border-b-4 border-rose-600 gap-4 transition-all duration-500">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isEmergencyMode ? 'bg-rose-600 animate-pulse' : 'bg-zinc-800'}`}>
                            <AlertCircle size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">¿Necesitas reportar un día pasado?</h4>
                            <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Máximo 7 días de antiguedad • Requiere aprobación</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        className={isEmergencyMode
                            ? "bg-rose-600 hover:bg-rose-700 text-white font-black px-6 shadow-md transition-all active:scale-95"
                            : "bg-rose-500 hover:bg-rose-600 text-white font-black px-6 shadow-md transition-all active:scale-95"
                        }
                        onClick={() => {
                            setIsEmergencyMode(!isEmergencyMode);
                            if (!isEmergencyMode) setReporte(prev => ({ ...prev, fecha: format(new Date(), 'yyyy-MM-dd') }));
                        }}
                    >
                        {isEmergencyMode ? 'CANCELAR EMERGENCIA' : '🆘 ACTIVAR MODO EMERGENCIA'}
                    </Button>
                </div>

                {/* Date Selection (Emergency Form) */}
                {isEmergencyMode && (
                    <Card className="border-2 border-rose-300 shadow-lg overflow-hidden animate-in slide-in-from-top-4 duration-500 mt-4">
                        <CardHeader className="bg-rose-50 py-3 px-4 flex flex-row items-center justify-between border-b border-rose-100">
                            <span className="text-sm font-black text-rose-800 uppercase flex items-center gap-2">
                                <CalendarIcon size={18} /> SELECCIONAR FECHA DE REPORTE PASADO
                            </span>
                            <Badge className="bg-rose-600 px-3 py-1 text-white font-black">MODO EMERGENCIA</Badge>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button type="button" variant="outline" className="w-full sm:w-[280px] justify-start text-left font-black border-rose-300">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {reporte.fecha ? format(new Date(reporte.fecha + 'T12:00:00'), 'PPP', { locale: es }) : <span>Seleccionar fecha</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={new Date(reporte.fecha + 'T12:00:00')}
                                            onSelect={(date) => date && setReporte(prev => ({ ...prev, fecha: format(date, 'yyyy-MM-dd') }))}
                                            disabled={(date) => isAfter(date, today) || isBefore(date, minDate)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <div className="flex-1 text-xs text-rose-700 font-bold leading-relaxed italic uppercase tracking-tighter">
                                    ⚠️ No afecta liquidación hasta aprobación • Mínimo 8 caracteres en motivo
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold text-rose-800 uppercase">Motivo detallado:</label>
                                    <span className={`text-[10px] font-black uppercase ${reporte.observaciones.length >= 8 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                        {reporte.observaciones.length} / 8
                                    </span>
                                </div>
                                <Textarea
                                    placeholder="Explica detalladamente por qué necesitas actualizar este día pasado..."
                                    value={reporte.observaciones}
                                    onChange={e => setReporte(prev => ({ ...prev, observaciones: e.target.value }))}
                                    className="min-h-[80px] border-rose-300 focus:ring-rose-400 bg-white font-medium"
                                    required
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Success Message for Emergency */}
                {!isEmergencyMode && !pendingRequest && reportingEmergency && (
                    <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-inner">
                        <CheckCircle2 className="text-emerald-600" />
                        <p className="text-emerald-800 font-black text-sm uppercase">¡Solicitud enviada con éxito! Aparecerá abajo en breve.</p>
                    </div>
                )}

                {/* Pending Request Status Card */}
                {pendingRequest && (
                    <div className="animate-in fade-in zoom-in-95 duration-500">
                        <Card className="border-2 border-amber-200 shadow-xl overflow-hidden bg-amber-50/50 backdrop-blur-sm">
                            <CardHeader className="bg-amber-100/50 border-b border-amber-200 py-4 text-center">
                                <CardTitle className="text-lg font-black text-amber-900 uppercase tracking-tighter flex items-center justify-center gap-2">
                                    <Clock className="text-amber-600" size={20} />
                                    Solicitud en Curso ({format(new Date(pendingRequest.fecha_reporte + 'T12:00:00'), 'dd/MM/yyyy')})
                                </CardTitle>
                                <p className="text-amber-700 font-bold text-[10px] uppercase">
                                    Enviada el {format(new Date(pendingRequest.created_at), "PPP 'a las' p", { locale: es })}
                                </p>
                            </CardHeader>
                            <CardContent className="p-5 space-y-4">
                                <div className="bg-white/80 p-3 rounded-lg border border-amber-100 shadow-sm">
                                    <p className="text-zinc-700 italic text-sm font-medium text-center">"{pendingRequest.motivo}"</p>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-4 justify-between border-t border-amber-200 pt-4">
                                    <p className="text-[10px] text-amber-800 font-black uppercase leading-tight italic max-w-sm">
                                        Esta solicitud está siendo revisada por administración. Puedes seguir reportando otros días normalmente.
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-rose-200 text-rose-600 hover:bg-rose-50 font-black px-6 shadow-sm whitespace-nowrap active:scale-95 transition-transform"
                                        onClick={handleCancelarSolicitud}
                                        disabled={isSubmitting}
                                    >
                                        CANCELAR SOLICITUD
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Sticky Save Bar */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-40 bg-white/95 backdrop-blur-md border-t-4 border-[#1B4332] px-4 sm:px-6 py-4 shadow-[0_-10px_50px_rgba(0,0,0,0.15)] pb-safe-offset-4 animate-in slide-in-from-bottom-8 duration-500">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-6 overflow-x-auto w-full sm:w-auto invisible-scrollbar pb-1 sm:pb-0">
                        {categorias.map(cat => {
                            const config = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG.OTRO;
                            const qty = subtotalCat(cat);
                            if (qty === 0) return null;
                            return (
                                <div key={cat} className="flex flex-col items-center">
                                    <span className={`font-black text-xl leading-none ${config.color}`}>{qty}</span>
                                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight mt-1">{cat.slice(0, 4)}</span>
                                </div>
                            );
                        })}
                        <div className="flex flex-col items-end border-l-2 border-zinc-100 pl-6 ml-2 whitespace-nowrap">
                            <span className="font-black text-2xl text-[#1B4332] tracking-tighter leading-none">S/ {totales.monto.toFixed(2)}</span>
                            <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1">LIQUIDACIÓN TOTAL</span>
                        </div>
                    </div>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        size="lg"
                        className={`${isEmergencyMode ? 'bg-rose-600 hover:bg-rose-800 animate-pulse' : 'bg-[#2D6A4F] hover:bg-[#1B4332]'} text-white flex gap-3 w-full sm:w-80 font-black h-14 shadow-2xl transition-all transform active:scale-95`}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                                <span className="uppercase tracking-widest">Procesando...</span>
                            </div>
                        ) : isEmergencyMode ? (
                            <><Send size={20} /><span className="uppercase tracking-wide">Enviar Solicitud</span></>
                        ) : (
                            <><Save size={20} /><span className="uppercase tracking-wide">Guardar Reporte Diario</span></>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
