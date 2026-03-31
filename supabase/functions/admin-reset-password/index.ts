import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    // Verify caller is an admin
    const callerClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return new Response('Unauthorized', { status: 401 });

    const { data: profile } = await callerClient.from('usuarios').select('rol').eq('id', caller.id).single();
    if (!profile || profile.rol !== 'ADMIN') {
        return new Response(JSON.stringify({ error: 'Solo administradores pueden cambiar contraseñas' }), {
            status: 403, headers: { 'Content-Type': 'application/json' }
        });
    }

    const { user_id, new_password } = await req.json();
    if (!user_id || !new_password) {
        return new Response(JSON.stringify({ error: 'user_id y new_password son requeridos' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }
    if (new_password.length < 8) {
        return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    // Update password using service role
    const adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, email: data.user?.email }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
    });
});
