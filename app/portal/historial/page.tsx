'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, ChevronDown, Eye, Calendar as CalendarIcon, Clock, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function HistorialPage() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();
    const [dataLoaded, setDataLoaded] = useState(false);

    const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
    const [reportesSemanal, setReportesSemanal] = useState<any[]>([]);
    const [camposByCampoId, setCamposByCampoId] = useState<Record<string, any>>({});
    const [valoresBySemanal, setValoresBySemanal] = useState<Record<string, any[]>>({});

    const [selectedReporte, setSelectedReporte] = useState<any>(null);
    const [reporteDetalles, setReporteDetalles] = useState<any[]>([]);
    const [openDetalle, setOpenDetalle] = useState(false);
    const [loadingDetalle, setLoadingDetalle] = useState(false);

    useEffect(() => {
        if (!comedorId) return;

        async function fetchData() {
            // 1. Fetch Reporte Diario
            const { data: liqData } = await supabase
                .from('reporte_diario')
                .select('*')
                .eq('comedor_id', comedorId as any)
                .order('fecha', { ascending: false })
                .limit(100);
            if (liqData) setLiquidaciones(liqData);

            // 2. Fetch Reportes Semanales (new module)
            const { data: semData } = await (supabase as any)
                .from('reporte_semanal')
                .select('id, semana_inicio, semana_fin, estado, created_at')
                .eq('comedor_id', comedorId)
                .order('semana_inicio', { ascending: false })
                .limit(50);

            if (semData && semData.length > 0) {
                setReportesSemanal(semData);
                // Fetch campos for this comedor
                const { data: camposData } = await (supabase as any)
                    .from('reporte_semanal_campos')
                    .select('id, nombre_campo, seccion, es_facturable, precio_ref')
                    .eq('comedor_id', comedorId)
                    .eq('activo', true);
                const campos: Record<string, any> = {};
                (camposData || []).forEach((c: any) => { campos[c.id] = c; });
                setCamposByCampoId(campos);

                // Fetch valores for all semanas
                const semIds = semData.map((s: any) => s.id);
                const { data: valData } = await (supabase as any)
                    .from('reporte_semanal_valores')
                    .select('reporte_semanal_id, campo_id, dia_semana, cantidad, precio_unitario')
                    .in('reporte_semanal_id', semIds);

                const valMap: Record<string, any[]> = {};
                (valData || []).forEach((v: any) => {
                    if (!valMap[v.reporte_semanal_id]) valMap[v.reporte_semanal_id] = [];
                    valMap[v.reporte_semanal_id].push(v);
                });
                setValoresBySemanal(valMap);
            }

            setDataLoaded(true);
        }
        fetchData();
    }, [comedorId, supabase]);

    async function verDetalle(reporte: any) {
        setSelectedReporte(reporte);
        setOpenDetalle(true);
        setLoadingDetalle(true);
        try {
            const [valRes, totRes] = await Promise.all([
                supabase
                    .from('reporte_diario_valores')
                    .select('cantidad, monto, precio_unitario, comedor_campos_reporte(nombre_campo, categoria)')
                    .eq('reporte_id', reporte.id),
                supabase
                    .from('reporte_diario_totales')
                    .select('*')
                    .eq('reporte_id', reporte.id)
            ]);

            if (valRes.error) throw valRes.error;

            // Ensure comedor_campos_reporte is an object
            const formattedValores = (valRes.data || []).map((v: any) => ({
                ...v,
                comedor_campos_reporte: Array.isArray(v.comedor_campos_reporte)
                    ? v.comedor_campos_reporte[0]
                    : v.comedor_campos_reporte
            }));

            setReporteDetalles(formattedValores);
            setSelectedReporte({ ...reporte, totales: totRes.data || [] });
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingDetalle(false);
        }
    }

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500 flex justify-center items-center h-[50vh]">Cargando historial...</div>;

    const formatDateStr = (date: string) => format(new Date(date + 'T12:00:00'), 'dd MMM yyyy', { locale: es });

    // --- Helper for grouping by week ---
    const groupByWeek = (data: any[]) => {
        const groups: Record<string, any[]> = {};
        data.forEach(item => {
            const dt = new Date(item.fecha + 'T12:00:00');
            const week = format(dt, 'yyyy-ww');
            if (!groups[week]) groups[week] = [];
            groups[week].push(item);
        });
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    };

    // --- Helper for grouping by month ---
    const groupByMonth = (data: any[]) => {
        const groups: Record<string, any[]> = {};
        data.forEach(item => {
            const dt = new Date((item.fecha || item.created_at) + (item.fecha ? 'T12:00:00' : ''));
            const month = format(dt, 'yyyy-MM');
            if (!groups[month]) groups[month] = [];
            groups[month].push(item);
        });
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#1B4332]">Historial de Registros</h2>
                    <p className="text-sm text-zinc-500">Consulta tus reportes agrupados por tiempo.</p>
                </div>
            </div>

            <Tabs defaultValue="diario" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8">
                    <TabsTrigger value="diario">Reporte Diario</TabsTrigger>
                    <TabsTrigger value="semanal">Reporte Semanal</TabsTrigger>
                </TabsList>

                {/* TAB DIARIO */}
                <TabsContent value="diario">
                    <div className="space-y-4">
                        {groupByWeek(liquidaciones).map(([weekKey, items]) => {
                            const first = items[0];
                            const label = `Semana ${weekKey.split('-')[1]} — ${formatDateStr(items[items.length - 1].fecha)} al ${formatDateStr(items[0].fecha)}`;
                            return (
                                <AccordionItem key={weekKey} title={label} count={items.length} icon={<CalendarIcon size={18} />}>
                                    <HistoryTable
                                        headers={['Fecha', 'Montos', 'Observaciones', 'Total Día', 'Detalle']}
                                        data={items}
                                        renderRow={(l) => (
                                            <TableRow key={l.id}>
                                                <TableCell className="font-bold text-zinc-700">{formatDateStr(l.fecha)}</TableCell>
                                                <TableCell className="text-xs">
                                                    <div>Coffe: S/ {Number(l.monto_coffe || 0).toFixed(2)}</div>
                                                </TableCell>
                                                <TableCell className="text-xs text-zinc-500 max-w-[200px] truncate">{l.observaciones || '-'}</TableCell>
                                                <TableCell className="text-right font-black text-lg text-[#2D6A4F]">S/ {Number(l.subtotal || 0).toFixed(2)}</TableCell>
                                                <TableCell className="text-right">
                                                    <button onClick={() => verDetalle(l)} className="text-[#2D6A4F] hover:bg-emerald-50 p-2 rounded-lg border border-emerald-100 transition-colors">
                                                        <Eye size={18} />
                                                    </button>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    />
                                </AccordionItem>
                            );
                        })}
                    </div>
                </TabsContent>

                {/* TAB SEMANAL */}
                <TabsContent value="semanal">
                    <div className="space-y-4">
                        {reportesSemanal.length === 0 ? (
                            <div className="py-16 text-center text-zinc-400 italic">Aún no has enviado reportes semanales.</div>
                        ) : reportesSemanal.map((rep: any) => {
                            const inicio = new Date(rep.semana_inicio + 'T12:00:00');
                            const fin = new Date(rep.semana_fin + 'T12:00:00');
                            const label = `Semana ${format(inicio, 'dd MMM', { locale: es })} – ${format(fin, 'dd MMM yyyy', { locale: es })}`;
                            const valores = valoresBySemanal[rep.id] || [];
                            // Compute total
                            const totalMonto = valores.reduce((acc: number, v: any) => {
                                const campo = camposByCampoId[v.campo_id];
                                if (!campo?.es_facturable) return acc;
                                return acc + (v.cantidad * v.precio_unitario);
                            }, 0);
                            const totalQty = valores.reduce((acc: number, v: any) => {
                                const campo = camposByCampoId[v.campo_id];
                                if (!campo?.es_facturable) return acc;
                                return acc + v.cantidad;
                            }, 0);
                            return (
                                <AccordionItem key={rep.id} title={label} count={totalQty} icon={<CalendarIcon size={18} />}>
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <Badge className={rep.estado === 'cerrado'
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                            : 'bg-amber-100 text-amber-800 border-amber-300'}>
                                            {rep.estado === 'cerrado' ? '✅ Enviado al admin' : '⏳ Borrador'}
                                        </Badge>
                                        <span className="font-black text-lg text-emerald-700">S/. {totalMonto.toFixed(2)}</span>
                                    </div>
                                    <HistoryTable
                                        headers={['Sección', 'Producto / Servicio', 'Total Sem.', 'Precio', 'Monto']}
                                        data={Object.values(camposByCampoId).filter((c: any) =>
                                            valores.some((v: any) => v.campo_id === c.id && [0, 1, 2, 3, 4, 5, 6].some(d => {
                                                const val = valores.find((vv: any) => vv.campo_id === c.id && vv.dia_semana === d);
                                                return val && val.cantidad > 0;
                                            }))
                                        )}
                                        renderRow={(campo: any) => {
                                            const qty = [0, 1, 2, 3, 4, 5, 6].reduce((s: number, d: number) => {
                                                const v = valores.find((vv: any) => vv.campo_id === campo.id && vv.dia_semana === d);
                                                return s + (v?.cantidad || 0);
                                            }, 0);
                                            const precio = valores.find((vv: any) => vv.campo_id === campo.id)?.precio_unitario || 0;
                                            const monto = campo.es_facturable ? qty * precio : 0;
                                            return (
                                                <TableRow key={campo.id}>
                                                    <TableCell className="text-xs text-zinc-400">{campo.seccion}</TableCell>
                                                    <TableCell className="font-medium text-zinc-700">
                                                        {campo.nombre_campo}
                                                        {!campo.es_facturable && <span className="ml-2 text-xs text-zinc-400 italic">(info)</span>}
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-zinc-800">{qty || '—'}</TableCell>
                                                    <TableCell className="text-center text-xs text-zinc-500">{campo.es_facturable ? `S/. ${precio.toFixed(2)}` : '—'}</TableCell>
                                                    <TableCell className="text-right font-bold text-emerald-700">{monto > 0 ? `S/. ${monto.toFixed(2)}` : '—'}</TableCell>
                                                </TableRow>
                                            );
                                        }}
                                    />
                                </AccordionItem>
                            );
                        })}
                    </div>
                </TabsContent>
            </Tabs>

            {/* DIALOG DETALLE - Similar al admin para consistencia */}
            <Dialog open={openDetalle} onOpenChange={setOpenDetalle}>
                <DialogContent className="sm:max-w-7xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8">
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="text-2xl font-black text-[#1B4332] flex items-center justify-between">
                            <span>Resumen de Reporte Diario</span>
                            <Badge className="bg-emerald-600 text-white px-4 py-1 text-sm">
                                {selectedReporte && formatDateStr(selectedReporte.fecha)}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription className="text-base font-medium text-zinc-600">
                            Desglose detallado de pax y montos enviados al administrador.
                        </DialogDescription>
                    </DialogHeader>

                    {loadingDetalle ? (
                        <div className="py-20 text-center">
                            <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-zinc-500 font-bold">Cargando desglose...</p>
                        </div>
                    ) : (
                        <div className="space-y-8 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {(() => {
                                    const definedOrder = ['DESAYUNO', 'ALMUERZO', 'CENA', 'AMANECIDA', 'LONCHE', 'PAN', 'BEBIDA', 'EXTRA', 'OTRO'];
                                    const actualCats = Array.from(new Set(reporteDetalles.map(d => d.comedor_campos_reporte?.categoria))).filter(Boolean) as string[];
                                    return definedOrder.filter(cat => actualCats.includes(cat)).concat(actualCats.filter(cat => !definedOrder.includes(cat)));
                                })().map(cat => {
                                    const items = reporteDetalles.filter(d => d.comedor_campos_reporte?.categoria === cat);
                                    if (items.length === 0) return null;
                                    const catTotal = selectedReporte?.totales?.find((t: any) => t.categoria === cat);

                                    return (
                                        <Card key={cat} className="overflow-hidden border-2 border-emerald-100 shadow-sm">
                                            <div className="bg-emerald-600 px-4 py-2 flex justify-between items-center text-white">
                                                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">SECCIÓN {cat}</span>
                                                {catTotal && <span className="text-lg font-black whitespace-nowrap">{catTotal.total_cantidad} PAX</span>}
                                            </div>
                                            <CardContent className="p-0">
                                                <table className="w-full text-sm">
                                                    <tbody className="divide-y divide-emerald-50">
                                                        {items.map((item, idx) => (
                                                            <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                                                                <td className="px-4 py-2.5 font-semibold text-zinc-700 text-xs">{item.comedor_campos_reporte?.nombre_campo}</td>
                                                                <td className="px-4 py-2.5 text-center font-black text-lg bg-zinc-50/50 text-zinc-800 whitespace-nowrap w-24">
                                                                    {item.cantidad}
                                                                    <div className="text-[9px] font-normal text-zinc-400">S/ {(item.precio_unitario || (item.monto / (item.cantidad || 1))).toFixed(2)} c/u</div>
                                                                </td>
                                                                <td className="px-4 py-2.5 text-right font-black text-lg text-emerald-700 whitespace-nowrap w-32">S/ {Number(item.monto || 0).toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    {(() => {
                                                        const totalCant = items.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);
                                                        const totalMonto = items.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);
                                                        return (
                                                            <tfoot className="bg-emerald-50/50 border-t-2 border-emerald-100 uppercase">
                                                                <tr className="text-emerald-900 font-black">
                                                                    <td className="px-4 py-2 text-[10px] tracking-widest">Subtotal {cat}</td>
                                                                    <td className="px-4 py-2 text-center text-xl whitespace-nowrap">{totalCant}</td>
                                                                    <td className="px-4 py-2 text-right text-xl whitespace-nowrap">S/ {totalMonto.toFixed(2)}</td>
                                                                </tr>
                                                            </tfoot>
                                                        );
                                                    })()}
                                                </table>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>

                            {/* Serv Extras / Obs */}
                            {(selectedReporte?.tiene_coffe_break || selectedReporte?.observaciones) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t-2 border-dashed border-zinc-100">
                                    {selectedReporte.tiene_coffe_break && (
                                        <div className="bg-amber-50 h-full p-5 rounded-2xl border-2 border-amber-200">
                                            <h4 className="text-xs font-black text-amber-800 mb-2 uppercase tracking-widest flex items-center gap-2">
                                                ☕ Coffe Break / Especiales
                                            </h4>
                                            <p className="text-sm text-amber-900 font-medium mb-3">{selectedReporte.descripcion_coffe}</p>
                                            <div className="text-2xl font-black text-amber-700">S/ {Number(selectedReporte.monto_coffe || 0).toFixed(2)}</div>
                                        </div>
                                    )}
                                    {selectedReporte.observaciones && (
                                        <div className="bg-zinc-50 h-full p-5 rounded-2xl border-2 border-zinc-200">
                                            <h4 className="text-xs font-black text-zinc-500 mb-2 uppercase tracking-widest flex items-center gap-2">
                                                📝 Observaciones Adicionales
                                            </h4>
                                            <p className="text-sm text-zinc-700 font-medium italic">"{selectedReporte.observaciones}"</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="bg-emerald-900 text-white p-6 rounded-2xl flex items-center justify-between shadow-xl shadow-emerald-900/20">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Resumen Consolidado</span>
                                    <span className="text-lg font-black uppercase tracking-tighter">Liquidación Total del Día</span>
                                </div>
                                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black opacity-60 uppercase">Total Pax</span>
                                        <span className="text-3xl font-black">{reporteDetalles.reduce((acc, curr) => acc + (curr.cantidad || 0), 0)}</span>
                                    </div>
                                    <div className="hidden md:block h-10 w-px bg-white/20" />
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black opacity-60 uppercase">Monto Final</span>
                                        <span className="text-4xl font-black">S/ {Number(selectedReporte?.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// --- Custom Accordion Item Component ---
function AccordionItem({ title, count, icon, children }: { title: string, count: number, icon?: React.ReactNode, children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border rounded-xl overflow-hidden bg-white shadow-sm transition-all duration-200 border-zinc-200 hover:border-emerald-200">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${isOpen ? 'bg-emerald-50/50' : 'bg-white'}`}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${isOpen ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                        {icon || <CalendarIcon size={18} />}
                    </div>
                    <div>
                        <h3 className="font-black text-[#1B4332] tracking-tight">{title}</h3>
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">{count} registros encontrados</p>
                    </div>
                </div>
                {isOpen ? <ChevronDown className="text-emerald-600" /> : <ChevronRight className="text-zinc-300" />}
            </button>
            {isOpen && (
                <div className="p-4 bg-white border-t border-zinc-100 animate-in slide-in-from-top-2 duration-300">
                    {children}
                </div>
            )}
        </div>
    );
}

function HistoryTable({ headers, data, renderRow }: { headers: string[], data: any[], renderRow: (item: any) => React.ReactNode }) {
    return (
        <Card className="border-0 shadow-none">
            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader className="bg-zinc-50">
                        <TableRow>
                            {headers.map(h => {
                                const isRight = h.includes('Total') || h.includes('Monto') || h.includes('Total') || h.includes('Ventas') || h.includes('S. Final') || h.includes('Ingreso') || h.includes('S/') || h.includes('Detalle');
                                const isCenter = h.includes('Cant') || h.includes('Pedido') || h.includes('St.') || h.includes('Vendida') || h.includes('Diferencia') || h.includes('Dif.');
                                return (
                                    <TableHead key={h} className={`text-[10px] font-black uppercase tracking-widest text-zinc-400 ${isRight ? 'text-right' : isCenter ? 'text-center' : ''}`}>
                                        {h}
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow><TableCell colSpan={headers.length} className="text-center py-12 text-zinc-500 italic">No hay registros en este grupo</TableCell></TableRow>
                        ) : data.map(renderRow)}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
