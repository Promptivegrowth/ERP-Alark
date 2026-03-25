'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const diarioSchema = z.object({
    fecha: z.string(),
    credito: z.array(z.object({
        servicio: z.string(),
        precio_unit: z.number(),
        cantidad: z.number().min(0)
    })),
    contado: z.array(z.object({
        servicio: z.string(),
        precio_unit: z.number(),
        cantidad: z.number().min(0)
    })),
    depositos: z.object({
        bancario: z.number().min(0),
        yape: z.number().min(0),
        efectivo: z.number().min(0),
    }),
});

type DiarioForm = z.infer<typeof diarioSchema>;

export default function DiarioPage() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);

    const form = useForm<DiarioForm>({
        resolver: zodResolver(diarioSchema),
        defaultValues: {
            fecha: format(new Date(), 'yyyy-MM-dd'),
            credito: [],
            contado: [],
            depositos: { bancario: 0, yape: 0, efectivo: 0 },
        }
    });

    const { fields: creditoFields } = useFieldArray({ control: form.control, name: 'credito' });
    const { fields: contadoFields } = useFieldArray({ control: form.control, name: 'contado' });

    const watchAll = form.watch();

    useEffect(() => {
        if (!comedorId) return;

        async function loadCatalogs() {
            const { data: precios } = await supabase.from('precios_servicios').select('*').eq('activo', true);

            if (precios && precios.length > 0) {
                const cred = precios.filter(p => ['ALMUERZO RANSA', 'CENA RANSA', 'AMANECIDA'].includes(p.nombre));
                const cont = precios.filter(p => !['ALMUERZO RANSA', 'CENA RANSA', 'AMANECIDA'].includes(p.nombre));

                form.setValue('credito', cred.map(p => ({ servicio: p.nombre, precio_unit: p.precio, cantidad: 0 })));
                form.setValue('contado', cont.map(p => ({ servicio: p.nombre, precio_unit: p.precio, cantidad: 0 })));
            }

            setDataLoaded(true);
        }
        loadCatalogs();
    }, [comedorId, supabase, form]);

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500">Cargando formulario...</div>;

    const totalCredito = watchAll.credito?.reduce((acc, curr) => acc + (curr.cantidad * curr.precio_unit), 0) || 0;
    const totalContado = watchAll.contado?.reduce((acc, curr) => acc + (curr.cantidad * curr.precio_unit), 0) || 0;
    const totalDepositos = Number(watchAll.depositos?.bancario || 0) + Number(watchAll.depositos?.yape || 0) + Number(watchAll.depositos?.efectivo || 0);
    const balance = (totalCredito + totalContado) - totalDepositos;

    async function onSubmit(data: DiarioForm) {
        if (!comedorId) return;
        setIsSubmitting(true);
        try {
            const liqInserts: any[] = [];
            data.credito.forEach(c => {
                if (c.cantidad > 0) {
                    liqInserts.push({
                        comedor_id: comedorId, fecha: data.fecha, servicio: c.servicio,
                        tipo_pago: 'CREDITO_RANSA', precio_unit: c.precio_unit, cantidad: c.cantidad
                    });
                }
            });
            data.contado.forEach(c => {
                if (c.cantidad > 0) {
                    liqInserts.push({
                        comedor_id: comedorId, fecha: data.fecha, servicio: c.servicio,
                        tipo_pago: 'CONTADO', precio_unit: c.precio_unit, cantidad: c.cantidad
                    });
                }
            });

            if (liqInserts.length > 0) {
                const { error: liqErr } = await supabase.from('liquidacion_diaria').upsert(liqInserts, { onConflict: 'comedor_id,fecha,servicio,tipo_pago' });
                if (liqErr) throw liqErr;
            }

            const depInserts = [];
            if (data.depositos.bancario > 0) depInserts.push({ comedor_id: comedorId, fecha: data.fecha, tipo: 'DEPOSITO', monto: data.depositos.bancario });
            if (data.depositos.yape > 0) depInserts.push({ comedor_id: comedorId, fecha: data.fecha, tipo: 'YAPE', monto: data.depositos.yape });
            if (data.depositos.efectivo > 0) depInserts.push({ comedor_id: comedorId, fecha: data.fecha, tipo: 'EFECTIVO', monto: data.depositos.efectivo });

            if (depInserts.length > 0) {
                const { error: depErr } = await supabase.from('depositos_diarios').upsert(depInserts, { onConflict: 'comedor_id,fecha,tipo' });
                if (depErr) throw depErr;
            }

            toast.success('Liquidación diaria guardada correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar la liquidación');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-32">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Liquidación Diaria</h2>
                <Input
                    type="date"
                    className="w-48"
                    {...form.register('fecha')}
                />
            </div>

            <Card>
                <CardHeader><CardTitle className="text-lg text-blue-700">Crédito Ransa</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Servicio</TableHead>
                                <TableHead>Precio (S/.)</TableHead>
                                <TableHead className="w-32">Cantidad</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {creditoFields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell className="font-medium">{field.servicio}</TableCell>
                                    <TableCell>{field.precio_unit.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Input
                                            type="number" min="0"
                                            {...form.register(`credito.${index}.cantidad`, { valueAsNumber: true })}
                                            disabled={isSubmitting}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                        S/. {(watchAll.credito?.[index]?.cantidad * field.precio_unit || 0).toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-lg text-emerald-700">Contado / Yape</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Servicio</TableHead>
                                <TableHead>Precio (S/.)</TableHead>
                                <TableHead className="w-32">Cantidad</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {contadoFields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell className="font-medium">{field.servicio}</TableCell>
                                    <TableCell>{field.precio_unit.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Input
                                            type="number" min="0"
                                            {...form.register(`contado.${index}.cantidad`, { valueAsNumber: true })}
                                            disabled={isSubmitting}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                        S/. {(watchAll.contado?.[index]?.cantidad * field.precio_unit || 0).toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-lg text-purple-700">Depósitos del Día</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Depósito Bancario</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-zinc-500">S/.</span>
                            <Input type="number" step="0.01" className="pl-8" {...form.register('depositos.bancario', { valueAsNumber: true })} />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Yape</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-zinc-500">S/.</span>
                            <Input type="number" step="0.01" className="pl-8" {...form.register('depositos.yape', { valueAsNumber: true })} />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Efectivo</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-zinc-500">S/.</span>
                            <Input type="number" step="0.01" className="pl-8" {...form.register('depositos.efectivo', { valueAsNumber: true })} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white dark:bg-zinc-950 border-t p-4 px-6 flex flex-col md:flex-row justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10 transition-all">
                <div className="flex gap-6 mb-4 md:mb-0 text-sm">
                    <div className="flex flex-col"><span className="text-zinc-500">T. Crédito</span><span className="font-bold text-lg text-blue-600">S/. {totalCredito.toFixed(2)}</span></div>
                    <div className="flex flex-col"><span className="text-zinc-500">T. Contado</span><span className="font-bold text-lg text-emerald-600">S/. {totalContado.toFixed(2)}</span></div>
                    <div className="flex flex-col"><span className="text-zinc-500">T. Depósitos</span><span className="font-bold text-lg text-purple-600">S/. {totalDepositos.toFixed(2)}</span></div>

                    <div className={`flex flex-col ${Math.abs(balance) > 1 ? 'text-amber-500' : 'text-zinc-800 dark:text-zinc-200'}`}>
                        <span className="text-zinc-500">Balance</span>
                        <span className="font-bold text-lg">S/. {balance.toFixed(2)}</span>
                        {Math.abs(balance) > 1 && <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Diferencia</span>}
                    </div>
                </div>

                <Button size="lg" type="submit" disabled={isSubmitting} className="w-full md:w-auto">
                    {isSubmitting ? 'Guardando...' : 'Guardar Liquidación'}
                </Button>
            </div>
        </form>
    )
}
