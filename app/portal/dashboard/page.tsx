'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle2, AlertCircle, FileText, Users, DollarSign, Activity } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

export default function PortalDashboard() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();

    const [hasLiquidationToday, setHasLiquidationToday] = useState(false);
    const [salesToday, setSalesToday] = useState(0);
    const [salesWeek, setSalesWeek] = useState(0);
    const [comensalesToday, setComensalesToday] = useState(0);
    const [activeAlerts, setActiveAlerts] = useState(0);
    const [incidents, setIncidents] = useState<any[]>([]);
    const [criticalStock, setCriticalStock] = useState<any[]>([]);

    // Fake chart data for the demo, should be fetched via Supabase view vw_ventas_semanales
    const chartData = [
        { name: 'Semana 1', credito: 4000, contado: 2400 },
        { name: 'Semana 2', credito: 3000, contado: 1398 },
        { name: 'Semana 3', credito: 2000, contado: 9800 },
        { name: 'Semana 4', credito: 2780, contado: 3908 },
    ];

    useEffect(() => {
        if (!comedorId) return;

        async function loadDashboardData() {
            const today = new Date().toISOString().split('T')[0];

            // 1. Check liquidation today
            const { data: liqData } = await supabase
                .from('liquidacion_diaria')
                .select('*')
                .eq('comedor_id', comedorId)
                .eq('fecha', today);

            if (liqData && liqData.length > 0) {
                setHasLiquidationToday(true);
                setSalesToday(liqData.reduce((acc, curr) => acc + (curr.monto || 0), 0));
            }

            // 2. Load Incidents
            const { data: incData } = await supabase
                .from('incidencias')
                .select('*')
                .eq('comedor_id', comedorId)
                .order('created_at', { ascending: false })
                .limit(5);

            if (incData) setIncidents(incData);

            // 3. Load Alerts
            const { count } = await supabase
                .from('logistica_alertas')
                .select('*', { count: 'exact', head: true })
                .eq('comedor_id', comedorId)
                .eq('atendido', false);

            if (count) setActiveAlerts(count);

            // 4. Critical Stock (dias_cobertura < 3) - Fetch from view or calculate
            const { data: stockData } = await supabase
                .from('vw_stock_actual')
                .select('*')
                .eq('comedor_id', comedorId)
                .lt('dias_cobertura', 3)
                .limit(5);

            if (stockData) setCriticalStock(stockData);
        }

        loadDashboardData();
    }, [comedorId, supabase]);

    if (loading) return <div>Cargando...</div>;

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStr = `Semana ${format(weekStart, 'dd')} - ${format(weekEnd, 'dd MMMM', { locale: es })}`;

    return (
        <div className="space-y-6">
            {/* Top Banner */}
            <div className={`p-4 rounded-lg flex items-center gap-4 text-white ${hasLiquidationToday ? 'bg-green-600' : 'bg-red-500'}`}>
                {hasLiquidationToday ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                <div>
                    <h3 className="font-bold text-lg">
                        {hasLiquidationToday ? 'Liquidación Diaria Completada' : 'Liquidación Diaria Pendiente'}
                    </h3>
                    <p className="opacity-90">
                        {hasLiquidationToday
                            ? 'Has registrado correctamente las ventas de hoy.'
                            : 'Recuerda registrar las ventas antes del cierre del día.'}
                    </p>
                </div>
                <div className="ml-auto bg-white/20 px-4 py-2 rounded-md font-semibold text-sm">
                    {weekStr}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas de Hoy</CardTitle>
                        <DollarSign className="h-4 w-4 text-zinc-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">S/. {salesToday.toLocaleString('es-PE')}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas de la Semana</CardTitle>
                        <Activity className="h-4 w-4 text-zinc-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">S/. {salesWeek.toLocaleString('es-PE')}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Comensales Hoy</CardTitle>
                        <Users className="h-4 w-4 text-zinc-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{comensalesToday}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Alertas Activas</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{activeAlerts}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <Card className="col-span-1 lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Ventas Últimas 4 Semanas</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis tickFormatter={(val) => `S/.${val}`} />
                                <RechartsTooltip formatter={(value) => [`S/. ${value}`, 'Monto']} />
                                <Line type="monotone" dataKey="credito" stroke="#1A56DB" strokeWidth={3} name="Crédito Ransa" />
                                <Line type="monotone" dataKey="contado" stroke="#10b981" strokeWidth={3} name="Contado/Yape" />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Incidents & Stock */}
                <div className="space-y-6 col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>Stock Crítico</CardTitle>
                            <CardDescription>Productos con menos de 3 días de cobertura</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {criticalStock.length === 0 ? (
                                <div className="text-center py-6 text-zinc-500 flex flex-col items-center">
                                    <CheckCircle2 size={32} className="text-green-500 mb-2" />
                                    No hay stock crítico
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {criticalStock.map((s, idx) => (
                                        <div key={idx} className="flex justify-between items-center border-b pb-2 last:border-0">
                                            <div className="font-medium text-sm">{s.producto_nombre}</div>
                                            <div className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                                                {Math.floor(s.dias_cobertura)} días rev.
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Últimas Incidencias</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {incidents.length === 0 ? (
                                <div className="text-center py-6 text-zinc-500 flex flex-col items-center">
                                    <FileText size={32} className="mb-2 opacity-50" />
                                    Sin incidencias recientes
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {incidents.map((inc) => (
                                        <div key={inc.id} className="flex flex-col border-b pb-2 last:border-0">
                                            <div className="flex justify-between items-center">
                                                <div className="font-semibold text-sm">{inc.tipo}</div>
                                                <div className={`text-xs px-2 py-0.5 rounded-full ${inc.estado === 'ABIERTA' ? 'bg-red-100 text-red-800' : 'bg-zinc-100 text-zinc-800'}`}>
                                                    {inc.estado}
                                                </div>
                                            </div>
                                            <p className="text-xs text-zinc-600 mt-1 line-clamp-2">{inc.descripcion}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
