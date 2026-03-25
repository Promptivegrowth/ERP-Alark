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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const especialesSchema = z.object({
    servicios: z.array(z.object({
        fecha: z.string().min(1, 'Requerido'),
        solicitante: z.string().min(1, 'Requerido'),
        tipo: z.string().min(1, 'Requerido'),
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
            servicios: [{
                fecha: new Date().toISOString().split('T')[0],
                solicitante: '',
                tipo: 'COFFE BREAK',
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
            const inserts = data.servicios.map(s => ({
                comedor_id: comedorId,
                fecha: s.fecha,
                solicitante: s.solicitante,
                tipo: s.tipo,
                descripcion: s.descripcion,
                cantidad: s.cantidad,
                precio_unit: s.precio_unit,
                observacion: s.observacion || null
            }));

            const { error } = await supabase.from('especial_servicios').insert(inserts);

            if (error) throw error;
            toast.success('Servicios especiales guardados correctamente');

            form.reset({
                servicios: [{
                    fecha: new Date().toISOString().split('T')[0],
                    solicitante: '', tipo: 'COFFE BREAK', descripcion: '', cantidad: 1, precio_unit: 0, observacion: ''
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
                            <CardDescription>Añade servicios que no corresponden al flujo diario normal (Cumpleaños, atenciones especiales).</CardDescription>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({
                                fecha: new Date().toISOString().split('T')[0],
                                solicitante: '', tipo: 'COFFE BREAK', descripcion: '', cantidad: 1, precio_unit: 0, observacion: ''
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
                                    <TableHead className="w-[150px]">Observación</TableHead>
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
                                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                {...form.register(`servicios.${idx}.tipo`)}
                                                required
                                            >
                                                <option value="COFFE BREAK">Coffe Break</option>
                                                <option value="CUMPLEANOS">Cumpleaños</option>
                                                <option value="REFRIGERIO">Refrigerio</option>
                                                <option value="STAG">STAG / Staff</option>
                                                <option value="SOPORTE">Soporte</option>
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
                                            <Input placeholder="Opcional..." {...form.register(`servicios.${idx}.observacion`)} />
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
                                    <TableCell colSpan={2}></TableCell>
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
    )
}
