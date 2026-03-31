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
                    valores,
                }));
            } else {
                setReporte(prev => ({
                    ...prev,
                    id: undefined,
                    tiene_coffe_break: false,
                    descripcion_coffe: '',
                    monto_coffe: 0,
                    observaciones: '',
                    valores: {},
                }));
            }
        }
        loadExisting();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comedorId, reporte.fecha, dataLoaded]);

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
            if (!reporte.observaciones || reporte.observaciones.trim().length < 10) {
                toast.error('❌ Para reportes de emergencia, debes ingresar un motivo detallado en Observaciones (mínimo 10 caracteres).');
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
                    {reporte.id && <Badge className="bg-emerald-100 text-emerald-800 text-xs">Reporte guardado</Badge>}
                </div>
            </div>

            {/* Field Cards by Category */}
            {categorias.map(cat => {
                const config = CATEGORIA_CONFIG[cat] || CATEGORIA_CONFIG.OTRO;
                const camposCat = campos.filter(c => c.categoria === cat);
                const isVolcan = comedorNombre === 'VOLCAN';
                const isPamolsaOrTottus = ['PAMOLSA', 'TOTTUS-CDF', 'TOTTUS-CDS', 'TOTTUS-PPA'].includes(comedorNombre);

                return (
                    <Card key={cat} className={`border-2 ${config.border} overflow-hidden`}>
                        <CardHeader className={`${config.bg} py-3 px-4 border-b ${config.border}`}>
                            <CardTitle className={`text-base font-bold ${config.color}`}>
                                {config.label}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-zinc-100">
                                {camposCat.map((campo, idx) => {
                                    const isReadonly = campo.es_readonly;
                                    const cantidadVal = isReadonly ? getReadonlyCantidad(campo) : (reporte.valores[campo.id]?.cantidad || 0);
                                    const montoVal = reporte.valores[campo.id]?.monto || 0;

                                    // Visual separators
                                    const showVolcanFaucettSep = isVolcan && idx > 0 && VOLCAN_FAUCETT.includes(campo.nombre_campo) && !VOLCAN_FAUCETT.includes(camposCat[idx - 1].nombre_campo);
                                    const showVolcanGambettaSep = isVolcan && idx > 0 && !VOLCAN_FAUCETT.includes(campo.nombre_campo) && VOLCAN_FAUCETT.includes(camposCat[idx - 1].nombre_campo);
                                    const showTottusSep = isPamolsaOrTottus && PAMOLSA_TOTTUS.includes(campo.nombre_campo) && !PAMOLSA_TOTTUS.includes(camposCat[idx - 1]?.nombre_campo || '');

                                    return (
                                        <div key={campo.id}>
                                            {(showVolcanFaucettSep || showVolcanGambettaSep) && (
                                                <div className="px-4 py-1 bg-zinc-100 text-xs font-bold text-zinc-500 uppercase tracking-wide">
                                                    {VOLCAN_FAUCETT.includes(campo.nombre_campo) ? '📍 Sede Faucett' : '📍 Sede Gambetta'}
                                                </div>
                                            )}
                                            {showTottusSep && (
                                                <div className="px-4 py-1 bg-blue-50 text-xs font-bold text-blue-700 uppercase tracking-wide border-y border-blue-100">
                                                    🏪 Sección TOTTUS
                                                </div>
                                            )}
                                            {isPamolsaOrTottus && idx === 0 && (
                                                <div className="px-4 py-1 bg-green-50 text-xs font-bold text-green-700 uppercase tracking-wide border-b border-green-100">
                                                    🟢 Sección ALMARK
                                                </div>
                                            )}
                                            <div className={`flex items-center gap-3 px-4 py-2.5 ${isReadonly ? 'bg-zinc-50' : 'hover:bg-zinc-50/50'} transition-colors`}>
                                                <div className="flex-1 min-w-0">
                                                    <span className={`text-sm font-medium ${isReadonly ? 'text-zinc-400 italic' : 'text-zinc-800'}`}>
                                                        {campo.nombre_campo}
                                                        {isReadonly && <span className="ml-2 text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded">auto</span>}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24">
                                                        <label className="text-[10px] text-zinc-400 block text-center mb-0.5">Cantidad</label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            value={cantidadVal || ''}
                                                            readOnly={isReadonly}
                                                            onChange={e => !isReadonly && handleCantidad(campo.id, Number(e.target.value))}
                                                            className={`text-center text-sm h-8 ${isReadonly ? 'bg-zinc-100 text-zinc-500 cursor-default' : 'border-[#2D6A4F] focus:ring-[#2D6A4F]'}`}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <div className="w-28">
                                                        <label className="text-[10px] text-zinc-400 block text-center mb-0.5">Monto S/.</label>
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1.5 text-zinc-400 text-xs">S/</span>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={montoVal || ''}
                                                                onChange={e => handleMonto(campo.id, Number(e.target.value))}
                                                                className="pl-6 text-sm h-8 border-[#2D6A4F] focus:ring-[#2D6A4F]"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Category subtotal */}
                            <div className={`flex flex-col sm:flex-row justify-between items-center px-4 py-3 ${config.bg} border-t ${config.border} gap-2`}>
                                <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider ${config.color} whitespace-nowrap`}>Subtotal {cat}</span>
                                <div className="flex justify-end items-center w-full sm:w-auto gap-6 text-right">
                                    <span className={`text-sm font-black ${config.color} whitespace-nowrap`}>{subtotalCat(cat)} PAX</span>
                                    <span className={`text-sm font-black ${config.color} whitespace-nowrap`}>S/ {subtotalMontoCat(cat).toFixed(2)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            {/* Coffee Break Section */}
            <Card className={`border-2 ${reporte.tiene_coffe_break ? 'border-amber-300' : 'border-zinc-200'} transition-colors`}>
                <CardHeader className={`py-3 px-4 flex flex-row items-center justify-between ${reporte.tiene_coffe_break ? 'bg-amber-50 border-b border-amber-200' : 'bg-zinc-50'}`}>
                    <CardTitle className="text-base font-bold text-zinc-700 flex items-center gap-2">
                        <Coffee size={16} />
                        Coffe Break / Servicios Adicionales
                    </CardTitle>
                    <button
                        type="button"
                        onClick={() => setReporte(prev => ({ ...prev, tiene_coffe_break: !prev.tiene_coffe_break }))}
                        className={`text-xs px-3 py-1 rounded-full font-semibold transition-all ${reporte.tiene_coffe_break ? 'bg-amber-500 text-white' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'}`}
                    >
                        {reporte.tiene_coffe_break ? 'SÍ — incluido' : 'NO — clic para agregar'}
                    </button>
                </CardHeader>
                {reporte.tiene_coffe_break && (
                    <CardContent className="pt-4 space-y-3">
                        <Textarea
                            placeholder="Describe el servicio de coffe break..."
                            value={reporte.descripcion_coffe}
                            onChange={e => setReporte(prev => ({ ...prev, descripcion_coffe: e.target.value }))}
                            className="resize-none text-sm border-amber-300 focus:ring-amber-400"
                            rows={2}
                        />
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-medium text-zinc-600">Monto:</label>
                            <div className="relative w-36">
                                <span className="absolute left-2 top-2 text-zinc-400 text-xs">S/</span>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={reporte.monto_coffe || ''}
                                    onChange={e => setReporte(prev => ({ ...prev, monto_coffe: Number(e.target.value) }))}
                                    className="pl-6 text-sm border-amber-300"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Emergency Mode UI */}
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
                    variant={isEmergencyMode ? "destructive" : "outline"}
                    className={isEmergencyMode ? "bg-rose-600 hover:bg-rose-700" : "bg-transparent text-white border-zinc-700 hover:bg-zinc-800"}
                    onClick={() => {
                        setIsEmergencyMode(!isEmergencyMode);
                        if (isEmergencyMode) setReporte(prev => ({ ...prev, fecha: format(new Date(), 'yyyy-MM-dd') }));
                    }}
                >
                    {isEmergencyMode ? 'Cancelar Emergencia' : '🆘 Activar Modo Emergencia'}
                </Button>
            </div>

            {/* Date Selection (Emergency) */}
            {isEmergencyMode && (
                <Card className="border-2 border-rose-200 bg-rose-50/30 overflow-hidden">
                    <CardHeader className="py-2 px-4 bg-rose-100 flex flex-row items-center justify-between border-b border-rose-200">
                        <span className="text-sm font-black text-rose-800 uppercase flex items-center gap-2">
                            <CalendarIcon size={18} /> SELECCIONAR FECHA DE REPORTE PASADO
                        </span>
                        <Badge className="bg-rose-600 px-3 py-1 text-white font-black">MODO EMERGENCIA</Badge>
                    </CardHeader>
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-6">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full sm:w-[280px] justify-start text-left font-black border-rose-300">
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
                    </CardContent>
                </Card>
            )}

            {/* Existing Cards for categories... (Line 160 approx) */}

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
        </div>
    );
}
