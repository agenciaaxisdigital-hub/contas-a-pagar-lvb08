const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, usuario_id, nome, tipo, nova_senha } = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (!usuario_id) {
      return new Response(
        JSON.stringify({ error: 'usuario_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the usuario record
    const { data: usuario, error: fetchError } = await supabaseAdmin
      .from('usuarios')
      .select('id, auth_user_id, nome, tipo')
      .eq('id', usuario_id)
      .single();

    if (fetchError || !usuario) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // EDIT action
    if (action === 'edit') {
      const updates: Record<string, string> = {};
      if (nome && nome.trim()) updates.nome = nome.trim();
      if (tipo) updates.tipo = tipo;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('usuarios')
          .update(updates)
          .eq('id', usuario_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Erro ao atualizar: ' + updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Reset password if provided
      if (nova_senha && nova_senha.length >= 6) {
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
          usuario.auth_user_id,
          { password: nova_senha }
        );
        if (pwError) {
          return new Response(
            JSON.stringify({ error: 'Erro ao resetar senha: ' + pwError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Usuário atualizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE action
    if (action === 'delete') {
      // Delete from usuarios table
      const { error: delError } = await supabaseAdmin
        .from('usuarios')
        .delete()
        .eq('id', usuario_id);

      if (delError) {
        return new Response(
          JSON.stringify({ error: 'Erro ao deletar usuário: ' + delError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete auth user
      const { error: authDelError } = await supabaseAdmin.auth.admin.deleteUser(
        usuario.auth_user_id
      );

      if (authDelError) {
        console.error('Auth delete error (non-critical):', authDelError);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Usuário removido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida. Use "edit" ou "delete".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Manage user error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
