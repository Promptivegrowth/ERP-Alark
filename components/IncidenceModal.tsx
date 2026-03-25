'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function IncidenceModal() {
    const { comedorId } = useUser();
    const supabase = createClient();
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, handleSubmit, reset } = useForm({
        defaultValues: { tipo: 'EQUIPAMIENTO', descripcion: '' }
    });

    async function onSubmit(data: any) {
        if (!comedorId) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('incidencias').insert({
                comedor_id: String(comedorId),
                tipo: data.tipo,
                descripcion: data.descripcion,
                estado: 'ABIERTA'
            } as any);

            if (error) throw error;
            toast.success('Incidencia reportada con éxito');
            setOpen(false);
            reset();
        } catch (e) {
            console.error(e);
            toast.error('Error al reportar la incidencia');
        } finally {
            setIsSubmitting(false);
        }
    }

    // Si no está cargado el comedorId, no renderizamos el botón
    if (!comedorId) return null;

    return (
        <>
            <Button
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-amber-500 hover:bg-amber-600 text-white z-50 transition-transform hover:scale-105"
                size="icon"
                title="Reportar Incidencia"
                onClick={() => setOpen(true)}
            >
                <AlertTriangle size={28} />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-amber-600 flex items-center gap-2">
                            <AlertTriangle /> Reportar Incidencia Urgente
                        </DialogTitle>
                        <DialogDescription>
                            Registra problemas de equipamiento, personal u otros para que Administración lo gestione de inmediato.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tipo de Incidencia</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                {...register('tipo')}
                                required
                            >
                                <option value="EQUIPAMIENTO">Equipamiento / Máquinas</option>
                                <option value="PERSONAL">Falta de Personal</option>
                                <option value="INSUMOS">Falta de Insumos / Calidad</option>
                                <option value="SISTEMA">Falla en el Sistema/Internet</option>
                                <option value="OTRO">Otros / Especiales</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Descripción Detallada</label>
                            <Textarea
                                placeholder="Ej. La congeladora principal no está enfriando correctamente..."
                                className="min-h-[120px] resize-none"
                                {...register('descripcion')}
                                required
                            />
                        </div>
                        <div className="pt-4 flex justify-end space-x-3">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-amber-500 hover:bg-amber-600 text-white font-semibold">
                                {isSubmitting ? 'Enviando...' : 'Reportar ahora'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
