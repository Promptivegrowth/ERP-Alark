'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface KardexRow {
    producto_id: string;
    nombre: string;
    ingreso_semanal: number;
    stock_anterior: number;
    ventas_credito: number;
    ventas_contado: number;
    stock_fisico: number;
    observacion: string;
}

interface KardexForm {
    semana: string;
    items: KardexRow[];
}

export default function KardexPastelesPage() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);

    const form = useForm<KardexForm>({
        defaultValues: {
            semana: new Date().toISOString().split('T')[0],
            items: []
        }
    });

    const { fields } = useFieldArray({ control: form.control, name: 'items' });
    const watchAll = form.watch();

    useEffect(() => {
        if (!comedorId) return;

        async function loadProducts() {
            const { data: pasteles } = await supabase
                .from('kardex_productos')
                .select('*')
                .eq('categoria', 'PASTEL')
                .eq('activo', true)
                .order('nombre');

            if (pasteles) {
                form.setValue('items', (pasteles as any[]).map(s => ({
                    producto_id: s.id,
                    nombre: s.nombre,
                    ingreso_semanal: 0,
                    stock_anterior: 0,
                    ventas_credito: 0,
                    ventas_contado: 0,
                    stock_fisico: 0,
                    observacion: ''
                })));
            }
            setDataLoaded(true);
        }
        loadProducts();
    }, [comedorId, supabase, form]);

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500">Cargando Kardex...</div>;

    async function onSubmit(data: KardexForm) {
        if (!comedorId) return;
        setIsSubmitting(true);
        try {
            // 1. Ensure semana exists
            let semanaId;
            const weekStart = new Date(data.semana);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            const { data: semData, error: semErr } = await supabase
                .from('semanas')
                .select('id')
                .eq('comedor_id', comedorId)
                .eq('fecha_inicio', weekStart.toISOString().split('T')[0])
                .single();

            if (semErr && semErr.code !== 'PGRST116') throw semErr;

            if (semData) {
                semanaId = semData.id;
            } else {
                const { data: newSem, error: insErr } = await supabase
                    .from('semanas')
                    .insert({
                        comedor_id: comedorId,
                        fecha_inicio: weekStart.toISOString().split('T')[0],
                        fecha_fin: weekEnd.toISOString().split('T')[0]
                    } as any)
                    .select()
                    .single();
                if (insErr) throw insErr;
                semanaId = newSem.id;
            }

            // 2. Prepare inserts for pasteles
            const inserts = data.items.map(item => {
                return {
                    semana_id: semanaId,
                    comedor_id: comedorId,
                    producto_id: item.producto_id,
                    stock_inicial_qty: item.stock_anterior,
                    pedido_qty: item.ingreso_semanal,
                    venta_credito_yapes: item.ventas_credito,
                    venta_contado: item.ventas_contado,
                    merma: 0,
                    stock_final_valor: 0
                };
            });

            const { error } = await supabase.from('kardex_pasteles').upsert(inserts as any, { onConflict: 'semana_id, producto_id' });
            if (error) throw error;

            toast.success('Kardex de pasteles guardado correctamente');
        } catch (e) {
            console.error(e);
            toast.error('Error al guardar el Kardex');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Kardex de Pasteles</h2>
                <Input
                    type="date"
                    className="w-48"
                    {...form.register('semana')}
                    required
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Control de Inventario - Pastelería</CardTitle>
                    <CardDescription>Completa el stock y las ventas de la semana para cuadrar el inventario.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Producto</TableHead>
                                <TableHead>Ingreso Sem.</TableHead>
                                <TableHead>Stock Anterior</TableHead>
                                <TableHead className="bg-zinc-50 font-semibold dark:bg-zinc-900">Saldo</TableHead>
                                <TableHead>Ventas Crédito</TableHead>
                                <TableHead>Ventas Contado</TableHead>
                                <TableHead className="bg-zinc-50 font-semibold dark:bg-zinc-900">T. Ventas</TableHead>
                                <TableHead>Stock Físico</TableHead>
                                <TableHead>Diferencia</TableHead>
                                <TableHead className="w-[200px]">Observación</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, idx) => {
                                const row = watchAll.items?.[idx];
                                const ingreso = row?.ingreso_semanal || 0;
                                const anterior = row?.stock_anterior || 0;
                                const saldo = ingreso + anterior;

                                const credito = row?.ventas_credito || 0;
                                const contado = row?.ventas_contado || 0;
                                const tVentas = credito + contado;

                                const fisico = row?.stock_fisico || 0;
                                const diferencia = fisico - (saldo - tVentas);

                                return (
                                    <TableRow key={field.id}>
                                        <TableCell className="font-medium text-xs">{field.nombre}</TableCell>
                                        <TableCell><Input type="number" min="0" className="w-20" {...form.register(`items.${idx}.ingreso_semanal`, { valueAsNumber: true })} /></TableCell>
                                        <TableCell><Input type="number" min="0" className="w-20" {...form.register(`items.${idx}.stock_anterior`, { valueAsNumber: true })} /></TableCell>
                                        <TableCell className="bg-zinc-50 dark:bg-zinc-900 font-bold">{saldo}</TableCell>
                                        <TableCell><Input type="number" min="0" className="w-20" {...form.register(`items.${idx}.ventas_credito`, { valueAsNumber: true })} /></TableCell>
                                        <TableCell><Input type="number" min="0" className="w-20" {...form.register(`items.${idx}.ventas_contado`, { valueAsNumber: true })} /></TableCell>
                                        <TableCell className="bg-zinc-50 dark:bg-zinc-900 font-bold text-blue-600">{tVentas}</TableCell>
                                        <TableCell><Input type="number" min="0" className="w-20 border-emerald-500" {...form.register(`items.${idx}.stock_fisico`, { valueAsNumber: true })} /></TableCell>
                                        <TableCell>
                                            <div className={`font-bold px-2 py-1 rounded inline-flex ${diferencia < 0 ? 'bg-red-100 text-red-700' : diferencia > 0 ? 'bg-amber-100 text-amber-700' : 'text-emerald-700'}`}>
                                                {diferencia}
                                            </div>
                                        </TableCell>
                                        <TableCell><Input placeholder="Opcional..." {...form.register(`items.${idx}.observacion`)} /></TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white dark:bg-zinc-950 border-t p-4 px-6 flex justify-end shadow-md z-10 text-sm">
                <Button size="lg" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando...' : 'Guardar Kardex de Pasteles'}
                </Button>
            </div>
        </form>
    );
}
