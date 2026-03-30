'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, AlertCircle, HelpCircle, TrendingUp } from 'lucide-react';
import ReporteDiario from '@/components/portal/ReporteDiario';
import { getCruceResumen, type CruceCategoria } from '@/lib/calculations/cruce-semanal';

const ESTADO_CONFIG = {
    OK: { label: 'Correcto', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    ALERTA: { label: 'Alerta ±15%', icon: AlertCircle, cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    CRITICO: { label: 'Crítico >15%', icon: AlertTriangle, cls: 'bg-red-100 text-red-800 border-red-200' },
    SIN_DATOS: { label: 'Sin semanal', icon: HelpCircle, cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
};

export default function DiarioPage() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();
    const [semanaActual, setSemanaActual] = useState<any>(null);
    const [cruceData, setCruceData] = useState<CruceCategoria[]>([]);
    const [hayCritico, setHayCritico] = useState(false);

    useEffect(() => {
        if (!comedorId) return;
        async function loadSemana() {
            const hoy = format(new Date(), 'yyyy-MM-dd');
            const inicioSemana = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
            const finSemana = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

            // Get or create current semana
            const { data: sem } = await supabase
                .from('semanas')
                .select('*')
                .eq('comedor_id', comedorId as any)
                .gte('fecha_inicio', inicioSemana)
                .lte('fecha_fin', finSemana)
                .maybeSingle();

            if (sem) {
                setSemanaActual(sem);
                // Load cross-reference summary for the current week
                const cruce = await getCruceResumen(comedorId as string, (sem as any).id as string);
                setCruceData(cruce);
                setHayCritico(cruce.some(c => c.estado === 'CRITICO'));
            }
        }
        loadSemana();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comedorId]);

    if (loading) return <div className="p-8 text-center text-zinc-500">Cargando...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#1B4332]">Reporte Diario</h2>
                <p className="text-sm text-zinc-500 mt-1">
                    Semana: {semanaActual
                        ? `${format(new Date((semanaActual as any).fecha_inicio + 'T12:00:00'), 'dd MMM', { locale: es })} – ${format(new Date((semanaActual as any).fecha_fin + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}`
                        : 'Sin semana activa configurada'}
                </p>
            </div>

            {/* Critical discrepancy alert */}
            {hayCritico && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border-2 border-red-300 rounded-xl">
                    <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="font-bold text-red-800">Diferencias detectadas entre reporte diario y semanal</p>
                        <p className="text-sm text-red-700 mt-0.5">Revisa los datos ingresados o contacta al administrador para reconciliar los totales.</p>
                    </div>
                </div>
            )}

            {/* Dynamic daily report form */}
            <ReporteDiario />

            {/* Weekly cross-reference summary */}
            {cruceData.length > 0 && (
                <Card className="border-2 border-[#2D6A4F]/20">
                    <CardHeader className="bg-[#1B4332]/5 border-b border-[#2D6A4F]/20 pb-3">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={16} className="text-[#2D6A4F]" />
                            <CardTitle className="text-base text-[#1B4332]">Resumen Semanal Acumulado</CardTitle>
                        </div>
                        <CardDescription className="text-xs">Comparativo entre tus reportes diarios y el reporte semanal</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
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
                                    {cruceData.map(row => {
                                        const cfg = ESTADO_CONFIG[row.estado];
                                        const Icon = cfg.icon;
                                        return (
                                            <tr key={row.categoria} className="hover:bg-zinc-50/50">
                                                <td className="px-4 py-2.5 font-medium text-zinc-800">{row.categoria}</td>
                                                <td className="px-4 py-2.5 text-right font-medium">S/ {row.total_diario_acumulado.toFixed(2)}</td>
                                                <td className="px-4 py-2.5 text-right font-medium">S/ {row.total_semanal.toFixed(2)}</td>
                                                <td className={`px-4 py-2.5 text-right font-bold ${row.diferencia < 0 ? 'text-red-600' : row.diferencia > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                    {row.diferencia > 0 ? '+' : ''}{row.diferencia.toFixed(2)}
                                                    <span className="text-xs font-normal ml-1 text-zinc-400">({row.diferencia_pct.toFixed(1)}%)</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold border px-2.5 py-0.5 rounded-full ${cfg.cls}`}>
                                                        <Icon size={12} />
                                                        {cfg.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
