CREATE TABLE IF NOT EXISTS funcionarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas(id),
  nome            varchar(255) NOT NULL,
  cpf             varchar(14),
  cargo           varchar(100) NOT NULL,
  salario         numeric(12,2) NOT NULL,
  data_admissao   date NOT NULL,
  banco           varchar(100),
  agencia         varchar(20),
  conta           varchar(30),
  pix             varchar(100),
  contrato_url    text,
  ativo           boolean DEFAULT true,
  criado_em       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagamentos_funcionarios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id    uuid NOT NULL REFERENCES funcionarios(id),
  empresa_id        uuid NOT NULL REFERENCES empresas(id),
  mes_referencia    date NOT NULL,
  valor_pago        numeric(12,2) NOT NULL,
  forma_pagamento   varchar(50) NOT NULL,
  data_pagamento    date NOT NULL,
  status            varchar(20) DEFAULT 'Pago',
  comprovante_url   text,
  observacoes       text,
  pago_por          uuid REFERENCES usuarios(id),
  criado_em         timestamptz DEFAULT now()
);

ALTER TABLE funcionarios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos_funcionarios  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated select funcionarios"
  ON funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert funcionarios"
  ON funcionarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update funcionarios"
  ON funcionarios FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated select pagamentos"
  ON pagamentos_funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert pagamentos"
  ON pagamentos_funcionarios FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_funcionarios_empresa    ON funcionarios(empresa_id);
CREATE INDEX idx_pagamentos_funcionario  ON pagamentos_funcionarios(funcionario_id);
CREATE INDEX idx_pagamentos_mes          ON pagamentos_funcionarios(mes_referencia);
