-- Migration: Add observations to weekly Kardex and fix Cruce constraints
-- 1. Add observacion columns to weekly reports
ALTER TABLE public.kardex_snack_ventas ADD COLUMN IF NOT EXISTS observacion TEXT;
ALTER TABLE public.kardex_pasteles ADD COLUMN IF NOT EXISTS observacion TEXT;

-- 2. Ensure RLS policies don't need changes (they use FOR ALL or specific SELECT, adding a column is usually fine)
-- But let's verify if there are any triggers or functions that might break. 
-- Looking at the schema, there are only updated_at triggers which handle the column automatically.

-- 3. Add a helper function to get or create a week for a comedor given a date
-- This will be useful for the daily report -> cruce connection
CREATE OR REPLACE FUNCTION get_or_create_semana(p_comedor_id UUID, p_fecha DATE)
RETURNS UUID AS $$
DECLARE
    v_semana_id UUID;
    v_fecha_inicio DATE;
    v_fecha_fin DATE;
BEGIN
    -- Calculate Monday and Sunday for the given date
    v_fecha_inicio := p_fecha - (EXTRACT(DOW FROM p_fecha)::INTEGER + 6) % 7;
    v_fecha_fin := v_fecha_inicio + 6;

    -- Search for existing week
    SELECT id INTO v_semana_id 
    FROM public.semanas 
    WHERE comedor_id = p_comedor_id 
    AND fecha_inicio = v_fecha_inicio;

    -- Create if not exists
    IF v_semana_id IS NULL THEN
        INSERT INTO public.semanas (comedor_id, fecha_inicio, fecha_fin)
        VALUES (p_comedor_id, v_fecha_inicio, v_fecha_fin)
        RETURNING id INTO v_semana_id;
    END IF;

    RETURN v_semana_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
