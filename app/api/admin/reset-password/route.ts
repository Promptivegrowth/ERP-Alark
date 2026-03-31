import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1eXFqaHBpc2tva2h0dXVxbHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM4Mzc2OSwiZXhwIjoyMDg5OTU5NzY5fQ.4vZogebrvPbkdO5AIgkeJaS2ForGLUWpRy4Z7k4QjZM';
const SUPABASE_URL = 'https://zuyqjhpiskokhtuuqltu.supabase.co';

export async function POST(req: Request) {
    try {
        const { userId, newPassword } = await req.json();

        if (!userId || !newPassword) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
        }

        if (newPassword.length < 8) {
            return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
        }

        // Usamos el cliente de admin con service_role_key
        const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: newPassword
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, email: data.user.email });
    } catch (error: any) {
        console.error('Error en admin password reset:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
