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
    const sumaSemanal = (watchAll.lunes || 0) + (watchAll.martes || 0) + (watchAll.miercoles || 0) + (watchAll.jueves || 0) + (watchAll.viernes || 0) + (watchAll.sabado || 0) + (watchAll.domingo || 0);

    if (loading) return null;

    async function onSubmit(data: PedidoPanForm) {
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

            // 2. Map days to records
            const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
            const inserts = days.map((day, idx) => {
                const date = new Date(weekStart);
                date.setDate(date.getDate() + idx);
                const qty = (data as any)[day] || 0;

                return {
                    semana_id: semanaId,
                    comedor_id: comedorId,
                    fecha: date.toISOString().split('T')[0],
                    producto: 'PAN', // Standard for this form
                    cantidad_pedido: qty
                };
            });

            const { error } = await supabase.from('pedido_pan').upsert(inserts as any, { onConflict: 'semana_id, fecha, producto' });

            if (error) throw error;
            toast.success('Pedido de pan guardado correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar el pedido de pan');
        } finally {
            setIsSubmitting(false);
        }
    }

    const daysList = [
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
                            {daysList.map(d => (
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
    );
}
