-- Inserir empresa padrão se não existir
INSERT INTO empresas (nome)
SELECT 'Dra. Fernanda Sarelli'
WHERE NOT EXISTS (SELECT 1 FROM empresas LIMIT 1);

-- Backfill: associar contas_pagar e fornecedores à primeira empresa cadastrada
UPDATE contas_pagar
SET empresa_id = (SELECT id FROM empresas ORDER BY criado_em LIMIT 1)
WHERE empresa_id IS NULL;

UPDATE fornecedores
SET empresa_id = (SELECT id FROM empresas ORDER BY criado_em LIMIT 1)
WHERE empresa_id IS NULL;
