CREATE TABLE IF NOT EXISTS empresas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      varchar(255) NOT NULL,
  cnpj      varchar(18),
  logo_url  text,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated select empresas"
  ON empresas FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated insert empresas"
  ON empresas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated update empresas"
  ON empresas FOR UPDATE TO authenticated USING (true);
