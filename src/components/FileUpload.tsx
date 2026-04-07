import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileCheck, Loader2, Camera, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  contaId: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}

export default function FileUpload({ contaId, currentUrl, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);
  const inputCameraRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande (máx. 10MB)');
      return;
    }

    // Preview imediato para imagens
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    }

    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${contaId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('comprovantes')
      .upload(path, file, { upsert: true });

    if (error) {
      toast.error('Erro ao enviar arquivo');
      setPreview(null);
      setUploading(false);
      // Limpa o input para permitir re-seleção
      if (inputGaleriaRef.current) inputGaleriaRef.current.value = '';
      if (inputCameraRef.current) inputCameraRef.current.value = '';
      return;
    }

    const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(path);

    await supabase
      .from('contas_pagar')
      .update({ comprovante_url: urlData.publicUrl })
      .eq('id', contaId);

    onUploaded(urlData.publicUrl);
    toast.success('✓ Comprovante anexado!');
    setPreview(null);
    setUploading(false);
  };

  // Se já tem comprovante, mostra visualização + opção de trocar
  if (currentUrl) {
    const isImage = /\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i.test(currentUrl);
    return (
      <div className="space-y-3">
        {isImage && (
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img
              src={currentUrl}
              alt="Comprovante"
              className="w-full max-h-48 object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <FileCheck size={16} className="text-green-500 shrink-0" />
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline truncate flex-1"
          >
            {isImage ? 'Ver boleto/conta em tamanho completo →' : 'Abrir boleto/conta (PDF) →'}
          </a>
        </div>
        <button
          onClick={() => inputGaleriaRef.current?.click()}
          className="w-full h-10 rounded-xl border border-dashed border-border text-xs text-muted-foreground flex items-center justify-center gap-2 hover:border-primary/40 transition-colors"
        >
          <Upload size={14} /> Substituir boleto/conta
        </button>
        <input ref={inputGaleriaRef} type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Inputs hidden */}
      <input
        ref={inputGaleriaRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleUpload}
        className="hidden"
      />
      <input
        ref={inputCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleUpload}
        className="hidden"
      />

      {/* Preview */}
      {preview && (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img src={preview} alt="Preview" className="w-full max-h-40 object-cover" />
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-white">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-xs font-medium">Enviando...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!preview && !uploading && (
        <div className="grid grid-cols-2 gap-2">
          {/* Galeria / Arquivo */}
          <button
            onClick={() => inputGaleriaRef.current?.click()}
            className="h-16 rounded-xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all active:scale-95"
          >
            <ImageIcon size={20} />
            <span className="text-[11px] font-medium">Galeria / PDF</span>
          </button>

          {/* Câmera */}
          <button
            onClick={() => inputCameraRef.current?.click()}
            className="h-16 rounded-xl border-2 border-dashed border-border bg-background flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all active:scale-95"
          >
            <Camera size={20} />
            <span className="text-[11px] font-medium">Tirar foto</span>
          </button>
        </div>
      )}

      {uploading && !preview && (
        <div className="h-16 rounded-xl border border-dashed border-border bg-background flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Enviando comprovante...</span>
        </div>
      )}
    </div>
  );
}
