'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

export default function ReporteSistemaPage() {
    const { comedorId, comedorNombre, loading } = useUser();
    const supabase = createClient();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [summary, setSummary] = useState({ total_raciones: 0, total_valor: 0 });

    if (loading) return null;

    function normalizeText(text: string) {
        if (!text) return '';
        return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    }

    function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;
        setFile(uploadedFile);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });

                // 1. Find correct sheet
                const cName = normalizeText(comedorNombre || '');
                // simple heuristic: find sheet name that contains parts of comedor name, or if not found, use first sheet
                let targetSheetName = wb.SheetNames.find(s => {
                    const sNorm = normalizeText(s);
                    // e.g., 'RANSA SAN AGUSTIN' -> look for 'SAN AGUSTIN' or 'AGUSTIN'
                    const parts = cName.split(' ').filter(p => p.length > 3);
                    return parts.some(p => sNorm.includes(p));
                });

                if (!targetSheetName) {
                    targetSheetName = wb.SheetNames[0]; // fallback
                    toast.info(`No se encontró pestaña exacta para ${comedorNombre}, usando: ${targetSheetName}`);
                } else {
                    toast.success(`Pestaña detectada: ${targetSheetName}`);
                }

                const ws = wb.Sheets[targetSheetName];
                // Use JSON with header: 1 to get arrays of rows
                const jsonData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

                // 2. Scan to find header row index
                let headerRowIndex = -1;
                let colMap = { codigo: -1, nombres: -1, cantidad: -1, total: -1 };

                for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
                    const row = jsonData[i];
                    if (!row || !Array.isArray(row)) continue;

                    let foundCod = -1, foundNom = -1, foundCant = -1, foundTot = -1;

                    row.forEach((cell, colIdx) => {
                        if (!cell) return;
                        const text = normalizeText(cell);
                        if (text.includes('CODIGO') || text === 'N°' || text === 'DNI') foundCod = colIdx;
                        if (text.includes('NOMBRES') || text.includes('APELLIDOS') || text.includes('COLABORADOR')) foundNom = colIdx;
                        if (text.includes('CANTIDAD') || text.includes('RACIONES') || text === 'CANT') foundCant = colIdx;
                        if (text.includes('TOTAL') || text.includes('MONTO') || text.includes('VALOR')) foundTot = colIdx;
                    });

                    // We need at least Names and Total to parse
                    if (foundNom !== -1 && foundTot !== -1) {
                        headerRowIndex = i;
                        colMap = { codigo: foundCod, nombres: foundNom, cantidad: foundCant, total: foundTot };
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    toast.error("No se detectó la cabecera del formato. Asegúrate de tener columnas con 'NOMBRES' y 'TOTAL'.");
                    return;
                }

                // 3. Parse data
                const extracted: any[] = [];
                let tRaciones = 0;
                let tValor = 0;

                for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length === 0) continue;

                    const nombre = colMap.nombres !== -1 ? row[colMap.nombres] : '';
                    const totalRaw = colMap.total !== -1 ? row[colMap.total] : 0;

                    // Break if reached a "TOTALES" row at the bottom
                    if (typeof nombre === 'string' && (nombre.toUpperCase().includes('TOTAL') || nombre === '')) {
                        // If names column is empty but total is > 0, it might be the footer. We heuristic skip.
                        if (!nombre) continue;
                    }

                    const val = parseFloat(totalRaw);
                    if (isNaN(val) || val <= 0) continue;

                    let cantRaw = colMap.cantidad !== -1 ? row[colMap.cantidad] : 1;
                    const cant = parseFloat(cantRaw) || 1;

                    const cod = colMap.codigo !== -1 ? row[colMap.codigo]?.toString() : 'S/C';

                    extracted.push({
                        codigo: cod,
                        nombre: String(nombre).trim(),
                        cantidad: cant,
                        valor: val
                    });

                    tRaciones += cant;
                    tValor += val;
                }

                setParsedData(extracted);
                setSummary({ total_raciones: tRaciones, total_valor: tValor });
                toast.success(`Excel procesado: ${extracted.length} registros encontrados.`);

            } catch (err) {
                console.error(err);
                toast.error('Ocurrió un error al procesar el Excel.');
            }
        };
        reader.readAsBinaryString(uploadedFile);
    }

    async function handleConfirm() {
        if (!comedorId || parsedData.length === 0) return;
        setIsSubmitting(true);

        try {
            // 1. Insert header
            const { data: headerData, error: headerErr } = await supabase.from('reporte_credito').insert({
                comedor_id: comedorId,
                fecha: reportDate,
                archivo_nombre: file?.name || 'reporte.xlsx',
                total_raciones: summary.total_raciones,
                total_valor: summary.total_valor
            }).select('id').single();

            if (headerErr) throw headerErr;

            const reporteId = headerData.id;

            // 2. Insert details (batch array mapping)
            const detailsInserts = parsedData.map(d => ({
                reporte_id: reporteId,
                codigo_empleado: d.codigo,
                nombre_empleado: d.nombre,
                cantidad: d.cantidad,
                valor: d.valor
            }));

            const { error: detErr } = await supabase.from('reporte_credito_detalle').insert(detailsInserts);
            if (detErr) throw detErr;

            toast.success('Reporte consolidado guardado en la Base de Datos');
            setParsedData([]);
            setFile(null);
        } catch (e) {
            console.error(e);
            toast.error('Error al guardar en el servidor');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Carga de Reporte del Sistema Externo</h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Subir Consolidado Excel</CardTitle>
                    <CardDescription>Sube el archivo enviado por Ransa o Derco. El sistema auto-detectará las cabeceras y totales.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-6 items-end">
                        <div className="space-y-2 w-full sm:w-1/3">
                            <label className="text-sm font-medium">Fecha correspondiente al reporte</label>
                            <Input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
                        </div>
                        <div className="space-y-2 w-full sm:w-2/3">
                            <label className="text-sm font-medium">Archivo Excel (.xls, .xlsx)</label>
                            <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
                        </div>
                    </div>

                    {parsedData.length > 0 && (
                        <div className="mt-8 pt-6 border-t font-sans animate-in fade-in">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-emerald-700">
                                    <CheckCircle2 size={20} /> Datos Extraídos Correctamente
                                </h3>
                                <div className="flex gap-4 text-sm bg-zinc-50 dark:bg-zinc-900 p-3 rounded-md border">
                                    <div><span className="text-zinc-500">Registros:</span> <span className="font-bold">{parsedData.length}</span></div>
                                    <div><span className="text-zinc-500">Raciones:</span> <span className="font-bold">{summary.total_raciones}</span></div>
                                    <div><span className="text-zinc-500">Total (S/.):</span> <span className="font-bold text-lg text-emerald-600">S/. {summary.total_valor.toFixed(2)}</span></div>
                                </div>
                            </div>

                            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-zinc-50 dark:bg-zinc-900 sticky top-0 z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead className="w-24">Código</TableHead>
                                            <TableHead>Colaborador / Nombre</TableHead>
                                            <TableHead className="text-right w-24">Cantidad</TableHead>
                                            <TableHead className="text-right w-32">Total (S/.)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedData.slice(0, 100).map((row, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-xs text-zinc-500">{row.codigo}</TableCell>
                                                <TableCell className="font-medium text-sm">{row.nombre}</TableCell>
                                                <TableCell className="text-right">{row.cantidad}</TableCell>
                                                <TableCell className="text-right font-semibold">S/. {row.valor.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {parsedData.length > 100 && (
                                    <div className="p-4 text-center text-sm text-zinc-500 bg-zinc-50">
                                        ... Mostrando solo los primeros 100 de {parsedData.length} registros ...
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 flex justify-end">
                                <Button onClick={handleConfirm} disabled={isSubmitting} size="lg" className="w-full sm:w-auto">
                                    <FileSpreadsheet className="mr-2" size={18} />
                                    {isSubmitting ? 'Guardando en Base de Datos...' : 'Confirmar y Subir al ERP'}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
