'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Eye } from 'lucide-react';

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
                .limit(50);
            if (liqData) setLiquidaciones(liqData);

            // 2. Fetch Snacks
            const { data: snackData } = await supabase
                .from('kardex_snack_ventas')
                .select(`*, semanas(fecha_inicio), kardex_productos(nombre)`)
                .eq('comedor_id', comedorId as any)
                .order('created_at', { ascending: false })
                .limit(50);
            if (snackData) setSnacks(snackData);

            // 3. Fetch Pasteles
            const { data: pastaData } = await supabase
                .from('kardex_pasteles')
                .select(`*, semanas(fecha_inicio), kardex_productos(nombre)`)
                .eq('comedor_id', comedorId as any)
                .order('created_at', { ascending: false })
                .limit(50);
            if (pastaData) setPasteles(pastaData);

            // 4. Fetch Pan
            const { data: panData } = await supabase
                .from('pedido_pan')
                .select(`*, semanas(fecha_inicio)`)
                .eq('comedor_id', comedorId as any)
                .order('fecha', { ascending: false })
                .limit(50);
            if (panData) setPan(panData);

            // 5. Fetch Gastos
            const { data: gasData } = await supabase
                .from('gastos_operativos')
                .select(`*, semanas(fecha_inicio)`)
                .eq('comedor_id', comedorId as any)
                .order('fecha', { ascending: false })
                .limit(50);
            if (gasData) setGastos(gasData);

            // 6. Fetch Coffe
            const { data: coffeData } = await supabase
                .from('coffe_otros')
                .select(`*, semanas(fecha_inicio)`)
                .eq('comedor_id', comedorId as any)
                .order('fecha', { ascending: false })
                .limit(50);
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

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Historial de Registros</h2>
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

                <TabsContent value="diario">
                    <HistoryTable
                        headers={['Fecha', 'Monto Coffe', 'Observaciones', 'Total Día', 'Detalle']}
                        data={liquidaciones}
                        renderRow={(l) => (
                            <TableRow key={l.id}>
                                <TableCell className="font-medium">{formatDateStr(l.fecha)}</TableCell>
                                <TableCell>S/ {Number(l.monto_coffe || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-zinc-500">{l.observaciones || '-'}</TableCell>
                                <TableCell className="text-right font-bold text-[#2D6A4F]">S/ {Number(l.subtotal || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-center">
                                    <button onClick={() => verDetalle(l)} className="text-[#2D6A4F] hover:text-[#1B4332] p-1 h-8 w-8 inline-flex items-center justify-center rounded-md border border-zinc-200">
                                        <Eye size={16} />
                                    </button>
                                </TableCell>
                            </TableRow>
                        )}
                    />
                </TabsContent>

                <TabsContent value="snacks">
                    <HistoryTable
                        headers={['Fecha Reg.', 'Semana', 'Producto', 'St. Inicial', 'Pedido', 'Ventas', 'St. Final', 'Dif.']}
                        data={snacks}
                        renderRow={(s) => (
                            <TableRow key={s.id}>
                                <TableCell className="text-[10px] text-zinc-400">{format(new Date(s.created_at), 'dd MMM HH:mm')}</TableCell>
                                <TableCell className="font-medium">{formatDateStr(s.semanas?.fecha_inicio)}</TableCell>
                                <TableCell>{s.kardex_productos?.nombre}</TableCell>
                                <TableCell className="text-right">{s.stock_inicial_qty}</TableCell>
                                <TableCell className="text-right">{s.pedido_qty}</TableCell>
                                <TableCell className="text-right text-zinc-600 font-medium">{Number(s.venta_credito || 0) + Number(s.venta_contado_yape || 0)}</TableCell>
                                <TableCell className="text-right font-bold bg-zinc-50">{s.stock_final_qty}</TableCell>
                                <TableCell className={`text-right font-medium ${Number(s.merma || 0) > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>{s.merma || 0}</TableCell>
                            </TableRow>
                        )}
                    />
                </TabsContent>

                <TabsContent value="pasteles">
                    <HistoryTable
                        headers={['Fecha Reg.', 'Semana', 'Producto', 'St. Inicial', 'Pedido', 'Ventas', 'St. Final', 'Dif.']}
                        data={pasteles}
                        renderRow={(p) => (
                            <TableRow key={p.id}>
                                <TableCell className="text-[10px] text-zinc-400">{format(new Date(p.created_at), 'dd MMM HH:mm')}</TableCell>
                                <TableCell className="font-medium">{formatDateStr(p.semanas?.fecha_inicio)}</TableCell>
                                <TableCell>{p.kardex_productos?.nombre}</TableCell>
                                <TableCell className="text-right">{p.stock_inicial_qty}</TableCell>
                                <TableCell className="text-right">{p.pedido_qty}</TableCell>
                                <TableCell className="text-right text-zinc-600 font-medium">{Number(p.venta_credito_yapes || 0) + Number(p.venta_contado || 0)}</TableCell>
                                <TableCell className="text-right font-bold bg-zinc-50">{p.stock_final_qty}</TableCell>
                                <TableCell className={`text-right font-medium ${Number(p.merma || 0) > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>{p.merma || 0}</TableCell>
                            </TableRow>
                        )}
                    />
                </TabsContent>

                <TabsContent value="pan">
                    <HistoryTable
                        headers={['Fecha', 'Producto', 'Pedido', 'Vendida', 'Diferencia']}
                        data={pan}
                        renderRow={(p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{formatDateStr(p.fecha)}</TableCell>
                                <TableCell>{p.producto}</TableCell>
                                <TableCell className="text-right">{p.cantidad_pedido}</TableCell>
                                <TableCell className="text-right">{p.cantidad_vendida}</TableCell>
                                <TableCell className="text-right font-bold">{p.diferencia}</TableCell>
                            </TableRow>
                        )}
                    />
                </TabsContent>

                <TabsContent value="gastos">
                    <HistoryTable
                        headers={['Fecha', 'Categoría', 'Descripción', 'Monto', 'Autorizado']}
                        data={gastos}
                        renderRow={(g) => (
                            <TableRow key={g.id}>
                                <TableCell className="font-medium">{formatDateStr(g.fecha)}</TableCell>
                                <TableCell><span className="text-xs bg-zinc-100 px-2 py-0.5 rounded">{g.categoria}</span></TableCell>
                                <TableCell>{g.descripcion}</TableCell>
                                <TableCell className="text-right font-bold text-red-600">S/ {g.monto.toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-zinc-500">{g.autorizado_por || '-'}</TableCell>
                            </TableRow>
                        )}
                    />
                </TabsContent>

                <TabsContent value="coffe">
                    <HistoryTable
                        headers={['Fecha', 'Tipo', 'Solicitado', 'Detalle', 'Total']}
                        data={coffe}
                        renderRow={(c) => (
                            <TableRow key={c.id}>
                                <TableCell className="font-medium">{formatDateStr(c.fecha)}</TableCell>
                                <TableCell><span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium">{c.tipo}</span></TableCell>
                                <TableCell>{c.solicitado_por}</TableCell>
                                <TableCell className="text-xs">{c.descripcion} ({c.cantidad} x {c.valor_unit})</TableCell>
                                <TableCell className="text-right font-bold">S/ {c.total.toFixed(2)}</TableCell>
                            </TableRow>
                        )}
                    />
                </TabsContent>
            </Tabs>

            <Dialog open={openDetalle} onOpenChange={setOpenDetalle}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-[#1B4332] flex items-center justify-between">
                            <span>Resumen de Reporte</span>
                            <Badge variant="outline" className="text-[#2D6A4F] border-[#2D6A4F]">
                                {selectedReporte && formatDateStr(selectedReporte.fecha)}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription>Desglose por categorías y servicios adicionales.</DialogDescription>
                    </DialogHeader>

                    {loadingDetalle ? (
                        <div className="py-20 text-center text-zinc-500">Cargando desglose...</div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {['DESAYUNO', 'ALMUERZO', 'CENA', 'AMANECIDA', 'LONCHE', 'PAN', 'BEBIDA', 'EXTRA'].map(cat => {
                                    const items = reporteDetalles.filter(d => d.comedor_campos_reporte?.categoria === cat);
                                    if (items.length === 0) return null;
                                    const catTotal = selectedReporte?.totales?.find((t: any) => t.categoria === cat);

                                    return (
                                        <Card key={cat} className="overflow-hidden border-zinc-200">
                                            <div className="bg-emerald-50 px-3 py-1.5 border-b flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">{cat}</span>
                                                {catTotal && <span className="text-[10px] font-bold text-emerald-600">{catTotal.total_cantidad} pax</span>}
                                            </div>
                                            <CardContent className="p-0">
                                                <table className="w-full text-xs">
                                                    <tbody className="divide-y">
                                                        {items.map((item, idx) => (
                                                            <tr key={idx}>
                                                                <td className="px-3 py-1.5">{item.comedor_campos_reporte?.nombre_campo}</td>
                                                                <td className="px-3 py-1.5 text-center font-medium bg-zinc-50/50">{item.cantidad}</td>
                                                                <td className="px-3 py-1.5 text-right font-medium">S/ {Number(item.monto || 0).toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>

                            {(selectedReporte?.tiene_coffe_break || selectedReporte?.observaciones) && (
                                <div className="space-y-4 pt-4 border-t">
                                    {selectedReporte.tiene_coffe_break && (
                                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                                            <h4 className="text-xs font-bold text-amber-800 mb-1">COFFE BREAK / ESPECIALES</h4>
                                            <p className="text-xs text-amber-900">{selectedReporte.descripcion_coffe}</p>
                                            <p className="text-sm font-bold text-amber-800 mt-1">Monto: S/ {Number(selectedReporte.monto_coffe || 0).toFixed(2)}</p>
                                        </div>
                                    )}
                                    {selectedReporte.observaciones && (
                                        <div className="bg-zinc-50 p-3 rounded-lg border">
                                            <h4 className="text-xs font-bold text-zinc-600 mb-1 text-uppercase">OBSERVACIONES</h4>
                                            <p className="text-xs text-zinc-700 italic">{selectedReporte.observaciones}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="bg-[#1B4332] text-white p-4 rounded-xl flex items-center justify-between">
                                <span className="font-bold">TOTAL FINAL DEL DÍA</span>
                                <span className="text-xl font-bold">S/ {Number(selectedReporte?.subtotal || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function HistoryTable({ headers, data, renderRow }: { headers: string[], data: any[], renderRow: (item: any) => React.ReactNode }) {
    return (
        <Card>
            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-900">
                        <TableRow>
                            {headers.map(h => <TableHead key={h} className={h.includes('Total') || h.includes('Monto') || h.includes('Vendida') || h.includes('Diferencia') || h.includes('V. ') || h.includes('Cantidad') || h.includes('Ingreso') ? 'text-right' : ''}>{h}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow><TableCell colSpan={headers.length} className="text-center py-12 text-zinc-500">No se encontraron registros recientes</TableCell></TableRow>
                        ) : data.map(renderRow)}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
