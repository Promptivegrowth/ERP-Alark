'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { campoEntraAlCruce } from '@/lib/utils/comedor-total-rules';

interface Comedor { id: string; nombre: string; }
interface CruceRow {
    categoria: string;
    acumulado_diario_qty: number;
    total_semanal_qty: number;
    acumulado_diario_monto: number;
    total_semanal_monto: number;
    diferencia_qty: number;
    diferencia_monto: number;
    porcentaje_qty: number;
    porcentaje_monto: number;
    estado: 'OK' | 'ALERTA' | 'ERROR';
}

export default function CrucePage() {
    const { loading } = useUser();
    const supabase = useMemo(() => createClient(), []);

    const [comedores, setComedores] = useState<Comedor[]>([]);
    const [selectedComedor, setSelectedComedor] = useState<string>('');
    const [semanaInicio, setSemanaInicio] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [cruceData, setCruceData] = useState<CruceRow[]>([]);
    const [comedorNombre, setComedorNombre] = useState('');
    const [calculando, setCalculando] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const semanaFin = endOfWeek(semanaInicio, { weekStartsOn: 1 });
    const semanaLabel = `${format(semanaInicio, 'dd MMM', { locale: es })} – ${format(semanaFin, 'dd MMM yyyy', { locale: es })}`;

    useEffect(() => {
        (supabase as any).from('comedores').select('id, nombre').order('nombre').then(({ data }: any) => {
            if (data) setComedores(data);
        });
    }, [supabase]);

    const calcularCruce = useCallback(async () => {
        if (!selectedComedor) { toast.error('Selecciona un comedor'); return; }
        setCalculando(true);
        setHasLoaded(false);

        const c = comedores.find(x => x.id === selectedComedor);
        setComedorNombre(c?.nombre || '');

        const fechaStr = format(semanaInicio, 'yyyy-MM-dd');
        const fechaFinStr = format(semanaFin, 'yyyy-MM-dd');

        try {
            // ---- SEMANAL ----
            const { data: repSemanal } = await (supabase as any)
                .from('reporte_semanal')
                .select('id')
                .eq('comedor_id', selectedComedor)
                .eq('semana_inicio', fechaStr)
                .maybeSingle();

            const { data: camposSemanal } = await (supabase as any)
                .from('reporte_semanal_campos')
                .select('id, nombre_campo, categoria_cruce, es_facturable')
                .eq('comedor_id', selectedComedor)
                .eq('activo', true);

            const mapaCampoSem = new Map<string, any>((camposSemanal || []).map((x: any) => [x.id, x]));

            const totalSemanalQty: Record<string, number> = {};
            const totalSemanalMonto: Record<string, number> = {};
            if (repSemanal?.id) {
                const { data: valores } = await (supabase as any)
                    .from('reporte_semanal_valores')
                    .select('campo_id, cantidad, precio_unitario')
                    .eq('reporte_semanal_id', repSemanal.id);

                (valores || []).forEach((v: any) => {
                    const campo = mapaCampoSem.get(v.campo_id);
                    if (!campo) return;
                    if (!campo.es_facturable) return;
                    const cat = campo.categoria_cruce;
                    if (!cat) return;
                    if (!campoEntraAlCruce(selectedComedor, cat, campo.nombre_campo)) return;
                    const qty = Number(v.cantidad || 0);
                    const precio = Number(v.precio_unitario || 0);
                    totalSemanalQty[cat] = (totalSemanalQty[cat] || 0) + qty;
                    totalSemanalMonto[cat] = (totalSemanalMonto[cat] || 0) + qty * precio;
                });
            }

            // ---- DIARIO ----
            const { data: reportesDiarios } = await (supabase as any)
                .from('reporte_diario')
                .select('id')
                .eq('comedor_id', selectedComedor)
                .gte('fecha', fechaStr)
                .lte('fecha', fechaFinStr);
            const rdIds: string[] = (reportesDiarios || []).map((r: any) => r.id);

            const acumuladoDiarioQty: Record<string, number> = {};
            const acumuladoDiarioMonto: Record<string, number> = {};
            if (rdIds.length > 0) {
                const { data: camposDiarios } = await (supabase as any)
                    .from('comedor_campos_reporte')
                    .select('id, nombre_campo, categoria')
                    .eq('comedor_id', selectedComedor);
                const mapaCampoDia = new Map<string, any>((camposDiarios || []).map((x: any) => [x.id, x]));

                const { data: valoresDiarios } = await (supabase as any)
                    .from('reporte_diario_valores')
                    .select('campo_id, cantidad, monto')
                    .in('reporte_id', rdIds);

                (valoresDiarios || []).forEach((v: any) => {
                    const campo = mapaCampoDia.get(v.campo_id);
                    if (!campo) return;
                    const cat = campo.categoria;
                    if (!campoEntraAlCruce(selectedComedor, cat, campo.nombre_campo)) return;
                    acumuladoDiarioQty[cat] = (acumuladoDiarioQty[cat] || 0) + Number(v.cantidad || 0);
                    acumuladoDiarioMonto[cat] = (acumuladoDiarioMonto[cat] || 0) + Number(v.monto || 0);
                });
            }

            // ---- MERGE ----
            const categorias = new Set([
                ...Object.keys(totalSemanalQty),
                ...Object.keys(acumuladoDiarioQty),
            ]);

            const rows: CruceRow[] = [];
            categorias.forEach(cat => {
                const semQty = totalSemanalQty[cat] || 0;
                const semMonto = totalSemanalMonto[cat] || 0;
                const diaQty = acumuladoDiarioQty[cat] || 0;
                const diaMonto = acumuladoDiarioMonto[cat] || 0;

                const diffQty = semQty - diaQty;
                const diffMonto = semMonto - diaMonto;
                const pctQty = semQty > 0 ? Math.abs((diffQty / semQty) * 100) : (diaQty > 0 ? 100 : 0);
                const pctMonto = semMonto > 0 ? Math.abs((diffMonto / semMonto) * 100) : (diaMonto > 0 ? 100 : 0);
                const pctMax = Math.max(pctQty, pctMonto);

                let estado: 'OK' | 'ALERTA' | 'ERROR' = 'OK';
                if (diffQty !== 0 || Math.abs(diffMonto) > 0.01) estado = 'ALERTA';
                if (pctMax > 10) estado = 'ERROR';
                if (semQty === 0 && diaQty === 0) estado = 'OK';

                rows.push({
                    categoria: cat,
                    acumulado_diario_qty: diaQty,
                    total_semanal_qty: semQty,
                    acumulado_diario_monto: diaMonto,
                    total_semanal_monto: semMonto,
                    diferencia_qty: diffQty,
                    diferencia_monto: diffMonto,
                    porcentaje_qty: pctQty,
                    porcentaje_monto: pctMonto,
                    estado,
                });
            });

            if (rows.length === 0) {
                toast.warning('No hay datos para cruzar en esta semana. Asegúrate de que existan reportes diarios y semanal.');
            }
            setCruceData(rows.sort((a, b) => a.categoria.localeCompare(b.categoria)));
            setHasLoaded(true);
        } catch (err: any) {
            console.error(err);
            toast.error('Error al calcular el cruce: ' + (err?.message || 'desconocido'));
        } finally {
            setCalculando(false);
        }
    }, [selectedComedor, semanaInicio, semanaFin, supabase, comedores]);

    const estadoBadge = (estado: string) => {
        if (estado === 'OK') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>;
        if (estado === 'ALERTA') return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><AlertTriangle className="h-3 w-3 mr-1" />ALERTA</Badge>;
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />ERROR</Badge>;
    };

    const summary = {
        ok: cruceData.filter(r => r.estado === 'OK').length,
        alerta: cruceData.filter(r => r.estado === 'ALERTA').length,
        error: cruceData.filter(r => r.estado === 'ERROR').length,
    };

    const totalsFooter = cruceData.reduce((acc, r) => ({
        diaQty: acc.diaQty + r.acumulado_diario_qty,
        semQty: acc.semQty + r.total_semanal_qty,
        diaMonto: acc.diaMonto + r.acumulado_diario_monto,
        semMonto: acc.semMonto + r.total_semanal_monto,
    }), { diaQty: 0, semQty: 0, diaMonto: 0, semMonto: 0 });

    if (loading) return <div className="p-8 text-center text-zinc-500">Cargando...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                    <RefreshCw className="h-6 w-6" /> Cruce Diario / Semanal
                </h2>
                <p className="text-zinc-500">Compara el acumulado de los reportes diarios contra el reporte semanal en cantidad de pedidos y en costos.</p>
            </div>

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
                                <span className="text-sm font-medium min-w-[200px] text-center border rounded-md px-3 py-2 bg-zinc-50">
                                    {semanaLabel}
                                </span>
                                <Button variant="outline" size="icon" onClick={() => setSemanaInicio(prev => addWeeks(prev, 1))}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <Button onClick={calcularCruce} disabled={calculando || !selectedComedor} className="bg-indigo-600 hover:bg-indigo-700">
                            <RefreshCw className={`h-4 w-4 mr-2 ${calculando ? 'animate-spin' : ''}`} />
                            {calculando ? 'Calculando...' : 'Calcular Cruce'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {hasLoaded && (
                <>
                    <div className="grid grid-cols-3 gap-4">
                        <Card className="border-emerald-200 bg-emerald-50"><CardContent className="py-4 text-center">
                            <div className="text-2xl font-bold text-emerald-700">{summary.ok}</div>
                            <div className="text-xs text-emerald-600">Categorías OK</div>
                        </CardContent></Card>
                        <Card className="border-amber-200 bg-amber-50"><CardContent className="py-4 text-center">
                            <div className="text-2xl font-bold text-amber-700">{summary.alerta}</div>
                            <div className="text-xs text-amber-600">Alertas (diferencia)</div>
                        </CardContent></Card>
                        <Card className="border-red-200 bg-red-50"><CardContent className="py-4 text-center">
                            <div className="text-2xl font-bold text-red-700">{summary.error}</div>
                            <div className="text-xs text-red-600">Errores (&gt;10%)</div>
                        </CardContent></Card>
                    </div>

                    <Card>
                        <CardHeader className="border-b">
                            <CardTitle className="text-base">
                                Cruce: {comedorNombre} — {semanaLabel}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead rowSpan={2} className="align-bottom">Categoría</TableHead>
                                        <TableHead colSpan={3} className="text-center border-l">Pedidos (cantidad)</TableHead>
                                        <TableHead colSpan={3} className="text-center border-l">Costos (S/.)</TableHead>
                                        <TableHead rowSpan={2} className="text-center align-bottom border-l">Estado</TableHead>
                                    </TableRow>
                                    <TableRow>
                                        <TableHead className="text-right border-l">Diario</TableHead>
                                        <TableHead className="text-right">Semanal</TableHead>
                                        <TableHead className="text-right">Δ</TableHead>
                                        <TableHead className="text-right border-l">Diario</TableHead>
                                        <TableHead className="text-right">Semanal</TableHead>
                                        <TableHead className="text-right">Δ</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cruceData.length === 0 ? (
                                        <TableRow><TableCell colSpan={8} className="text-center text-zinc-400 py-8">No hay datos para cruzar.</TableCell></TableRow>
                                    ) : cruceData.map((row, i) => (
                                        <TableRow key={i} className={row.estado === 'ERROR' ? 'bg-red-50' : row.estado === 'ALERTA' ? 'bg-amber-50/40' : ''}>
                                            <TableCell className="font-semibold">{row.categoria}</TableCell>
                                            <TableCell className="text-right border-l">{row.acumulado_diario_qty.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{row.total_semanal_qty.toLocaleString()}</TableCell>
                                            <TableCell className={`text-right font-bold ${row.diferencia_qty > 0 ? 'text-red-600' : row.diferencia_qty < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {row.diferencia_qty > 0 ? '+' : ''}{row.diferencia_qty} <span className="text-[10px] text-zinc-400">({row.porcentaje_qty.toFixed(1)}%)</span>
                                            </TableCell>
                                            <TableCell className="text-right border-l">S/ {row.acumulado_diario_monto.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">S/ {row.total_semanal_monto.toFixed(2)}</TableCell>
                                            <TableCell className={`text-right font-bold ${row.diferencia_monto > 0.01 ? 'text-red-600' : row.diferencia_monto < -0.01 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {row.diferencia_monto >= 0 ? '+' : ''}{row.diferencia_monto.toFixed(2)} <span className="text-[10px] text-zinc-400">({row.porcentaje_monto.toFixed(1)}%)</span>
                                            </TableCell>
                                            <TableCell className="text-center border-l">{estadoBadge(row.estado)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                {cruceData.length > 0 && (
                                    <tfoot className="bg-zinc-50 border-t-2 font-bold">
                                        <tr>
                                            <td className="p-3">TOTAL</td>
                                            <td className="p-3 text-right border-l">{totalsFooter.diaQty.toLocaleString()}</td>
                                            <td className="p-3 text-right">{totalsFooter.semQty.toLocaleString()}</td>
                                            <td className={`p-3 text-right ${(totalsFooter.semQty - totalsFooter.diaQty) !== 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                {(totalsFooter.semQty - totalsFooter.diaQty).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right border-l">S/ {totalsFooter.diaMonto.toFixed(2)}</td>
                                            <td className="p-3 text-right">S/ {totalsFooter.semMonto.toFixed(2)}</td>
                                            <td className={`p-3 text-right ${Math.abs(totalsFooter.semMonto - totalsFooter.diaMonto) > 0.01 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                S/ {(totalsFooter.semMonto - totalsFooter.diaMonto).toFixed(2)}
                                            </td>
                                            <td className="p-3 border-l"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </Table>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-50 border-zinc-200">
                        <CardContent className="py-4 px-6 text-xs text-zinc-500 space-y-1">
                            <p><strong>Reglas:</strong> Diferencia = Total Semanal − Acumulado Diario (tanto en pedidos como en costo). El % se calcula sobre el total semanal.</p>
                            <p>✅ <strong>OK:</strong> Cantidad y costo cuadran (diferencia ≈ 0)</p>
                            <p>⚠️ <strong>ALERTA:</strong> Hay diferencia en cantidad o costo (pero ≤10%)</p>
                            <p>🔴 <strong>ERROR:</strong> Diferencia &gt; 10% en cantidad o costo</p>
                            <p><strong>Reglas especiales:</strong> Para <strong>MACHU PICCHU</strong> solo se consideran los <em>CONSUMIDOS</em> (Almuerzo/Cena/Desayuno). Para <strong>MEDLOG</strong> solo se consideran los <em>TICKETS</em> (Almuerzo/Cena).</p>
                        </CardContent>
                    </Card>
                </>
            )}

            {!hasLoaded && !calculando && (
                <Card><CardContent className="py-16 text-center text-zinc-400">Selecciona un comedor y semana, luego haz clic en &ldquo;Calcular Cruce&rdquo;.</CardContent></Card>
            )}
        </div>
    );
}
