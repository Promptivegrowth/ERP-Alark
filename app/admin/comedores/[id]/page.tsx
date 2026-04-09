'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { format, startOfWeek, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, User as UserIcon, Building, Phone, Calendar, AlertTriangle, TrendingUp, CheckCircle2, AlertCircle, HelpCircle, Eye, Info, FileSpreadsheet, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { exportResumenExcel } from '@/lib/utils/export-resumen-excel';
import { toast } from 'sonner';

export default function ComedorDetallePage() {
    const params = useParams();
    const id = params.id as string;
    const { loading } = useUser();
    const supabase = createClient();
    const [dataLoaded, setDataLoaded] = useState(false);

    const [comedor, setComedor] = useState<any>(null);
    const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
    const [kardex, setKardex] = useState<any[]>([]);
    const [pedidosPan, setPedidosPan] = useState<any[]>([]);
    const [gastos, setGastos] = useState<any[]>([]);
    const [especiales, setEspeciales] = useState<any[]>([]);
    const [cruceData, setCruceData] = useState<any[]>([]);
    const [selectedReporte, setSelectedReporte] = useState<any>(null);
    const [reporteDetalles, setReporteDetalles] = useState<any[]>([]);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [openDetalle, setOpenDetalle] = useState(false);

    // Export states
    const [exporting, setExporting] = useState(false);
    const [exportStartDate, setExportStartDate] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));

    useEffect(() => {
        if (!id) return;

        async function fetchData() {
            const { data: cData } = await supabase.from('comedores').select('*').eq('id', id).single();
            if (cData) setComedor(cData);

            const [liqRes, snackRes, pastRes, panRes, gasRes, espRes, cruceRes] = await Promise.all([
                supabase.from('reporte_diario').select('*').eq('comedor_id', id).order('fecha', { ascending: false }).limit(50),
                supabase.from('kardex_snack_ventas').select('*, kardex_productos(nombre)').eq('comedor_id', id).order('created_at', { ascending: false }).limit(20),
                supabase.from('kardex_pasteles').select('*, kardex_productos(nombre)').eq('comedor_id', id).order('created_at', { ascending: false }).limit(20),
                supabase.from('pedido_pan').select('*').eq('comedor_id', id).order('fecha', { ascending: false }).limit(50),
                supabase.from('gastos_operativos').select('*').eq('comedor_id', id).order('fecha', { ascending: false }).limit(50),
                supabase.from('coffe_otros').select('*').eq('comedor_id', id).order('fecha', { ascending: false }).limit(50),
                supabase.from('reporte_cruce_semanal').select('*').eq('comedor_id', id).order('updated_at', { ascending: false }).limit(30)
            ]);

            if (liqRes.data) setLiquidaciones(liqRes.data);

            // Merge snacks and pasteles for the Kardex tab
            const mergedKardex = [
                ...((snackRes.data || []) as any[]).map(k => ({ ...k, tipo: 'SNACK' })),
                ...((pastRes.data || []) as any[]).map(k => ({ ...k, tipo: 'PASTEL' }))
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setKardex(mergedKardex);
            if (panRes.data) setPedidosPan(panRes.data);
            if (gasRes.data) setGastos(gasRes.data);
            if (espRes.data) setEspeciales(espRes.data);
            if (cruceRes.data) setCruceData(cruceRes.data);

            setDataLoaded(true);
        }
        fetchData();
    }, [id, supabase]);

    async function verDetalle(reporte: any) {
        setSelectedReporte(reporte);
        setOpenDetalle(true);
        setLoadingDetalle(true);
        try {
            // Fetch values, field names and category totals
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
            setReporteDetalles(valRes.data || []);

            // We can attach totals to the selectedReporte or keep local
            setSelectedReporte({ ...reporte, totales: totRes.data || [] });
        } catch (err) {
            console.error(err);
            setReporteDetalles([]);
        } finally {
            setLoadingDetalle(false);
        }
    }

    async function handleExport(days: number) {
        if (!comedor) return;
        setExporting(true);
        try {
            await exportResumenExcel(
                supabase,
                comedor.id,
                comedor.nombre,
                new Date(exportStartDate + 'T12:00:00'),
                days
            );
            toast.success(`Resumen de ${days} días exportado con éxito`);
        } catch (error: any) {
            console.error(error);
            toast.error(`Error al exportar: ${error.message}`);
        } finally {
            setExporting(false);
        }
    }

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500">Cargando datos del comedor...</div>;
    if (!comedor) return <div className="p-8 text-center text-zinc-500">Comedor no encontrado</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-[#1B4332] flex items-center gap-3">
                        {comedor.nombre}
                        {comedor.activo ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Activo</Badge>
                        ) : (
                            <Badge variant="destructive">Inactivo</Badge>
                        )}
                    </h2>
                    <p className="text-zinc-500 flex items-center gap-2 mt-1">
                        <Building size={16} /> {comedor.cliente_empresa}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-zinc-400" />
                        <input
                            type="date"
                            value={exportStartDate}
                            onChange={(e) => setExportStartDate(e.target.value)}
                            className="text-sm border-none focus:ring-0 p-0 text-zinc-600 font-medium"
                        />
                    </div>
                    <Separator orientation="vertical" className="h-8 hidden sm:block" />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                            onClick={() => handleExport(7)}
                            disabled={exporting}
                        >
                            <FileSpreadsheet size={16} className="mr-2" />
                            {exporting ? 'Generando...' : '7 Días'}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                            onClick={() => handleExport(15)}
                            disabled={exporting}
                        >
                            <FileSpreadsheet size={16} className="mr-2" />
                            {exporting ? 'Generando...' : '15 Días'}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="col-span-1 md:col-span-3">
                    <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
                        <CardTitle className="text-lg">Información Operativa</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-6 pt-4">
                        <div>
                            <div className="text-sm font-medium text-zinc-500 flex items-center gap-2 mb-1"><MapPin size={14} /> Ubicación</div>
                            <div className="font-semibold">{comedor.direccion || 'No registrada'}</div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-zinc-500 flex items-center gap-2 mb-1"><UserIcon size={14} /> Encargado</div>
                            <div className="font-semibold">{comedor.responsable || 'No asignado'}</div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-zinc-500 flex items-center gap-2 mb-1"><Phone size={14} /> Teléfono</div>
                            <div className="font-semibold">{comedor.telefono || '-'}</div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-zinc-500 flex items-center gap-2 mb-1"><Calendar size={14} /> Creado en</div>
                            <div className="font-semibold">{format(new Date(comedor.created_at), 'dd MMM yyyy')}</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="diario" className="w-full">
                <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto md:h-12 bg-zinc-100">
                    <TabsTrigger value="diario" className="data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white">Reportes Diarios</TabsTrigger>
                    <TabsTrigger value="cruce" className="data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white">
                        Cruce Diario/Sem.
                        {cruceData.some(c => c.tiene_discrepancia) && <span className="ml-1.5 w-2 h-2 rounded-full bg-red-500 inline-block" />}
                    </TabsTrigger>
                    <TabsTrigger value="kardex" className="data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white">Kardex</TabsTrigger>
                    <TabsTrigger value="pan" className="data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white">Pedidos Pan</TabsTrigger>
                    <TabsTrigger value="gastos" className="data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white">Gastos</TabsTrigger>
                    <TabsTrigger value="especiales" className="data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white">Serv. Especiales</TabsTrigger>
                </TabsList>

                <TabsContent value="diario" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Reportes Diarios</CardTitle>
                            <CardDescription>Registros diarios enviados por el comedor (nuevo módulo).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Total Servicios (S/.)</TableHead>
                                        <TableHead>Coffe Break</TableHead>
                                        <TableHead>Observaciones</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                        <TableHead className="text-center">Detalle</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {liquidaciones.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-6 text-zinc-500">Sin reportes diarios</TableCell></TableRow> :
                                        liquidaciones.map((l) => (
                                            <TableRow key={l.id}>
                                                <TableCell className="font-medium">{format(new Date(l.fecha + 'T12:00:00'), 'dd MMM yyyy')}</TableCell>
                                                <TableCell className="font-bold text-[#2D6A4F]">S/. {Number(l.subtotal || 0).toFixed(2)}</TableCell>
                                                <TableCell>{l.tiene_coffe_break ? <Badge className="bg-amber-100 text-amber-800">Sí</Badge> : <span className="text-zinc-400 text-xs">No</span>}</TableCell>
                                                <TableCell className="text-xs text-zinc-500 max-w-[200px] truncate">{l.observaciones || '-'}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={l.bloqueado ? 'bg-zinc-200 text-zinc-600' : 'bg-emerald-100 text-emerald-800'}>
                                                        {l.bloqueado ? 'Cerrado' : 'Activo'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => verDetalle(l)}>
                                                        <Eye size={16} className="text-[#2D6A4F]" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cruce" className="mt-6">
                    <Card className="border-2 border-[#2D6A4F]/20">
                        <CardHeader className="bg-[#1B4332]/5 border-b">
                            <div className="flex items-center gap-2">
                                <TrendingUp size={16} className="text-[#2D6A4F]" />
                                <CardTitle className="text-base text-[#1B4332]">Cruce Diario vs Semanal</CardTitle>
                            </div>
                            <CardDescription>Diferencias detectadas entre los reportes diarios acumulados y los reportes semanales.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {cruceData.length === 0 ? (
                                <div className="text-center py-12 text-zinc-500">Sin datos de cruce aún. Se generan automáticamente al guardar reportes.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-zinc-50 border-b">
                                                <th className="text-left px-4 py-2 font-semibold text-zinc-600">Categoría</th>
                                                <th className="text-right px-4 py-2 font-semibold text-zinc-600">Acumulado Diario</th>
                                                <th className="text-right px-4 py-2 font-semibold text-zinc-600">Total Semanal</th>
                                                <th className="text-right px-4 py-2 font-semibold text-zinc-600">Diferencia</th>
                                                <th className="text-center px-4 py-2 font-semibold text-zinc-600">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {cruceData.map((row: any) => {
                                                const dif = Number(row.diferencia || 0);
                                                const pct = Number(row.diferencia_pct || 0);
                                                const estado = row.tiene_discrepancia ? (pct > 15 ? 'CRITICO' : 'ALERTA') : 'OK';
                                                return (
                                                    <TableRow key={row.id}>
                                                        <TableCell className="font-medium">{row.categoria}</TableCell>
                                                        <TableCell className="text-right">S/ {Number(row.total_diario_acumulado).toFixed(2)}</TableCell>
                                                        <TableCell className="text-right">S/ {Number(row.total_semanal).toFixed(2)}</TableCell>
                                                        <TableCell className={`text-right font-bold ${dif < 0 ? 'text-red-600' : dif > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                            {dif > 0 ? '+' : ''}{dif.toFixed(2)} ({pct.toFixed(1)}%)
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge className={estado === 'CRITICO' ? 'bg-red-100 text-red-800' : estado === 'ALERTA' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>
                                                                {estado === 'CRITICO' ? '⚠ Crítico' : estado === 'ALERTA' ? '⚡ Alerta' : '✓ OK'}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="kardex" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Diferencias de Inventario (Kardex)</CardTitle>
                            <CardDescription>Monitorea las pérdidas o sobresobrantes de stock.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Semana</TableHead>
                                        <TableHead>Producto</TableHead>
                                        <TableHead className="text-right">Ingreso</TableHead>
                                        <TableHead className="text-right">Total Ventas</TableHead>
                                        <TableHead className="text-right">Stock Físico</TableHead>
                                        <TableHead className="text-right">Diferencia</TableHead>
                                        <TableHead>Observación</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {kardex.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-6 text-zinc-500">Sin datos</TableCell></TableRow> :
                                        kardex.map((k, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium text-xs">
                                                    {k.semana_id ? 'Semanal' : format(new Date(k.created_at), 'dd MMM yyyy')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{k.kardex_productos?.nombre || 'Producto'}</span>
                                                        <span className="text-[10px] text-zinc-400">{k.tipo}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">{k.pedido_qty || 0}</TableCell>
                                                <TableCell className="text-right text-blue-600">{Number(k.venta_credito || k.venta_credito_yapes || 0) + Number(k.venta_contado || k.venta_contado_yape || 0)}</TableCell>
                                                <TableCell className="text-right font-bold">{k.stock_final_qty || 0}</TableCell>
                                                <TableCell className="text-right">
                                                    <span className={`px-2 py-1 rounded font-semibold text-xs ${Number(k.merma || 0) > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-emerald-700'}`}>
                                                        {k.merma || 0}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-zinc-500 text-xs italic">{k.observacion || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="pan" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Histórico de Pedido de Pan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Semana Inicio</TableHead>
                                        <TableHead className="text-right">L</TableHead>
                                        <TableHead className="text-right">M</TableHead>
                                        <TableHead className="text-right">M</TableHead>
                                        <TableHead className="text-right">J</TableHead>
                                        <TableHead className="text-right">V</TableHead>
                                        <TableHead className="text-right">S</TableHead>
                                        <TableHead className="text-right">D</TableHead>
                                        <TableHead className="text-right">Total Semana</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pedidosPan.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-6 text-zinc-500">Sin datos</TableCell></TableRow> :
                                        pedidosPan.map((p) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="font-medium">{format(new Date(p.fecha), 'dd MMM yyyy')}</TableCell>
                                                <TableCell className="text-right">{p.producto}</TableCell>
                                                <TableCell className="text-right font-bold text-amber-600">{p.cantidad_pedido}</TableCell>
                                                <TableCell className="text-right" colSpan={6}></TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="gastos" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gastos de Caja Chica</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Doc / Ticket</TableHead>
                                        <TableHead>Proveedor / Concepto</TableHead>
                                        <TableHead className="text-right">Monto (S/.)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gastos.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-6 text-zinc-500">Sin datos</TableCell></TableRow> :
                                        gastos.map((g) => (
                                            <TableRow key={g.id}>
                                                <TableCell className="font-medium">{format(new Date(g.fecha), 'dd MMM yyyy')}</TableCell>
                                                <TableCell><Badge variant="outline">{g.categoria}</Badge></TableCell>
                                                <TableCell>{g.descripcion} {g.autorizado_por && <span className="text-zinc-400 text-xs ml-2">({g.autorizado_por})</span>}</TableCell>
                                                <TableCell className="text-right font-bold text-red-600">- S/. {(g.monto || 0).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="especiales" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Servicios Especiales (Coffe / Staff)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Solicitante</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead className="text-right">Cant.</TableHead>
                                        <TableHead className="text-right">Total (S/.)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {especiales.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-zinc-500">Sin datos</TableCell></TableRow> :
                                        especiales.map((e) => (
                                            <TableRow key={e.id}>
                                                <TableCell className="font-medium">{format(new Date(e.fecha), 'dd MMM yyyy')}</TableCell>
                                                <TableCell><Badge variant="outline">{e.tipo}</Badge></TableCell>
                                                <TableCell>{e.solicitante}</TableCell>
                                                <TableCell>{e.descripcion}</TableCell>
                                                <TableCell className="text-right">{e.cantidad}</TableCell>
                                                <TableCell className="text-right font-bold text-indigo-600">S/. {(e.total || (e.cantidad * e.valor_unit) || 0).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={openDetalle} onOpenChange={setOpenDetalle}>
                <DialogContent className="sm:max-w-7xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8">
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="text-2xl font-bold text-[#1B4332] flex items-center gap-3">
                            <Info size={24} /> Resumen Detallado
                        </DialogTitle>
                        <CardDescription>
                            Reporte del {selectedReporte && format(new Date(selectedReporte.fecha + 'T12:00:00'), 'EEEE dd MMMM yyyy', { locale: es })}
                        </CardDescription>
                    </DialogHeader>

                    {loadingDetalle ? (
                        <div className="py-12 text-center text-zinc-500 italic">Cargando detalles...</div>
                    ) : (
                        <div className="space-y-6 pt-4">
                            {/* Observaciones Banner */}
                            {selectedReporte?.observaciones && (
                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg text-amber-800 text-sm italic">
                                    <span className="font-bold mb-1 block">Observaciones:</span>
                                    "{selectedReporte.observaciones}"
                                </div>
                            )}

                            {/* Coffee Break Banner */}
                            {selectedReporte?.tiene_coffe_break && (
                                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-indigo-900">Servicio Coffee Break</p>
                                        <p className="text-xs text-indigo-700">{selectedReporte.coffe_break_descripcion}</p>
                                    </div>
                                    <div className="text-lg font-bold text-indigo-900">
                                        S/. {Number(selectedReporte.coffe_break_monto || 0).toFixed(2)}
                                    </div>
                                </div>
                            )}

                            {/* Detailed Table grouped by category */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {['DESAYUNO', 'ALMUERZO', 'CENA', 'AMANECIDA', 'LONCHE', 'PAN', 'BEBIDA', 'EXTRA'].map(cat => {
                                    const items = reporteDetalles.filter(d => d.comedor_campos_reporte?.categoria === cat);
                                    if (items.length === 0) return null;

                                    const catTotal = selectedReporte?.totales?.find((t: any) => t.categoria === cat);

                                    return (
                                        <Card key={cat} className="overflow-hidden border-zinc-200">
                                            <CardHeader className="bg-emerald-50/50 py-3 border-b flex flex-row items-center justify-between">
                                                <CardTitle className="text-xl font-black tracking-wider text-[#1B4332] uppercase">{cat}</CardTitle>
                                                {catTotal && (
                                                    <span className="text-sm font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                                                        {catTotal.total_cantidad} pax
                                                    </span>
                                                )}
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-zinc-50 text-zinc-500 text-xs border-b">
                                                        <tr>
                                                            <th className="text-left px-4 py-2.5 font-bold">Concepto</th>
                                                            <th className="text-center px-4 py-2.5 font-bold">Cant.</th>
                                                            <th className="text-right px-4 py-2.5 font-bold">Precio</th>
                                                            <th className="text-right px-4 py-2.5 font-bold">Subtotal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-zinc-100">
                                                        {items.map((item, i) => (
                                                            <tr key={i} className="hover:bg-zinc-50 text-xl font-bold">
                                                                <td className="px-4 py-2.5 text-zinc-900 border-r border-zinc-100">{item.comedor_campos_reporte?.nombre_campo}</td>
                                                                <td className="px-4 py-2.5 text-center text-emerald-950 font-black bg-emerald-50/30">{item.cantidad}</td>
                                                                <td className="px-4 py-2.5 text-right text-zinc-500 font-medium">S/. {(item.precio_unitario || (item.monto / (item.cantidad || 1)) || 0).toFixed(2)}</td>
                                                                <td className="px-4 py-2.5 text-right text-zinc-900 font-black">S/. {Number(item.monto || 0).toFixed(2)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    {catTotal && (
                                                        <tfoot className="bg-emerald-50/30 border-t-2 border-emerald-100">
                                                            <tr>
                                                                <td className="px-4 py-4 font-black text-base text-emerald-900 uppercase">TOTAL {cat}</td>
                                                                <td className="px-4 py-4 text-center font-black text-3xl text-emerald-900 bg-emerald-100/50">{catTotal.total_cantidad}</td>
                                                                <td className="px-4 py-4 text-right font-black text-3xl text-[#1B4332]">S/. {Number(catTotal.total_monto || 0).toFixed(2)}</td>
                                                            </tr>
                                                        </tfoot>
                                                    )}
                                                </table>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>

                            <Separator />

                            <div className="flex justify-between items-center p-4 bg-[#1B4332] text-white rounded-xl">
                                <span className="font-medium">TOTAL GENERAL DEL DÍA</span>
                                <span className="text-2xl font-bold">S/. {Number(selectedReporte?.subtotal || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
