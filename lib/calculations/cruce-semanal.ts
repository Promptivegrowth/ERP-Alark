import { createClient } from '@/lib/supabase/client';
import { campoEntraAlCruce } from '@/lib/utils/comedor-total-rules';

export interface CruceCategoria {
    categoria: string;
    total_diario_acumulado: number;     // monto diario acumulado
    total_semanal: number;              // monto semanal
    total_diario_cantidad: number;      // cantidad diaria acumulada
    total_semanal_cantidad: number;     // cantidad semanal
    diferencia: number;
    diferencia_pct: number;
    tiene_discrepancia: boolean;
    estado: 'OK' | 'ALERTA' | 'CRITICO' | 'SIN_DATOS';
}

interface CampoDiario { id: string; nombre_campo: string; categoria: string; }
interface CampoSemanal { id: string; nombre_campo: string; categoria_cruce: string | null; es_facturable: boolean; }

// Calcula el cruce entre los reportes diarios acumulados y el reporte semanal
// para un comedor y semana dados. Persiste el resultado en reporte_cruce_semanal.
//
// Reglas:
// - Se agrupa por `categoria` (DESAYUNO, ALMUERZO, CENA, ...).
// - El lado DIARIO agrega todos los `reporte_diario_valores` usando el campo
//   `categoria` de `comedor_campos_reporte`, respetando las reglas especiales
//   por comedor (Machu Picchu solo CONSUMIDO, Medlog solo TICKETS).
// - El lado SEMANAL agrega todos los `reporte_semanal_valores` usando el campo
//   `categoria_cruce` de `reporte_semanal_campos`, igualmente respetando las
//   reglas especiales por comedor.
// - Se comparan tanto cantidades como montos.
export async function calcularCruceSemanal(comedor_id: string, semana_id: string): Promise<void> {
    const supabase = createClient();

    const { data: semana } = await (supabase as any).from('semanas').select('fecha_inicio,fecha_fin').eq('id', semana_id).single();
    if (!semana) return;
    const fechaInicio = semana.fecha_inicio;
    const fechaFin = semana.fecha_fin;

    // ---- DIARIO ----
    const { data: reportesDiarios } = await (supabase as any)
        .from('reporte_diario')
        .select('id')
        .eq('comedor_id', comedor_id)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin);
    const reporteIds: string[] = (reportesDiarios || []).map((r: any) => r.id);

    const { data: camposDiarios } = await (supabase as any)
        .from('comedor_campos_reporte')
        .select('id, nombre_campo, categoria')
        .eq('comedor_id', comedor_id);
    const mapaCampoDiario = new Map<string, CampoDiario>((camposDiarios || []).map((c: any) => [c.id, c]));

    const diarioPorCat: Record<string, { cantidad: number; monto: number }> = {};
    if (reporteIds.length > 0) {
        const { data: valores } = await (supabase as any)
            .from('reporte_diario_valores')
            .select('campo_id, cantidad, monto')
            .in('reporte_id', reporteIds);
        (valores || []).forEach((v: any) => {
            const campo = mapaCampoDiario.get(v.campo_id);
            if (!campo) return;
            if (!campoEntraAlCruce(comedor_id, campo.categoria, campo.nombre_campo)) return;
            const key = campo.categoria;
            if (!diarioPorCat[key]) diarioPorCat[key] = { cantidad: 0, monto: 0 };
            diarioPorCat[key].cantidad += Number(v.cantidad || 0);
            diarioPorCat[key].monto += Number(v.monto || 0);
        });
    }

    // ---- SEMANAL ----
    const { data: repSemanal } = await (supabase as any)
        .from('reporte_semanal')
        .select('id')
        .eq('comedor_id', comedor_id)
        .eq('semana_inicio', fechaInicio)
        .maybeSingle();

    const semanalPorCat: Record<string, { cantidad: number; monto: number }> = {};
    if (repSemanal?.id) {
        const { data: camposSemanal } = await (supabase as any)
            .from('reporte_semanal_campos')
            .select('id, nombre_campo, categoria_cruce, es_facturable')
            .eq('comedor_id', comedor_id)
            .eq('activo', true);
        const mapaCampoSemanal = new Map<string, CampoSemanal>((camposSemanal || []).map((c: any) => [c.id, c]));

        const { data: valoresSem } = await (supabase as any)
            .from('reporte_semanal_valores')
            .select('campo_id, cantidad, precio_unitario')
            .eq('reporte_semanal_id', repSemanal.id);

        (valoresSem || []).forEach((v: any) => {
            const campo = mapaCampoSemanal.get(v.campo_id);
            if (!campo) return;
            const cat = campo.categoria_cruce || '';
            if (!cat) return;
            if (!campo.es_facturable) return;
            if (!campoEntraAlCruce(comedor_id, cat, campo.nombre_campo)) return;
            if (!semanalPorCat[cat]) semanalPorCat[cat] = { cantidad: 0, monto: 0 };
            const qty = Number(v.cantidad || 0);
            const precio = Number(v.precio_unitario || 0);
            semanalPorCat[cat].cantidad += qty;
            semanalPorCat[cat].monto += qty * precio;
        });
    }

    // ---- UPSERT ----
    const categorias = new Set([...Object.keys(diarioPorCat), ...Object.keys(semanalPorCat)]);
    const cruceInserts = Array.from(categorias).map(cat => {
        const diario = diarioPorCat[cat] || { cantidad: 0, monto: 0 };
        const semanal = semanalPorCat[cat] || { cantidad: 0, monto: 0 };
        const pctMonto = semanal.monto > 0 ? Math.abs(((diario.monto - semanal.monto) / semanal.monto) * 100) : 0;
        return {
            comedor_id,
            semana_id,
            categoria: cat,
            total_diario_acumulado: diario.monto,
            total_semanal: semanal.monto,
            total_diario_cantidad: diario.cantidad,
            total_semanal_cantidad: semanal.cantidad,
            diferencia_pct: pctMonto,
            updated_at: new Date().toISOString(),
        };
    });

    if (cruceInserts.length > 0) {
        await (supabase as any)
            .from('reporte_cruce_semanal')
            .upsert(cruceInserts, { onConflict: 'comedor_id,semana_id,categoria' });
    }
}

export async function getCruceResumen(comedor_id: string, semana_id: string): Promise<CruceCategoria[]> {
    const supabase = createClient();

    const { data } = await (supabase as any)
        .from('reporte_cruce_semanal')
        .select('*')
        .eq('comedor_id', comedor_id)
        .eq('semana_id', semana_id);

    return ((data || []) as any[]).map((row) => {
        const pct = Math.abs(Number(row.diferencia_pct || 0));
        let estado: CruceCategoria['estado'] = 'OK';
        if (Number(row.total_semanal || 0) === 0 && Number(row.total_diario_acumulado || 0) === 0) estado = 'SIN_DATOS';
        else if (pct > 15) estado = 'CRITICO';
        else if (pct > 5) estado = 'ALERTA';
        return {
            categoria: row.categoria,
            total_diario_acumulado: Number(row.total_diario_acumulado || 0),
            total_semanal: Number(row.total_semanal || 0),
            total_diario_cantidad: Number(row.total_diario_cantidad || 0),
            total_semanal_cantidad: Number(row.total_semanal_cantidad || 0),
            diferencia: Number(row.total_diario_acumulado || 0) - Number(row.total_semanal || 0),
            diferencia_pct: Number(row.diferencia_pct || 0),
            tiene_discrepancia: !!row.tiene_discrepancia,
            estado,
        };
    });
}
