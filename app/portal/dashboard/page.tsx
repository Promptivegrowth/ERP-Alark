'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle2, AlertCircle, FileText, Users, DollarSign, Activity } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

export default function PortalDashboard() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();

    const [hasLiquidationToday, setHasLiquidationToday] = useState(false);
    const [salesToday, setSalesToday] = useState(0);
    const [salesWeek, setSalesWeek] = useState(0);
    const [activeAlerts, setActiveAlerts] = useState(0);
    const [incidents, setIncidents] = useState<any[]>([]);
    const [criticalStock, setCriticalStock] = useState<any[]>([]);

    // Chart data - ideally should be fetched from a view
    const [chartData, setChartData] = useState([
        { name: 'Semana 1', credito: 0, contado: 0 },
        { name: 'Semana 2', credito: 0, contado: 0 },
        { name: 'Semana 3', credito: 0, contado: 0 },
        { name: 'Semana 4', credito: 0, contado: 0 },
    ]);

    useEffect(() => {
        if (!comedorId) return;

        async function loadDashboardData() {
            const today = new Date().toISOString().split('T')[0];

            // 1. Check liquidation today
            const { data: liqData } = await supabase
                .from('liquidacion_diaria')
                .select('*')
                .eq('comedor_id', comedorId as any)
                .eq('fecha', today);

            if (liqData && liqData.length > 0) {
                setHasLiquidationToday(true);
                const total = (liqData as any[]).reduce((acc, curr) => acc + (Number(curr.cantidad) * Number(curr.precio_unit)), 0);
                setSalesToday(total);
            }

            // 2. Load Incidents (last 3)
            const { data: incData } = await supabase
                .from('incidencias')
                .select('*')
                .eq('comedor_id', comedorId as any)
                .order('created_at', { ascending: false })
                .limit(3);
            if (incData) setIncidents(incData);

            // 3. Load Active Alerts
            const { count } = await supabase
                .from('logistica_alertas')
                .select('*', { count: 'exact', head: true })
                .eq('comedor_id', comedorId as any)
                .eq('atendido', false);
            if (count) setActiveAlerts(count);

            // 4. Critical Stock (dias_cobertura < 3)
            // Note: If vw_stock_actual doesn't exist, this will fail gracefully but we should check schema
            try {
                const { data: stockData } = await supabase
                    .from('vw_stock_actual' as any)
                    .select('*')
                    .eq('comedor_id', comedorId as any)
                    .lt('dias_cobertura', 3)
                    .limit(5);
                if (stockData) setCriticalStock(stockData);
            } catch (e) {
                console.warn("View vw_stock_actual not found or accessible");
            }
        }

        loadDashboardData();
    }, [comedorId, supabase]);

    if (loading) return <div className="p-8 text-center text-zinc-500">Cargando Dashboard...</div>;

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const weekStr = `Semana ${format(weekStart, 'dd')} - ${format(weekEnd, 'dd MMMM', { locale: es })}`;

    return (
        <div className="space-y-6">
            {/* Top Banner */}
            <div className={`p-4 rounded-lg flex items-center gap-4 text-white shadow-sm transition-colors ${hasLiquidationToday ? 'bg-emerald-600' : 'bg-red-500'}`}>
                {hasLiquidationToday ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                <div>
                    <h3 className="font-bold text-lg">
                        {hasLiquidationToday ? 'Liquidación Diaria Completada' : 'Liquidación Diaria Pendiente'}
                    </h3>
                    <p className="opacity-90 text-sm">
                        {hasLiquidationToday
                            ? 'Has registrado correctamente las ventas de hoy. Todo al día.'
                            : 'Falta registrar la liquidación de hoy. Hazlo antes de cerrar.'}
                    </p>
                </div>
                <div className="ml-auto bg-white/20 px-4 py-2 rounded-md font-semibold text-xs whitespace-nowrap">
                    {weekStr}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas de Hoy</CardTitle>
                        <DollarSign className="h-4 w-4 text-zinc-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">S/ {salesToday.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</div>
                        <p className="text-xs text-zinc-500 mt-1">Estimado según liquidación</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Alertas Logísticas</CardTitle>
                        <Activity className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{activeAlerts}</div>
                        <p className="text-xs text-zinc-500 mt-1">Pendientes de atención</p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-zinc-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Stock Crítico</CardTitle>
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{criticalStock.length}</div>
                        <p className="text-xs text-zinc-500 mt-1">Menos de 3 días de cobertura</p>
                    </CardContent>
                </Card>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Area */}
                <Card className="col-span-1 lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Ventas Últimas Semanas (Demo)</CardTitle>
                        <CardDescription>Visualización de ingresos por tipo de pago</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `S/${val}`} />
                                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Line type="monotone" dataKey="credito" stroke="#1A56DB" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Crédito" />
                                <Line type="monotone" dataKey="contado" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Contado" />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Right Column */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Últimas Incidencias</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {incidents.length === 0 ? (
                                    <div className="text-center py-6 text-zinc-400 text-sm">Sin reportes recientes</div>
                                ) : incidents.map((inc) => (
                                    <div key={inc.id} className="flex gap-3 items-start border-b pb-3 last:border-0 last:pb-0">
                                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${inc.estado === 'ABIERTA' ? 'bg-red-500' : 'bg-zinc-300'}`} />
                                        <div className="min-w-0">
                                            <div className="font-semibold text-sm truncate">{inc.tipo}</div>
                                            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{inc.descripcion}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base text-red-600">Alerta de Insumos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {criticalStock.length === 0 ? (
                                    <div className="text-center py-4 text-zinc-400 text-sm italic">Buen nivel de inventario</div>
                                ) : criticalStock.map((s, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <span className="font-medium truncate mr-2">{s.producto_nombre}</span>
                                        <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                            {s.stock_actual} und.
                                        </span>
                                    </div>
                                ))}
                                <Button variant="link" className="w-full text-xs text-zinc-500 h-auto p-0 mt-2">
                                    Ver inventario completo
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
