'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CalendarDays, ChevronLeft, ChevronRight, Save, CheckCircle, AlertCircle } from 'lucide-react';

interface Comedor { id: string; nombre: string; }
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
interface ValorDia {
    cantidad: number;
    precio_unitario: number;
}
type ValoresMap = Record<string, Record<number, ValorDia>>; // campo_id -> dia_semana -> valor

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function ReporteSemanalPage() {
    const { loading } = useUser();
    const supabase = createClient();

    const [comedores, setComedores] = useState<Comedor[]>([]);
    const [selectedComedor, setSelectedComedor] = useState<string>('');
    const [semanaInicio, setSemanaInicio] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [campos, setCampos] = useState<CampoSemanal[]>([]);
    const [valores, setValores] = useState<ValoresMap>({});
    const [reporteId, setReporteId] = useState<string | null>(null);
    const [estado, setEstado] = useState<'borrador' | 'cerrado'>('borrador');
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const semanaFin = endOfWeek(semanaInicio, { weekStartsOn: 1 });
    const semanaLabel = `${format(semanaInicio, 'dd MMM', { locale: es })} – ${format(semanaFin, 'dd MMM yyyy', { locale: es })}`;

    useEffect(() => {
        supabase.from('comedores').select('id, nombre').order('nombre').then(({ data }) => {
            if (data) setComedores(data);
        });
    }, []);

    const loadReporte = useCallback(async () => {
        if (!selectedComedor) return;
        setLoaded(false);

        const fechaStr = format(semanaInicio, 'yyyy-MM-dd');

        // Load campos
        const { data: camposData } = await supabase
            .from('reporte_semanal_campos')
            .select('*')
            .eq('comedor_id', selectedComedor)
            .eq('activo', true)
            .order('orden');

        if (!camposData || camposData.length === 0) {
            toast.warning('Este comedor no tiene campos semanales configurados.');
            setCampos([]);
            setLoaded(true);
            return;
        }
        setCampos(camposData);

        // Load or create reporte header
        const { data: reporteData } = await supabase
            .from('reporte_semanal')
            .select('*')
            .eq('comedor_id', selectedComedor)
            .eq('semana_inicio', fechaStr)
            .single();

        let rid = reporteData?.id;
        if (!rid) {
            const { data: newRep } = await supabase
                .from('reporte_semanal')
                .insert({ comedor_id: selectedComedor, semana_inicio: fechaStr, semana_fin: format(semanaFin, 'yyyy-MM-dd') })
                .select('id')
                .single();
            rid = newRep?.id;
        }
        setReporteId(rid || null);
        setEstado(reporteData?.estado || 'borrador');

        if (rid) {
            const { data: valoresData } = await supabase
                .from('reporte_semanal_valores')
                .select('campo_id, dia_semana, cantidad, precio_unitario')
                .eq('reporte_semanal_id', rid);

            const map: ValoresMap = {};
            (valoresData || []).forEach(v => {
                if (!map[v.campo_id]) map[v.campo_id] = {};
                map[v.campo_id][v.dia_semana] = { cantidad: v.cantidad, precio_unitario: v.precio_unitario };
            });
            setValores(map);
        }
        setLoaded(true);
    }, [selectedComedor, semanaInicio]);

    useEffect(() => { loadReporte(); }, [loadReporte]);

    const getVal = (campoId: string, dia: number, field: 'cantidad' | 'precio_unitario') =>
        valores[campoId]?.[dia]?.[field] ?? (field === 'precio_unitario' ? 0 : 0);

    const setVal = (campoId: string, dia: number, field: 'cantidad' | 'precio_unitario', val: number) => {
        setValores(prev => ({
            ...prev,
            [campoId]: {
                ...(prev[campoId] || {}),
                [dia]: { cantidad: prev[campoId]?.[dia]?.cantidad ?? 0, precio_unitario: prev[campoId]?.[dia]?.precio_unitario ?? 0, [field]: val }
            }
        }));
    };

    const totalCampo = (campoId: string, facturable: boolean) => {
        if (!facturable) return { qty: 0, monto: 0 };
        return Array.from({ length: 7 }, (_, i) => i).reduce((acc, dia) => {
            const qty = getVal(campoId, dia, 'cantidad');
            const prc = getVal(campoId, dia, 'precio_unitario');
            return { qty: acc.qty + qty, monto: acc.monto + qty * prc };
        }, { qty: 0, monto: 0 });
    };

    const grandTotal = () => campos.filter(c => c.es_facturable).reduce((acc, c) => {
        const t = totalCampo(c.id, true);
        return { qty: acc.qty + t.qty, monto: acc.monto + t.monto };
    }, { qty: 0, monto: 0 });

    const saveReporte = async () => {
        if (!reporteId) return;
        setSaving(true);
        try {
            const upserts = [];
            for (const campo of campos) {
                for (let dia = 0; dia < 7; dia++) {
                    const qty = getVal(campo.id, dia, 'cantidad');
                    const prc = getVal(campo.id, dia, 'precio_unitario');
                    if (qty > 0 || prc > 0) {
                        upserts.push({
                            reporte_semanal_id: reporteId,
                            campo_id: campo.id,
                            dia_semana: dia,
                            cantidad: qty,
                            precio_unitario: prc
                        });
                    }
                }
            }
            await supabase.from('reporte_semanal_valores').upsert(upserts, { onConflict: 'reporte_semanal_id,campo_id,dia_semana' });
            toast.success('Reporte semanal guardado correctamente');
        } catch {
            toast.error('Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const cerrarReporte = async () => {
        if (!reporteId) return;
        await supabase.from('reporte_semanal').update({ estado: 'cerrado' }).eq('id', reporteId);
        setEstado('cerrado');
        toast.success('Reporte cerrado. Ya no puede editarse.');
    };

    // Group campos by section
    const secciones = Array.from(new Set(campos.map(c => c.seccion)));
    const gt = grandTotal();

    if (loading) return <div className="p-8 text-center text-zinc-500">Cargando...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                        <CalendarDays className="h-6 w-6" /> Reporte Semanal
                    </h2>
                    <p className="text-zinc-500">Registra las cantidades vendidas por día de la semana.</p>
                </div>
                {reporteId && estado === 'borrador' && (
                    <div className="flex gap-2">
                        <Button onClick={saveReporte} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                            <Save className="h-4 w-4 mr-2" />{saving ? 'Guardando...' : 'Guardar'}
                        </Button>
                        <Button onClick={cerrarReporte} variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                            <CheckCircle className="h-4 w-4 mr-2" /> Cerrar Semana
                        </Button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="space-y-1 w-full md:w-1/3">
                            <label className="text-sm font-medium">Comedor</label>
                            <Select value={selectedComedor} onValueChange={setSelectedComedor}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar comedor..." /></SelectTrigger>
                                <SelectContent>
                                    {comedores.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Semana</label>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setSemanaInicio(prev => subWeeks(prev, 1))}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-medium min-w-[180px] text-center border rounded-md px-3 py-2 bg-zinc-50">
                                    {semanaLabel}
                                </span>
                                <Button variant="outline" size="icon" onClick={() => setSemanaInicio(prev => addWeeks(prev, 1))}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        {estado === 'cerrado' && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                <CheckCircle className="h-3 w-3 mr-1" /> Cerrado
                            </Badge>
                        )}
                        {estado === 'borrador' && reporteId && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                                <AlertCircle className="h-3 w-3 mr-1" /> Borrador
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Grilla */}
            {loaded && campos.length > 0 && (
                <div className="space-y-4">
                    {secciones.map(sec => {
                        const camposSec = campos.filter(c => c.seccion === sec);
                        const secFacturable = camposSec.some(c => c.es_facturable);
                        return (
                            <Card key={sec}>
                                <CardHeader className="py-3 px-4 bg-zinc-50 border-b flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">{sec}</CardTitle>
                                    {!secFacturable && (
                                        <Badge variant="outline" className="text-xs text-zinc-500">Solo control — no facturado</Badge>
                                    )}
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-zinc-50/50">
                                                    <th className="text-left p-3 font-medium text-zinc-600 min-w-[200px]">Campo</th>
                                                    {DIAS.map((d, i) => (
                                                        <th key={i} className="p-2 font-medium text-zinc-500 text-center w-[80px]">
                                                            <div>{d}</div>
                                                            <div className="text-xs text-zinc-400 font-normal">
                                                                {format(addDays(semanaInicio, i), 'dd/MM')}
                                                            </div>
                                                        </th>
                                                    ))}
                                                    <th className="p-3 text-center font-medium text-zinc-600 w-[70px]">Total</th>
                                                    <th className="p-3 text-center font-medium text-zinc-600 w-[90px]">Precio</th>
                                                    <th className="p-3 text-right font-medium text-zinc-600 w-[100px]">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {camposSec.map(campo => {
                                                    const { qty, monto } = totalCampo(campo.id, campo.es_facturable);
                                                    const precioRef = campo.precio_ref ?? 0;
                                                    return (
                                                        <tr key={campo.id} className={`border-b hover:bg-indigo-50/30 ${!campo.es_facturable ? 'opacity-60' : ''}`}>
                                                            <td className="p-3 font-medium text-zinc-800">
                                                                {campo.nombre_campo}
                                                                {!campo.es_facturable && <span className="ml-2 text-xs text-zinc-400">(informativo)</span>}
                                                            </td>
                                                            {Array.from({ length: 7 }, (_, dia) => (
                                                                <td key={dia} className="p-1">
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        value={getVal(campo.id, dia, 'cantidad') || ''}
                                                                        onChange={e => setVal(campo.id, dia, 'cantidad', Number(e.target.value))}
                                                                        disabled={estado === 'cerrado'}
                                                                        className="h-8 text-center text-xs w-full px-1"
                                                                        placeholder="0"
                                                                    />
                                                                </td>
                                                            ))}
                                                            <td className="p-3 text-center font-semibold text-indigo-700">{qty || '—'}</td>
                                                            <td className="p-2">
                                                                {campo.precio_editable ? (
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={getVal(campo.id, 0, 'precio_unitario') || precioRef || ''}
                                                                        onChange={e => {
                                                                            const p = Number(e.target.value);
                                                                            for (let d = 0; d < 7; d++) setVal(campo.id, d, 'precio_unitario', p);
                                                                        }}
                                                                        disabled={estado === 'cerrado'}
                                                                        className="h-8 text-center text-xs w-full px-1"
                                                                        placeholder={precioRef ? String(precioRef) : '0.00'}
                                                                    />
                                                                ) : (
                                                                    <span className="text-xs text-zinc-500">S/. {precioRef.toFixed(2)}</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-right font-semibold">
                                                                {campo.es_facturable && monto > 0 ? (
                                                                    <span className="text-emerald-700">S/. {monto.toFixed(2)}</span>
                                                                ) : '—'}
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

                    {/* Grand Total */}
                    <Card className="border-2 border-indigo-200 bg-indigo-50">
                        <CardContent className="py-4 px-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="text-sm font-medium text-indigo-700">TOTAL SEMANAL FACTURADO</div>
                                    <div className="text-xs text-indigo-500">{gt.qty} servicios en la semana</div>
                                </div>
                                <div className="text-3xl font-bold text-indigo-900">
                                    S/. {gt.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {loaded && campos.length === 0 && selectedComedor && (
                <Card>
                    <CardContent className="py-12 text-center text-zinc-500">
                        No hay campos configurados para este comedor.
                    </CardContent>
                </Card>
            )}

            {!selectedComedor && (
                <Card>
                    <CardContent className="py-12 text-center text-zinc-400">
                        Selecciona un comedor para cargar el reporte semanal.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
