import ExcelJS from 'exceljs';
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

    // --- CREATE WORKBOOK ---
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Resumen');

    // Header Row
    const headerRowValues = [comedorNombre, ...dateRange.map(d => format(new Date(d + 'T12:00:00'), 'dd-MMM', { locale: es }))];
    const headerRow = worksheet.addRow(headerRowValues);

    // Style Header
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1B4332' } // Alark Green
        };
        cell.font = {
            color: { argb: 'FFFFFFFF' },
            bold: true,
            name: 'Arial',
            size: 11
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Fields rows
    fields.forEach(field => {
        const rowData = [field.nombre_campo];
        dateRange.forEach(date => {
            const report = reportes?.find(r => r.fecha === date);
            if (report) {
                const val = valores.find(v => v.reporte_id === report.id && v.campo_id === field.id);
                rowData.push(val ? val.cantidad : 0);
            } else {
                rowData.push('');
            }
        });
        const r = worksheet.addRow(rowData);
        r.getCell(1).font = { bold: true };
        r.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            if (colNumber > 1) cell.alignment = { horizontal: 'center' };
        });
    });

    // Spacer
    worksheet.addRow([]);

    // Coffe Break Row
    const coffeRowValues = ['COFFE BREAKS / OTROS'];
    dateRange.forEach(date => {
        const report = reportes?.find(r => r.fecha === date);
        coffeRowValues.push(report?.tiene_coffe_break ? 'SI' : 'NO');
    });
    const cfRow = worksheet.addRow(coffeRowValues);
    cfRow.eachCell((cell, colNumber) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E7FF' } // Indigo-50
        };
        cell.font = { bold: true, color: { argb: 'FF312E81' } };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        if (colNumber > 1) cell.alignment = { horizontal: 'center' };
    });

    // Spacer
    worksheet.addRow([]);

    // Category Totals
    const categories = Array.from(new Set(fields.map(f => f.categoria)));
    categories.forEach(cat => {
        const rowData = [`TOTAL ${cat}`];
        dateRange.forEach(date => {
            const report = reportes?.find(r => r.fecha === date);
            if (report) {
                const tot = totales.find(t => t.reporte_id === report.id && t.categoria === cat);
                rowData.push(tot ? tot.total_cantidad : 0);
            } else {
                rowData.push('');
            }
        });
        const totalRow = worksheet.addRow(rowData);
        totalRow.eachCell((cell, colNumber) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD1FAE5' } // Emerald-100
            };
            cell.font = { bold: true, color: { argb: 'FF065F46' } };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            if (colNumber > 1) cell.alignment = { horizontal: 'center' };
        });
    });

    // Final Styling (Columns)
    worksheet.getColumn(1).width = 32;
    for (let i = 2; i <= numDays + 1; i++) {
        worksheet.getColumn(i).width = 12;
    }

    // Export using Buffer and Blob (Client Side safe)
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const fileName = `Resumen_${comedorNombre}_${format(startDate, 'dd-MM-yyyy')}_${numDays}dias.xlsx`;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);

    return fileName;
}
