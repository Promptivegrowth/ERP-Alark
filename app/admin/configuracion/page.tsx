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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Plus, Store, Users, Key, LayoutList, GripVertical, ToggleLeft, ToggleRight } from 'lucide-react';

export default function ConfiguracionPage() {
    const { loading, rol } = useUser();
    const supabase = createClient();
    const [dataLoaded, setDataLoaded] = useState(false);
    const isReadOnly = rol === 'SUPERVISOR';
    // El supervisor no debería entrar acá (no se muestra en el menú) pero por si navega directo.
    if (isReadOnly) {
        return (
            <div className="p-12 text-center">
                <p className="text-sm text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg inline-block px-6 py-4">
                    Modo supervisor: esta sección está disponible solo para administradores.
                </p>
            </div>
        );
    }

    const [comedores, setComedores] = useState<any[]>([]);
    const [usuarios, setUsuarios] = useState<any[]>([]);

    // Comedor Form
    const [newComedor, setNewComedor] = useState({ nombre: '', cliente: '', responsable: '' });
    const [isSubmittingC, setIsSubmittingC] = useState(false);

    // User Form
    const [newUser, setNewUser] = useState({ email: '', rol: 'COMEDOR', comedor_id: 'none' });
    const [isSubmittingU, setIsSubmittingU] = useState(false);

    // Campo config
    const [selectedComedorId, setSelectedComedorId] = useState('');
    const [camposComedor, setCamposComedor] = useState<any[]>([]);
    const [loadingCampos, setLoadingCampos] = useState(false);
    const [newCampo, setNewCampo] = useState({ nombre_campo: '', categoria: 'ALMUERZO' as string, orden: 0, precio_unitario: 0 });
    const [isSubmittingCampo, setIsSubmittingCampo] = useState(false);
    const [editingCampoId, setEditingCampoId] = useState<string | null>(null);
    const [editingPrecio, setEditingPrecio] = useState<number>(0);
    const [editingNombre, setEditingNombre] = useState<string>('');
    const [editingCategoria, setEditingCategoria] = useState<string>('ALMUERZO');

    // Password Reset
    const [resetUser, setResetUser] = useState<any>(null);
    const [newPasswordForReset, setNewPasswordForReset] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

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

    async function handleResetPassword() {
        if (!resetUser || !newPasswordForReset) return;
        if (newPasswordForReset.length < 8) {
            toast.error('La contraseña debe tener al menos 8 caracteres');
            return;
        }

        setIsResetting(true);
        try {
            const res = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: resetUser.id, newPassword: newPasswordForReset })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(`Contraseña de ${resetUser.email} actualizada con éxito`);
                setIsDialogOpen(false);
                setNewPasswordForReset('');
                setResetUser(null);
            } else {
                throw new Error(data.error || 'Error al resetear contraseña');
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Error al resetear contraseña');
        } finally {
            setIsResetting(false);
        }
    }

    async function loadCamposComedor(comedorId: string) {
        setLoadingCampos(true);
        const { data } = await supabase
            .from('comedor_campos_reporte')
            .select('*')
            .eq('comedor_id', comedorId)
            .order('orden');
        if (data) setCamposComedor(data);
        setLoadingCampos(false);
    }

    async function toggleCampoActivo(id: string, activo: boolean) {
        await (supabase.from('comedor_campos_reporte') as any).update({ activo: !activo }).eq('id', id);
        setCamposComedor(prev => prev.map(c => c.id === id ? { ...c, activo: !activo } : c));
        toast.success('Campo actualizado');
    }

    async function agregarCampo(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedComedorId || !newCampo.nombre_campo) {
            toast.error('Completa todos los campos');
            return;
        }
        setIsSubmittingCampo(true);

        const { error } = await supabase.from('comedor_campos_reporte').insert({
            comedor_id: selectedComedorId,
            nombre_campo: newCampo.nombre_campo.toUpperCase(),
            categoria: newCampo.categoria,
            orden: newCampo.orden || (camposComedor.length + 1),
            precio_unitario: newCampo.precio_unitario || 0,
            activo: true,
        } as any);

        if (error) {
            console.error('Error insert:', error);
            toast.error('Error al agregar campo');
        }
        else {
            toast.success('Campo agregado');
            setNewCampo({ nombre_campo: '', categoria: 'ALMUERZO', orden: 0, precio_unitario: 0 });
            loadCamposComedor(selectedComedorId);
        }
        setIsSubmittingCampo(false);
    }

    async function guardarEdicionCampo(id: string) {
        if (!editingNombre) {
            toast.error('Nombre no puede estar vacío');
            return;
        }

        const { error } = await (supabase.from('comedor_campos_reporte') as any)
            .update({
                nombre_campo: editingNombre.toUpperCase(),
                categoria: editingCategoria,
                precio_unitario: editingPrecio
            })
            .eq('id', id);

        if (error) {
            console.error('Error updating field:', error);
            toast.error('Error al actualizar campo');
        }
        else {
            toast.success('Campo actualizado');
            setEditingCampoId(null);
            loadCamposComedor(selectedComedorId);
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
                <TabsList className="grid grid-cols-3 md:w-[600px] bg-zinc-100">
                    <TabsTrigger value="comedores" className="flex gap-2 data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white"><Store size={16} /> Comedores</TabsTrigger>
                    <TabsTrigger value="usuarios" className="flex gap-2 data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white"><Users size={16} /> Accesos</TabsTrigger>
                    <TabsTrigger value="campos" className="flex gap-2 data-[state=active]:bg-[#2D6A4F] data-[state=active]:text-white"><LayoutList size={16} /> Campos por Comedor</TabsTrigger>
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
                                    <Select value={newUser.rol} onValueChange={v => setNewUser({ ...newUser, rol: v || '' })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="COMEDOR">Encargado Comedor</SelectItem>
                                            <SelectItem value="SUPERVISOR">Supervisor (solo lectura)</SelectItem>
                                            <SelectItem value="ADMIN">Administrador</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {newUser.rol === 'COMEDOR' && (
                                    <div className="space-y-2 w-full md:w-1/3">
                                        <label className="text-sm font-medium">Asignar Comedor</label>
                                        <Select value={newUser.comedor_id} onValueChange={v => setNewUser({ ...newUser, comedor_id: v || '' })}>
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
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {usuarios.map(u => (
                                        <TableRow key={u.id}>
                                            <TableCell className="font-semibold">{u.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={
                                                    u.rol === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                    u.rol === 'SUPERVISOR' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-orange-50 text-orange-700 border-orange-200'
                                                }>
                                                    {u.rol}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{u.comedores?.nombre || <span className="text-zinc-400 italic">No Aplica (Admin)</span>}</TableCell>
                                            <TableCell className="text-xs text-zinc-500">
                                                {format(new Date(u.created_at || new Date()), 'dd MMM yyyy', { locale: es })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Dialog open={isDialogOpen && resetUser?.id === u.id} onOpenChange={(open) => {
                                                    setIsDialogOpen(open);
                                                    if (open) setResetUser(u);
                                                    else { setResetUser(null); setNewPasswordForReset(''); }
                                                }}>
                                                    <DialogTrigger render={
                                                        <Button variant="outline" size="sm" className="h-8 gap-2">
                                                            <Key size={14} />
                                                            Cambiar Clave
                                                        </Button>
                                                    } />
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Cambiar Contraseña</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="space-y-4 py-4">
                                                            <div className="space-y-2">
                                                                <p className="text-sm font-medium">Resetear clave para: <span className="font-bold">{u.email}</span></p>
                                                                <Input
                                                                    type="password"
                                                                    placeholder="Nueva contraseña (min. 8 caracteres)"
                                                                    value={newPasswordForReset}
                                                                    onChange={(e) => setNewPasswordForReset(e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <DialogFooter>
                                                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                                            <Button
                                                                className="bg-indigo-600 hover:bg-indigo-700"
                                                                onClick={handleResetPassword}
                                                                disabled={isResetting || newPasswordForReset.length < 8}
                                                            >
                                                                {isResetting ? 'Guardando...' : 'Actualizar Contraseña'}
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="campos" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader className="bg-zinc-50 border-b pb-4">
                            <CardTitle className="text-lg flex items-center gap-2"><LayoutList size={16} /> Configurar Campos por Comedor</CardTitle>
                            <CardDescription>Selecciona un comedor para ver y editar sus campos de reporte diario.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="flex gap-4 items-end mb-6">
                                <div className="space-y-2 w-full md:w-1/2">
                                    <label className="text-sm font-medium">Seleccionar Comedor</label>
                                    <Select value={selectedComedorId} onValueChange={v => { setSelectedComedorId(v || ''); loadCamposComedor(v || ''); }}>
                                        <SelectTrigger><SelectValue placeholder="-- Selecciona un comedor --" /></SelectTrigger>
                                        <SelectContent>
                                            {comedores.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {selectedComedorId && (
                                <>
                                    {/* Add new campo form */}
                                    <form onSubmit={agregarCampo} className="flex flex-wrap gap-3 items-end mb-6 p-4 bg-[#1B4332]/5 rounded-lg border border-[#2D6A4F]/20">
                                        <div className="space-y-1 flex-1 min-w-[160px]">
                                            <label className="text-xs font-medium text-zinc-600">Nombre del Campo</label>
                                            <Input placeholder="Ej. ALMUERZOS SISTEMA" value={newCampo.nombre_campo} onChange={e => setNewCampo({ ...newCampo, nombre_campo: e.target.value })} required />
                                        </div>
                                        <div className="space-y-1 w-44">
                                            <label className="text-xs font-medium text-zinc-600">Categoría</label>
                                            <Select value={newCampo.categoria} onValueChange={v => setNewCampo({ ...newCampo, categoria: v || 'ALMUERZO' })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {['DESAYUNO', 'ALMUERZO', 'CENA', 'AMANECIDA', 'LONCHE', 'PAN', 'BEBIDA', 'EXTRA', 'OTRO'].map(cat => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1 w-24">
                                            <label className="text-xs font-medium text-zinc-600">Precio S/</label>
                                            <Input type="number" step="0.01" placeholder="0.00" value={newCampo.precio_unitario || ''} onChange={e => setNewCampo({ ...newCampo, precio_unitario: parseFloat(e.target.value) || 0 })} />
                                        </div>
                                        <div className="space-y-1 w-20">
                                            <label className="text-xs font-medium text-zinc-600">Orden</label>
                                            <Input type="number" min={0} placeholder="0" value={newCampo.orden || ''} onChange={e => setNewCampo({ ...newCampo, orden: Number(e.target.value) })} />
                                        </div>
                                        <Button type="submit" disabled={isSubmittingCampo} className="bg-[#2D6A4F] hover:bg-[#1B4332]">
                                            <Plus size={16} className="mr-1.5" />{isSubmittingCampo ? 'Agregando...' : 'Agregar'}
                                        </Button>
                                    </form>

                                    {/* Campo list */}
                                    {loadingCampos ? (
                                        <p className="text-center text-zinc-400 py-4">Cargando campos...</p>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-8">#</TableHead>
                                                    <TableHead>Nombre del Campo</TableHead>
                                                    <TableHead>Categoría</TableHead>
                                                    <TableHead className="text-right">Precio Unit.</TableHead>
                                                    <TableHead className="text-center">Activo</TableHead>
                                                    <TableHead className="text-center">Auto</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {camposComedor.map((campo, idx) => (
                                                    <TableRow key={campo.id} className={!campo.activo ? 'opacity-50' : ''}>
                                                        <TableCell className="text-zinc-400 text-xs">{campo.orden}</TableCell>
                                                        <TableCell className="font-medium">
                                                            {editingCampoId === campo.id ? (
                                                                <Input
                                                                    disabled={campo.es_readonly}
                                                                    className="h-8 text-xs font-bold uppercase"
                                                                    value={editingNombre}
                                                                    onChange={e => setEditingNombre(e.target.value)}
                                                                />
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        if (campo.es_readonly) return;
                                                                        setEditingCampoId(campo.id);
                                                                        setEditingNombre(campo.nombre_campo);
                                                                        setEditingCategoria(campo.categoria);
                                                                        setEditingPrecio(campo.precio_unitario || 0);
                                                                    }}
                                                                    className="hover:underline text-left cursor-text"
                                                                >
                                                                    {campo.nombre_campo}
                                                                </button>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editingCampoId === campo.id ? (
                                                                <Select value={editingCategoria} onValueChange={v => setEditingCategoria(v || 'ALMUERZO')}>
                                                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>
                                                                        {['DESAYUNO', 'ALMUERZO', 'CENA', 'AMANECIDA', 'LONCHE', 'PAN', 'BEBIDA', 'EXTRA', 'OTRO'].map(cat => (
                                                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <Badge variant="outline" className="text-xs">{campo.categoria}</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {editingCampoId === campo.id ? (
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className="w-24 h-8 text-right text-xs ml-auto"
                                                                    value={editingPrecio}
                                                                    onChange={e => setEditingPrecio(parseFloat(e.target.value) || 0)}
                                                                />
                                                            ) : (
                                                                <span className="font-bold text-zinc-600">
                                                                    S/. {(campo.precio_unitario || 0).toFixed(2)}
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {editingCampoId === campo.id ? (
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <Button size="icon" className="h-8 w-8 bg-emerald-600" onClick={() => guardarEdicionCampo(campo.id)}>
                                                                        <Plus size={14} />
                                                                    </Button>
                                                                    <Button size="icon" variant="outline" className="h-8 w-8 text-zinc-400" onClick={() => setEditingCampoId(null)}>
                                                                        <Plus size={14} className="rotate-45" />
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button onClick={() => toggleCampoActivo(campo.id, campo.activo)} title={campo.activo ? 'Desactivar' : 'Activar'}>
                                                                        {campo.activo
                                                                            ? <ToggleRight size={24} className="text-[#2D6A4F]" />
                                                                            : <ToggleLeft size={24} className="text-zinc-400" />}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {campo.es_readonly ? <Badge className="text-xs bg-zinc-100 text-zinc-600">calc.</Badge> : <span className="text-zinc-300 text-xs">—</span>}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    )
}
