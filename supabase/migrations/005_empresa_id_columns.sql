ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);
ALTER TABLE fornecedores  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa ON contas_pagar(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa  ON fornecedores(empresa_id);
