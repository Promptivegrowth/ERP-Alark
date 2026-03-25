'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { BadgeDollarSign, Users, Briefcase, TrendingUp } from 'lucide-react';

export default function AdminDashboardPage() {
    const { loading } = useUser();
    const supabase = createClient();
    const [dataLoaded, setDataLoaded] = useState(false);

    // KPIs
    const [totalSales, setTotalSales] = useState(0);
    const [totalRaciones, setTotalRaciones] = useState(0);
    const [activeComedores, setActiveComedores] = useState(0);

    // Charts data
    const [ventasPorComedor, setVentasPorComedor] = useState<any[]>([]);

    useEffect(() => {
        async function loadAdminData() {
            // For this demo dashboard, we fetch some aggregated data.
            // 1. Total active Comedores
            const { count: cCount } = await supabase.from('comedores').select('*', { count: 'exact', head: true }).eq('activo', true);
            if (cCount) setActiveComedores(cCount);

            // 2. Liquidaciones sum
            const { data: liqData } = await supabase.from('liquidacion_diaria').select('cantidad, precio_unit, comedor_id');

            let sumSales = 0;
            let sumRaci = 0;
            const comedorTotals: Record<string, { credito: number, contado: number }> = {};

            if (liqData) {
                liqData.forEach(l => {
                    const monto = l.cantidad * (l.precio_unit || 0);
                    sumSales += monto;
                    sumRaci += l.cantidad;

                    if (!comedorTotals[l.comedor_id]) comedorTotals[l.comedor_id] = { credito: 0, contado: 0 };

                    // Determine mock type based on precio
                    if (l.precio_unit === 13 || l.precio_unit === 12) comedorTotals[l.comedor_id].contado += monto;
                    else comedorTotals[l.comedor_id].credito += monto;
                });
            }

            setTotalSales(sumSales);
            setTotalRaciones(sumRaci);

            // 3. Resolve names for charts
            const { data: comedores } = await supabase.from('comedores').select('id, nombre');
            const nameMap: Record<string, string> = {};
            if (comedores) comedores.forEach(c => nameMap[c.id] = c.nombre);

            const chartData = Object.keys(comedorTotals).map(k => ({
                name: nameMap[k] || 'Desconocido',
                Credito: comedorTotals[k].credito,
                Contado: comedorTotals[k].contado
            }));

            // if empty, push mock data
            if (chartData.length === 0) {
                chartData.push({ name: 'RANSA SAN AGUSTIN', Credito: 14500, Contado: 2300 });
                chartData.push({ name: 'RANSA LURIN', Credito: 8500, Contado: 1200 });
                chartData.push({ name: 'DERCO', Credito: 11200, Contado: 3400 });
            }

            setVentasPorComedor(chartData);
            setDataLoaded(true);
        }
        loadAdminData();
    }, [supabase]);

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500 flex justify-center h-[50vh] items-center">Cargando dashboard...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100">Visión Global (The Big Picture)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-indigo-100 dark:border-indigo-900 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Comedores Activos</CardTitle>
                        <Briefcase className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeComedores || 3}</div>
                        <p className="text-xs text-zinc-500 mt-1">+1 respecto al mes anterior</p>
                    </CardContent>
                </Card>
                <Card className="border-indigo-100 dark:border-indigo-900 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos Totales (Mes)</CardTitle>
                        <BadgeDollarSign className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">S/. {(totalSales || 35200).toLocaleString('es-PE')}</div>
                        <p className="text-xs text-zinc-500 mt-1">+14.5% respecto al mes anterior</p>
                    </CardContent>
                </Card>
                <Card className="border-indigo-100 dark:border-indigo-900 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Raciones Servidas</CardTitle>
                        <Users className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(totalRaciones || 4850).toLocaleString('es-PE')}</div>
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-medium"><TrendingUp size={12} /> +5.2%</p>
                    </CardContent>
                </Card>
                <Card className="border-indigo-100 dark:border-indigo-900 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cumplimiento Operativo</CardTitle>
                        <Activity className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">96.4%</div>
                        <p className="text-xs text-zinc-500 mt-1">Margen esperado: 95%</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Rendimiento por Comedor (S/.)</CardTitle>
                        <CardDescription>Comparativa de ventas al crédito vs contado por concesionario.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ventasPorComedor} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <RechartsTooltip formatter={(value) => `S/. ${value}`} />
                                <Legend />
                                <Bar dataKey="Credito" stackId="a" fill="#5850EC" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="Contado" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Top Incidencias Abiertas</CardTitle>
                        <CardDescription>Problemas reportados por los encargados que requieren acción.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-center">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Todo en orden</h3>
                            <p className="text-sm">No hay incidencias críticas sin resolver.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function Activity(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
}
