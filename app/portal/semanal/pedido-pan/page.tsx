'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const pedidoPanSchema = z.object({
    semana: z.string(),
    lunes: z.number().min(0),
    martes: z.number().min(0),
    miercoles: z.number().min(0),
    jueves: z.number().min(0),
    viernes: z.number().min(0),
    sabado: z.number().min(0),
    domingo: z.number().min(0),
});

type PedidoPanForm = z.infer<typeof pedidoPanSchema>;

export default function PedidoPanPage() {
    const { comedorId, loading } = useUser();
    const supabase = createClient();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<PedidoPanForm>({
        resolver: zodResolver(pedidoPanSchema),
        defaultValues: {
            semana: new Date().toISOString().split('T')[0],
            lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0, sabado: 0, domingo: 0
        }
    });

    const watchAll = form.watch();
    const sumaSemanal = watchAll.lunes + watchAll.martes + watchAll.miercoles + watchAll.jueves + watchAll.viernes + watchAll.sabado + watchAll.domingo;

    if (loading) return null;

    async function onSubmit(data: PedidoPanForm) {
        if (!comedorId) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('pedido_pan').upsert({
                comedor_id: comedorId,
                semana_inicio: data.semana,
                lunes: data.lunes,
                martes: data.martes,
                miercoles: data.miercoles,
                jueves: data.jueves,
                viernes: data.viernes,
                sabado: data.sabado,
                domingo: data.domingo,
                total: sumaSemanal
            }, { onConflict: 'comedor_id,semana_inicio' });

            if (error) throw error;
            toast.success('Pedido de pan guardado correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar el pedido de pan');
        } finally {
            setIsSubmitting(false);
        }
    }

    const days = [
        { key: 'lunes', label: 'Lunes' },
        { key: 'martes', label: 'Martes' },
        { key: 'miercoles', label: 'Miércoles' },
        { key: 'jueves', label: 'Jueves' },
        { key: 'viernes', label: 'Viernes' },
        { key: 'sabado', label: 'Sábado' },
        { key: 'domingo', label: 'Domingo' }
    ];

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Pedido de Pan</h2>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Programación Semanal</CardTitle>
                        <CardDescription>Ingresa la cantidad de piezas de pan necesarias por día.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col space-y-2">
                            <label className="text-sm font-medium">Semana de inicio (Lunes)</label>
                            <Input type="date" className="w-48" {...form.register('semana')} required />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
                            {days.map(d => (
                                <div key={d.key} className="space-y-2">
                                    <label className="text-sm font-medium">{d.label}</label>
                                    <Input type="number" min="0" {...form.register(d.key as any, { valueAsNumber: true })} />
                                </div>
                            ))}
                        </div>

                        <div className="pt-6 border-t mt-6 flex justify-between items-center">
                            <div>
                                <span className="text-zinc-500 font-medium">Total de bolsas/unidades a pedir:</span>
                                <span className="ml-4 text-3xl font-bold text-amber-600">{sumaSemanal || 0}</span>
                            </div>
                            <Button type="submit" disabled={isSubmitting} size="lg">
                                {isSubmitting ? 'Guardando...' : 'Confirmar Semanal'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    )
}
