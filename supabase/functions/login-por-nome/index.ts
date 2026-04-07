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
    const { nome, senha } = await req.json();

    if (!nome || !senha) {
      return new Response(
        JSON.stringify({ error: 'Nome e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Look up usuario by nome
    const { data: usuario, error: userError } = await supabaseAdmin
      .from('usuarios')
      .select('auth_user_id, nome, tipo')
      .eq('nome', nome)
      .single();

    if (userError || !usuario) {
      console.error('User not found:', nome);
      return new Response(
        JSON.stringify({ error: 'Usuário ou senha inválidos' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the auth user's email
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(usuario.auth_user_id);

    if (authError || !authUser?.user?.email) {
      console.error('Auth user not found:', usuario.auth_user_id);
      return new Response(
        JSON.stringify({ error: 'Usuário ou senha inválidos' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sign in with email + password
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAnon = createClient(supabaseUrl, anonKey);
    
    const { data: session, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: authUser.user.email,
      password: senha,
    });

    if (signInError) {
      console.error('Sign in error:', signInError.message);
      return new Response(
        JSON.stringify({ error: 'Usuário ou senha inválidos' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        session: session.session,
        user: session.user,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
