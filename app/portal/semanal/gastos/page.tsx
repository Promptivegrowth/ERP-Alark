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

const gastosSchema = z.object({
    gastos: z.array(z.object({
        fecha: z.string().min(1, 'Requerido'),
        num_documento: z.string().min(1, 'Requerido'),
        proveedor: z.string().min(1, 'Requerido'),
        monto: z.number().min(0.01, 'Mínimo S/ 0.01'),
        observacion: z.string().optional()
    })).min(1, 'Agrega al menos un gasto')
});

type GastosForm = z.infer<typeof gastosSchema>;

export default function GastosPage() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<GastosForm>({
        resolver: zodResolver(gastosSchema),
        defaultValues: {
            gastos: [{
                fecha: new Date().toISOString().split('T')[0],
                num_documento: '',
                proveedor: '',
                monto: 0,
                observacion: ''
            }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'gastos'
    });

    const watchAll = form.watch();
    const totalGastos = watchAll.gastos?.reduce((acc, curr) => acc + (curr.monto || 0), 0) || 0;

    if (loading) return null;

    async function onSubmit(data: GastosForm) {
        if (!comedorId) return;
        setIsSubmitting(true);
        try {
            const inserts = data.gastos.map(g => ({
                comedor_id: comedorId,
                fecha: g.fecha,
                num_documento: g.num_documento,
                proveedor: g.proveedor,
                monto: g.monto,
                observacion: g.observacion || null
            }));

            const { error } = await supabase.from('gastos').insert(inserts);

            if (error) throw error;
            toast.success('Gastos registrados correctamente');

            // Reset after success
            form.reset({
                gastos: [{
                    fecha: new Date().toISOString().split('T')[0],
                    num_documento: '',
                    proveedor: '',
                    monto: 0,
                    observacion: ''
                }]
            });
        } catch (error) {
            console.error(error);
            toast.error('Error al registrar los gastos');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Registro de Gastos Parciales</h2>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Gastos de Caja Chica / Efectivo</CardTitle>
                            <CardDescription>Añade los tickets, boletas y facturas pagadas esta semana.</CardDescription>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => append({
                                fecha: new Date().toISOString().split('T')[0],
                                num_documento: '', proveedor: '', monto: 0, observacion: ''
                            })}
                            className="flex items-center gap-2"
                        >
                            <Plus size={16} /> Agregar Gasto
                        </Button>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <Table className="min-w-[800px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-40">Fecha</TableHead>
                                    <TableHead className="w-48">N° Documento</TableHead>
                                    <TableHead>Proveedor / Concepto</TableHead>
                                    <TableHead className="w-40">Monto (S/.)</TableHead>
                                    <TableHead>Observación</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, idx) => (
                                    <TableRow key={field.id}>
                                        <TableCell>
                                            <Input type="date" {...form.register(`gastos.${idx}.fecha`)} required />
                                        </TableCell>
                                        <TableCell>
                                            <Input placeholder="B001-443" {...form.register(`gastos.${idx}.num_documento`)} required />
                                        </TableCell>
                                        <TableCell>
                                            <Input placeholder="Comercial XYZ" {...form.register(`gastos.${idx}.proveedor`)} required />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" step="0.01" min="0" {...form.register(`gastos.${idx}.monto`, { valueAsNumber: true })} required />
                                        </TableCell>
                                        <TableCell>
                                            <Input placeholder="Opcional..." {...form.register(`gastos.${idx}.observacion`)} />
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
                                    <TableCell colSpan={3} className="text-right font-semibold">Total Gastos:</TableCell>
                                    <TableCell className="font-bold text-lg text-emerald-600">S/. {totalGastos.toFixed(2)}</TableCell>
                                    <TableCell colSpan={2}></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white dark:bg-zinc-950 border-t p-4 px-6 flex justify-end shadow-md z-10 text-sm">
                    <Button size="lg" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Guardando...' : 'Guardar Registros de Gasto'}
                    </Button>
                </div>
            </form>
        </div>
    )
}
