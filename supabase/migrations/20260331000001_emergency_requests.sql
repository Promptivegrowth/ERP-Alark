-- Table for emergency past-report requests
CREATE TABLE IF NOT EXISTS public.reporte_diario_solicitudes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comedor_id UUID NOT NULL REFERENCES public.comedores(id),
    fecha_reporte DATE NOT NULL,
    datos_json JSONB NOT NULL,
    motivo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
    admin_id UUID,
    admin_observacion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.reporte_diario_solicitudes ENABLE ROW LEVEL SECURITY;

-- Simple policy for authenticated users (comedores can create/read theirs, admins read/update all)
CREATE POLICY "Comedores can view their own solicitudes" 
ON public.reporte_diario_solicitudes FOR SELECT 
USING (comedor_id::text = auth.uid()::text OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Comedores can create solicitudes" 
ON public.reporte_diario_solicitudes FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can update solicitudes" 
ON public.reporte_diario_solicitudes FOR UPDATE 
USING (true);
