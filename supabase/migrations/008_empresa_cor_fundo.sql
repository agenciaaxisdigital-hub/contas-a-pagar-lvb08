-- Campo para armazenar a cor de fundo do card da empresa (hex, ex: #FFFFFF)
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cor_fundo varchar(7);
