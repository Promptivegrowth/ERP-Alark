'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

const especialesSchema = z.object({
    semana: z.string().min(1, 'Requerido'),
    servicios: z.array(z.object({
        fecha: z.string().min(1, 'Requerido'),
        solicitante: z.string().min(1, 'Requerido'),
        tipo: z.enum(['CUMPLEAÑOS', 'COFFE_BREAK', 'EVENTO_CORPORATIVO', 'SPORADE_STAG', 'OTRO']),
        descripcion: z.string().min(1, 'Requerido'),
        cantidad: z.number().min(1, 'Min 1'),
        precio_unit: z.number().min(0, 'Mínimo S/ 0'),
        observacion: z.string().optional()
    })).min(1)
});

type EspecialesForm = z.infer<typeof especialesSchema>;

export default function CoffeOtrosPage() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<EspecialesForm>({
        resolver: zodResolver(especialesSchema),
        defaultValues: {
            semana: new Date().toISOString().split('T')[0],
            servicios: [{
                fecha: new Date().toISOString().split('T')[0],
                solicitante: '',
                tipo: 'COFFE_BREAK',
                descripcion: '',
                cantidad: 1,
                precio_unit: 0,
                observacion: ''
            }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'servicios'
    });

    const watchAll = form.watch();
    const totalMonto = watchAll.servicios?.reduce((acc, curr) => acc + ((curr.cantidad || 0) * (curr.precio_unit || 0)), 0) || 0;

    if (loading) return null;

    async function onSubmit(data: EspecialesForm) {
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

            // 2. Prepare inserts
            const inserts = data.servicios.map(s => ({
                semana_id: semanaId,
                comedor_id: comedorId,
                fecha: s.fecha,
                solicitado_por: s.solicitante,
                tipo: s.tipo,
                descripcion: s.descripcion,
                cantidad: s.cantidad,
                valor_unit: s.precio_unit,
                total: s.cantidad * s.precio_unit
            }));

            const { error } = await supabase.from('coffe_otros').insert(inserts as any);

            if (error) throw error;
            toast.success('Servicios especiales guardados correctamente');

            form.reset({
                semana: data.semana,
                servicios: [{
                    fecha: new Date().toISOString().split('T')[0],
                    solicitante: '', tipo: 'COFFE_BREAK', descripcion: '', cantidad: 1, precio_unit: 0, observacion: ''
                }]
            });
        } catch (error) {
            console.error(error);
            toast.error('Error al registrar servicios especiales');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="mx-auto space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Servicios Especiales (Coffe / Staff)</h2>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Registro de Servicios Extra</CardTitle>
                            <CardDescription>Añade servicios que no corresponden al flujo diario normal.</CardDescription>
                            <div className="mt-4 flex items-center gap-4">
                                <label className="text-sm font-medium">Semana:</label>
                                <Input type="date" className="w-48" {...form.register('semana')} required />
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({
                                fecha: new Date().toISOString().split('T')[0],
                                solicitante: '', tipo: 'COFFE_BREAK', descripcion: '', cantidad: 1, precio_unit: 0, observacion: ''
                            })}
                            className="flex items-center gap-2"
                        >
                            <Plus size={16} /> Agregar Servicio
                        </Button>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <Table className="min-w-[1000px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-40">Fecha</TableHead>
                                    <TableHead className="w-40">Solicitante</TableHead>
                                    <TableHead className="w-40">Tipo</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="w-24">Cant.</TableHead>
                                    <TableHead className="w-32">Prec. Unit (S/.)</TableHead>
                                    <TableHead className="w-32">Total</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, idx) => (
                                    <TableRow key={field.id}>
                                        <TableCell>
                                            <Input type="date" {...form.register(`servicios.${idx}.fecha`)} required />
                                        </TableCell>
                                        <TableCell>
                                            <Input placeholder="Empresa/Persona" {...form.register(`servicios.${idx}.solicitante`)} required />
                                        </TableCell>
                                        <TableCell>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300"
                                                {...form.register(`servicios.${idx}.tipo`)}
                                                required
                                            >
                                                <option value="COFFE_BREAK">Coffe Break</option>
                                                <option value="CUMPLEANOS">Cumpleaños</option>
                                                <option value="EVENTO_CORPORATIVO">Evento Corp.</option>
                                                <option value="SPORADE_STAG">Staff / Stag</option>
                                                <option value="OTRO">Otro</option>
                                            </select>
                                        </TableCell>
                                        <TableCell>
                                            <Input placeholder="Detalle..." {...form.register(`servicios.${idx}.descripcion`)} required />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" min="1" {...form.register(`servicios.${idx}.cantidad`, { valueAsNumber: true })} required />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" step="0.01" min="0" {...form.register(`servicios.${idx}.precio_unit`, { valueAsNumber: true })} required />
                                        </TableCell>
                                        <TableCell className="font-semibold bg-zinc-50 dark:bg-zinc-900">
                                            S/. {((watchAll.servicios?.[idx]?.cantidad || 0) * (watchAll.servicios?.[idx]?.precio_unit || 0)).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => remove(idx)}
                                                disabled={fields.length === 1}
                                            >
                                                <Trash2 size={18} />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell colSpan={6} className="text-right font-semibold">Gran Total:</TableCell>
                                    <TableCell className="font-bold text-lg text-emerald-600">S/. {totalMonto.toFixed(2)}</TableCell>
                                    <TableCell colSpan={1}></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white dark:bg-zinc-950 border-t p-4 px-6 flex justify-end shadow-md z-10 text-sm">
                    <Button size="lg" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Guardando...' : 'Guardar Servicios Extra'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
