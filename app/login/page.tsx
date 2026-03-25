'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const loginSchema = z.object({
    email: z.string().email('Ingresa un correo válido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    async function onSubmit(data: LoginFormValues) {
        setIsLoading(true);

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            });

            if (authError || !authData.user) {
                toast.error('Credenciales incorrectas');
                setIsLoading(false);
                return;
            }

            // Check role
            const { data: userData, error: userError } = await supabase
                .from('usuarios')
                .select('rol')
                .eq('id', authData.user.id)
                .single();

            if (userError || !userData) {
                toast.error('Error al obtener el rol del usuario');
                setIsLoading(false);
                return;
            }

            toast.success('Acceso exitoso');

            if ((userData as any).rol === 'ADMIN') {
                router.push('/admin/dashboard');
            } else {
                router.push('/portal/dashboard');
            }
        } catch (e) {
            toast.error('Ocurrió un error inesperado');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="flex h-screen w-full">
            {/* Left side - Branding (hidden on mobile) */}
            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#1A56DB] to-[#5850EC] flex-col justify-center items-center text-white p-12">
                <div className="max-w-md text-center">
                    <h1 className="text-5xl font-extrabold mb-4 tracking-tight">Comedores Platform</h1>
                    <p className="text-xl text-blue-100 font-medium">Gestión centralizada de comedores industriales</p>
                </div>
            </div>

            {/* Right side - Login Form */}
            <div className="flex w-full lg:w-1/2 justify-center items-center bg-zinc-50 dark:bg-zinc-950 p-6">
                <Card className="w-full max-w-md shadow-lg border-zinc-200 dark:border-zinc-800">
                    <CardHeader className="space-y-1 text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 lg:hidden mb-2">
                            Comedores Platform
                        </h2>
                        <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
                        <CardDescription>
                            Ingresa tus credenciales para acceder a tu portal
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Correo Electrónico</label>
                                <Input placeholder="usuario@empresa.com" disabled={isLoading} {...form.register('email')} />
                                {form.formState.errors.email && (
                                    <p className="text-sm font-medium text-red-500">{form.formState.errors.email.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Contraseña</label>
                                <Input type="password" placeholder="••••••••" disabled={isLoading} {...form.register('password')} />
                                {form.formState.errors.password && (
                                    <p className="text-sm font-medium text-red-500">{form.formState.errors.password.message}</p>
                                )}
                            </div>
                            <Button className="w-full mt-6" type="submit" disabled={isLoading}>
                                {isLoading ? 'Verificando...' : 'Ingresar'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
