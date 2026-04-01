'use server'

import { createAdminClient } from '@/lib/supabase/admin';

export async function cancelarSolicitudEmergencia(id: string) {
    if (!id) return { success: false, error: 'ID de solicitud no proporcionado' };

    console.log('Server Action: Cancelando solicitud', id);
    const supabase = createAdminClient();

    try {
        const { error, data } = await supabase
            .from('reporte_diario_solicitudes')
            .delete()
            .eq('id', id)
            .select();

        if (error) {
            console.error('Error en Server Action delete:', error);
            return { success: false, error: error.message };
        }

        if (!data || data.length === 0) {
            console.warn('No se encontró la solicitud para borrar en el servidor', id);
            return { success: false, error: 'La solicitud no existe o ya fue borrada' };
        }

        return { success: true };
    } catch (err) {
        console.error('Excepción en Server Action:', err);
        return { success: false, error: 'Error interno del servidor' };
    }
}
