'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format, addDays, startOfWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Download, Calendar as CalendarIcon, Loader2, Building2 } from 'lucide-react';
import { campoSumaEnTotal } from '@/lib/utils/comedor-total-rules';

type Periodo = 'semanal' | 'quincenal';

interface Comedor { id: string; nombre: string; codigo: string; activo: boolean; }
interface CampoRow { id: string; nombre_campo: string; categoria: string; orden: number; }
interface ValorRow { campo_id: string; cantidad: number; monto: number; reporte_id: string; }
interface ReporteRow { id: string; fecha: string; comedor_id: string; tiene_coffe_break: boolean; monto_coffe: number; descripcion_coffe: string | null; }

// Colores del estilo manual del cliente
const COLOR_HEADER_BG = 'FF1B4332';       // Verde oscuro almark
const COLOR_HEADER_FG = 'FFFFFFFF';       // Blanco
const COLOR_COFFE_BG  = 'FFD8D2E8';       // Lila claro
const COLOR_TOTAL_BG  = 'FFD4F1DF';       // Verde claro
const COLOR_TOTAL_BORDER = 'FF2D6A4F';

// Orden en el que se listan las categorías de total (solo aparece si el comedor tiene campos de esa categoría)
const CATEGORIA_ORDER = ['DESAYUNO', 'CENA', 'ALMUERZO', 'AMANECIDA', 'LONCHE', 'PAN', 'BEBIDA', 'EXTRA', 'OTRO'];

export default function ConsolidadoReportePage() {
    const supabase = useMemo(() => createClient(), []);
    const [periodo, setPeriodo] = useState<Periodo>('semanal');
    const [fechaInicio, setFechaInicio] = useState<string>(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    const [comedores, setComedores] = useState<Comedor[]>([]);
    const [generando, setGenerando] = useState(false);
    const [preview, setPreview] = useState<any[]>([]);

    const diasTotal = periodo === 'semanal' ? 7 : 14;
    const fechaFin = format(addDays(parseISO(fechaInicio), diasTotal - 1), 'yyyy-MM-dd');

    useEffect(() => {
        (supabase as any).from('comedores').select('id,nombre,codigo,activo').order('nombre').then(({ data }: any) => {
            if (data) setComedores(data.filter((c: any) => c.activo !== false));
        });
    }, [supabase]);

    async function cargarDatos() {
        const dias: string[] = Array.from({ length: diasTotal }, (_, i) => format(addDays(parseISO(fechaInicio), i), 'yyyy-MM-dd'));

        const { data: camposAll } = await (supabase as any)
            .from('comedor_campos_reporte')
            .select('id, nombre_campo, categoria, orden, comedor_id, activo')
            .eq('activo', true)
            .order('orden');

        const { data: reportes } = await (supabase as any)
            .from('reporte_diario')
            .select('id, fecha, comedor_id, tiene_coffe_break, monto_coffe, descripcion_coffe')
            .gte('fecha', dias[0])
            .lte('fecha', dias[dias.length - 1]);

        const reporteIds = ((reportes as ReporteRow[]) || []).map(r => r.id);
        let valores: ValorRow[] = [];
        if (reporteIds.length > 0) {
            const { data: v } = await (supabase as any)
                .from('reporte_diario_valores')
                .select('campo_id, cantidad, monto, reporte_id')
                .in('reporte_id', reporteIds);
            valores = (v as ValorRow[]) || [];
        }

        // Indexar
        const reportesPorId = new Map<string, ReporteRow>((reportes || []).map((r: ReporteRow) => [r.id, r]));
        const camposPorComedor = new Map<string, CampoRow[]>();
        ((camposAll as any[]) || []).forEach((c: any) => {
            if (!camposPorComedor.has(c.comedor_id)) camposPorComedor.set(c.comedor_id, []);
            camposPorComedor.get(c.comedor_id)!.push(c);
        });

        // qty[comedor_id][campo_id][dia] = qty
        const qty: Record<string, Record<string, Record<string, number>>> = {};
        const monto: Record<string, Record<string, Record<string, number>>> = {};
        const coffe: Record<string, Record<string, { tiene: boolean; monto: number; descripcion: string | null }>> = {};

        valores.forEach(v => {
            const rep = reportesPorId.get(v.reporte_id);
            if (!rep) return;
            if (!qty[rep.comedor_id]) { qty[rep.comedor_id] = {}; monto[rep.comedor_id] = {}; }
            if (!qty[rep.comedor_id][v.campo_id]) { qty[rep.comedor_id][v.campo_id] = {}; monto[rep.comedor_id][v.campo_id] = {}; }
            qty[rep.comedor_id][v.campo_id][rep.fecha] = Number(v.cantidad || 0);
            monto[rep.comedor_id][v.campo_id][rep.fecha] = Number(v.monto || 0);
        });

        ((reportes as ReporteRow[]) || []).forEach(r => {
            if (!coffe[r.comedor_id]) coffe[r.comedor_id] = {};
            coffe[r.comedor_id][r.fecha] = {
                tiene: !!r.tiene_coffe_break,
                monto: Number(r.monto_coffe || 0),
                descripcion: r.descripcion_coffe
            };
        });

        // Construir preview por comedor
        const result = comedores.map(c => {
            const campos = (camposPorComedor.get(c.id) || []).sort((a, b) => a.orden - b.orden);
            const hasData = campos.some(campo => {
                for (const d of dias) {
                    if ((qty[c.id]?.[campo.id]?.[d] || 0) > 0) return true;
                }
                return false;
            }) || dias.some(d => coffe[c.id]?.[d]?.tiene);
            return { comedor: c, dias, campos, qty: qty[c.id] || {}, monto: monto[c.id] || {}, coffe: coffe[c.id] || {}, hasData };
        });

        return result;
    }

    async function handlePreview() {
        setGenerando(true);
        try {
            const data = await cargarDatos();
            setPreview(data);
            toast.success('Datos cargados. Haz clic en "Descargar Excel" para generar el archivo.');
        } catch (err: any) {
            toast.error('Error cargando datos: ' + (err?.message || 'desconocido'));
        } finally {
            setGenerando(false);
        }
    }

    async function handleDescargar() {
        setGenerando(true);
        try {
            const data = preview.length > 0 ? preview : await cargarDatos();

            const wb = new ExcelJS.Workbook();
            wb.creator = 'ERP Almark Peru';
            wb.created = new Date();

            // ---- Portada resumen ----
            const coverSheet = wb.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 3 }] });
            coverSheet.getCell('A1').value = `REPORTE ${periodo.toUpperCase()} CONSOLIDADO - ALMARK PERU`;
            coverSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: COLOR_HEADER_BG } };
            coverSheet.mergeCells('A1:E1');
            coverSheet.getCell('A2').value = `Del ${format(parseISO(fechaInicio), "dd 'de' MMMM yyyy", { locale: es })} al ${format(parseISO(fechaFin), "dd 'de' MMMM yyyy", { locale: es })}`;
            coverSheet.getCell('A2').font = { italic: true, size: 11, color: { argb: 'FF666666' } };
            coverSheet.mergeCells('A2:E2');

            const headerRow = coverSheet.addRow(['#', 'Comedor', 'Días con reporte', 'Total servicios', 'Total S/']);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 20;

            let idx = 1;
            let totalGeneralPax = 0;
            let totalGeneralMonto = 0;
            data.forEach(row => {
                const diasReportados = row.dias.filter((d: string) => {
                    const hasQty = row.campos.some((c: any) => (row.qty[c.id]?.[d] || 0) > 0);
                    const hasCoffe = row.coffe[d]?.tiene;
                    return hasQty || hasCoffe;
                }).length;
                let totPax = 0;
                let totMonto = 0;
                row.campos.forEach((c: any) => {
                    row.dias.forEach((d: string) => {
                        const q = row.qty[c.id]?.[d] || 0;
                        const m = row.monto[c.id]?.[d] || 0;
                        if (campoSumaEnTotal(row.comedor.id, c.categoria, c.nombre_campo)) {
                            totPax += q;
                            totMonto += m;
                        }
                    });
                });
                row.dias.forEach((d: string) => {
                    totMonto += row.coffe[d]?.monto || 0;
                });
                totalGeneralPax += totPax;
                totalGeneralMonto += totMonto;
                const r = coverSheet.addRow([idx++, row.comedor.nombre, diasReportados, totPax, totMonto]);
                r.getCell(5).numFmt = '"S/" #,##0.00';
                r.getCell(4).alignment = { horizontal: 'center' };
                r.getCell(3).alignment = { horizontal: 'center' };
                if (!row.hasData) {
                    r.eachCell(c => { c.font = { color: { argb: 'FFAAAAAA' }, italic: true }; });
                }
            });
            const totalRow = coverSheet.addRow(['', 'TOTAL', '', totalGeneralPax, totalGeneralMonto]);
            totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
            totalRow.getCell(5).numFmt = '"S/" #,##0.00';
            totalRow.getCell(4).alignment = { horizontal: 'center' };
            coverSheet.columns = [
                { width: 5 },
                { width: 24 },
                { width: 18 },
                { width: 18 },
                { width: 18 },
            ];

            // ---- Una hoja por comedor ----
            data.forEach(row => {
                if (!row.hasData) return; // Saltar comedores sin datos
                const sheet = wb.addWorksheet(row.comedor.nombre.substring(0, 31));
                escribirHojaComedor(sheet, row);
            });

            // Descargar
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Consolidado_${periodo}_${fechaInicio}_a_${fechaFin}.xlsx`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
            toast.success('Excel generado correctamente');
        } catch (err: any) {
            console.error(err);
            toast.error('Error generando Excel: ' + (err?.message || 'desconocido'));
        } finally {
            setGenerando(false);
        }
    }

    function escribirHojaComedor(sheet: ExcelJS.Worksheet, row: any) {
        const dias: string[] = row.dias;
        const campos: any[] = row.campos;

        const borderThin: Partial<ExcelJS.Borders> = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        };

        // Row 1: Header con nombre del comedor + días
        const headerValues = [row.comedor.nombre, ...dias.map(d => format(parseISO(d), 'dd-MMM', { locale: es }).toLowerCase())];
        const header = sheet.addRow(headerValues);
        header.height = 22;
        header.eachCell(c => {
            c.font = { bold: true, color: { argb: COLOR_HEADER_FG }, size: 11 };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
            c.alignment = { vertical: 'middle', horizontal: 'center' };
            c.border = borderThin;
        });
        header.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        // Rows por campo
        campos.forEach((campo: any) => {
            const qtys = dias.map(d => row.qty[campo.id]?.[d] || 0);
            const r = sheet.addRow([campo.nombre_campo, ...qtys]);
            r.getCell(1).font = { bold: true, size: 10 };
            r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            for (let i = 2; i <= dias.length + 1; i++) {
                r.getCell(i).alignment = { vertical: 'middle', horizontal: 'center' };
                r.getCell(i).font = { size: 10 };
            }
            r.eachCell(c => c.border = borderThin);
        });

        // Fila en blanco
        sheet.addRow([]);

        // COFFE BREAKS / OTROS (estilo lila)
        const coffeRow = sheet.addRow([
            'COFFE BREAKS / OTROS',
            ...dias.map(d => {
                const cb = row.coffe[d];
                if (!cb) return 'NO';
                return cb.tiene ? 'SI' : 'NO';
            }),
        ]);
        coffeRow.height = 18;
        coffeRow.eachCell(c => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_COFFE_BG } };
            c.font = { bold: true, size: 10, color: { argb: 'FF1A1A66' } };
            c.alignment = { vertical: 'middle', horizontal: 'center' };
            c.border = borderThin;
        });
        coffeRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        // Fila en blanco
        sheet.addRow([]);

        // TOTAL por categoría (solo categorías presentes en los campos)
        const catsPresentes = Array.from(new Set(campos.map((c: any) => c.categoria)));
        const catsOrdenadas = [
            ...CATEGORIA_ORDER.filter(c => catsPresentes.includes(c)),
            ...catsPresentes.filter(c => !CATEGORIA_ORDER.includes(c as string)),
        ];
        catsOrdenadas.forEach(cat => {
            const totalsPorDia = dias.map(d => {
                let s = 0;
                campos.filter((c: any) => c.categoria === cat).forEach((c: any) => {
                    // Regla Machu/Medlog: solo se cuentan los campos que efectivamente facturan.
                    if (!campoSumaEnTotal(row.comedor.id, c.categoria, c.nombre_campo)) return;
                    s += row.qty[c.id]?.[d] || 0;
                });
                return s;
            });
            const r = sheet.addRow([`TOTAL ${cat}`, ...totalsPorDia]);
            r.height = 20;
            r.eachCell(c => {
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
                c.font = { bold: true, size: 10, color: { argb: COLOR_TOTAL_BORDER } };
                c.alignment = { vertical: 'middle', horizontal: 'center' };
                c.border = {
                    top: { style: 'thin', color: { argb: COLOR_TOTAL_BORDER } },
                    bottom: { style: 'thin', color: { argb: COLOR_TOTAL_BORDER } },
                    left: { style: 'thin', color: { argb: COLOR_TOTAL_BORDER } },
                    right: { style: 'thin', color: { argb: COLOR_TOTAL_BORDER } },
                };
            });
            r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        });

        // TOTAL FACTURABLE (respeta reglas especiales Machu/Medlog)
        const totalFacturablePorDia = dias.map(d => {
            let s = 0;
            campos.forEach((c: any) => {
                if (campoSumaEnTotal(row.comedor.id, c.categoria, c.nombre_campo)) {
                    s += row.qty[c.id]?.[d] || 0;
                }
            });
            return s;
        });
        const rFact = sheet.addRow(['TOTAL FACTURABLE', ...totalFacturablePorDia]);
        rFact.height = 22;
        rFact.eachCell(c => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
            c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
            c.alignment = { vertical: 'middle', horizontal: 'center' };
            c.border = borderThin;
        });
        rFact.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        // Ajustar columnas
        sheet.columns = [
            { width: 32 },
            ...dias.map(() => ({ width: 10 })),
        ];
        // Congela la columna de nombres + la primera fila
        sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-[#1B4332] tracking-tight flex items-center gap-2">
                    <FileSpreadsheet className="h-6 w-6" /> Consolidado Semanal / Quincenal
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                    Exporta un Excel con una hoja por comedor, idéntico al reporte que revisa la administración cada semana.
                </p>
            </div>

            <Card>
                <CardHeader className="border-b bg-zinc-50">
                    <CardTitle className="text-base">Configuración del reporte</CardTitle>
                    <CardDescription>Selecciona el periodo y la fecha de inicio. El reporte cubre 7 días (semanal) o 14 días (quincenal) consecutivos.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="space-y-1 w-full md:w-1/3">
                            <label className="text-sm font-medium">Periodo</label>
                            <Select value={periodo} onValueChange={v => setPeriodo(v as Periodo)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="semanal">Semanal (7 días)</SelectItem>
                                    <SelectItem value="quincenal">Quincenal (14 días)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1 w-full md:w-1/3">
                            <label className="text-sm font-medium">Fecha de inicio</label>
                            <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 bg-white">
                                <CalendarIcon className="h-4 w-4 text-zinc-400" />
                                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="border-0 shadow-none focus-visible:ring-0 p-0" />
                            </div>
                            <p className="text-[11px] text-zinc-400">Hasta: {format(parseISO(fechaFin), "dd 'de' MMMM yyyy", { locale: es })}</p>
                        </div>
                        <div className="flex gap-2 ml-auto">
                            <Button variant="outline" onClick={handlePreview} disabled={generando}>
                                {generando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Previsualizar
                            </Button>
                            <Button onClick={handleDescargar} disabled={generando} className="bg-[#1B4332] hover:bg-[#2D6A4F]">
                                {generando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                                Descargar Excel
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {preview.length > 0 && (
                <Card>
                    <CardHeader className="border-b bg-emerald-50">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Vista previa - {preview.filter(p => p.hasData).length} de {preview.length} comedores con datos
                        </CardTitle>
                        <CardDescription>
                            Una hoja por cada comedor con datos en el rango de fechas.
                            Los comedores sin datos se omiten del Excel.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4">
                            {preview.map(p => (
                                <div key={p.comedor.id} className={`border rounded-lg p-3 text-sm ${p.hasData ? 'bg-white border-emerald-200' : 'bg-zinc-50 border-zinc-200 opacity-60'}`}>
                                    <div className="font-bold text-zinc-800 truncate">{p.comedor.nombre}</div>
                                    <div className="text-xs text-zinc-500 mt-1">{p.campos.length} campos</div>
                                    <Badge variant="outline" className={`mt-1.5 text-[10px] ${p.hasData ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-zinc-300 text-zinc-500'}`}>
                                        {p.hasData ? 'Con datos' : 'Sin datos'}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
