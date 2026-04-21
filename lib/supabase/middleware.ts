import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const url = request.nextUrl.clone();
    const isPortal = url.pathname.startsWith('/portal');
    const isAdmin = url.pathname.startsWith('/admin');
    const isLogin = url.pathname.startsWith('/login');
    const isRoot = url.pathname === '/';

    if (!user && (isPortal || isAdmin || isRoot)) {
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    if (user) {
        // Get user role
        const { data: userData } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', user.id)
            .single();

        const role = userData?.rol;

        const isAdminSide = role === 'ADMIN' || role === 'SUPERVISOR';

        if (isLogin || isRoot) {
            url.pathname = isAdminSide ? '/admin/dashboard' : '/portal/dashboard';
            return NextResponse.redirect(url);
        }

        if (isPortal && role !== 'COMEDOR') {
            url.pathname = '/admin/dashboard';
            return NextResponse.redirect(url);
        }

        if (isAdmin && !isAdminSide) {
            url.pathname = '/portal/dashboard';
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}
