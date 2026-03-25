-- Elimina políticas recursivas
DROP POLICY IF EXISTS "admin_all_usuarios" ON usuarios;
DROP POLICY IF EXISTS "comedor_read_usuarios" ON usuarios;

-- Crea las nuevas reglas optimizadas
CREATE POLICY "auth_read_usuarios" ON usuarios FOR SELECT USING (true);
CREATE POLICY "admin_all_usuarios_del" ON usuarios FOR DELETE USING ( (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'ADMIN' );
CREATE POLICY "admin_all_usuarios_upd" ON usuarios FOR UPDATE USING ( (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'ADMIN' );
