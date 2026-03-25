export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            comedores: {
                Row: {
                    id: string
                    nombre: string
                    codigo: string
                    cliente_empresa: string | null
                    direccion: string | null
                    responsable: string | null
                    telefono: string | null
                    activo: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: any
                Update: any
            }
            usuarios: {
                Row: {
                    id: string
                    comedor_id: string | null
                    rol: 'ADMIN' | 'COMEDOR'
                    nombre: string | null
                    email: string | null
                    activo: boolean
                    created_at: string
                }
                Insert: any
                Update: any
            }
        }
    }
}
