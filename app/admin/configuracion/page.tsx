'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Plus, Store, Users, Key } from 'lucide-react';

export default function ConfiguracionPage() {
    const { loading } = useUser();
    const supabase = createClient();
    const [dataLoaded, setDataLoaded] = useState(false);

    const [comedores, setComedores] = useState<any[]>([]);
    const [usuarios, setUsuarios] = useState<any[]>([]);

    // Comedor Form
    const [newComedor, setNewComedor] = useState({ nombre: '', cliente: '', responsable: '' });
    const [isSubmittingC, setIsSubmittingC] = useState(false);

    // User Form
    const [newUser, setNewUser] = useState({ email: '', rol: 'COMEDOR', comedor_id: 'none' });
    const [isSubmittingU, setIsSubmittingU] = useState(false);

    async function loadData() {
        const [cRes, uRes] = await Promise.all([
            supabase.from('comedores').select('*').order('nombre'),
            supabase.from('usuarios').select('*, comedores(nombre)').order('created_at', { ascending: false })
        ]);

        if (cRes.data) setComedores(cRes.data);
        if (uRes.data) setUsuarios(uRes.data);
        setDataLoaded(true);
    }

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [supabase]);

    async function crearComedor(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmittingC(true);
        try {
            // Mock logic: we will generate a simple ID if there is no default trigger 
            // but Supabase might fail depending on specific schema constraints.
            // Assuming table accepts basic inserts.
            const { error } = await supabase.from('comedores').insert({
                nombre: newComedor.nombre.toUpperCase(),
                cliente_empresa: newComedor.cliente.toUpperCase(),
                responsable: newComedor.responsable.toUpperCase(),
                activo: true,
                codigo: `CMD-${Math.floor(Math.random() * 10000)}`
            } as any);

            if (error) throw error;
            toast.success('Comedor registrado exitosamente');
            setNewComedor({ nombre: '', cliente: '', responsable: '' });
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('Error al crear el comedor (verifica las constraints de BD)');
        } finally {
            setIsSubmittingC(false);
        }
    }

    async function crearUsuario(e: React.FormEvent) {
        e.preventDefault();
        if (newUser.rol === 'COMEDOR' && newUser.comedor_id === 'none') {
            toast.error('Debes seleccionar un comedor para el rol COMEDOR');
            return;
        }

        setIsSubmittingU(true);
        try {
            // En Supabase la creación real de Auth requiere auth.signUp()
            // Esto solo registrará el perfil para vincular el rol.
            // Para este demo/ERP, asumiremos que se pre-creará el registro para el match.
            const { error } = await supabase.from('usuarios').insert({
                id: crypto.randomUUID(), // Mock pseudo uuid
                email: newUser.email,
                rol: newUser.rol,
                comedor_id: newUser.rol === 'ADMIN' ? null : newUser.comedor_id
            } as any);

            if (error) throw error;
            toast.success('Perfil de usuario registrado');
            setNewUser({ email: '', rol: 'COMEDOR', comedor_id: 'none' });
            loadData();
        } catch (err) {
            console.error(err);
            toast.error('Error al registrar perfil de usuario');
        } finally {
            setIsSubmittingU(false);
        }
    }

    if (loading || !dataLoaded) return <div className="p-8 text-center text-zinc-500">Cargando configuración...</div>;

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                        <Settings /> Configuración Global
                    </h2>
                    <p className="text-zinc-500">Gestión maestra de comedores, clientes y accesos.</p>
                </div>
            </div>

            <Tabs defaultValue="comedores" className="w-full">
                <TabsList className="grid grid-cols-2 md:w-[400px]">
                    <TabsTrigger value="comedores" className="flex gap-2"><Store size={16} /> Comedores</TabsTrigger>
                    <TabsTrigger value="usuarios" className="flex gap-2"><Users size={16} /> Accesos y Roles</TabsTrigger>
                </TabsList>

                <TabsContent value="comedores" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader className="bg-zinc-50 border-b pb-4">
                            <CardTitle className="text-lg">Añadir Nuevo Comedor</CardTitle>
                            <CardDescription>Crea un nuevo concesionario para empezar a recolectar datos operativos.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={crearComedor} className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="space-y-2 w-full md:w-1/3">
                                    <label className="text-sm font-medium">Nombre de la Operación</label>
                                    <Input placeholder="Ej. RANSA SAN AGUSTIN" value={newComedor.nombre} onChange={e => setNewComedor({ ...newComedor, nombre: e.target.value })} required />
                                </div>
                                <div className="space-y-2 w-full md:w-1/3">
                                    <label className="text-sm font-medium">Empresa / Cliente</label>
                                    <Input placeholder="Ej. RANSA" value={newComedor.cliente} onChange={e => setNewComedor({ ...newComedor, cliente: e.target.value })} required />
                                </div>
                                <div className="space-y-2 w-full md:w-1/3">
                                    <label className="text-sm font-medium">Encargado Responsable</label>
                                    <Input placeholder="Ej. Juan Perez" value={newComedor.responsable} onChange={e => setNewComedor({ ...newComedor, responsable: e.target.value })} required />
                                </div>
                                <Button type="submit" disabled={isSubmittingC} className="bg-indigo-600 hover:bg-indigo-700 w-full md:w-auto">
                                    <Plus size={16} className="mr-2" /> {isSubmittingC ? 'Guardando...' : 'Crear'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Comedores Instalados</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Responsable</TableHead>
                                        <TableHead className="w-24 text-center">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {comedores.map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-semibold">{c.nombre}</TableCell>
                                            <TableCell>{c.cliente_empresa}</TableCell>
                                            <TableCell>{c.responsable}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={c.activo ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-red-100 text-red-800'}>
                                                    {c.activo ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="usuarios" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader className="bg-zinc-50 border-b pb-4">
                            <CardTitle className="text-lg">Asignar Perfil / Rol</CardTitle>
                            <CardDescription>Nota: El usuario debe iniciar sesión con su cuenta Google para completar el vínculo.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={crearUsuario} className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="space-y-2 w-full md:w-1/3">
                                    <label className="text-sm font-medium">Correo Electrónico</label>
                                    <Input type="email" placeholder="usuario@empresa.com" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                                </div>
                                <div className="space-y-2 w-full md:w-1/4">
                                    <label className="text-sm font-medium">Rol</label>
                                    <Select value={newUser.rol} onValueChange={v => setNewUser({ ...newUser, rol: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="COMEDOR">Encargado Comedor</SelectItem>
                                            <SelectItem value="ADMIN">Administrador</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {newUser.rol === 'COMEDOR' && (
                                    <div className="space-y-2 w-full md:w-1/3">
                                        <label className="text-sm font-medium">Asignar Comedor</label>
                                        <Select value={newUser.comedor_id} onValueChange={v => setNewUser({ ...newUser, comedor_id: v })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">-- Seleccionar --</SelectItem>
                                                {comedores.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <Button type="submit" disabled={isSubmittingU} className="bg-indigo-600 hover:bg-indigo-700 w-full md:w-auto">
                                    <Key size={16} className="mr-2" /> {isSubmittingU ? 'Registrando...' : 'Asignar'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Listado de Accesos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Rol Asignado</TableHead>
                                        <TableHead>Comedor Vinculado</TableHead>
                                        <TableHead className="w-32">Registro</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {usuarios.map(u => (
                                        <TableRow key={u.id}>
                                            <TableCell className="font-semibold">{u.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={u.rol === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-orange-50 text-orange-700 border-orange-200'}>
                                                    {u.rol}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{u.comedores?.nombre || <span className="text-zinc-400 italic">No Aplica (Admin)</span>}</TableCell>
                                            <TableCell className="text-xs text-zinc-500">
                                                {format(new Date(u.created_at || new Date()), 'dd MMM yyyy', { locale: es })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    )
}
