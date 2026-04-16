'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, FileSpreadsheet, Eye, AlertCircle } from 'lucide-react';

interface Comedor { id: string; nombre: string; }
interface Lote {
    id: string;
    nombre_archivo: string;
    semana_inicio: string;
    total_filas: number;
    created_at: string;
    comedores?: { nombre: string };
}
interface RowPreview {
    apellidos?: string;
    nombres?: string;
    dni?: string;
    servicio?: string;
    servicio_canonico?: string;
    cantidad?: number;
    tipo_pago?: string;
    valor_empleado?: number;
    valor_empresa?: number;
    razon_social?: string;
}

// Canteen IDs that don't have internal system reports
const NO_SYSTEM_COMEDORES = ['MACHU PICCHU', 'MEDLOG', 'SAN JORGE'];

// Sheet name patterns to auto-detect system report tabs
const SYSTEM_SHEET_PATTERNS = [
    'REPORTE SISTEMA', 'REPORTE DE SISTEMA', 'DETALLE X TRABAJADO',
    'SISTEMA', 'HOJA2', 'DETALLE', 'DESAYUNO', 'ALMUERZO', 'CENAS', 'AMANECIDA',
    'DESAYUNO TERCEROS', 'ALMUERZO TERCEROS'
];

// Normalize service names to canonical categories
const SERVICE_MAP: Record<string, string> = {
    'ALMUERZOS': 'ALMUERZO', 'ALMUERZO SUBVENCIONADO': 'ALMUERZO', 'ALMUERZO NORMAL': 'ALMUERZO',
    'ALMUERZO DIETA': 'ALMUERZO', 'ALMUERZO TERCERO': 'ALMUERZO', 'MENU CAPACITACION': 'ALMUERZO',
    'DESAYUNOS': 'DESAYUNO', 'DESAYUNO DOBLE': 'DESAYUNO', 'DESAYUNO (FITESA)': 'DESAYUNO',
    'CENAS': 'CENA', 'CENA SISTEMA': 'CENA',
    'REFRIGERIOS CURSOS': 'EXTRA', 'COMBO': 'EXTRA',
};

function normalizeService(name: string): string {
    const n = name.toUpperCase().trim();
    return SERVICE_MAP[n] || (n.includes('ALMUERZO') ? 'ALMUERZO' : n.includes('CENA') ? 'CENA' : n.includes('DESAYUNO') ? 'DESAYUNO' : n.includes('AMANECIDA') ? 'AMANECIDA' : 'EXTRA');
}

// Column name mappings from Excel to canonical field names
function mapHeaders(headers: string[]): Record<string, string> {
    const map: Record<string, string> = {};
    headers.forEach((h, i) => {
        const hu = (h || '').toUpperCase().trim();
        if (hu.includes('FECHA')) map['fecha'] = String(i);
        else if (hu.includes('APELLIDO')) map['apellidos'] = String(i);
        else if (hu.includes('NOMBRE') && !hu.includes('APELLIDO')) map['nombres'] = String(i);
        else if (hu === 'DNI' || hu.includes('DOCUMENTO') || hu.includes('ID EMPLEADO')) map['dni'] = String(i);
        else if (hu.includes('SERVICIO') || hu.includes('PRODUCTO') || hu.includes('DESCRIPCION')) map['servicio'] = String(i);
        else if (hu === 'CANTIDAD') map['cantidad'] = String(i);
        else if (hu.includes('TIPO') || hu.includes('PAGO')) map['tipo_pago'] = String(i);
        else if (hu.includes('VALOR EMPLEADO') || hu.includes('PRÉC') || hu === 'PRECIO') map['valor_empleado'] = String(i);
        else if (hu.includes('VALOR EMPRESA') || hu.includes('EMPRESA')) map['valor_empresa'] = String(i);
        else if (hu.includes('RAZON') || hu.includes('SUBDIVISION') || hu.includes('UNIDAD')) map['razon_social'] = String(i);
        else if (hu.includes('CENTRO') || hu.includes('CCOSTO')) map['centro_costo'] = String(i);
    });
    return map;
}

function parseSheet(ws: XLSX.WorkSheet, sheetName: string, comedorNombre: string): RowPreview[] {
    const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
    if (raw.length < 2) return [];

    // For FITESA: each tab has a service name — inject it
    const isFitesaTab = ['DESAYUNO', 'ALMUERZO', 'CENAS', 'AMANECIDA', 'DESAYUNO TERCEROS', 'ALMUERZO TERCEROS']
        .some(p => sheetName.toUpperCase().includes(p));

    // Find header row (first row with at least 4 non-empty cells)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(10, raw.length); i++) {
        if ((raw[i] as string[]).filter(c => c !== '').length >= 4) { headerIdx = i; break; }
    }

    const headers = raw[headerIdx] as string[];
    const fieldMap = mapHeaders(headers);
    const rows: RowPreview[] = [];

    for (let i = headerIdx + 1; i < raw.length; i++) {
        const row = raw[i] as string[];
        if (!row || row.every(c => c === '' || c === null)) continue;

        // Skip sub-header rows (METALPREN: "Sub Empresa:") 
        const firstCell = String(row[0] || '').toUpperCase();
        if (firstCell.includes('SUB EMPRESA') || firstCell.includes('NOMBRES:') || firstCell === '') continue;

        const get = (field: string) => fieldMap[field] !== undefined ? row[Number(fieldMap[field])] : undefined;

        const servicioRaw = String(get('servicio') || (isFitesaTab ? sheetName : '') || '').trim();
        if (!servicioRaw) continue;

        const cantRaw = Number(get('cantidad') || 1);

        rows.push({
            apellidos: String(get('apellidos') || '').trim(),
            nombres: String(get('nombres') || '').trim(),
            dni: String(get('dni') || '').trim().replace(/\D/g, '').substring(0, 12),
            servicio: servicioRaw,
            servicio_canonico: normalizeService(servicioRaw),
            cantidad: isNaN(cantRaw) ? 1 : cantRaw,
            tipo_pago: String(get('tipo_pago') || 'Credito').includes('ontado') ? 'Contado' : 'Credito',
            valor_empleado: Number(get('valor_empleado') || 0) || undefined,
            valor_empresa: Number(get('valor_empresa') || 0) || undefined,
            razon_social: String(get('razon_social') || '').trim() || undefined,
        });
    }

    return rows.filter(r => r.dni || r.apellidos);
}

export default function SistemaPage() {
    const { loading } = useUser();
    const supabase = createClient();
    const fileRef = useRef<HTMLInputElement>(null);

    const [comedores, setComedores] = useState<Comedor[]>([]);
    const [selectedComedor, setSelectedComedor] = useState('');
    const [semanaInicio, setSemanaInicio] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    const [lotes, setLotes] = useState<Lote[]>([]);
    const [preview, setPreview] = useState<RowPreview[]>([]);
    const [fileName, setFileName] = useState('');
    const [parsedRows, setParsedRows] = useState<RowPreview[]>([]);
    const [uploading, setUploading] = useState(false);
    const [comedorNombre, setComedorNombre] = useState('');

    useEffect(() => {
        supabase.from('comedores').select('id, nombre').order('nombre').then(({ data }) => {
            if (data) setComedores(data);
        });
        loadLotes();
    }, []);

    const loadLotes = async (comedorId?: string) => {
        let q = supabase.from('system_report_lotes').select('*, comedores(nombre)').order('created_at', { ascending: false }).limit(50);
        if (comedorId) q = q.eq('comedor_id', comedorId);
        const { data } = await q;
        setLotes(data || []);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb = XLSX.read(ev.target?.result, { type: 'binary', cellDates: true });
                const cn = comedores.find(c => c.id === selectedComedor)?.nombre || '';

                // Detect system sheets
                const systemSheets = wb.SheetNames.filter(name =>
                    SYSTEM_SHEET_PATTERNS.some(p => name.toUpperCase().includes(p))
                );
                const sheetsToProcess = systemSheets.length > 0 ? systemSheets : wb.SheetNames;

                const allRows: RowPreview[] = [];
                sheetsToProcess.forEach(sheetName => {
                    const rows = parseSheet(wb.Sheets[sheetName], sheetName, cn);
                    allRows.push(...rows);
                });

                setParsedRows(allRows);
                setPreview(allRows.slice(0, 20));
                toast.success(`${allRows.length} filas detectadas en ${sheetsToProcess.length} pestaña(s). Revisa la vista previa y sube.`);
            } catch (err) {
                toast.error('Error al leer el Excel. Verifica el formato.');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleUpload = async () => {
        if (!selectedComedor || parsedRows.length === 0) {
            toast.error('Selecciona un comedor y sube un archivo primero.');
            return;
        }
        setUploading(true);
        try {
            // Create lote header
            const uploadId = crypto.randomUUID();
            const { data: lote } = await supabase.from('system_report_lotes').insert({
                comedor_id: selectedComedor,
                semana_inicio: semanaInicio,
                nombre_archivo: fileName,
                total_filas: parsedRows.length
            }).select('id').single();

            // Insert rows in batches of 100
            const rows = parsedRows.map(r => ({
                comedor_id: selectedComedor,
                upload_id: uploadId,
                semana_inicio: semanaInicio,
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
            }));

            for (let i = 0; i < rows.length; i += 100) {
                await supabase.from('system_report_uploads').insert(rows.slice(i, i + 100));
            }

            toast.success(`✅ ${parsedRows.length} filas cargadas correctamente.`);
            setParsedRows([]);
            setPreview([]);
            setFileName('');
            if (fileRef.current) fileRef.current.value = '';
            loadLotes(selectedComedor);
        } catch (err) {
            toast.error('Error al subir los datos.');
        } finally {
            setUploading(false);
        }
    };

    const deleteLote = async (loteId: string) => {
        // Get upload_id for this lote first
        const { data } = await supabase.from('system_report_lotes').select('id').eq('id', loteId).single();
        await supabase.from('system_report_uploads').delete().eq('upload_id', loteId);
        await supabase.from('system_report_lotes').delete().eq('id', loteId);
        toast.success('Lote eliminado.');
        loadLotes(selectedComedor || undefined);
    };

    const comedorActual = comedores.find(c => c.id === selectedComedor);
    const noTienesSistema = comedorActual && NO_SYSTEM_COMEDORES.includes(comedorActual.nombre);

    if (loading) return <div className="p-8 text-center text-zinc-500">Cargando...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                    <FileSpreadsheet className="h-6 w-6" /> Carga Sistema Interno
                </h2>
                <p className="text-zinc-500">Sube el Excel de reporte interno del sistema por comedor y semana.</p>
            </div>

            {/* Upload card */}
            <Card>
                <CardHeader className="border-b">
                    <CardTitle className="text-base">Subir Excel de Sistema</CardTitle>
                    <CardDescription>El parser detecta automáticamente el formato del comedor.</CardDescription>
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
                            <label className="text-sm font-medium">Semana inicio (Lunes)</label>
                            <input
                                type="date"
                                value={semanaInicio}
                                onChange={e => setSemanaInicio(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Archivo Excel (.xlsx)</label>
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
                        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <div className="text-sm text-emerald-800">
                                <strong>{fileName}</strong> — {parsedRows.length} filas listas para subir
                            </div>
                            <Button onClick={handleUpload} disabled={uploading} className="bg-emerald-600 hover:bg-emerald-700">
                                <Upload className="h-4 w-4 mr-2" />{uploading ? 'Subiendo...' : 'Subir Datos'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Preview */}
            {preview.length > 0 && (
                <Card>
                    <CardHeader className="border-b py-3 px-4 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium">Vista previa (primeras 20 filas)</CardTitle>
                        <Badge variant="outline">{parsedRows.length} filas totales</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>DNI</TableHead>
                                        <TableHead>Apellidos</TableHead>
                                        <TableHead>Nombres</TableHead>
                                        <TableHead>Servicio</TableHead>
                                        <TableHead>Canónico</TableHead>
                                        <TableHead className="text-center">Cant.</TableHead>
                                        <TableHead>Tipo Pago</TableHead>
                                        <TableHead className="text-right">V. Empresa</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {preview.map((r, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-mono text-xs">{r.dni}</TableCell>
                                            <TableCell className="text-xs">{r.apellidos}</TableCell>
                                            <TableCell className="text-xs">{r.nombres}</TableCell>
                                            <TableCell className="text-xs max-w-[150px] truncate">{r.servicio}</TableCell>
                                            <TableCell><Badge variant="outline" className="text-xs">{r.servicio_canonico}</Badge></TableCell>
                                            <TableCell className="text-center">{r.cantidad}</TableCell>
                                            <TableCell className="text-xs">{r.tipo_pago}</TableCell>
                                            <TableCell className="text-right text-xs">{r.valor_empresa ? `S/. ${r.valor_empresa}` : '—'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Historial de lotes */}
            <Card>
                <CardHeader className="border-b">
                    <CardTitle className="text-base">Historial de Cargas</CardTitle>
                    <CardDescription>Lotes de Excel subidos al sistema. Puedes eliminar un lote y todas sus filas.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Comedor</TableHead>
                                <TableHead>Semana</TableHead>
                                <TableHead>Archivo</TableHead>
                                <TableHead className="text-center">Filas</TableHead>
                                <TableHead>Subido</TableHead>
                                <TableHead className="text-center">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lotes.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center text-zinc-400 py-8">No hay cargas registradas.</TableCell></TableRow>
                            ) : lotes.map(l => (
                                <TableRow key={l.id}>
                                    <TableCell className="font-medium">{(l.comedores as any)?.nombre || '—'}</TableCell>
                                    <TableCell className="text-sm">{format(new Date(l.semana_inicio + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="text-xs text-zinc-500 max-w-[180px] truncate">{l.nombre_archivo}</TableCell>
                                    <TableCell className="text-center"><Badge variant="outline">{l.total_filas}</Badge></TableCell>
                                    <TableCell className="text-xs text-zinc-400">{format(new Date(l.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7" onClick={() => deleteLote(l.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
