'use client';

import { useState, useCallback } from 'react';
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

interface Comedor { id: string; nombre: string; }
interface CruceRow {
    categoria: string;
    acumulado_diario: number;
    total_semanal: number;
    diferencia: number;
    porcentaje: number;
    estado: 'OK' | 'ALERTA' | 'ERROR';
}

// Mapeo de categoria_cruce del reporte semanal -> categoria en reporte diario
// Campo categoria_cruce en reporte_semanal_campos hace el mapeo

const DIAS = [0, 1, 2, 3, 4, 5, 6]; // 0=Lun, 6=Dom

export default function CrucePage() {
    const { loading } = useUser();
    const supabase = createClient();

    const [comedores, setComedores] = useState<Comedor[]>([]);
    const [selectedComedor, setSelectedComedor] = useState<string>('');
    const [semanaInicio, setSemanaInicio] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [cruceData, setCruceData] = useState<CruceRow[]>([]);
    const [comedorNombre, setComedorNombre] = useState('');
    const [calculando, setCalculando] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const semanaFin = endOfWeek(semanaInicio, { weekStartsOn: 1 });
    const semanaLabel = `${format(semanaInicio, 'dd MMM', { locale: es })} – ${format(semanaFin, 'dd MMM yyyy', { locale: es })}`;

    useState(() => {
        supabase.from('comedores').select('id, nombre').order('nombre').then(({ data }) => {
            if (data) setComedores(data);
        });
    });

    const calcularCruce = useCallback(async () => {
        if (!selectedComedor) { toast.error('Selecciona un comedor'); return; }
        setCalculando(true);
        setHasLoaded(false);

        const c = comedores.find(x => x.id === selectedComedor);
        setComedorNombre(c?.nombre || '');

        const fechaStr = format(semanaInicio, 'yyyy-MM-dd');
        const fechaFinStr = format(semanaFin, 'yyyy-MM-dd');

        try {
            // 1. Obtener reporte semanal y sus valores
            const { data: repSemanal } = await supabase
                .from('reporte_semanal')
                .select('id')
                .eq('comedor_id', selectedComedor)
                .eq('semana_inicio', fechaStr)
                .single();

            // 2. Obtener campos con categoria_cruce para mapeo
            const { data: campos } = await supabase
                .from('reporte_semanal_campos')
                .select('id, nombre_campo, categoria_cruce, es_facturable')
                .eq('comedor_id', selectedComedor)
                .eq('activo', true)
                .not('categoria_cruce', 'is', null);

            // Totales semanales por categoria_cruce
            const totalSemanales: Record<string, number> = {};
            if (repSemanal?.id && campos && campos.length > 0) {
                const { data: valores } = await supabase
                    .from('reporte_semanal_valores')
                    .select('campo_id, cantidad, precio_unitario')
                    .eq('reporte_semanal_id', repSemanal.id);

                campos.forEach(camp => {
                    if (!camp.categoria_cruce || !camp.es_facturable) return;
                    const cat = camp.categoria_cruce;
                    const v = (valores || []).filter(x => x.campo_id === camp.id);
                    const total = v.reduce((s, x) => s + (x.cantidad || 0), 0);
                    totalSemanales[cat] = (totalSemanales[cat] || 0) + total;
                });
            }

            // 3. Obtener acumulado de reportes diarios de la semana
            // Buscar reportes diarios de esa semana para ese comedor
            const { data: reportesDiarios } = await supabase
                .from('reporte_diario')
                .select('id, fecha')
                .eq('comedor_id', selectedComedor)
                .gte('fecha', fechaStr)
                .lte('fecha', fechaFinStr);

            const rdIds = (reportesDiarios || []).map(r => r.id);
            const acumuladoDiario: Record<string, number> = {};

            if (rdIds.length > 0) {
                // Obtener campos diarios con sus categorias
                const { data: camposDiarios } = await supabase
                    .from('campos_reporte')
                    .select('id, nombre_campo, categoria')
                    .eq('comedor_id', selectedComedor);

                const { data: valoresDiarios } = await supabase
                    .from('reporte_diario_valores')
                    .select('campo_id, cantidad')
                    .in('reporte_diario_id', rdIds);

                (valoresDiarios || []).forEach(v => {
                    const campo = (camposDiarios || []).find(c => c.id === v.campo_id);
                    if (!campo) return;
                    const cat = campo.categoria;
                    acumuladoDiario[cat] = (acumuladoDiario[cat] || 0) + (v.cantidad || 0);
                });
            }

            // 4. Construir filas de cruce
            const categorias = new Set([
                ...Object.keys(totalSemanales),
                ...Object.keys(acumuladoDiario)
            ]);

            const rows: CruceRow[] = [];
            categorias.forEach(cat => {
                const semanal = totalSemanales[cat] || 0;
                const diario = acumuladoDiario[cat] || 0;
                const diff = semanal - diario;
                const pct = diario > 0 ? Math.abs(diff / diario * 100) : (semanal > 0 ? 100 : 0);
                let estado: 'OK' | 'ALERTA' | 'ERROR' = 'OK';
                if (diff !== 0) estado = 'ALERTA';
                if (pct > 10) estado = 'ERROR';

                rows.push({
                    categoria: cat,
                    acumulado_diario: diario,
                    total_semanal: semanal,
                    diferencia: diff,
                    porcentaje: pct,
                    estado
                });
            });

            if (rows.length === 0) {
                toast.warning('No hay datos para cruzar en esta semana. Asegúrate de que existan reportes diarios y semanal.');
            }
            setCruceData(rows.sort((a, b) => a.categoria.localeCompare(b.categoria)));
            setHasLoaded(true);
        } catch (err) {
            toast.error('Error al calcular el cruce');
        } finally {
            setCalculando(false);
        }
    }, [selectedComedor, semanaInicio, comedores]);

    const estadoBadge = (estado: string) => {
        if (estado === 'OK') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>;
        if (estado === 'ALERTA') return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><AlertTriangle className="h-3 w-3 mr-1" />ALERTA</Badge>;
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />ERROR</Badge>;
    };

    const summary = { ok: cruceData.filter(r => r.estado === 'OK').length, alerta: cruceData.filter(r => r.estado === 'ALERTA').length, error: cruceData.filter(r => r.estado === 'ERROR').length };

    if (loading) return <div className="p-8 text-center text-zinc-500">Cargando...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                    <RefreshCw className="h-6 w-6" /> Cruce Diario / Semanal
                </h2>
                <p className="text-zinc-500">Compara el acumulado de los reportes diarios vs el reporte semanal registrado.</p>
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
                                <span className="text-sm font-medium min-w-[180px] text-center border rounded-md px-3 py-2 bg-zinc-50">
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
                    {/* Summary cards */}
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
                                        <TableHead>Categoría</TableHead>
                                        <TableHead className="text-right">Acumulado Diario</TableHead>
                                        <TableHead className="text-right">Total Semanal</TableHead>
                                        <TableHead className="text-right">Diferencia</TableHead>
                                        <TableHead className="text-center">%</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cruceData.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="text-center text-zinc-400 py-8">No hay datos para cruzar.</TableCell></TableRow>
                                    ) : cruceData.map((row, i) => (
                                        <TableRow key={i} className={row.estado === 'ERROR' ? 'bg-red-50' : row.estado === 'ALERTA' ? 'bg-amber-50/40' : ''}>
                                            <TableCell className="font-semibold">{row.categoria}</TableCell>
                                            <TableCell className="text-right">{row.acumulado_diario.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{row.total_semanal.toLocaleString()}</TableCell>
                                            <TableCell className={`text-right font-bold ${row.diferencia > 0 ? 'text-red-600' : row.diferencia < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {row.diferencia > 0 ? '+' : ''}{row.diferencia}
                                            </TableCell>
                                            <TableCell className="text-center text-sm text-zinc-500">{row.porcentaje.toFixed(1)}%</TableCell>
                                            <TableCell className="text-center">{estadoBadge(row.estado)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-50 border-zinc-200">
                        <CardContent className="py-4 px-6 text-xs text-zinc-500 space-y-1">
                            <p><strong>Reglas:</strong> Diferencia = Total Semanal − Acumulado Diario</p>
                            <p>✅ <strong>OK:</strong> Sin diferencia | ⚠️ <strong>ALERTA:</strong> Hay diferencia | 🔴 <strong>ERROR:</strong> Diferencia &gt; 10%</p>
                            <p><strong>Nota:</strong> Para MACHU PICCHU solo se cruzan los CONSUMIDOS. Para MEDLOG solo se cruzan los del SISTEMA (no los tickets duplicados).</p>
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
