-- Fix: replace legacy eh_admin() (checks roles_usuarios) with is_app_admin()
--      (checks usuarios.tipo = 'admin'), which is what the app actually uses.

-- Drop all old policies on usuarios
DROP POLICY IF EXISTS "Admin gerencia usuarios"         ON public.usuarios;
DROP POLICY IF EXISTS "Admin insere usuarios"           ON public.usuarios;
DROP POLICY IF EXISTS "Usuario atualiza proprio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "Usuario ve proprio"              ON public.usuarios;

-- SELECT: own row always; admins see all rows
CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR is_app_admin());

-- INSERT: only admins from client; edge functions use service_role (bypasses RLS)
CREATE POLICY "usuarios_insert" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (is_app_admin());

-- UPDATE: own profile always; admins can update any row
CREATE POLICY "usuarios_update" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR is_app_admin());

-- DELETE: admins only; edge functions use service_role anyway
CREATE POLICY "usuarios_delete" ON public.usuarios
  FOR DELETE TO authenticated
  USING (is_app_admin());
