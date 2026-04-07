// v2 - handles existing users
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
    const { nome, senha, tipo } = await req.json();

    if (!nome || !senha) {
      return new Response(
        JSON.stringify({ error: 'Nome e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Check if user already exists in usuarios
    const { data: existing } = await supabaseAdmin
      .from('usuarios')
      .select('id, auth_user_id')
      .eq('nome', nome)
      .single();

    if (existing) {
      // User exists - update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existing.auth_user_id,
        { password: senha }
      );

      if (updateError) {
        console.error('Password update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar senha: ' + updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Senha atualizada', usuario: existing }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new auth user with generated email
    const email = `${nome.toLowerCase().replace(/[^a-z0-9]/g, '')}@sistema.local`;
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: false,
    });

    if (authError) {
      console.error('Auth create error:', authError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar usuário: ' + authError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create usuario record
    const { data: usuario, error: userError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        auth_user_id: authUser.user.id,
        nome,
        tipo: tipo || 'lancador',
      })
      .select()
      .single();

    if (userError) {
      console.error('Usuario insert error:', userError);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar registro de usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, usuario }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create user error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
