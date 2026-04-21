'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, FileSpreadsheet, AlertCircle, Database, History, CalendarRange, Download } from 'lucide-react';
import { parseWorkbook, type SistemaRow } from '@/lib/utils/sistema-parser';

interface Comedor { id: string; nombre: string; }
interface Lote {
    id: string;
    comedor_id: string;
    upload_id?: string;
    nombre_archivo: string;
    semana_inicio: string;
    total_filas: number;
    created_at: string;
    comedores?: { nombre: string };
}
interface VistaRow {
    id: string;
    fecha: string | null;
    apellidos: string | null;
    nombres: string | null;
    dni: string | null;
    servicio: string;
    servicio_canonico: string;
    cantidad: number;
    tipo_pago: string;
    valor_empleado: number | null;
    valor_empresa: number | null;
    razon_social: string | null;
    centro_costo: string | null;
    tipo_trabajador: string | null;
    comedor_id: string;
    comedores?: { nombre: string };
}

// Comedores que NO reportan sistema interno (el cliente no tiene sistema).
const NO_SYSTEM_COMEDORES = ['MACHU PICCHU', 'SAN JORGE'];

export default function SistemaPage() {
    const { loading, rol } = useUser();
    const supabase = useMemo(() => createClient(), []);
    const fileRef = useRef<HTMLInputElement>(null);

    // --- Común ---
    const [comedores, setComedores] = useState<Comedor[]>([]);

    // --- Tab Cargar ---
    const [selectedComedor, setSelectedComedor] = useState('');
    const [semanaInicio, setSemanaInicio] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const [fileName, setFileName] = useState('');
    const [parsedRows, setParsedRows] = useState<SistemaRow[]>([]);
    const [uploading, setUploading] = useState(false);
    const [parseStats, setParseStats] = useState<{ sheets: string[]; total: number; skippedGroup: number } | null>(null);

    // --- Tab Historial ---
    const [lotes, setLotes] = useState<Lote[]>([]);

    // --- Tab Ver datos ---
    const [viewComedor, setViewComedor] = useState('');
    const [viewFechaInicio, setViewFechaInicio] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [viewFechaFin, setViewFechaFin] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const [viewServicio, setViewServicio] = useState<string>('all');
    const [viewRows, setViewRows] = useState<VistaRow[]>([]);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewPage, setViewPage] = useState(1);
    const PAGE_SIZE = 50;

    useEffect(() => {
        (supabase as any).from('comedores').select('id, nombre').order('nombre').then(({ data }: any) => {
            if (data) setComedores(data);
        });
        loadLotes();
    }, [supabase]);

    if (loading) return <div className="p-8 text-center text-zinc-500">Cargando...</div>;

    // SUPERVISOR puede ver todo y descargar CSV, pero no carga Excel ni borra lotes.
    const isReadOnly = rol === 'SUPERVISOR';

    async function loadLotes(comedorId?: string) {
        let q = (supabase as any)
            .from('system_report_lotes')
            .select('*, comedores(nombre)')
            .order('created_at', { ascending: false })
            .limit(50);
        if (comedorId) q = q.eq('comedor_id', comedorId);
        const { data } = await q;
        setLotes(data || []);
    }

    async function loadViewData() {
        if (!viewComedor || !viewFechaInicio || !viewFechaFin) {
            toast.error('Selecciona comedor y rango de fechas');
            return;
        }
        setViewLoading(true);
        try {
            let q = (supabase as any)
                .from('system_report_uploads')
                .select('id, fecha, apellidos, nombres, dni, servicio, servicio_canonico, cantidad, tipo_pago, valor_empleado, valor_empresa, razon_social, centro_costo, tipo_trabajador, comedor_id, comedores(nombre)')
                .eq('comedor_id', viewComedor)
                .gte('fecha', viewFechaInicio)
                .lte('fecha', viewFechaFin + 'T23:59:59')
                .order('fecha', { ascending: true })
                .limit(5000);
            if (viewServicio !== 'all') q = q.eq('servicio_canonico', viewServicio);
            const { data, error } = await q;
            if (error) throw error;
            setViewRows((data as VistaRow[]) || []);
            setViewPage(1);
            toast.success(`${data?.length || 0} registros encontrados`);
        } catch (err: any) {
            console.error(err);
            toast.error('Error cargando datos: ' + (err?.message || 'desconocido'));
        } finally {
            setViewLoading(false);
        }
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(ev.target?.result, { type: 'binary', cellDates: false });
                const { rows, stats } = parseWorkbook(wb);
                setParsedRows(rows);
                setParseStats({ sheets: stats.sheetsProcessed, total: rows.length, skippedGroup: stats.skippedGroupHeaders });
                toast.success(`${rows.length} filas detectadas en ${stats.sheetsProcessed.length} pestaña(s).`);
            } catch (err: any) {
                console.error(err);
                toast.error('Error al leer el Excel: ' + (err?.message || 'formato inválido'));
            }
        };
        reader.readAsBinaryString(file);
    }

    async function handleUpload() {
        if (!selectedComedor || parsedRows.length === 0) {
            toast.error('Selecciona un comedor y sube un archivo primero.');
            return;
        }
        setUploading(true);
        try {
            const uploadId = crypto.randomUUID();

            // Crear lote
            await (supabase.from('system_report_lotes') as any).insert({
                comedor_id: selectedComedor,
                semana_inicio: semanaInicio,
                nombre_archivo: fileName,
                total_filas: parsedRows.length,
            });

            // Insertar filas en batches de 300 para evitar payload enorme
            const rowsToInsert = parsedRows.map(r => ({
                comedor_id: selectedComedor,
                upload_id: uploadId,
                semana_inicio: semanaInicio,
                fecha: r.fecha,
                apellidos: r.apellidos,
                nombres: r.nombres,
                dni: r.dni,
                servicio: r.servicio,
                servicio_canonico: r.servicio_canonico,
                cantidad: r.cantidad,
                tipo_pago: r.tipo_pago,
                valor_empleado: r.valor_empleado,
                valor_empresa: r.valor_empresa,
                razon_social: r.razon_social,
                centro_costo: r.centro_costo,
                tipo_trabajador: r.tipo_trabajador,
            }));
            const BATCH = 300;
            for (let i = 0; i < rowsToInsert.length; i += BATCH) {
                await (supabase.from('system_report_uploads') as any).insert(rowsToInsert.slice(i, i + BATCH));
            }

            toast.success(`${parsedRows.length} filas cargadas correctamente.`);
            setParsedRows([]);
            setParseStats(null);
            setFileName('');
            if (fileRef.current) fileRef.current.value = '';
            loadLotes(selectedComedor);
        } catch (err: any) {
            console.error(err);
            toast.error('Error al subir los datos: ' + (err?.message || 'desconocido'));
        } finally {
            setUploading(false);
        }
    }

    async function deleteLote(lote: Lote) {
        if (!confirm(`¿Eliminar el lote "${lote.nombre_archivo}" y todas sus filas?`)) return;
        try {
            // Primero borrar filas
            await (supabase.from('system_report_uploads') as any)
                .delete()
                .eq('comedor_id', lote.comedor_id)
                .eq('semana_inicio', lote.semana_inicio);
            await (supabase.from('system_report_lotes') as any).delete().eq('id', lote.id);
            toast.success('Lote eliminado.');
            loadLotes(selectedComedor || undefined);
        } catch (err: any) {
            toast.error('Error eliminando lote: ' + err.message);
        }
    }

    function exportCurrentViewCsv() {
        if (viewRows.length === 0) { toast.error('No hay datos para exportar'); return; }
        const headers = ['Fecha', 'DNI', 'Apellidos', 'Nombres', 'Servicio', 'Categoría', 'Cantidad', 'Tipo Pago', 'V. Empleado', 'V. Empresa', 'Razón Social', 'Centro Costo', 'Cargo'];
        const lines = [headers.join(';')];
        viewRows.forEach(r => {
            lines.push([
                r.fecha || '',
                r.dni || '',
                (r.apellidos || '').replace(/;/g, ' '),
                (r.nombres || '').replace(/;/g, ' '),
                (r.servicio || '').replace(/;/g, ' '),
                r.servicio_canonico || '',
                r.cantidad,
                r.tipo_pago || '',
                r.valor_empleado ?? '',
                r.valor_empresa ?? '',
                (r.razon_social || '').replace(/;/g, ' '),
                (r.centro_costo || '').replace(/;/g, ' '),
                (r.tipo_trabajador || '').replace(/;/g, ' '),
            ].join(';'));
        });
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cName = comedores.find(c => c.id === viewComedor)?.nombre || 'comedor';
        a.href = url;
        a.download = `sistema_${cName}_${viewFechaInicio}_a_${viewFechaFin}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 300);
    }

    const comedorActual = comedores.find(c => c.id === selectedComedor);
    const noTienesSistema = comedorActual && NO_SYSTEM_COMEDORES.some(n => comedorActual.nombre.toUpperCase().includes(n));

    // Agregados para la vista
    const viewTotals = viewRows.reduce((acc, r) => {
        acc.cantidad += Number(r.cantidad || 0);
        acc.empresa += Number(r.valor_empresa || 0);
        acc.empleado += Number(r.valor_empleado || 0);
        acc.total += Number(r.valor_empresa || 0) + Number(r.valor_empleado || 0);
        const cat = r.servicio_canonico || 'EXTRA';
        acc.porCat[cat] = (acc.porCat[cat] || 0) + Number(r.cantidad || 0);
        return acc;
    }, { cantidad: 0, empresa: 0, empleado: 0, total: 0, porCat: {} as Record<string, number> });

    const pagedRows = viewRows.slice((viewPage - 1) * PAGE_SIZE, viewPage * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(viewRows.length / PAGE_SIZE));

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                    <Database className="h-6 w-6" /> Sistema Interno
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                    Carga y explora los reportes del sistema interno que envían los comedores. Los Excel se procesan en el navegador y sólo se guardan los datos extraídos (fecha, empleado, servicio, montos) — el archivo original no se almacena.
                </p>
            </div>

            <Tabs defaultValue="ver" className="w-full">
                <TabsList className={`grid ${isReadOnly ? 'grid-cols-2' : 'grid-cols-3'} h-12 bg-zinc-100`}>
                    <TabsTrigger value="ver" className="data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white">
                        <CalendarRange className="h-4 w-4 mr-2" /> Ver datos
                    </TabsTrigger>
                    {!isReadOnly && (
                        <TabsTrigger value="cargar" className="data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white">
                            <Upload className="h-4 w-4 mr-2" /> Cargar Excel
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="historial" className="data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white">
                        <History className="h-4 w-4 mr-2" /> Historial
                    </TabsTrigger>
                </TabsList>

                {/* ---- VER DATOS ---- */}
                <TabsContent value="ver" className="mt-6 space-y-4">
                    <Card>
                        <CardHeader className="border-b pb-3 bg-zinc-50">
                            <CardTitle className="text-base">Explorador por comedor y rango de fechas</CardTitle>
                            <CardDescription>Visualiza el detalle de los registros cargados del sistema interno.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-sm font-medium">Comedor</label>
                                    <Select value={viewComedor} onValueChange={setViewComedor}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                        <SelectContent>
                                            {comedores.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Desde</label>
                                    <Input type="date" value={viewFechaInicio} onChange={e => setViewFechaInicio(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Hasta</label>
                                    <Input type="date" value={viewFechaFin} onChange={e => setViewFechaFin(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Servicio</label>
                                    <Select value={viewServicio} onValueChange={setViewServicio}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="DESAYUNO">Desayuno</SelectItem>
                                            <SelectItem value="ALMUERZO">Almuerzo</SelectItem>
                                            <SelectItem value="CENA">Cena</SelectItem>
                                            <SelectItem value="AMANECIDA">Amanecida</SelectItem>
                                            <SelectItem value="LONCHE">Lonche</SelectItem>
                                            <SelectItem value="PAN">Pan</SelectItem>
                                            <SelectItem value="BEBIDA">Bebida</SelectItem>
                                            <SelectItem value="EXTRA">Extra / Otros</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="outline" onClick={exportCurrentViewCsv} disabled={viewRows.length === 0}>
                                    <Download className="h-4 w-4 mr-2" /> Exportar CSV
                                </Button>
                                <Button onClick={loadViewData} disabled={viewLoading || !viewComedor} className="bg-indigo-600 hover:bg-indigo-700">
                                    {viewLoading ? 'Cargando...' : 'Buscar'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {viewRows.length > 0 && (
                        <>
                            {/* Totales */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <Card className="bg-[#1B4332] text-white border-none">
                                    <CardContent className="py-3 px-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200">Total registros</p>
                                        <p className="text-2xl font-black mt-1">{viewRows.length}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white border-emerald-200">
                                    <CardContent className="py-3 px-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total cantidad</p>
                                        <p className="text-2xl font-black mt-1 text-[#1B4332]">{viewTotals.cantidad.toLocaleString()}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white border-emerald-200">
                                    <CardContent className="py-3 px-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Valor empresa</p>
                                        <p className="text-lg font-black mt-1 text-emerald-700">S/ {viewTotals.empresa.toFixed(2)}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white border-emerald-200">
                                    <CardContent className="py-3 px-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Valor empleado</p>
                                        <p className="text-lg font-black mt-1 text-amber-700">S/ {viewTotals.empleado.toFixed(2)}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-white border-emerald-200">
                                    <CardContent className="py-3 px-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Monto total</p>
                                        <p className="text-lg font-black mt-1 text-indigo-700">S/ {viewTotals.total.toFixed(2)}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Por categoría */}
                            <Card>
                                <CardHeader className="py-3 px-4 border-b bg-zinc-50">
                                    <CardTitle className="text-sm">Cantidad por categoría</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="flex flex-wrap gap-3">
                                        {Object.entries(viewTotals.porCat).map(([cat, qty]) => (
                                            <div key={cat} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                                                <span className="text-xs font-bold text-emerald-900">{cat}</span>
                                                <Badge variant="outline" className="bg-white border-emerald-300">{qty}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Tabla */}
                            <Card>
                                <CardHeader className="py-3 px-4 border-b bg-zinc-50 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm">Detalle ({viewRows.length} registros)</CardTitle>
                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-2 text-xs">
                                            <Button variant="outline" size="sm" onClick={() => setViewPage(p => Math.max(1, p - 1))} disabled={viewPage <= 1}>‹</Button>
                                            <span>Página {viewPage} / {totalPages}</span>
                                            <Button variant="outline" size="sm" onClick={() => setViewPage(p => Math.min(totalPages, p + 1))} disabled={viewPage >= totalPages}>›</Button>
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="whitespace-nowrap">Fecha</TableHead>
                                                    <TableHead>DNI</TableHead>
                                                    <TableHead>Apellidos y Nombres</TableHead>
                                                    <TableHead>Servicio</TableHead>
                                                    <TableHead>Cat.</TableHead>
                                                    <TableHead className="text-center">Cant</TableHead>
                                                    <TableHead>Pago</TableHead>
                                                    <TableHead className="text-right">V. Empresa</TableHead>
                                                    <TableHead className="text-right">V. Empleado</TableHead>
                                                    <TableHead>Razón Social</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {pagedRows.map(r => (
                                                    <TableRow key={r.id}>
                                                        <TableCell className="text-xs whitespace-nowrap">
                                                            {r.fecha ? format(new Date(r.fecha.substring(0, 10) + 'T12:00:00'), 'dd MMM', { locale: es }) : '—'}
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs">{r.dni || '—'}</TableCell>
                                                        <TableCell className="text-xs">
                                                            <span className="font-semibold">{r.apellidos || ''}</span>
                                                            {r.nombres && <span className="text-zinc-500"> {r.nombres}</span>}
                                                        </TableCell>
                                                        <TableCell className="text-xs max-w-[200px] truncate">{r.servicio}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="text-[10px]">{r.servicio_canonico}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center">{r.cantidad}</TableCell>
                                                        <TableCell className="text-xs">{r.tipo_pago}</TableCell>
                                                        <TableCell className="text-right text-xs">{r.valor_empresa != null ? `S/ ${Number(r.valor_empresa).toFixed(2)}` : '—'}</TableCell>
                                                        <TableCell className="text-right text-xs">{r.valor_empleado != null ? `S/ ${Number(r.valor_empleado).toFixed(2)}` : '—'}</TableCell>
                                                        <TableCell className="text-xs text-zinc-500">{r.razon_social || '—'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {!viewLoading && viewRows.length === 0 && viewComedor && (
                        <Card><CardContent className="py-12 text-center text-zinc-400 text-sm">
                            No hay registros cargados para ese comedor y rango. Primero carga un Excel desde la pestaña &ldquo;Cargar Excel&rdquo;.
                        </CardContent></Card>
                    )}
                </TabsContent>

                {/* ---- CARGAR ---- (sólo ADMIN) */}
                {!isReadOnly && (
                <TabsContent value="cargar" className="mt-6 space-y-4">
                    <Card>
                        <CardHeader className="border-b">
                            <CardTitle className="text-base">Subir Excel del sistema del comedor</CardTitle>
                            <CardDescription>
                                El parser detecta automáticamente el formato (FADESA, FUNDICIÓN, ICH, MEDLOG, MOLICENTRO, METALPREN, etc.).
                                Sólo se guardan los datos útiles — el archivo Excel no se almacena en el servidor.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Comedor</label>
                                    <Select value={selectedComedor} onValueChange={v => { setSelectedComedor(v); loadLotes(v); }}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                        <SelectContent>
                                            {comedores.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Semana de referencia</label>
                                    <Input type="date" value={semanaInicio} onChange={e => setSemanaInicio(e.target.value)} />
                                    <p className="text-[10px] text-zinc-400">Se usa para agrupar el lote (la fecha real se extrae de cada fila).</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Archivo Excel</label>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        disabled={!selectedComedor || !!noTienesSistema}
                                        onChange={handleFileChange}
                                        className="w-full border rounded-md px-3 py-2 text-sm bg-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-indigo-50 file:text-indigo-700 file:text-xs"
                                    />
                                </div>
                            </div>

                            {noTienesSistema && (
                                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                    Este comedor no tiene reporte de sistema interno. No aplica carga de Excel.
                                </div>
                            )}

                            {fileName && parsedRows.length > 0 && (
                                <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                    <div className="text-sm text-emerald-900">
                                        <strong>{fileName}</strong>
                                        <span className="text-emerald-700 ml-2">— {parsedRows.length} filas listas</span>
                                        {parseStats && <span className="text-emerald-600 ml-2">({parseStats.sheets.length} hoja(s), {parseStats.skippedGroup} sub-cabeceras saltadas)</span>}
                                    </div>
                                    <Button onClick={handleUpload} disabled={uploading} className="bg-emerald-600 hover:bg-emerald-700">
                                        <Upload className="h-4 w-4 mr-2" />{uploading ? 'Subiendo...' : 'Subir a la base de datos'}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {parsedRows.length > 0 && (
                        <Card>
                            <CardHeader className="py-3 px-4 border-b bg-zinc-50 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm">Vista previa (primeras 20 filas de {parsedRows.length})</CardTitle>
                                <Badge variant="outline">{parsedRows.length} filas</Badge>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>DNI</TableHead>
                                                <TableHead>Apellidos y Nombres</TableHead>
                                                <TableHead>Servicio</TableHead>
                                                <TableHead>Cat.</TableHead>
                                                <TableHead className="text-center">Cant.</TableHead>
                                                <TableHead className="text-right">V. Empresa</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {parsedRows.slice(0, 20).map((r, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-xs">{r.fecha || '—'}</TableCell>
                                                    <TableCell className="font-mono text-xs">{r.dni}</TableCell>
                                                    <TableCell className="text-xs">{r.apellidos} <span className="text-zinc-400">{r.nombres}</span></TableCell>
                                                    <TableCell className="text-xs max-w-[180px] truncate">{r.servicio}</TableCell>
                                                    <TableCell><Badge variant="outline" className="text-[10px]">{r.servicio_canonico}</Badge></TableCell>
                                                    <TableCell className="text-center">{r.cantidad}</TableCell>
                                                    <TableCell className="text-right text-xs">{r.valor_empresa != null ? `S/ ${Number(r.valor_empresa).toFixed(2)}` : '—'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
                )}

                {/* ---- HISTORIAL ---- */}
                <TabsContent value="historial" className="mt-6">
                    <Card>
                        <CardHeader className="border-b">
                            <CardTitle className="text-base">Historial de cargas</CardTitle>
                            <CardDescription>
                                {isReadOnly
                                    ? 'Últimos 50 lotes subidos al sistema.'
                                    : 'Últimos 50 lotes subidos al sistema. Puedes eliminar un lote y todas sus filas.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Comedor</TableHead>
                                        <TableHead>Semana referencia</TableHead>
                                        <TableHead>Archivo</TableHead>
                                        <TableHead className="text-center">Filas</TableHead>
                                        <TableHead>Subido</TableHead>
                                        {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lotes.length === 0 ? (
                                        <TableRow><TableCell colSpan={isReadOnly ? 5 : 6} className="text-center py-12 text-zinc-400">Sin cargas registradas.</TableCell></TableRow>
                                    ) : lotes.map(l => (
                                        <TableRow key={l.id}>
                                            <TableCell className="font-semibold">{l.comedores?.nombre || '—'}</TableCell>
                                            <TableCell className="text-xs">{format(new Date(l.semana_inicio + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}</TableCell>
                                            <TableCell className="text-xs flex items-center gap-2">
                                                <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                                                {l.nombre_archivo}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs">{l.total_filas.toLocaleString()}</TableCell>
                                            <TableCell className="text-xs text-zinc-500">{format(new Date(l.created_at), 'dd MMM yyyy HH:mm', { locale: es })}</TableCell>
                                            {!isReadOnly && (
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => deleteLote(l)} className="text-red-600 hover:text-red-800 hover:bg-red-50">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
