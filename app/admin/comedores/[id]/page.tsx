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
import { MapPin, User as UserIcon, Building, Phone, Calendar, AlertTriangle, Eye, Info, FileSpreadsheet, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { exportResumenExcel } from '@/lib/utils/export-resumen-excel';
import { toast } from 'sonner';
import { campoSumaEnTotal } from '@/lib/utils/comedor-total-rules';

export default function ComedorDetallePage() {
    const params = useParams();
    const id = params.id as string;
    const { loading } = useUser();
    const supabase = createClient();
    const [dataLoaded, setDataLoaded] = useState(false);

    const [comedor, setComedor] = useState<any>(null);
    const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
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

            const { data: liqData } = await supabase
                .from('reporte_diario')
                .select('*')
                .eq('comedor_id', id)
                .order('fecha', { ascending: false })
                .limit(50);
            if (liqData) setLiquidaciones(liqData);

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

            // Format data to ensure comedor_campos_reporte is an object
            const formattedValores = (valRes.data || []).map((v: any) => ({
                ...v,
                comedor_campos_reporte: Array.isArray(v.comedor_campos_reporte)
                    ? v.comedor_campos_reporte[0]
                    : v.comedor_campos_reporte
            }));

            setReporteDetalles(formattedValores);

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
                <TabsList className="grid grid-cols-1 h-auto md:h-12 bg-zinc-100">
                    <TabsTrigger value="diario" className="data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white">Reportes Diarios</TabsTrigger>
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
                                        <p className="text-xs text-indigo-700">{selectedReporte.descripcion_coffe}</p>
                                    </div>
                                    <div className="text-lg font-bold text-indigo-900">
                                        S/. {Number(selectedReporte.monto_coffe || 0).toFixed(2)}
                                    </div>
                                </div>
                            )}

                            {/* Detailed Table grouped by category */}
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
                                                    {(() => {
                                                        // Respeta la regla Machu/Medlog: solo cuentan los campos que
                                                        // efectivamente facturan (ver lib/utils/comedor-total-rules).
                                                        const facturables = items.filter((it: any) => campoSumaEnTotal(id, it.comedor_campos_reporte?.categoria || '', it.comedor_campos_reporte?.nombre_campo || ''));
                                                        const totalCant = facturables.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);
                                                        const totalMonto = facturables.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);
                                                        return (
                                                            <tfoot className="bg-emerald-50/30 border-t-2 border-emerald-100">
                                                                <tr>
                                                                    <td className="px-4 py-4 font-black text-base text-emerald-900 uppercase">TOTAL {cat}</td>
                                                                    <td className="px-4 py-4 text-center font-black text-3xl text-emerald-900 bg-emerald-100/50">{totalCant}</td>
                                                                    <td className="px-4 py-4 text-right font-black text-3xl text-[#1B4332]">S/. {totalMonto.toFixed(2)}</td>
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

                            <Separator />

                            <div className="bg-[#1B4332] text-white p-6 rounded-2xl flex items-center justify-between shadow-xl shadow-emerald-900/20">
                                <div className="flex flex-col">
                                    <span className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Resumen General</span>
                                    <span className="text-xl font-black uppercase tracking-tighter">Total Liquidación del Día</span>
                                </div>
                                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black opacity-60 uppercase">Total Pax</span>
                                        <span className="text-3xl font-black">{
                                            reporteDetalles.reduce((acc, curr) => {
                                                if (!campoSumaEnTotal(id, curr.comedor_campos_reporte?.categoria || '', curr.comedor_campos_reporte?.nombre_campo || '')) return acc;
                                                return acc + (curr.cantidad || 0);
                                            }, 0)
                                        }</span>
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
    )
}
