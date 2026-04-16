'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, ChevronLeft, ChevronRight, Save, CheckCircle, AlertCircle, Lock } from 'lucide-react';

interface CampoSemanal {
    id: string;
    nombre_campo: string;
    seccion: string;
    precio_ref: number | null;
    precio_editable: boolean;
    es_facturable: boolean;
    categoria_cruce: string | null;
    orden: number;
}
interface ValorDia { cantidad: number; precio_unitario: number; }
type ValoresMap = Record<string, Record<number, ValorDia>>;

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function ReporteSemanalPortalPage() {
    const { comedorId, comedorNombre, loading } = useUser();
    const supabase = createClient();

    const [semanaInicio, setSemanaInicio] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [campos, setCampos] = useState<CampoSemanal[]>([]);
    const [valores, setValores] = useState<ValoresMap>({});
    const [reporteId, setReporteId] = useState<string | null>(null);
    const [estado, setEstado] = useState<'borrador' | 'cerrado'>('borrador');
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);
    // Track price per campo (uniform across all days)
    const [precios, setPrecios] = useState<Record<string, number>>({});

    const semanaFin = endOfWeek(semanaInicio, { weekStartsOn: 1 });
    const semanaLabel = `${format(semanaInicio, 'dd MMM', { locale: es })} – ${format(semanaFin, 'dd MMM yyyy', { locale: es })}`;

    const loadReporte = useCallback(async () => {
        if (!comedorId) return;
        setLoaded(false);

        const fechaStr = format(semanaInicio, 'yyyy-MM-dd');
        const fechaFinStr = format(semanaFin, 'yyyy-MM-dd');

        // Load campos configurados para este comedor
        const { data: camposData } = await (supabase as any)
            .from('reporte_semanal_campos')
            .select('*')
            .eq('comedor_id', comedorId)
            .eq('activo', true)
            .order('orden');

        if (!camposData || camposData.length === 0) {
            setCampos([]);
            setLoaded(true);
            return;
        }
        setCampos(camposData);

        // Load o crear reporte header
        const { data: repData } = await (supabase as any)
            .from('reporte_semanal')
            .select('*')
            .eq('comedor_id', comedorId)
            .eq('semana_inicio', fechaStr)
            .single();

        let rid = repData?.id;
        if (!rid) {
            const { data: newRep } = await (supabase as any)
                .from('reporte_semanal')
                .insert({ comedor_id: comedorId, semana_inicio: fechaStr, semana_fin: fechaFinStr })
                .select('id')
                .single();
            rid = newRep?.id;
        }
        setReporteId(rid || null);
        setEstado(repData?.estado || 'borrador');

        if (rid) {
            const { data: valoresData } = await (supabase as any)
                .from('reporte_semanal_valores')
                .select('campo_id, dia_semana, cantidad, precio_unitario')
                .eq('reporte_semanal_id', rid);

            const map: ValoresMap = {};
            const pricemap: Record<string, number> = {};
            (valoresData as any[]).forEach((v: any) => {
                if (!map[v.campo_id]) map[v.campo_id] = {};
                map[v.campo_id][v.dia_semana] = { cantidad: v.cantidad, precio_unitario: v.precio_unitario };
                if (v.precio_unitario > 0) pricemap[v.campo_id] = v.precio_unitario;
            });
            setValores(map);
            // Init precios from stored values or precio_ref
            const initPrecios: Record<string, number> = {};
            (camposData as CampoSemanal[]).forEach((c: CampoSemanal) => {
                initPrecios[c.id] = pricemap[c.id] ?? c.precio_ref ?? 0;
            });
            setPrecios(initPrecios);
        } else {
            // Init precios from precio_ref
            const initPrecios: Record<string, number> = {};
            (camposData as CampoSemanal[]).forEach((c: CampoSemanal) => { initPrecios[c.id] = c.precio_ref ?? 0; });
            setPrecios(initPrecios);
        }

        setLoaded(true);
    }, [comedorId, semanaInicio]);

    useEffect(() => { loadReporte(); }, [loadReporte]);

    const getQty = (campoId: string, dia: number) => valores[campoId]?.[dia]?.cantidad ?? 0;
    const setQty = (campoId: string, dia: number, val: number) => {
        setValores(prev => ({
            ...prev,
            [campoId]: {
                ...(prev[campoId] || {}),
                [dia]: { cantidad: val, precio_unitario: precios[campoId] ?? 0 }
            }
        }));
    };
    const setPrecio = (campoId: string, val: number) => {
        setPrecios(prev => ({ ...prev, [campoId]: val }));
        // Update all existing day values with new price
        setValores(prev => {
            const updated = { ...prev };
            if (updated[campoId]) {
                const newDia: Record<number, ValorDia> = {};
                Object.keys(updated[campoId]).forEach(d => {
                    newDia[Number(d)] = { cantidad: updated[campoId][Number(d)].cantidad, precio_unitario: val };
                });
                updated[campoId] = newDia;
            }
            return updated;
        });
    };

    const totalCampo = (campoId: string, facturable: boolean) => {
        if (!facturable) return { qty: 0, monto: 0 };
        const precio = precios[campoId] ?? 0;
        const qty = Array.from({ length: 7 }, (_, i) => i).reduce((s, d) => s + getQty(campoId, d), 0);
        return { qty, monto: qty * precio };
    };

    const grandTotal = () => campos.filter(c => c.es_facturable).reduce((acc, c) => {
        const t = totalCampo(c.id, true);
        return { qty: acc.qty + t.qty, monto: acc.monto + t.monto };
    }, { qty: 0, monto: 0 });

    const handleSave = async () => {
        if (!reporteId || estado === 'cerrado') return;
        setSaving(true);
        try {
            const upserts: any[] = [];
            for (const campo of campos) {
                const precio = precios[campo.id] ?? campo.precio_ref ?? 0;
                for (let dia = 0; dia < 7; dia++) {
                    const qty = getQty(campo.id, dia);
                    upserts.push({
                        reporte_semanal_id: reporteId,
                        campo_id: campo.id,
                        dia_semana: dia,
                        cantidad: qty,
                        precio_unitario: precio
                    });
                }
            }
            await (supabase as any).from('reporte_semanal_valores').upsert(upserts, { onConflict: 'reporte_semanal_id,campo_id,dia_semana' });
            toast.success('✅ Reporte semanal guardado correctamente');
        } catch {
            toast.error('Error al guardar el reporte');
        } finally {
            setSaving(false);
        }
    };

    const handleCerrar = async () => {
        if (!reporteId) return;
        // Save first then close
        await handleSave();
        await (supabase as any).from('reporte_semanal').update({ estado: 'cerrado' }).eq('id', reporteId);
        setEstado('cerrado');
        toast.success('Semana cerrada y enviada al admin.');
    };

    const secciones = Array.from(new Set(campos.map(c => c.seccion)));
    const gt = grandTotal();

    if (loading) return <div className="p-8 text-center text-zinc-400">Cargando...</div>;

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <CalendarDays className="h-6 w-6 text-emerald-600" />
                        Reporte Semanal
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">
                        {comedorNombre} · Registra las cantidades vendidas por día
                    </p>
                </div>
                {estado === 'cerrado' ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 px-4 py-2">
                        <Lock className="h-3 w-3 mr-2" /> Semana cerrada — enviada al admin
                    </Badge>
                ) : (
                    <div className="flex gap-2">
                        <Button onClick={handleSave} disabled={saving || !reporteId} variant="outline" className="border-emerald-400 text-emerald-700">
                            <Save className="h-4 w-4 mr-2" />{saving ? 'Guardando...' : 'Guardar borrador'}
                        </Button>
                        <Button onClick={handleCerrar} disabled={saving || !reporteId} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <CheckCircle className="h-4 w-4 mr-2" /> Cerrar y enviar semana
                        </Button>
                    </div>
                )}
            </div>

            {/* Selector de semana */}
            <Card>
                <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-zinc-600">Semana:</span>
                        <Button variant="outline" size="icon" onClick={() => setSemanaInicio(p => subWeeks(p, 1))} disabled={estado === 'cerrado'}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-semibold min-w-[180px] text-center border rounded-md px-4 py-2 bg-zinc-50">
                            {semanaLabel}
                        </span>
                        <Button variant="outline" size="icon" onClick={() => setSemanaInicio(p => addWeeks(p, 1))} disabled={estado === 'cerrado'}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        {estado === 'borrador' && reporteId && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 ml-2">
                                <AlertCircle className="h-3 w-3 mr-1" /> Borrador
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* No hay campos configurados */}
            {loaded && campos.length === 0 && (
                <Card>
                    <CardContent className="py-16 text-center text-zinc-400">
                        Tu comedor aún no tiene campos de reporte semanal configurados.<br />
                        Contacta al administrador.
                    </CardContent>
                </Card>
            )}

            {/* Grilla principal */}
            {loaded && campos.length > 0 && (
                <div className="space-y-4">
                    {secciones.map(sec => {
                        const camposSec = campos.filter(c => c.seccion === sec);
                        const hayNoFacturables = camposSec.some(c => !c.es_facturable);
                        return (
                            <Card key={sec} className="overflow-hidden">
                                <CardHeader className="py-3 px-4 bg-zinc-50 border-b flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-bold text-zinc-700 uppercase tracking-wide">{sec}</CardTitle>
                                    {hayNoFacturables && (
                                        <Badge variant="outline" className="text-xs text-zinc-400">Campos informativos incluidos</Badge>
                                    )}
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-zinc-50/40 text-xs">
                                                    <th className="text-left p-3 font-semibold text-zinc-600 min-w-[180px]">Producto / Servicio</th>
                                                    {DIAS.map((d, i) => (
                                                        <th key={i} className="p-2 text-center text-zinc-500 font-medium w-16">
                                                            <div className="font-semibold">{d}</div>
                                                            <div className="text-zinc-400 font-normal">{format(addDays(semanaInicio, i), 'dd/MM')}</div>
                                                        </th>
                                                    ))}
                                                    <th className="p-3 text-center text-zinc-600 font-semibold w-16">Total</th>
                                                    <th className="p-3 text-center text-zinc-600 font-semibold w-24">Precio S/.</th>
                                                    <th className="p-3 text-right text-zinc-600 font-semibold w-24">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {camposSec.map(campo => {
                                                    const { qty, monto } = totalCampo(campo.id, campo.es_facturable);
                                                    const isReadOnly = estado === 'cerrado';
                                                    const isInfoOnly = !campo.es_facturable;
                                                    return (
                                                        <tr key={campo.id} className={`border-b transition-colors ${isInfoOnly ? 'bg-zinc-50/60 opacity-75' : 'hover:bg-emerald-50/20'}`}>
                                                            <td className="p-3 font-medium text-zinc-800 text-sm">
                                                                {campo.nombre_campo}
                                                                {isInfoOnly && <span className="ml-2 text-xs text-zinc-400 font-normal italic">(informativo)</span>}
                                                            </td>
                                                            {Array.from({ length: 7 }, (_, dia) => (
                                                                <td key={dia} className="p-1">
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        value={getQty(campo.id, dia) || ''}
                                                                        onChange={e => setQty(campo.id, dia, Number(e.target.value) || 0)}
                                                                        disabled={isReadOnly}
                                                                        className="h-8 text-center text-xs w-full px-0"
                                                                        placeholder="0"
                                                                    />
                                                                </td>
                                                            ))}
                                                            <td className="p-3 text-center font-bold text-emerald-700">
                                                                {campo.es_facturable && qty > 0 ? qty : (
                                                                    <span className="text-zinc-400 font-normal">
                                                                        {Array.from({ length: 7 }, (_, i) => i).reduce((s, d) => s + getQty(campo.id, d), 0) || '—'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-2">
                                                                {campo.precio_editable ? (
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.10"
                                                                        value={precios[campo.id] || ''}
                                                                        onChange={e => setPrecio(campo.id, Number(e.target.value) || 0)}
                                                                        disabled={isReadOnly || isInfoOnly}
                                                                        placeholder={String(campo.precio_ref ?? '0.00')}
                                                                        className="h-8 text-center text-xs w-full px-1"
                                                                    />
                                                                ) : (
                                                                    <span className="text-xs text-zinc-500 text-center block">
                                                                        {(campo.precio_ref ?? 0).toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-right font-semibold">
                                                                {campo.es_facturable && monto > 0 ? (
                                                                    <span className="text-emerald-700">S/. {monto.toFixed(2)}</span>
                                                                ) : <span className="text-zinc-300">—</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {/* Gran Total */}
                    <div className="sticky bottom-20 z-20">
                        <Card className="border-2 border-emerald-300 bg-emerald-50 shadow-lg">
                            <CardContent className="py-4 px-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-sm font-bold text-emerald-800">TOTAL SEMANAL A FACTURAR</div>
                                        <div className="text-xs text-emerald-600">{gt.qty} servicios registrados esta semana</div>
                                    </div>
                                    <div className="text-3xl font-extrabold text-emerald-900">
                                        S/. {gt.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
