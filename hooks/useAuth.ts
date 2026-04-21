'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function useUser() {
    const [user, setUser] = useState<any>(null);
    const [rol, setRol] = useState<string | null>(null);
    const [comedorId, setComedorId] = useState<string | null>(null);
    const [comedorNombre, setComedorNombre] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        async function fetchUser() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setLoading(false);
                return;
            }

            setUser(session.user);

            const { data: userData } = await supabase
                .from('usuarios')
                .select('rol, comedor_id')
                .eq('id', session.user.id)
                .single();

            if (userData) {
                setRol(userData.rol);
                setComedorId(userData.comedor_id);
            }

            if (userData?.comedor_id) {
                const { data: comedorData } = await supabase.from('comedores').select('nombre').eq('id', userData.comedor_id).single();
                if (comedorData) setComedorNombre(comedorData.nombre);
            }

            setLoading(false);
        }

        fetchUser();
    }, [supabase]);

    return { user, rol, comedorId, comedorNombre, loading };
}

export function useRequireRole(requiredRole: string) {
    const { rol, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        // ADMIN accepts both ADMIN and SUPERVISOR (supervisor tiene acceso al admin en modo lectura)
        const matches = rol === requiredRole ||
            (requiredRole === 'ADMIN' && rol === 'SUPERVISOR');
        if (!matches) {
            if (rol === 'ADMIN' || rol === 'SUPERVISOR') router.push('/admin/dashboard');
            else if (rol === 'COMEDOR') router.push('/portal/dashboard');
            else router.push('/login');
        }
    }, [rol, loading, requiredRole, router]);

    return { loading };
}
