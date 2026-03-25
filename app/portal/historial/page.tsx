'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function HistorialPage() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();
    const [activeTab, setActiveTab] = useState<'diario' | 'kardex' | 'gastos'>('diario');
    const [dataLoaded, setDataLoaded] = useState(false);

    const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
    const [kardex, setKardex] = useState<any[]>([]);
    const [gastos, setGastos] = useState<any[]>([]);

    useEffect(() => {
        if (!comedorId) return;

        async function fetchData() {
            // 1. Fetch Liquidaciones (grouped or detailed, let's fetch last 30)
            const { data: liqData } = await supabase
                .from('liquidacion_diaria')
                .select('*')
                .eq('comedor_id', String(comedorId))
                .order('fecha', { ascending: false })
                .limit(50);

            if (liqData) setLiquidaciones(liqData);

            // 2. Fetch Kardex
            const { data: karData } = await supabase
                .from('kardex_semanal')
                .select(`*, kardex_productos(nombre)`)
                .eq('comedor_id', String(comedorId))
                .order('semana_inicio', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(50);

            if (karData) setKardex(karData);

            // 3. Fetch Gastos
            const { data: gasData } = await supabase
                .from('gastos')
                .select('*')
                .eq('comedor_id', String(comedorId))
                .order('fecha', { ascending: false })
                .limit(50);

            if (gasData) setGastos(gasData);

            setDataLoaded(true);
        }
        fetchData();
    }, [comedorId, supabase]);

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500 flex justify-center items-center h-[50vh]">Cargando historial...</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Historial de Registros</h2>
            </div>

            <div className="flex space-x-2 border-b">
                <button
                    onClick={() => setActiveTab('diario')}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'diario' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                >
                    Liquidaciones Diarias
                </button>
                <button
                    onClick={() => setActiveTab('kardex')}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'kardex' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                >
                    Kardex
                </button>
                <button
                    onClick={() => setActiveTab('gastos')}
                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'gastos' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                >
                    Gastos
                </button>
            </div>

            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    {activeTab === 'diario' && (
                        <Table>
                            <TableHeader className="bg-zinc-50">
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Servicio</TableHead>
                                    <TableHead>Tipo de Pago</TableHead>
                                    <TableHead className="text-right">Cantidad</TableHead>
                                    <TableHead className="text-right">Prec. Unit (S/.)</TableHead>
                                    <TableHead className="text-right">Total (S/.)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {liquidaciones.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-zinc-500">Sin registros</TableCell></TableRow>
                                ) : liquidaciones.map((l) => (
                                    <TableRow key={l.id}>
                                        <TableCell className="font-medium">{format(new Date(l.fecha), 'dd MMM yyyy', { locale: es })}</TableCell>
                                        <TableCell>{l.servicio}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${l.tipo_pago === 'CREDITO_RANSA' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                                {l.tipo_pago}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">{l.cantidad}</TableCell>
                                        <TableCell className="text-right">{(l.precio_unit || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-semibold text-emerald-600">S/. {(l.monto || (l.cantidad * (l.precio_unit || 0))).toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}

                    {activeTab === 'kardex' && (
                        <Table>
                            <TableHeader className="bg-zinc-50">
                                <TableRow>
                                    <TableHead>Semana</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Ingreso</TableHead>
                                    <TableHead className="text-right">V. Crédito</TableHead>
                                    <TableHead className="text-right">V. Contado</TableHead>
                                    <TableHead className="text-right">Stock Físico</TableHead>
                                    <TableHead className="text-right">Diferencia</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {kardex.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-zinc-500">Sin registros</TableCell></TableRow>
                                ) : kardex.map((k) => (
                                    <TableRow key={k.id}>
                                        <TableCell className="font-medium">{format(new Date(k.semana_inicio), 'dd MMM yyyy', { locale: es })}</TableCell>
                                        <TableCell>{k.kardex_productos?.nombre || 'Producto'}</TableCell>
                                        <TableCell className="text-right">{k.ingreso_semanal}</TableCell>
                                        <TableCell className="text-right text-blue-600">{k.ventas_credito}</TableCell>
                                        <TableCell className="text-right text-emerald-600">{k.ventas_contado}</TableCell>
                                        <TableCell className="text-right font-bold">{k.stock_fisico}</TableCell>
                                        <TableCell className="text-right">
                                            <span className={`px-2 py-1 rounded font-semibold ${k.diferencia < 0 ? 'bg-red-100 text-red-700' : k.diferencia > 0 ? 'bg-amber-100 text-amber-700' : 'text-emerald-700'}`}>
                                                {k.diferencia}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}

                    {activeTab === 'gastos' && (
                        <Table>
                            <TableHeader className="bg-zinc-50">
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>N° Documento</TableHead>
                                    <TableHead>Proveedor</TableHead>
                                    <TableHead className="text-right">Monto (S/.)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {gastos.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-zinc-500">Sin registros</TableCell></TableRow>
                                ) : gastos.map((g) => (
                                    <TableRow key={g.id}>
                                        <TableCell className="font-medium">{format(new Date(g.fecha), 'dd MMM yyyy', { locale: es })}</TableCell>
                                        <TableCell>{g.num_documento}</TableCell>
                                        <TableCell>{g.proveedor}</TableCell>
                                        <TableCell className="text-right font-bold text-red-600">- S/. {(g.monto || 0).toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
