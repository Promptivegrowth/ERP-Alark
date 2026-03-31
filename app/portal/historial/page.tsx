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
    const [snacks, setSnacks] = useState<any[]>([]);
    const [pasteles, setPasteles] = useState<any[]>([]);
    const [pan, setPan] = useState<any[]>([]);
    const [gastos, setGastos] = useState<any[]>([]);
    const [coffe, setCoffe] = useState<any[]>([]);

    const [selectedReporte, setSelectedReporte] = useState<any>(null);
    const [reporteDetalles, setReporteDetalles] = useState<any[]>([]);
    const [openDetalle, setOpenDetalle] = useState(false);
    const [loadingDetalle, setLoadingDetalle] = useState(false);

    useEffect(() => {
        if (!comedorId) return;

        async function fetchData() {
            // 1. Fetch Reporte Diario (new module)
            const { data: liqData } = await supabase
                .from('reporte_diario')
                .select('*')
                .eq('comedor_id', comedorId as any)
                .order('fecha', { ascending: false })
                .limit(100);
            if (liqData) setLiquidaciones(liqData);

            // 2. Fetch Snacks
            const { data: snackData } = await supabase
                .from('kardex_snack_ventas')
                .select(`*, semanas(fecha_inicio, fecha_fin), kardex_productos(nombre)`)
                .eq('comedor_id', comedorId as any)
                .order('created_at', { ascending: false })
                .limit(100);
            if (snackData) setSnacks(snackData);

            // 3. Fetch Pasteles
            const { data: pastaData } = await supabase
                .from('kardex_pasteles')
                .select(`*, semanas(fecha_inicio, fecha_fin), kardex_productos(nombre)`)
                .eq('comedor_id', comedorId as any)
                .order('created_at', { ascending: false })
                .limit(100);
            if (pastaData) setPasteles(pastaData);

            // 4. Fetch Pan
            const { data: panData } = await supabase
                .from('pedido_pan')
                .select(`*, semanas(fecha_inicio, fecha_fin)`)
                .eq('comedor_id', comedorId as any)
                .order('fecha', { ascending: false })
                .limit(100);
            if (panData) setPan(panData);

            // 5. Fetch Gastos
            const { data: gasData } = await supabase
                .from('gastos_operativos')
                .select(`*, semanas(fecha_inicio, fecha_fin)`)
                .eq('comedor_id', comedorId as any)
                .order('fecha', { ascending: false })
                .limit(100);
            if (gasData) setGastos(gasData);

            // 6. Fetch Coffe
            const { data: coffeData } = await supabase
                .from('coffe_otros')
                .select(`*, semanas(fecha_inicio, fecha_fin)`)
                .eq('comedor_id', comedorId as any)
                .order('fecha', { ascending: false })
                .limit(100);
            if (coffeData) setCoffe(coffeData);

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
                    .select('cantidad, monto, comedor_campos_reporte(nombre_campo, categoria)')
                    .eq('reporte_id', reporte.id),
                supabase
                    .from('reporte_diario_totales')
                    .select('*')
                    .eq('reporte_id', reporte.id)
            ]);

            if (valRes.error) throw valRes.error;
            setReporteDetalles(valRes.data || []);
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
                <TabsList className="grid w-full grid-cols-6 mb-8">
                    <TabsTrigger value="diario">Diario</TabsTrigger>
                    <TabsTrigger value="snacks">Snacks</TabsTrigger>
                    <TabsTrigger value="pasteles">Pasteles</TabsTrigger>
                    <TabsTrigger value="pan">Pan</TabsTrigger>
                    <TabsTrigger value="gastos">Gastos</TabsTrigger>
                    <TabsTrigger value="coffe">Especiales</TabsTrigger>
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

                {/* TABS SEMANALES agrupadas por MES */}
                <TabsContent value="snacks">
                    <div className="space-y-4">
                        {groupByMonth(snacks).map(([monthKey, items]) => {
                            const monthName = format(new Date(monthKey + '-02'), 'MMMM yyyy', { locale: es });
                            return (
                                <AccordionItem key={monthKey} title={monthName.toUpperCase()} count={items.length}>
                                    <HistoryTable
                                        headers={['Fecha Reg.', 'Producto', 'St. Inicial', 'Pedido', 'Ventas', 'St. Final', 'Merma']}
                                        data={items}
                                        renderRow={(s) => (
                                            <TableRow key={s.id}>
                                                <TableCell className="text-[10px] text-zinc-400">
                                                    <div className="flex items-center gap-1"><Clock size={10} /> {format(new Date(s.created_at), 'dd/MM HH:mm')}</div>
                                                </TableCell>
                                                <TableCell className="font-bold text-[#1B4332]">{s.kardex_productos?.nombre}</TableCell>
                                                <TableCell className="text-center font-medium bg-zinc-50/50">{s.stock_inicial_qty}</TableCell>
                                                <TableCell className="text-center font-medium">{s.pedido_qty}</TableCell>
                                                <TableCell className="text-center text-emerald-700 font-black text-base">{Number(s.venta_credito || 0) + Number(s.venta_contado_yape || 0)}</TableCell>
                                                <TableCell className="text-center font-black bg-zinc-50 text-base">{s.stock_final_qty}</TableCell>
                                                <TableCell className={`text-center font-black ${Number(s.merma || 0) > 0 ? 'text-rose-600 bg-rose-50' : 'text-zinc-300'}`}>{s.merma || 0}</TableCell>
                                            </TableRow>
                                        )}
                                    />
                                </AccordionItem>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="pasteles">
                    <div className="space-y-4">
                        {groupByMonth(pasteles).map(([monthKey, items]) => {
                            const monthName = format(new Date(monthKey + '-02'), 'MMMM yyyy', { locale: es });
                            return (
                                <AccordionItem key={monthKey} title={monthName.toUpperCase()} count={items.length}>
                                    <HistoryTable
                                        headers={['Fecha Reg.', 'Producto', 'St. Inicial', 'Pedido', 'Ventas', 'St. Final', 'Merma']}
                                        data={items}
                                        renderRow={(p) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="text-[10px] text-zinc-400">
                                                    <div className="flex items-center gap-1"><Clock size={10} /> {format(new Date(p.created_at), 'dd/MM HH:mm')}</div>
                                                </TableCell>
                                                <TableCell className="font-bold text-[#1B4332]">{p.kardex_productos?.nombre}</TableCell>
                                                <TableCell className="text-center font-medium opacity-60">{p.stock_inicial_qty}</TableCell>
                                                <TableCell className="text-center font-medium">{p.pedido_qty}</TableCell>
                                                <TableCell className="text-center text-emerald-700 font-black text-base">{Number(p.venta_credito_yapes || 0) + Number(p.venta_contado || 0)}</TableCell>
                                                <TableCell className="text-center font-black bg-zinc-50 text-base">{p.stock_final_qty}</TableCell>
                                                <TableCell className={`text-center font-black ${Number(p.merma || 0) > 0 ? 'text-rose-600 bg-rose-50' : 'text-zinc-300'}`}>{p.merma || 0}</TableCell>
                                            </TableRow>
                                        )}
                                    />
                                </AccordionItem>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="pan">
                    <div className="space-y-4">
                        {groupByMonth(pan).map(([monthKey, items]) => {
                            const monthName = format(new Date(monthKey + '-02'), 'MMMM yyyy', { locale: es });
                            return (
                                <AccordionItem key={monthKey} title={monthName.toUpperCase()} count={items.length}>
                                    <HistoryTable
                                        headers={['Fecha', 'Producto', 'Pedido', 'Vendida', 'Diferencia']}
                                        data={items}
                                        renderRow={(p) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="font-bold">{formatDateStr(p.fecha)}</TableCell>
                                                <TableCell className="font-medium text-emerald-900">{p.producto}</TableCell>
                                                <TableCell className="text-center font-bold text-lg">{p.cantidad_pedido}</TableCell>
                                                <TableCell className="text-center font-bold text-lg text-emerald-700">{p.cantidad_vendida}</TableCell>
                                                <TableCell className="text-center font-black text-xl bg-zinc-50">{p.diferencia}</TableCell>
                                            </TableRow>
                                        )}
                                    />
                                </AccordionItem>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="gastos">
                    <div className="space-y-4">
                        {groupByMonth(gastos).map(([monthKey, items]) => {
                            const monthName = format(new Date(monthKey + '-02'), 'MMMM yyyy', { locale: es });
                            return (
                                <AccordionItem key={monthKey} title={monthName.toUpperCase()} count={items.length}>
                                    <HistoryTable
                                        headers={['Fecha', 'Categoría', 'Descripción', 'Monto', 'Autorizado']}
                                        data={items}
                                        renderRow={(g) => (
                                            <TableRow key={g.id}>
                                                <TableCell className="font-bold">{formatDateStr(g.fecha)}</TableCell>
                                                <TableCell><Badge variant="secondary" className="uppercase text-[10px]">{g.categoria}</Badge></TableCell>
                                                <TableCell className="text-xs">{g.descripcion}</TableCell>
                                                <TableCell className="text-right font-black text-xl text-rose-600">S/ {g.monto.toFixed(2)}</TableCell>
                                                <TableCell className="text-xs text-zinc-400 italic text-right">{g.autorizado_por || '-'}</TableCell>
                                            </TableRow>
                                        )}
                                    />
                                </AccordionItem>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="coffe">
                    <div className="space-y-4">
                        {groupByMonth(coffe).map(([monthKey, items]) => {
                            const monthName = format(new Date(monthKey + '-02'), 'MMMM yyyy', { locale: es });
                            return (
                                <AccordionItem key={monthKey} title={monthName.toUpperCase()} count={items.length}>
                                    <HistoryTable
                                        headers={['Fecha', 'Tipo / Solicitado', 'Detalle del Servicio', 'Total']}
                                        data={items}
                                        renderRow={(c) => (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-bold">
                                                    <div>{formatDateStr(c.fecha)}</div>
                                                    <div className="text-[10px] text-zinc-400">{c.solicitado_por}</div>
                                                </TableCell>
                                                <TableCell><Badge className="bg-purple-100 text-purple-800 border-purple-200">{c.tipo}</Badge></TableCell>
                                                <TableCell className="text-xs font-medium">
                                                    {c.descripcion}
                                                    <div className="text-[10px] text-zinc-500">{c.cantidad} unidades x S/ {c.valor_unit}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-black text-xl text-purple-900">S/ {c.total.toFixed(2)}</TableCell>
                                            </TableRow>
                                        )}
                                    />
                                </AccordionItem>
                            );
                        })}
                    </div>
                </TabsContent>
            </Tabs>

            {/* DIALOG DETALLE - Similar al admin para consistencia */}
            <Dialog open={openDetalle} onOpenChange={setOpenDetalle}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                                {['DESAYUNO', 'ALMUERZO', 'CENA', 'AMANECIDA', 'LONCHE', 'PAN', 'BEBIDA', 'EXTRA'].map(cat => {
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
                                                                <td className="px-4 py-2.5 text-center font-black text-lg bg-zinc-50/50 text-zinc-800 whitespace-nowrap w-24">{item.cantidad}</td>
                                                                <td className="px-4 py-2.5 text-right font-black text-lg text-emerald-700 whitespace-nowrap w-32">S/ {Number(item.monto || 0).toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    {catTotal && (
                                                        <tfoot className="bg-emerald-50/50 border-t-2 border-emerald-100 uppercase">
                                                            <tr className="text-emerald-900 font-black">
                                                                <td className="px-4 py-2 text-[10px] tracking-widest">Subtotal {cat}</td>
                                                                <td className="px-4 py-2 text-center text-xl whitespace-nowrap">{catTotal.total_cantidad}</td>
                                                                <td className="px-4 py-2 text-right text-xl whitespace-nowrap">S/ {Number(catTotal.total_monto || 0).toFixed(2)}</td>
                                                            </tr>
                                                        </tfoot>
                                                    )}
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
                                <span className="text-lg font-black uppercase tracking-tighter">Liquidación Total del Día</span>
                                <span className="text-4xl font-black">S/ {Number(selectedReporte?.subtotal || 0).toFixed(2)}</span>
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
