'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarDays, Eye, CheckCircle2, Clock, Lock } from 'lucide-react';

interface Comedor { id: string; nombre: string; }
interface ReporteSemanal {
    id: string; semana_inicio: string; semana_fin: string; estado: string; total_facturado: number;
    comedores?: { nombre: string };
}
interface Campo { id: string; nombre_campo: string; seccion: string; es_facturable: boolean; precio_ref: number | null; }
interface Valor { campo_id: string; dia_semana: number; cantidad: number; precio_unitario: number; }

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function AdminSemanalViewerPage() {
    const supabase = createClient();

    const [comedores, setComedores] = useState<Comedor[]>([]);
    const [selectedComedor, setSelectedComedor] = useState('');
    const [reportes, setReportes] = useState<ReporteSemanal[]>([]);
    const [selectedReporte, setSelectedReporte] = useState('');
    const [campos, setCampos] = useState<Campo[]>([]);
    const [valores, setValores] = useState<Valor[]>([]);
    const [semanaInicio, setSemanaInicio] = useState<Date | null>(null);

    useEffect(() => {
        supabase.from('comedores').select('id, nombre').order('nombre').then(({ data }) => {
            if (data) setComedores(data);
        });
    }, []);

    useEffect(() => {
        if (!selectedComedor) return;
        (supabase as any)
            .from('reporte_semanal')
            .select('id, semana_inicio, semana_fin, estado, total_facturado')
            .eq('comedor_id', selectedComedor)
            .order('semana_inicio', { ascending: false })
            .then(({ data }: any) => setReportes(data || []));
    }, [selectedComedor]);

    useEffect(() => {
        if (!selectedReporte || !selectedComedor) return;
        const rep = reportes.find(r => r.id === selectedReporte);
        if (rep) setSemanaInicio(new Date(rep.semana_inicio + 'T12:00:00'));

        Promise.all([
            (supabase as any)
                .from('reporte_semanal_campos')
                .select('id, nombre_campo, seccion, es_facturable, precio_ref')
                .eq('comedor_id', selectedComedor)
                .eq('activo', true)
                .order('orden'),
            (supabase as any)
                .from('reporte_semanal_valores')
                .select('campo_id, dia_semana, cantidad, precio_unitario')
                .eq('reporte_semanal_id', selectedReporte)
        ]).then(([camposRes, valoresRes]: any[]) => {
            setCampos(camposRes.data || []);
            setValores(valoresRes.data || []);
        });
    }, [selectedReporte]);

    const getQty = (campoId: string, dia: number) => valores.find(v => v.campo_id === campoId && v.dia_semana === dia)?.cantidad ?? 0;
    const getPrecio = (campoId: string) => valores.find(v => v.campo_id === campoId)?.precio_unitario ?? 0;

    const totalCampo = (campoId: string, facturable: boolean) => {
        if (!facturable) return { qty: 0, monto: 0 };
        const qty = Array.from({ length: 7 }, (_, i) => i).reduce((s, d) => s + getQty(campoId, d), 0);
        const precio = getPrecio(campoId);
        return { qty, monto: qty * precio };
    };

    const grandTotal = campos.filter(c => c.es_facturable).reduce((acc, c) => {
        const t = totalCampo(c.id, true);
        return { qty: acc.qty + t.qty, monto: acc.monto + t.monto };
    }, { qty: 0, monto: 0 });

    const secciones = Array.from(new Set(campos.map(c => c.seccion)));
    const repActual = reportes.find(r => r.id === selectedReporte);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                    <CalendarDays className="h-6 w-6" /> Reportes Semanales — Vista Admin
                </h2>
                <p className="text-zinc-500 text-sm">Vista de solo lectura. Los reportes los envía cada comedor desde su portal.</p>
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-5 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Comedor</label>
                            <Select value={selectedComedor} onValueChange={v => { setSelectedComedor(v); setSelectedReporte(''); setCampos([]); setValores([]); }}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar comedor..." /></SelectTrigger>
                                <SelectContent>{comedores.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Semana</label>
                            <Select value={selectedReporte} onValueChange={setSelectedReporte} disabled={!selectedComedor}>
                                <SelectTrigger><SelectValue placeholder={reportes.length === 0 ? 'Sin reportes enviados' : 'Seleccionar semana...'} /></SelectTrigger>
                                <SelectContent>
                                    {reportes.map(r => (
                                        <SelectItem key={r.id} value={r.id}>
                                            {format(new Date(r.semana_inicio + 'T12:00:00'), 'dd MMM', { locale: es })} –{' '}
                                            {format(new Date(r.semana_fin + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}
                                            {r.estado === 'cerrado' ? ' ✅' : ' ⏳'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Estado del reporte */}
            {repActual && (
                <div className="flex items-center gap-3 flex-wrap">
                    <Badge className={repActual.estado === 'cerrado'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 px-4 py-2'
                        : 'bg-amber-100 text-amber-800 border-amber-300 px-4 py-2'}>
                        {repActual.estado === 'cerrado'
                            ? <><CheckCircle2 className="h-3.5 w-3.5 mr-2" />Cerrado y enviado por comedor</>
                            : <><Clock className="h-3.5 w-3.5 mr-2" />Borrador — aún en edición</>}
                    </Badge>
                    {grandTotal.monto > 0 && (
                        <Badge variant="outline" className="text-indigo-700 border-indigo-300 px-4 py-2 text-sm font-bold">
                            Total: S/. {grandTotal.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </Badge>
                    )}
                    <Badge variant="outline" className="text-zinc-500 text-xs"><Eye className="h-3 w-3 mr-1" />Solo lectura</Badge>
                </div>
            )}

            {/* Grilla de valores */}
            {selectedReporte && campos.length > 0 && (
                <div className="space-y-4">
                    {secciones.map(sec => {
                        const camposSec = campos.filter(c => c.seccion === sec);
                        return (
                            <Card key={sec} className="overflow-hidden">
                                <CardHeader className="py-3 px-4 bg-zinc-50 border-b">
                                    <CardTitle className="text-sm font-bold text-zinc-700 uppercase tracking-wide">{sec}</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-zinc-50/40 text-xs">
                                                    <th className="text-left p-3 font-semibold text-zinc-600 min-w-[180px]">Producto / Servicio</th>
                                                    {DIAS.map((d, i) => (
                                                        <th key={i} className="p-2 text-center text-zinc-500 font-medium w-16">
                                                            <div>{d}</div>
                                                            {semanaInicio && <div className="text-zinc-400 font-normal">{format(addDays(semanaInicio, i), 'dd/MM')}</div>}
                                                        </th>
                                                    ))}
                                                    <th className="p-3 text-center font-semibold w-16 text-zinc-600">Total</th>
                                                    <th className="p-3 text-center font-semibold w-20 text-zinc-600">Precio</th>
                                                    <th className="p-3 text-right font-semibold w-24 text-zinc-600">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {camposSec.map(campo => {
                                                    const { qty, monto } = totalCampo(campo.id, campo.es_facturable);
                                                    return (
                                                        <tr key={campo.id} className={`border-b ${!campo.es_facturable ? 'opacity-60 bg-zinc-50/50' : ''}`}>
                                                            <td className="p-3 font-medium text-zinc-800 text-sm">
                                                                {campo.nombre_campo}
                                                                {!campo.es_facturable && <span className="ml-2 text-xs text-zinc-400 italic">(informativo)</span>}
                                                            </td>
                                                            {Array.from({ length: 7 }, (_, dia) => (
                                                                <td key={dia} className="p-2 text-center">
                                                                    <span className={`text-sm font-mono ${getQty(campo.id, dia) > 0 ? 'font-bold text-zinc-800' : 'text-zinc-300'}`}>
                                                                        {getQty(campo.id, dia) || '—'}
                                                                    </span>
                                                                </td>
                                                            ))}
                                                            <td className="p-3 text-center font-bold text-emerald-700">
                                                                {campo.es_facturable && qty > 0 ? qty : <span className="text-zinc-400 font-normal text-xs">—</span>}
                                                            </td>
                                                            <td className="p-3 text-center text-xs text-zinc-500">
                                                                {campo.es_facturable ? `S/. ${getPrecio(campo.id).toFixed(2)}` : '—'}
                                                            </td>
                                                            <td className="p-3 text-right font-semibold">
                                                                {campo.es_facturable && monto > 0
                                                                    ? <span className="text-emerald-700">S/. {monto.toFixed(2)}</span>
                                                                    : <span className="text-zinc-200">—</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {/* Total */}
                    <Card className="border-2 border-indigo-200 bg-indigo-50">
                        <CardContent className="py-4 px-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="text-sm font-bold text-indigo-800">TOTAL SEMANAL FACTURADO</div>
                                    <div className="text-xs text-indigo-500">{grandTotal.qty} servicios</div>
                                </div>
                                <div className="text-3xl font-extrabold text-indigo-900">
                                    S/. {grandTotal.monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {selectedReporte && campos.length === 0 && (
                <Card>
                    <CardContent className="py-16 text-center text-zinc-400">
                        Este comedor aún no tiene campos de reporte semanal configurados.
                    </CardContent>
                </Card>
            )}

            {!selectedReporte && selectedComedor && reportes.length === 0 && (
                <Card>
                    <CardContent className="py-16 text-center text-zinc-400">
                        Este comedor aún no ha enviado ningún reporte semanal.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
