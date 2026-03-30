import { createClient } from '@/lib/supabase/client';

export interface CruceCategoria {
    categoria: string;
    total_diario_acumulado: number;
    total_semanal: number;
    diferencia: number;
    diferencia_pct: number;
    tiene_discrepancia: boolean;
    estado: 'OK' | 'ALERTA' | 'CRITICO' | 'SIN_DATOS';
}

export async function calcularCruceSemanal(comedor_id: string, semana_id: string): Promise<void> {
    const supabase = createClient();

    // 1. Get semana dates
    const { data: semana } = await supabase.from('semanas').select('fecha_inicio,fecha_fin').eq('id', semana_id).single();
    if (!semana) return;

    const fechaInicio = (semana as any).fecha_inicio;
    const fechaFin = (semana as any).fecha_fin;

    // 2. Get all daily reports for this semana
    const { data: reportesDiarios } = await supabase
        .from('reporte_diario')
        .select('id')
        .eq('comedor_id', comedor_id)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin);

    if (!reportesDiarios || reportesDiarios.length === 0) return;

    const reporteIds = reportesDiarios.map((r: any) => r.id);

    // 3. Get all daily totals for these reports grouped by categoria
    const { data: totalesDiarios } = await supabase
        .from('reporte_diario_totales')
        .select('categoria,total_cantidad,total_monto')
        .in('reporte_id', reporteIds);

    // Aggregate by category
    const acumuladosPorCategoria: Record<string, { cantidad: number; monto: number }> = {};
    (totalesDiarios || []).forEach((t: any) => {
        if (!acumuladosPorCategoria[t.categoria]) {
            acumuladosPorCategoria[t.categoria] = { cantidad: 0, monto: 0 };
        }
        acumuladosPorCategoria[t.categoria].cantidad += Number(t.total_cantidad || 0);
        acumuladosPorCategoria[t.categoria].monto += Number(t.total_monto || 0);
    });

    // 4. Get weekly semanal totals (from kardex, gastos, etc.)
    const { data: snacks } = await supabase
        .from('kardex_snack_ventas')
        .select('venta_credito,venta_contado_yape')
        .eq('comedor_id', comedor_id)
        .eq('semana_id', semana_id);

    const totalSemanal = (snacks || []).reduce((acc: number, s: any) => {
        return acc + Number(s.venta_credito || 0) + Number(s.venta_contado_yape || 0);
    }, 0);

    // 5. Insert/update cruce for each category
    const cruceInserts = Object.entries(acumuladosPorCategoria).map(([cat, vals]) => {
        const diario = vals.monto;
        const semanal = totalSemanal;
        const dif = diario - semanal;
        const pct = semanal > 0 ? Math.abs((dif / semanal) * 100) : 0;

        return {
            comedor_id,
            semana_id,
            categoria: cat,
            total_diario_acumulado: diario,
            total_semanal: semanal,
            diferencia_pct: pct,
            updated_at: new Date().toISOString(),
        };
    });

    if (cruceInserts.length > 0) {
        await supabase
            .from('reporte_cruce_semanal')
            .upsert(cruceInserts as any, { onConflict: 'comedor_id,semana_id,categoria' });
    }
}

export async function getCruceResumen(comedor_id: string, semana_id: string): Promise<CruceCategoria[]> {
    const supabase = createClient();

    const { data } = await supabase
        .from('reporte_cruce_semanal')
        .select('*')
        .eq('comedor_id', comedor_id)
        .eq('semana_id', semana_id);

    return (data || []).map((row: any) => {
        let estado: CruceCategoria['estado'] = 'OK';
        const pct = Math.abs(Number(row.diferencia_pct || 0));
        if (row.total_semanal === 0) estado = 'SIN_DATOS';
        else if (pct > 15) estado = 'CRITICO';
        else if (pct > 5) estado = 'ALERTA';

        return {
            categoria: row.categoria,
            total_diario_acumulado: Number(row.total_diario_acumulado),
            total_semanal: Number(row.total_semanal),
            diferencia: Number(row.diferencia),
            diferencia_pct: Number(row.diferencia_pct),
            tiene_discrepancia: row.tiene_discrepancia,
            estado,
        };
    });
}
