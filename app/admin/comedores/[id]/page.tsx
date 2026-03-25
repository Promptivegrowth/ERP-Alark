'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, User as UserIcon, Building, Phone, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

    useEffect(() => {
        if (!id) return;

        async function fetchData() {
            const { data: cData } = await supabase.from('comedores').select('*').eq('id', id).single();
            if (cData) setComedor(cData);

            const [liqRes, karRes, panRes, gasRes, espRes] = await Promise.all([
                supabase.from('liquidacion_diaria').select('*').eq('comedor_id', id).order('fecha', { ascending: false }).limit(50),
                supabase.from('kardex_semanal').select('*, kardex_productos(nombre)').eq('comedor_id', id).order('semana_inicio', { ascending: false }).limit(50),
                supabase.from('pedido_pan').select('*').eq('comedor_id', id).order('semana_inicio', { ascending: false }).limit(20),
                supabase.from('gastos').select('*').eq('comedor_id', id).order('fecha', { ascending: false }).limit(50),
                supabase.from('especial_servicios').select('*').eq('comedor_id', id).order('fecha', { ascending: false }).limit(50)
            ]);

            if (liqRes.data) setLiquidaciones(liqRes.data);
            if (karRes.data) setKardex(karRes.data);
            if (panRes.data) setPedidosPan(panRes.data);
            if (gasRes.data) setGastos(gasRes.data);
            if (espRes.data) setEspeciales(espRes.data);

            setDataLoaded(true);
        }
        fetchData();
    }, [id, supabase]);

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500">Cargando datos del comedor...</div>;
    if (!comedor) return <div className="p-8 text-center text-zinc-500">Comedor no encontrado</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100 flex items-center gap-3">
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
                <div className="flex gap-4">
                    {/* Actions like Edit could go here */}
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
                <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto md:h-12 bg-zinc-100 dark:bg-zinc-900">
                    <TabsTrigger value="diario" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800">Liquidaciones Diarias</TabsTrigger>
                    <TabsTrigger value="kardex" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800">Kardex de Inventario</TabsTrigger>
                    <TabsTrigger value="pan" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800">Pedidos de Pan</TabsTrigger>
                    <TabsTrigger value="gastos" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800">Gastos Caja Chica</TabsTrigger>
                    <TabsTrigger value="especiales" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800">Servs. Especiales</TabsTrigger>
                </TabsList>

                <TabsContent value="diario" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Liquidaciones Diarias Recientes</CardTitle>
                            <CardDescription>Registro del ingreso al crédito y contado reportado por el comedor.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Servicio</TableHead>
                                        <TableHead>Tipo de Pago</TableHead>
                                        <TableHead className="text-right">Cantidad</TableHead>
                                        <TableHead className="text-right">Total (S/.)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {liquidaciones.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-6 text-zinc-500">Sin datos</TableCell></TableRow> :
                                        liquidaciones.map((l) => (
                                            <TableRow key={l.id}>
                                                <TableCell className="font-medium">{format(new Date(l.fecha), 'dd MMM yyyy')}</TableCell>
                                                <TableCell>{l.servicio}</TableCell>
                                                <TableCell><Badge variant="outline" className={l.tipo_pago === 'CREDITO_RANSA' ? 'text-indigo-600' : 'text-emerald-600'}>{l.tipo_pago}</Badge></TableCell>
                                                <TableCell className="text-right">{l.cantidad}</TableCell>
                                                <TableCell className="text-right font-bold text-emerald-600">S/. {(l.monto || (l.cantidad * l.precio_unit)).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {kardex.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-zinc-500">Sin datos</TableCell></TableRow> :
                                        kardex.map((k) => (
                                            <TableRow key={k.id}>
                                                <TableCell className="font-medium">{format(new Date(k.semana_inicio), 'dd MMM yyyy')}</TableCell>
                                                <TableCell>{k.kardex_productos?.nombre || 'Producto'}</TableCell>
                                                <TableCell className="text-right">{k.ingreso_semanal}</TableCell>
                                                <TableCell className="text-right text-blue-600">{Number(k.ventas_credito) + Number(k.ventas_contado)}</TableCell>
                                                <TableCell className="text-right font-bold">{k.stock_fisico}</TableCell>
                                                <TableCell className="text-right">
                                                    <span className={`px-2 py-1 rounded font-semibold text-xs ${k.diferencia < 0 ? 'bg-red-100 text-red-700' : k.diferencia > 0 ? 'bg-amber-100 text-amber-700' : 'text-emerald-700'}`}>
                                                        {k.diferencia}
                                                    </span>
                                                </TableCell>
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
                                                <TableCell className="font-medium">{format(new Date(p.semana_inicio), 'dd MMM yyyy')}</TableCell>
                                                <TableCell className="text-right">{p.lunes}</TableCell>
                                                <TableCell className="text-right">{p.martes}</TableCell>
                                                <TableCell className="text-right">{p.miercoles}</TableCell>
                                                <TableCell className="text-right">{p.jueves}</TableCell>
                                                <TableCell className="text-right">{p.viernes}</TableCell>
                                                <TableCell className="text-right">{p.sabado}</TableCell>
                                                <TableCell className="text-right">{p.domingo}</TableCell>
                                                <TableCell className="text-right font-bold text-amber-600">{p.total}</TableCell>
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
                                                <TableCell>{g.num_documento}</TableCell>
                                                <TableCell>{g.proveedor} {g.observacion && <span className="text-zinc-400 text-xs ml-2">({g.observacion})</span>}</TableCell>
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
                                                <TableCell className="text-right font-bold text-indigo-600">S/. {((e.cantidad || 0) * (e.precio_unit || 0)).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
