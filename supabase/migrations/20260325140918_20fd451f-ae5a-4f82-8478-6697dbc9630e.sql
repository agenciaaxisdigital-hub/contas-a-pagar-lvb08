
-- Add recurring and PIX fields to contas_pagar
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS recorrente boolean DEFAULT false;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS dia_vencimento_recorrente integer;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS chave_pix text;

-- Create storage bucket for receipt uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload receipts
CREATE POLICY "Autenticados upload comprovantes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comprovantes');

-- RLS: authenticated users can view receipts
CREATE POLICY "Autenticados veem comprovantes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'comprovantes');

-- RLS: admin can delete receipts
CREATE POLICY "Admin deleta comprovantes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'comprovantes' AND (SELECT is_app_admin()));
