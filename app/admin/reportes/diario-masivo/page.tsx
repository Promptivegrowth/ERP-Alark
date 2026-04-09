'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, FileSpreadsheet, Loader2, Calendar as CalendarIcon, Printer } from 'lucide-react';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';

interface Comedor {
    id: string;
    nombre: string;
}

interface CampoReporte {
    id: string;
    nombre_campo: string;
    categoria: string;
}

interface ValorReporte {
    id: string;
    campo_id: string;
    cantidad: number;
    monto: number;
    comedor_campos_reporte?: CampoReporte;
}

interface ReporteDiario {
    id: string;
    comedor_id: string;
    fecha: string;
    tiene_coffe_break: boolean;
    monto_coffe: number;
    subtotal?: number;
    reporte_diario_valores?: ValorReporte[];
}

interface ReporteMasivo {
    comedores: Comedor[];
    data: Record<string, {
        reporte?: ReporteDiario;
        valores: ValorReporte[];
    }>;
}

export default function DiarioMasivoPage() {
    const supabase = createClient();
    const [fecha, setFecha] = useState(format(prevDay(), 'yyyy-MM-dd'));
    const [loading, setLoading] = useState(false);
    const [reporteData, setReporteData] = useState<ReporteMasivo | null>(null);

    function prevDay() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
    }

    async function fetchReporteData() {
        setLoading(true);
        try {
            // 1. Fetch Comedores
            const { data: comedoresData, error: cErr } = await supabase
                .from('comedores')
                .select('id, nombre')
                .order('nombre');

            if (cErr) throw cErr;

            // 2. Fetch Reportes for Date
            const { data: reports, error: rErr } = await supabase
                .from('reporte_diario')
                .select('*, reporte_diario_valores(*, comedor_campos_reporte(*))')
                .eq('fecha', fecha);

            if (rErr) throw rErr;

            // Process data
            const mappedData: Record<string, { reporte: ReporteDiario; valores: ValorReporte[] }> = {};
            reports?.forEach((r: ReporteDiario) => {
                mappedData[r.comedor_id] = {
                    reporte: r,
                    valores: r.reporte_diario_valores || []
                };
            });

            setReporteData({
                comedores: comedoresData || [],
                data: mappedData
            });

            toast.success('Datos cargados correctamente');
        } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error('Error al cargar datos: ' + message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchReporteData();
    }, [fecha]);

    async function handleExportExcel() {
        if (!reporteData) return;

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Reporte Diario ' + fecha);

        // Styling constants
        const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } }; // Emerald-900
        const headerFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };
        const categoryFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }; // Light Emerald
        const totalFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } }; // Light Orange
        const border: Partial<ExcelJS.Borders> = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        // 1. Title
        sheet.mergeCells('A1:Z2');
        const titleCell = sheet.getCell('A1');
        titleCell.value = `REPORTE CONSOLIDADO DIARIO - ${format(parseISO(fecha), 'PPPP', { locale: es }).toUpperCase()}`;
        titleCell.font = { size: 16, bold: true, color: { argb: 'FF1B4332' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // 2. Build Columns
        let currentCol = 1;

        reporteData.comedores.forEach((comedor) => {
            // Merge title per comedor (Servicios, Cant, Precio, Total)
            const startCol = currentCol;
            const endCol = currentCol + 3;
            sheet.mergeCells(4, startCol, 4, endCol);
            const titleCell = sheet.getCell(4, startCol);
            titleCell.value = comedor.nombre;
            titleCell.font = headerFont;
            titleCell.fill = headerFill;
            titleCell.alignment = { horizontal: 'center' };
            titleCell.border = border;

            // SubHeaders: Servicio, Cant, Precio, Total
            const h1 = sheet.getCell(5, startCol);
            h1.value = 'SERVICIOS';
            h1.font = { bold: true };
            h1.fill = categoryFill;
            h1.border = border;

            const h2 = sheet.getCell(5, startCol + 1);
            h2.value = 'CANT.';
            h2.font = { bold: true };
            h2.fill = categoryFill;
            h2.alignment = { horizontal: 'right' };
            h2.border = border;

            const h3 = sheet.getCell(5, startCol + 2);
            h3.value = 'PRECIO';
            h3.font = { bold: true };
            h3.fill = categoryFill;
            h3.alignment = { horizontal: 'right' };
            h3.border = border;

            const h4 = sheet.getCell(5, startCol + 3);
            h4.value = 'TOTAL';
            h4.font = { bold: true };
            h4.fill = categoryFill;
            h4.alignment = { horizontal: 'right' };
            h4.border = border;

            // Data rows
            const comData = reporteData.data[comedor.id];
            let rowIdx = 6;

            if (comData) {
                const sortedValores = [...comData.valores].sort((a, b) => {
                    const catA = a.comedor_campos_reporte?.categoria || '';
                    const catB = b.comedor_campos_reporte?.categoria || '';
                    return catA.localeCompare(catB);
                });

                sortedValores.forEach(v => {
                    const c1 = sheet.getCell(rowIdx, startCol);
                    c1.value = v.comedor_campos_reporte?.nombre_campo || 'Sin Nombre';
                    c1.border = border;

                    const c2 = sheet.getCell(rowIdx, startCol + 1);
                    c2.value = v.cantidad || 0;
                    c2.border = border;
                    c2.alignment = { horizontal: 'right' };
                    c2.font = { bold: true };

                    const precio = v.monto / (v.cantidad || 1);
                    const c3 = sheet.getCell(rowIdx, startCol + 2);
                    c3.value = precio;
                    c3.numFmt = '"S/" #,##0.00';
                    c3.border = border;
                    c3.alignment = { horizontal: 'right' };

                    const c4 = sheet.getCell(rowIdx, startCol + 3);
                    c4.value = v.monto || 0;
                    c4.numFmt = '"S/" #,##0.00';
                    c4.border = border;
                    c4.alignment = { horizontal: 'right' };
                    c4.font = { bold: true };

                    rowIdx++;
                });

                // Add Coffe Break if exists
                if (comData.reporte?.tiene_coffe_break) {
                    const c1 = sheet.getCell(rowIdx, startCol);
                    c1.value = 'COFFE BREAKS / OTROS';
                    c1.font = { italic: true };
                    c1.border = border;

                    const c2 = sheet.getCell(rowIdx, startCol + 1);
                    c2.value = 'SI';
                    c2.border = border;
                    c2.alignment = { horizontal: 'right' };

                    const c4 = sheet.getCell(rowIdx, startCol + 3);
                    c4.value = comData.reporte.monto_coffe || 0;
                    c4.numFmt = '"S/" #,##0.00';
                    c4.border = border;
                    c4.alignment = { horizontal: 'right' };
                    c4.font = { bold: true };

                    rowIdx++;
                }

                // Add Subtotals
                rowIdx = Math.max(rowIdx, 25);
                const subTCell = sheet.getCell(rowIdx, startCol);
                subTCell.value = 'SUB TOTAL';
                subTCell.font = { bold: true };
                subTCell.fill = headerFill;
                subTCell.font = headerFont;
                subTCell.border = border;

                sheet.getCell(rowIdx, startCol + 1).fill = headerFill;
                sheet.getCell(rowIdx, startCol + 1).border = border;
                sheet.getCell(rowIdx, startCol + 2).fill = headerFill;
                sheet.getCell(rowIdx, startCol + 2).border = border;
                sheet.getCell(rowIdx, startCol + 3).fill = headerFill;
                sheet.getCell(rowIdx, startCol + 3).border = border;

                const totalsCant: Record<string, number> = {};
                const totalsMonto: Record<string, number> = {};
                sortedValores.forEach(v => {
                    const cat = v.comedor_campos_reporte?.categoria || 'OTROS';
                    totalsCant[cat] = (totalsCant[cat] || 0) + (v.cantidad || 0);
                    totalsMonto[cat] = (totalsMonto[cat] || 0) + (v.monto || 0);
                });

                Object.entries(totalsCant).forEach(([cat, sum]) => {
                    rowIdx++;
                    const r1 = sheet.getCell(rowIdx, startCol);
                    r1.value = `TOTAL ${cat}`;
                    r1.border = border;
                    r1.font = { bold: true };

                    const r2 = sheet.getCell(rowIdx, startCol + 1);
                    r2.value = sum;
                    r2.border = border;
                    r2.font = { bold: true };
                    r2.fill = totalFill;
                    r2.alignment = { horizontal: 'right' };

                    const r4 = sheet.getCell(rowIdx, startCol + 3);
                    r4.value = totalsMonto[cat] || 0;
                    r4.numFmt = '"S/" #,##0.00';
                    r4.border = border;
                    r4.font = { bold: true };
                    r4.fill = totalFill;
                    r4.alignment = { horizontal: 'right' };
                    r4.fill = totalFill;
                    r4.alignment = { horizontal: 'right' };
                });

                // Add Total General row
                rowIdx++;
                const tg1 = sheet.getCell(rowIdx, startCol);
                tg1.value = 'TOTAL GENERAL DEL DÍA';
                tg1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                tg1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
                tg1.border = border;

                const globalMonto = Object.values(totalsMonto).reduce((a, b) => a + (b || 0), 0) + (comData.reporte?.monto_coffe || 0);
                const globalCant = Object.values(totalsCant).reduce((a, b) => a + (b || 0), 0);

                const tg2 = sheet.getCell(rowIdx, startCol + 1);
                tg2.value = globalCant;
                tg2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                tg2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
                tg2.border = border;
                tg2.alignment = { horizontal: 'right' };

                sheet.getCell(rowIdx, startCol + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
                sheet.getCell(rowIdx, startCol + 2).border = border;

                const tg4 = sheet.getCell(rowIdx, startCol + 3);
                tg4.value = globalMonto;
                tg4.numFmt = '"S/" #,##0.00';
                tg4.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                tg4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4332' } };
                tg4.border = border;
                tg4.alignment = { horizontal: 'right' };
            } else {
                sheet.getCell(6, startCol).value = '(Sin Reporte)';
                sheet.getCell(6, startCol).font = { italic: true, color: { argb: 'FFAAAAAA' } };
                sheet.getCell(6, startCol).border = border;
                sheet.getCell(6, startCol + 1).border = border;
                sheet.getCell(6, startCol + 2).border = border;
                sheet.getCell(6, startCol + 3).border = border;
            }

            currentCol += 5;
        });

        // Column widths
        for (let i = 1; i <= currentCol; i++) {
            const column = sheet.getColumn(i);
            if (i % 5 === 1) column.width = 25;
            else if (i % 5 === 2) column.width = 8;
            else if (i % 5 === 3) column.width = 12;
            else if (i % 5 === 4) column.width = 15;
            else column.width = 2; // Spacer column
        }

        // Export
        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `Reporte_Masivo_${fecha}.xlsx`;
        const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.style.display = 'none';
        anchor.href = url;
        anchor.download = fileName;

        document.body.appendChild(anchor);
        anchor.click();

        setTimeout(() => {
            document.body.removeChild(anchor);
            window.URL.revokeObjectURL(url);
        }, 100);

        toast.success('Excel exportado correctamente');
    }

    return (
        <div className="space-y-6 container mx-auto py-8 px-4 max-w-7xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-emerald-900 tracking-tight flex items-center gap-3">
                        <FileSpreadsheet className="w-8 h-8" />
                        REPORTE DIARIO MASIVO
                    </h1>
                    <p className="text-zinc-500 font-medium">Consolidado general de los 17 comedores en formato Excel.</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border">
                    <div className="flex items-center gap-2 px-3 border-r">
                        <CalendarIcon className="w-4 h-4 text-emerald-600" />
                        <Input
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                            className="border-none shadow-none focus-visible:ring-0 p-0 text-sm font-bold w-32"
                        />
                    </div>
                    <Button
                        onClick={handleExportExcel}
                        disabled={loading || !reporteData}
                        className="bg-emerald-600 hover:bg-emerald-700 font-bold px-6 shadow-md"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        EXPORTAR EXCEL
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/50 backdrop-blur rounded-2xl border-2 border-dashed border-emerald-100">
                    <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
                    <p className="text-emerald-900 font-bold">Generando consolidado multicomedor...</p>
                    <p className="text-emerald-600/60 text-sm">Esto puede tardar unos segundos dado el volumen de datos.</p>
                </div>
            ) : reporteData ? (
                <div className="space-y-8">
                    {/* Consolidated Summary Bar */}
                    {/* Consolidated Summary Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {(() => {
                            // Detect all active categories in the result set
                            const activeCats = Array.from(new Set(
                                Object.values(reporteData.data)
                                    .flatMap((row: any) => row.valores.map((v: any) => v.comedor_campos_reporte?.categoria))
                            )).filter(Boolean) as string[];

                            // Sort categories for consistent display
                            const definedOrder = ['DESAYUNO', 'ALMUERZO', 'CENA', 'AMANECIDA', 'LONCHE', 'PAN', 'BEBIDA', 'EXTRA', 'OTRO'];
                            const displayCats = definedOrder.filter(c => activeCats.includes(c))
                                .concat(activeCats.filter(c => !definedOrder.includes(c)));

                            const totals: Record<string, number> = { TOTAL_CASH: 0, TOTAL_PAX: 0 };
                            displayCats.forEach(c => totals[c] = 0);

                            Object.values(reporteData.data).forEach((comRow: any) => {
                                comRow.valores.forEach((v: any) => {
                                    const c = v.comedor_campos_reporte?.categoria;
                                    const q = v.cantidad || 0;
                                    if (c && totals.hasOwnProperty(c)) totals[c] += q;
                                    totals.TOTAL_PAX += q;
                                });
                                totals.TOTAL_CASH += Number(comRow.reporte?.subtotal || 0);
                            });

                            return (
                                <>
                                    {/* Global Total Pax Card First */}
                                    <Card className="border-none shadow-md overflow-hidden bg-emerald-900 text-white">
                                        <CardContent className="p-4 pt-5">
                                            <p className="text-[10px] font-black uppercase text-emerald-200 tracking-widest">TOTAL PAX GLOBAL</p>
                                            <div className="flex items-end justify-between mt-1">
                                                <h3 className="text-3xl font-black">{totals.TOTAL_PAX}</h3>
                                                <span className="text-xs font-bold text-emerald-300 opacity-60">Servicios</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Each Category Total */}
                                    {displayCats.map(c => (
                                        <Card key={c} className="border-none shadow-sm overflow-hidden bg-white/80 backdrop-blur-sm group hover:shadow-md transition-all">
                                            <div className="h-1 w-full bg-emerald-500" />
                                            <CardContent className="p-3 pt-4">
                                                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-tight truncate">{c}S TOTALES</p>
                                                <div className="flex items-end justify-between mt-0.5">
                                                    <h3 className="text-xl font-black text-[#1B4332]">{totals[c]}</h3>
                                                    <span className="text-[10px] font-bold text-zinc-300 group-hover:text-emerald-500 transition-colors uppercase">Pax</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}

                                    {/* Global Cash Total Last */}
                                    <Card className="border-none shadow-md overflow-hidden bg-[#122c21] text-white">
                                        <CardContent className="p-4 pt-5">
                                            <p className="text-[10px] font-black uppercase text-emerald-200 tracking-widest">MONTO TOTAL DÍA</p>
                                            <div className="flex items-end justify-between mt-1">
                                                <h3 className="text-2xl font-black">S/ {totals.TOTAL_CASH.toFixed(2)}</h3>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            );
                        })()}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {reporteData.comedores.map(c => {
                            const comRow = reporteData.data[c.id];
                            const hasData = !!comRow;

                            const catTotals: Record<string, number> = {};
                            if (hasData) {
                                comRow.valores.forEach((v: any) => {
                                    const cat = v.comedor_campos_reporte?.categoria || 'OTROS';
                                    catTotals[cat] = (catTotals[cat] || 0) + (v.cantidad || 0);
                                });
                            }

                            return (
                                <Card key={c.id} className={`overflow-hidden transition-all hover:shadow-lg border-2 ${hasData ? 'border-emerald-100' : 'border-zinc-100 opacity-60'}`}>
                                    <CardHeader className={`py-3 ${hasData ? 'bg-emerald-50' : 'bg-zinc-50'}`}>
                                        <CardTitle className="text-sm font-black flex items-center justify-between">
                                            <span className="truncate pr-2">{c.nombre}</span>
                                            {hasData ? (
                                                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase shrink-0">Reportado</span>
                                            ) : (
                                                <span className="text-[10px] bg-zinc-300 text-zinc-600 px-2 py-0.5 rounded-full uppercase shrink-0">Pendiente</span>
                                            )}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        {hasData ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {Object.entries(catTotals).map(([cat, val]) => (
                                                        <div key={cat} className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50 flex flex-col justify-center">
                                                            <p className="text-[7px] font-black text-emerald-800 uppercase tracking-tighter truncate leading-tight">{cat}</p>
                                                            <p className="text-xs font-black text-[#1B4332]">{val}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="pt-2 border-t border-dashed flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Subtotal</span>
                                                    <span className="text-sm font-black text-emerald-900">S/ {Number(comRow.reporte?.subtotal || 0).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-6 text-zinc-300">
                                                <FileSpreadsheet className="w-8 h-8 mb-2 opacity-20" />
                                                <p className="text-[10px] font-bold uppercase tracking-widest">Sin datos</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
