'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { calcularCruceSemanal } from '@/lib/calculations/cruce-semanal';
import { Save, Coffee, ChevronDown, ChevronUp, AlertCircle, Calendar as CalendarIcon, Send } from 'lucide-react';
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
}

interface ReporteData {
    id?: string;
    fecha: string;
    tiene_coffe_break: boolean;
    descripcion_coffe: string;
    monto_coffe: number;
    observaciones: string;
    valores: Record<string, FieldValue>;
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

const VOLCAN_FAUCETT = ['ALMUERZOS FAUCETT', 'CENA FAUCETT', 'AMANECIDA FAUCETT'];
const PAMOLSA_TOTTUS = ['PANES TOTTUS', 'BEBIDAS TOTTUS', 'ALMUERZOS TOTTUS', 'CENAS TOTTUS'];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReporteDiario() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();

    const [campos, setCampos] = useState<Campo[]>([]);
    const [comedorNombre, setComedorNombre] = useState('');
    const [reporte, setReporte] = useState<ReporteData>({
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
    const [activeTab, setActiveTab] = useState('diario');
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

    // Load existing report for date
    useEffect(() => {
        if (!comedorId || !reporte.fecha || !dataLoaded) return;
        async function loadExisting() {
            try {
                const { data: rd } = await supabase
                    .from('reporte_diario')
                    .select('*, reporte_diario_valores(*)')
                    .eq('comedor_id', comedorId as any)
                    .eq('fecha', reporte.fecha)
                    .maybeSingle();

                if (rd) {
                    const valores: Record<string, FieldValue> = {};
                    ((rd as any).reporte_diario_valores || []).forEach((v: any) => {
                        valores[v.campo_id] = { campo_id: v.campo_id, cantidad: v.cantidad, monto: v.monto };
                    });
                    setReporte(prev => ({
                        ...prev,
                        id: (rd as any).id,
                        tiene_coffe_break: (rd as any).tiene_coffe_break,
                        descripcion_coffe: (rd as any).descripcion_coffe || '',
                        monto_coffe: (rd as any).monto_coffe || 0,
                        observaciones: (rd as any).observaciones || '',
                        valores
                    }));
                } else {
                    setReporte(prev => ({
                        ...prev,
                        id: undefined,
                        tiene_coffe_break: false,
                        descripcion_coffe: '',
                        monto_coffe: 0,
                        observaciones: '',
                        valores: {}
                    }));
                }

                // Check for pending requests for this date
                const { data: pending } = await supabase
                    .from('reporte_diario_solicitudes')
                    .select('*')
                    .eq('comedor_id', comedorId as any)
                    .eq('fecha_reporte', reporte.fecha)
                    .eq('estado', 'PENDIENTE')
                    .maybeSingle();

                setPendingRequest(pending);
            } catch (err) {
                console.error('Error loading existing report:', err);
            }
        }
        loadExisting();
    }, [comedorId, reporte.fecha, dataLoaded, supabase]);

    // Handle value change
    const handleCantidad = useCallback((campoId: string, val: number) => {
        setReporte(prev => ({
            ...prev,
            valores: {
                ...prev.valores,
                [campoId]: { ...prev.valores[campoId], campo_id: campoId, cantidad: val, monto: prev.valores[campoId]?.monto || 0 },
            },
        }));
    }, []);

    const handleMonto = useCallback((campoId: string, val: number) => {
        setReporte(prev => ({
            ...prev,
            valores: {
                ...prev.valores,
                [campoId]: { ...prev.valores[campoId], campo_id: campoId, monto: val, cantidad: prev.valores[campoId]?.cantidad || 0 },
            },
        }));
    }, []);

    // Computed readonly (e.g. QUEBRADO = SOLICITADOS - CONSUMIDOS)
    function getReadonlyCantidad(campo: Campo): number {
        if (!campo.es_readonly || !campo.formula) return reporte.valores[campo.id]?.cantidad || 0;
        const cat = campo.categoria;
        const camposCat = campos.filter(c => c.categoria === cat && !c.es_readonly);
        const prefix = campo.nombre_campo.split(' ')[0]; // ALMUERZOS / CENAS
        const solicitado = camposCat.find(c => c.nombre_campo.includes(prefix) && c.nombre_campo.includes('SOLICITADOS'));
        const consumido = camposCat.find(c => c.nombre_campo.includes(prefix) && c.nombre_campo.includes('CONSUMIDOS'));
        const s = solicitado ? (reporte.valores[solicitado.id]?.cantidad || 0) : 0;
        const c = consumido ? (reporte.valores[consumido.id]?.cantidad || 0) : 0;
        return s - c;
    }

    // Group by category
    const categorias = Array.from(new Set(campos.map(c => c.categoria)));

    // Subtotals per category
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
            monto: categorias.reduce((acc, cat) => acc + subtotalMontoCat(cat), 0) + reporte.monto_coffe,
        };
    }

    // Submit
    async function handleSubmit() {
        if (!comedorId) return;

        // Validation for Emergency Mode
        if (isEmergencyMode) {
            if (!reporte.observaciones || reporte.observaciones.trim().length < 8) {
                toast.error('❌ Para reportes de emergencia, debes ingresar un motivo detallado en Observaciones (mínimo 8 caracteres).');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            if (isEmergencyMode) {
                // Prepare full report data for JSON storage
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

                toast.success('Solicitud de emergencia enviada para revisión del administrador ✓');
                setIsEmergencyMode(false);
                setReporte(prev => ({ ...prev, fecha: format(new Date(), 'yyyy-MM-dd') }));
                return;
            }

            let reporteId = reporte.id;

            // Upsert header
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

            if (reporteId) {
                const { error } = await supabase.from('reporte_diario').update(headerData as any).eq('id', reporteId as any);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('reporte_diario').insert(headerData as any).select('id').single();
                if (error) throw error;
                reporteId = (data as any).id;
                setReporte(prev => ({ ...prev, id: reporteId }));
            }

            // Upsert values
            const valoresInserts = campos.map(campo => ({
                reporte_id: reporteId,
                campo_id: campo.id,
                cantidad: campo.es_readonly ? getReadonlyCantidad(campo) : (reporte.valores[campo.id]?.cantidad || 0),
                monto: reporte.valores[campo.id]?.monto || 0,
            }));

            const { error: vErr } = await supabase.from('reporte_diario_valores').upsert(valoresInserts as any, { onConflict: 'reporte_id,campo_id' });
            if (vErr) throw vErr;

            // Upsert totals per category
            const totalesInserts = categorias.map(cat => ({
                reporte_id: reporteId,
                categoria: cat,
                label_total: `TOTAL ${cat}`,
                total_cantidad: subtotalCat(cat),
                total_monto: subtotalMontoCat(cat),
            }));


            await supabase.from('reporte_diario_totales').upsert(totalesInserts as any, { onConflict: 'reporte_id,categoria' });

            // 4. Trigger Cruce calculation
            try {
                // Get or create semana_id via RPC
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
        const { error } = await supabase.from('reporte_diario_solicitudes').delete().eq('id', pendingRequest.id);
        if (error) toast.error('Error al cancelar solicitud');
        else {
            toast.success('Solicitud cancelada ✓');
            setPendingRequest(null);
        }
        setIsSubmitting(false);
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
                    <p className="text-xs text-zinc-400 mt-1">Contacta al administrador para configurarlos.</p>
                </div>
            </div>
        );
    }

    const totales = grandTotal();

    return (
        <div className="space-y-5 pb-40">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#1B4332]">Reporte Diario</h2>
                    <p className="text-sm text-zinc-500">{comedorNombre}</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-zinc-600">Fecha:</label>
                    <Input
                        type="date"
                        className="w-44 border-[#2D6A4F] focus:ring-[#2D6A4F]"
                        value={reporte.fecha}
                        onChange={e => setReporte(prev => ({ ...prev, fecha: e.target.value }))}
                    />
                    {reporte.id && !pendingRequest && <Badge className="bg-emerald-100 text-emerald-800 text-xs">Reporte guardado</Badge>}
                    {pendingRequest && <Badge className="bg-amber-100 text-amber-800 text-xs animate-pulse">Solicitud Pendiente</Badge>}
                </div>
            </div>

            {/* Pending Request View */}
            {pendingRequest ? (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <Card className="border-2 border-amber-200 shadow-xl overflow-hidden bg-amber-50/30">
                        <CardHeader className="bg-amber-100/50 border-b border-amber-200 py-6 text-center">
                            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 border-2 border-amber-300">
                                <Coffee className="text-amber-600" size={32} />
                            </div>
                            <CardTitle className="text-2xl font-black text-amber-900 uppercase tracking-tighter">
                                Solicitud de Actualización Pendiente
                            </CardTitle>
                            <p className="text-amber-700 font-bold mt-2">
                                Enviada el {format(new Date(pendingRequest.created_at), "PPP 'a las' p", { locale: es })}
                            </p>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm">
                                <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-3">Detalles del Motivo:</h4>
                                <p className="text-zinc-700 italic text-lg leading-relaxed font-medium">
                                    "{pendingRequest.motivo}"
                                </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase block mb-1">Monto Solicitado</span>
                                    <span className="text-xl font-black text-emerald-900">S/ {pendingRequest.datos_json.totales.monto.toFixed(2)}</span>
                                </div>
                                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                                    <span className="text-[10px] font-black text-zinc-400 uppercase block mb-1">Estado de Auditoría</span>
                                    <span className="text-sm font-black text-zinc-600 uppercase flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                        Espera de aprobación
                                    </span>
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col sm:flex-row gap-4">
                                <div className="flex-1 p-4 bg-rose-50 rounded-xl border border-rose-100">
                                    <p className="text-xs text-rose-800 font-bold leading-tight">
                                        ⚠️ El formulario está bloqueado mientras esta solicitud esté en revisión. Si necesitas corregir algo, cancela esta solicitud y envía una nueva.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="border-rose-200 text-rose-600 hover:bg-rose-50 font-black h-14 px-8"
                                    onClick={handleCancelarSolicitud}
                                    disabled={isSubmitting}
                                >
                                    CANCELAR SOLICITUD
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <>
                    {/* Normal Form View */}
                    {/* Emergency Banner */}
                    <div className="flex flex-col sm:flex-row items-center justify-between bg-zinc-900 text-white p-4 rounded-xl shadow-lg border-b-4 border-rose-600 gap-4">
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
                                if (isEmergencyMode) setReporte(prev => ({ ...prev, fecha: format(new Date(), 'yyyy-MM-dd') }));
                            }}
                        >
                            {isEmergencyMode ? 'CANCELAR EMERGENCIA' : '🆘 ACTIVAR MODO EMERGENCIA'}
                        </Button>
                    </div>

                    {/* Date Selection (Emergency) */}
                    {isEmergencyMode && (
                        <Card className="border-2 border-rose-300 shadow-lg overflow-hidden animate-in slide-in-from-top-4 duration-500">
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
                                    <div className="flex-1 text-xs text-rose-700 font-bold leading-relaxed">
                                        ⚠️ Recuerda: Este reporte no se activará de inmediato. El administrador debe validarlo antes de que aparezca en el historial oficial.
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-rose-800 uppercase">Motivo / Observación del Cambio (Obligatorio)</label>
                                        <span className={`text-[10px] font-black uppercase ${reporte.observaciones.length >= 8 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                            {reporte.observaciones.length} / 8 caracteres
                                        </span>
                                    </div>
                                    <Textarea
                                        placeholder="Explica detalladamente por qué necesitas actualizar este día pasado..."
                                        value={reporte.observaciones}
                                        onChange={e => setReporte(prev => ({ ...prev, observaciones: e.target.value }))}
                                        className="min-h-[100px] border-rose-300 focus:ring-rose-400 bg-white"
                                        required
                                        minLength={8}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {categorias.map(cat => {
                        const config = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG.OTRO;
                        return (
                            <Card key={cat} className={`border-l-4 ${config.border} shadow-md overflow-hidden bg-white/50 backdrop-blur-sm`}>
                                <CardHeader className={`${config.bg} py-3 px-4 flex flex-row items-center justify-between`}>
                                    <CardTitle className={`text-base font-black uppercase tracking-tight ${config.color}`}>
                                        {config.label}
                                    </CardTitle>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase leading-none">Subtotal Pax</p>
                                            <p className={`text-sm font-black ${config.color}`}>{subtotalCat(cat)}</p>
                                        </div>
                                        <div className="text-right border-l border-zinc-200 pl-3">
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase leading-none">Monto</p>
                                            <p className={`text-sm font-black ${config.color}`}>S/ {subtotalMontoCat(cat).toFixed(2)}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-zinc-50/50 border-b border-zinc-100">
                                                <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                    <th className="px-4 py-2 text-left">Concepto / Servicio</th>
                                                    <th className="px-4 py-2 text-right w-24">Cantidad</th>
                                                    <th className="px-4 py-2 text-right w-32">Monto S/</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100">
                                                {campos.filter(c => c.categoria === cat).map(campo => (
                                                    <tr key={campo.id} className="hover:bg-zinc-50/30 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="font-bold text-zinc-700 leading-tight uppercase text-xs">{campo.nombre_campo}</p>
                                                            {campo.es_readonly && <span className="text-[9px] font-black text-rose-500 uppercase">Calculado Automático</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Input
                                                                type="number"
                                                                className={`w-20 ml-auto h-8 text-right font-black border-zinc-200 focus:ring-1 ${campo.es_readonly ? 'bg-zinc-100 opacity-70' : 'bg-white'}`}
                                                                value={campo.es_readonly ? getReadonlyCantidad(campo) : (reporte.valores[campo.id]?.cantidad || 0)}
                                                                onChange={e => handleCantidad(campo.id, parseFloat(e.target.value) || 0)}
                                                                readOnly={campo.es_readonly}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                className="w-28 ml-auto h-8 text-right font-black border-zinc-200 focus:ring-1 bg-white"
                                                                value={reporte.valores[campo.id]?.monto || 0}
                                                                onChange={e => handleMonto(campo.id, parseFloat(e.target.value) || 0)}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {/* Coffe Break / Eventos */}
                    <Card className="border-l-4 border-l-amber-400 shadow-md bg-white/50 backdrop-blur-sm">
                        <CardHeader className="bg-amber-50 py-3 px-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-base font-black uppercase tracking-tight text-amber-800">
                                ☕ Coffe Break / Eventos Especiales
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
                            <CardContent className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Descripción del Evento</label>
                                        <Input
                                            placeholder="Ej: Coffe Break Capacitación Ransa..."
                                            value={reporte.descripcion_coffe}
                                            onChange={e => setReporte(prev => ({ ...prev, descripcion_coffe: e.target.value }))}
                                            className="font-bold border-zinc-200"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Monto S/</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={reporte.monto_coffe}
                                            onChange={e => setReporte(prev => ({ ...prev, monto_coffe: parseFloat(e.target.value) || 0 }))}
                                            className="font-black border-zinc-200 text-amber-700"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* Observaciones Generales */}
                    <Card className="border-l-4 border-l-zinc-400 shadow-md bg-white/50 backdrop-blur-sm">
                        <CardHeader className="bg-zinc-50 py-3 px-4">
                            <CardTitle className="text-base font-black uppercase tracking-tight text-zinc-800">
                                💬 Observaciones Generales
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <Textarea
                                placeholder="Cualquier aclaración adicional para este reporte..."
                                value={reporte.observaciones}
                                onChange={e => setReporte(prev => ({ ...prev, observaciones: e.target.value }))}
                                className="font-medium border-zinc-200 min-h-[80px]"
                            />
                        </CardContent>
                    </Card>

                    {/* Sticky Save Bar */}
                    <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-40 bg-white/90 backdrop-blur-md border-t-2 border-[#1B4332] px-4 sm:px-6 py-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] pb-safe-offset-4">
                        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="grid grid-cols-3 sm:flex gap-4 sm:gap-6 text-center sm:text-left w-full sm:w-auto">
                                {categorias.map(cat => {
                                    const config = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG.OTRO;
                                    const qty = subtotalCat(cat);
                                    if (qty === 0) return null;
                                    return (
                                        <div key={cat} className="flex flex-col items-center">
                                            <span className={`font-black text-lg ${config.color}`}>{qty}</span>
                                            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">{cat.slice(0, 4)}</span>
                                        </div>
                                    );
                                })}
                                <div className="flex flex-col items-end border-l border-zinc-200 pl-4 sm:ml-2 whitespace-nowrap">
                                    <span className="font-black text-xl text-[#1B4332] leading-none">S/ {totales.monto.toFixed(2)}</span>
                                    <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1">LIQUIDACIÓN TOTAL</span>
                                </div>
                            </div>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                size="lg"
                                className={`${isEmergencyMode ? 'bg-rose-600 hover:bg-rose-800' : 'bg-[#2D6A4F] hover:bg-[#1B4332]'} text-white gap-2 w-full sm:w-auto font-black shadow-lg transition-all transform active:scale-95`}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Procesando...
                                    </span>
                                ) : isEmergencyMode ? (
                                    <>
                                        <Send size={18} />
                                        ENVIAR SOLICITUD DE ACTUALIZACIÓN
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        GUARDAR REPORTE DIARIO
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
