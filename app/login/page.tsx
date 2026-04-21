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
import { Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
    email: z.string().email('Ingresa un correo válido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
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

            const userRol = (userData as any).rol;
            if (userRol === 'ADMIN' || userRol === 'SUPERVISOR') {
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
        <div className="flex h-screen w-full overflow-hidden bg-zinc-50">
            {/* Left side - Branding (hidden on mobile) */}
            <div className="hidden lg:flex w-7/12 bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] flex-col justify-center items-center text-white p-16 relative overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-400/10 rounded-full -ml-48 -mb-48 blur-3xl" />

                <div className="max-w-xl text-center relative z-10">
                    <div className="inline-block p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 mb-8 shadow-2xl">
                        <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-[#1B4332] text-4xl font-black">AM</span>
                        </div>
                    </div>
                    <h1 className="text-6xl font-black mb-6 tracking-tighter leading-tight drop-shadow-sm uppercase">
                        Plataforma <br /> <span className="text-emerald-300">Auditoría Almark Peru</span>
                    </h1>
                    <div className="h-1.5 w-24 bg-emerald-400 mx-auto rounded-full mb-8 shadow-sm" />
                    <p className="text-xl text-emerald-50/80 font-bold max-w-sm mx-auto leading-relaxed italic">
                        "Excelencia operativa y transparencia en la gestión de comedores industriales."
                    </p>
                </div>
            </div>

            {/* Right side - Login Form */}
            <div className="flex w-full lg:w-5/12 justify-center items-center p-6 md:p-12">
                <Card className="w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-zinc-200 dark:border-zinc-800 glass overflow-hidden rounded-3xl border-2">
                    <div className="h-2 bg-gradient-to-r from-emerald-500 to-emerald-700" />
                    <CardHeader className="space-y-4 text-center pt-10 px-8">
                        <div className="lg:hidden mb-4">
                            <div className="w-12 h-12 bg-[#1B4332] rounded-xl flex items-center justify-center shadow-lg mx-auto mb-2">
                                <span className="text-white text-2xl font-black">AM</span>
                            </div>
                            <h2 className="text-2xl font-black text-zinc-800 tracking-tighter uppercase">
                                Auditoría Almark Peru
                            </h2>
                        </div>
                        <CardTitle className="text-3xl font-black text-zinc-800 tracking-tight">Iniciar Sesión</CardTitle>
                        <CardDescription className="text-zinc-500 font-medium">
                            Ingresa tus credenciales para acceder al portal seguro de gestión.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-10">
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[12px] font-black text-zinc-400 uppercase tracking-widest pl-1">Correo Electrónico</label>
                                <Input
                                    placeholder="ejemplo@almarkperu.com"
                                    className="h-12 bg-zinc-50 border-zinc-200 rounded-xl px-4 font-medium transition-all focus:ring-emerald-500 focus:border-emerald-500"
                                    disabled={isLoading}
                                    {...form.register('email')}
                                />
                                {form.formState.errors.email && (
                                    <p className="text-xs font-bold text-rose-500 pl-1">{form.formState.errors.email.message}</p>
                                )}
                            </div>
                            <div className="space-y-1.5 pt-1">
                                <label className="text-[12px] font-black text-zinc-400 uppercase tracking-widest pl-1">Contraseña</label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        className="h-12 bg-zinc-50 border-zinc-200 rounded-xl px-4 pr-12 font-medium transition-all focus:ring-emerald-500 focus:border-emerald-500"
                                        disabled={isLoading}
                                        {...form.register('password')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-emerald-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                {form.formState.errors.password && (
                                    <p className="text-xs font-bold text-rose-500 pl-1">{form.formState.errors.password.message}</p>
                                )}
                            </div>
                            <Button
                                className="w-full h-14 mt-8 bg-[#1B4332] hover:bg-[#0D1F17] text-white font-black text-lg rounded-2xl shadow-xl shadow-emerald-900/10 transition-all active:scale-[0.98]"
                                type="submit"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>VERIFICANDO...</span>
                                    </div>
                                ) : 'ENTRAR AL PORTAL'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
