
-- Tabela fornecedores
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar(255) NOT NULL,
  tipo_pessoa varchar(10),
  cpf_cnpj varchar(18),
  telefone varchar(20),
  email varchar(255),
  banco varchar(100),
  agencia varchar(20),
  conta varchar(20),
  pix varchar(200),
  observacoes text,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem fornecedores" ON public.fornecedores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados inserem fornecedores" ON public.fornecedores
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin atualiza fornecedores" ON public.fornecedores
  FOR UPDATE TO authenticated USING (is_app_admin());

-- Tabela contas_pagar
CREATE TABLE public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao varchar(255) NOT NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id),
  fornecedor_nome_livre varchar(255),
  categoria varchar(50),
  subcategoria varchar(50),
  valor numeric(12,2) NOT NULL,
  data_emissao date,
  data_vencimento date NOT NULL,
  data_pagamento date,
  forma_pagamento varchar(30),
  status varchar(20) NOT NULL DEFAULT 'Lancada',
  motivo text NOT NULL,
  observacoes text,
  comprovante_url text,
  criado_por uuid REFERENCES public.usuarios(id),
  aprovado_por uuid REFERENCES public.usuarios(id),
  pago_por uuid REFERENCES public.usuarios(id),
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

-- Lançador vê apenas suas contas, Admin vê todas
CREATE POLICY "Usuarios veem contas" ON public.contas_pagar
  FOR SELECT TO authenticated
  USING (is_app_admin() OR criado_por = get_usuario_id());

CREATE POLICY "Autenticados inserem contas" ON public.contas_pagar
  FOR INSERT TO authenticated WITH CHECK (true);

-- Lançador edita apenas suas contas com status Lancada, Admin edita qualquer
CREATE POLICY "Usuarios atualizam contas" ON public.contas_pagar
  FOR UPDATE TO authenticated
  USING (is_app_admin() OR (criado_por = get_usuario_id() AND status = 'Lancada'));

CREATE POLICY "Admin deleta contas" ON public.contas_pagar
  FOR DELETE TO authenticated USING (is_app_admin());

-- Tabela contas_pagar_logs
CREATE TABLE public.contas_pagar_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid REFERENCES public.contas_pagar(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.usuarios(id),
  acao varchar(50),
  status_anterior varchar(20),
  status_novo varchar(20),
  observacao text,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_pagar_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem logs" ON public.contas_pagar_logs
  FOR SELECT TO authenticated
  USING (is_app_admin() OR usuario_id = get_usuario_id());

CREATE POLICY "Autenticados inserem logs" ON public.contas_pagar_logs
  FOR INSERT TO authenticated WITH CHECK (true);
