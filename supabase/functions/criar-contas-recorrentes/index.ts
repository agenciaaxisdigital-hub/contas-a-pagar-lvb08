import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const inicioMes = `${ano}-${mes}-01`;
  const fimMes = new Date(ano, hoje.getMonth() + 1, 0);
  const fimMesStr = `${ano}-${mes}-${String(fimMes.getDate()).padStart(2, '0')}`;

  const { data: recorrentes, error } = await supabase
    .from('contas_pagar')
    .select('*')
    .eq('recorrente', true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let criadas = 0;
  let ignoradas = 0;

  for (const conta of recorrentes ?? []) {
    const dia = conta.dia_vencimento_recorrente ?? 1;
    const diaStr = String(Math.min(dia, fimMes.getDate())).padStart(2, '0');
    const dataVencimento = `${ano}-${mes}-${diaStr}`;

    // Idempotency check: skip if this bill already exists for this month
    const { data: existente } = await supabase
      .from('contas_pagar')
      .select('id')
      .eq('empresa_id', conta.empresa_id)
      .eq('descricao', conta.descricao)
      .gte('data_vencimento', inicioMes)
      .lte('data_vencimento', fimMesStr)
      .neq('id', conta.id)
      .maybeSingle();

    if (existente) { ignoradas++; continue; }

    const { error: insertError } = await supabase.from('contas_pagar').insert({
      empresa_id: conta.empresa_id,
      descricao: conta.descricao,
      fornecedor_id: conta.fornecedor_id ?? null,
      fornecedor_nome_livre: conta.fornecedor_nome_livre ?? null,
      categoria: conta.categoria ?? null,
      subcategoria: conta.subcategoria ?? null,
      valor: conta.valor,
      data_emissao: hoje.toISOString().split('T')[0],
      data_vencimento: dataVencimento,
      forma_pagamento: conta.forma_pagamento ?? null,
      status: 'Lancada',
      recorrente: true,
      dia_vencimento_recorrente: dia,
      criado_por: conta.criado_por ?? null,
    });

    if (!insertError) criadas++;
  }

  return new Response(
    JSON.stringify({ criadas, ignoradas, executadoEm: hoje.toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
