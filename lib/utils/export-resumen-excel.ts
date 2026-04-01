import * as XLSX from 'xlsx';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { SupabaseClient } from '@supabase/supabase-js';

export async function exportResumenExcel(
    supabase: SupabaseClient,
    comedorId: string,
    comedorNombre: string,
    startDate: Date,
    numDays: number
) {
    const endDate = addDays(startDate, numDays - 1);
    const dateRange: string[] = [];
    for (let i = 0; i < numDays; i++) {
        dateRange.push(format(addDays(startDate, i), 'yyyy-MM-dd'));
    }

    // 1. Fetch Config/Fields
    const { data: fields } = await supabase
        .from('comedor_campos_reporte')
        .select('*')
        .eq('comedor_id', comedorId)
        .order('orden', { ascending: true });

    if (!fields || fields.length === 0) throw new Error('No se encontraron campos configurados para este comedor');

    // 2. Fetch Reports in range
    const { data: reportes } = await supabase
        .from('reporte_diario')
        .select('*')
        .eq('comedor_id', comedorId)
        .gte('fecha', dateRange[0])
        .lte('fecha', dateRange[dateRange.length - 1]);

    const reporteIds = reportes?.map(r => r.id) || [];

    // 3. Fetch Values & Totals
    const [valRes, totRes] = await Promise.all([
        reporteIds.length > 0
            ? supabase.from('reporte_diario_valores').select('*').in('reporte_id', reporteIds)
            : Promise.resolve({ data: [] }),
        reporteIds.length > 0
            ? supabase.from('reporte_diario_totales').select('*').in('reporte_id', reporteIds)
            : Promise.resolve({ data: [] })
    ]);

    const valores = valRes.data || [];
    const totales = totRes.data || [];

    // --- PIVOT DATA ---
    const headers = [comedorNombre, ...dateRange.map(d => format(new Date(d + 'T12:00:00'), 'dd-MMM', { locale: es }))];
    const rows: any[] = [];

    // Fields rows (Calculated from definitions)
    fields.forEach(field => {
        const rowData: any = { [comedorNombre]: field.nombre_campo };
        dateRange.forEach(date => {
            const report = reportes?.find(r => r.fecha === date);
            if (report) {
                const val = valores.find(v => v.reporte_id === report.id && v.campo_id === field.id);
                rowData[format(new Date(date + 'T12:00:00'), 'dd-MMM', { locale: es })] = val ? val.cantidad : 0;
            } else {
                rowData[format(new Date(date + 'T12:00:00'), 'dd-MMM', { locale: es })] = '';
            }
        });
        rows.push(rowData);
    });

    // Spacer
    rows.push({});

    // Coffe Break Row
    const coffeRow: any = { [comedorNombre]: 'COFFE BREAKS / OTROS' };
    dateRange.forEach(date => {
        const report = reportes?.find(r => r.fecha === date);
        coffeRow[format(new Date(date + 'T12:00:00'), 'dd-MMM', { locale: es })] = report?.tiene_coffe_break ? 'SI' : 'NO';
    });
    rows.push(coffeRow);

    // Spacer
    rows.push({});

    // Category Totals (Pivot)
    const categories = Array.from(new Set(fields.map(f => f.categoria)));
    categories.forEach(cat => {
        const rowData: any = { [comedorNombre]: `TOTAL ${cat}` };
        dateRange.forEach(date => {
            const report = reportes?.find(r => r.fecha === date);
            if (report) {
                const tot = totales.find(t => t.reporte_id === report.id && t.categoria === cat);
                rowData[format(new Date(date + 'T12:00:00'), 'dd-MMM', { locale: es })] = tot ? tot.total_cantidad : 0;
            } else {
                rowData[format(new Date(date + 'T12:00:00'), 'dd-MMM', { locale: es })] = '';
            }
        });
        rows.push(rowData);
    });

    // --- CREATE XLSX ---
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });

    // Set widths
    const wscols = [{ wch: 30 }, ...dateRange.map(() => ({ wch: 12 }))];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen');

    // Export
    const fileName = `Resumen_${comedorNombre}_${format(startDate, 'dd-MM-yyyy')}_${numDays}dias.xlsx`;
    XLSX.writeFile(workbook, fileName);

    return fileName;
}
