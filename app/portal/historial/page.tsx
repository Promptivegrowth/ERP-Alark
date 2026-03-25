'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

    useEffect(() => {
        if (!comedorId) return;

        async function fetchData() {
            // 1. Fetch Liquidaciones
            const { data: liqData } = await supabase
                .from('liquidacion_diaria')
                .select('*')
                .eq('comedor_id', comedorId)
                .order('fecha', { ascending: false })
                .limit(50);
            if (liqData) setLiquidaciones(liqData);

            // 2. Fetch Snacks
            const { data: snackData } = await supabase
                .from('kardex_snack_ventas')
                .select(`*, semanas(fecha_inicio), kardex_productos(nombre)`)
                .eq('comedor_id', comedorId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (snackData) setSnacks(snackData);

            // 3. Fetch Pasteles
            const { data: pastaData } = await supabase
                .from('kardex_pasteles')
                .select(`*, semanas(fecha_inicio), kardex_productos(nombre)`)
                .eq('comedor_id', comedorId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (pastaData) setPasteles(pastaData);

            // 4. Fetch Pan
            const { data: panData } = await supabase
                .from('pedido_pan')
                .select(`*, semanas(fecha_inicio)`)
                .eq('comedor_id', comedorId)
                .order('fecha', { ascending: false })
                .limit(50);
            if (panData) setPan(panData);

            // 5. Fetch Gastos
            const { data: gasData } = await supabase
                .from('gastos_operativos')
                .select(`*, semanas(fecha_inicio)`)
                .eq('comedor_id', comedorId)
                .order('fecha', { ascending: false })
                .limit(50);
            if (gasData) setGastos(gasData);

            // 6. Fetch Coffe
            const { data: coffeData } = await supabase
                .from('coffe_otros')
                .select(`*, semanas(fecha_inicio)`)
                .eq('comedor_id', comedorId)
                .order('fecha', { ascending: false })
                .limit(50);
            if (coffeData) setCoffe(coffeData);

            setDataLoaded(true);
        }
        fetchData();
    }, [comedorId, supabase]);

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500 flex justify-center items-center h-[50vh]">Cargando historial...</div>;

    const formatDateStr = (date: string) => format(new Date(date), 'dd MMM yyyy', { locale: es });

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
                        headers={['Fecha', 'Servicio', 'Tipo Pago', 'Cantidad', 'Precio', 'Total']}
                        data={liquidaciones}
                        renderRow={(l) => (
                            <TableRow key={l.id}>
                                <TableCell className="font-medium">{formatDateStr(l.fecha)}</TableCell>
                                <TableCell>{l.servicio}</TableCell>
                                <TableCell>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${l.tipo_pago === 'CREDITO_RANSA' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                        {l.tipo_pago}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">{l.cantidad}</TableCell>
                                <TableCell className="text-right">S/ {l.precio_unit.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-bold">S/ {(l.cantidad * l.precio_unit).toFixed(2)}</TableCell>
                            </TableRow>
                        )}
                    />
                </TabsContent>

                <TabsContent value="snacks">
                    <HistoryTable
                        headers={['Semana', 'Producto', 'St. Inicial', 'Pedido', 'V. Crédito', 'V. Contado']}
                        data={snacks}
                        renderRow={(s) => (
                            <TableRow key={s.id}>
                                <TableCell className="font-medium">{formatDateStr(s.semanas?.fecha_inicio)}</TableCell>
                                <TableCell>{s.kardex_productos?.nombre}</TableCell>
                                <TableCell className="text-right">{s.stock_inicial_qty}</TableCell>
                                <TableCell className="text-right">{s.pedido_qty}</TableCell>
                                <TableCell className="text-right text-blue-600 font-medium">{s.venta_credito}</TableCell>
                                <TableCell className="text-right text-green-600 font-medium">{s.venta_contado_yape}</TableCell>
                            </TableRow>
                        )}
                    />
                </TabsContent>

                <TabsContent value="pasteles">
                    <HistoryTable
                        headers={['Semana', 'Producto', 'St. Inicial', 'Pedido', 'V. Crédito', 'V. Contado']}
                        data={pasteles}
                        renderRow={(p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{formatDateStr(p.semanas?.fecha_inicio)}</TableCell>
                                <TableCell>{p.kardex_productos?.nombre}</TableCell>
                                <TableCell className="text-right">{p.stock_inicial_qty}</TableCell>
                                <TableCell className="text-right">{p.pedido_qty}</TableCell>
                                <TableCell className="text-right text-blue-600 font-medium">{p.venta_credito_yapes}</TableCell>
                                <TableCell className="text-right text-green-600 font-medium">{p.venta_contado}</TableCell>
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
