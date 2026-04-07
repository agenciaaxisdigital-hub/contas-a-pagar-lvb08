import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewFornecedorDialog({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    nome: '', tipo_pessoa: '', cpf_cnpj: '', telefone: '', email: '', pix: '',
  });
  const [loading, setLoading] = useState(false);

  const update = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    setLoading(true);
    const { error } = await supabase.from('fornecedores').insert({
      nome: form.nome.trim(),
      tipo_pessoa: form.tipo_pessoa || null,
      cpf_cnpj: form.cpf_cnpj.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      pix: form.pix.trim() || null,
    });
    setLoading(false);
    if (error) { toast.error('Erro ao criar fornecedor'); return; }
    toast.success('Fornecedor criado');
    setForm({ nome: '', tipo_pessoa: '', cpf_cnpj: '', telefone: '', email: '', pix: '' });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Novo Fornecedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="label-micro">Nome *</label>
            <Input value={form.nome} onChange={e => update('nome', e.target.value)} className="h-11 bg-background" placeholder="Nome do fornecedor" />
          </div>
          <div className="space-y-1">
            <label className="label-micro">Tipo pessoa</label>
            <Select value={form.tipo_pessoa} onValueChange={v => update('tipo_pessoa', v)}>
              <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="PF ou PJ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PF">Pessoa Física</SelectItem>
                <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="label-micro">CPF/CNPJ</label>
            <Input value={form.cpf_cnpj} onChange={e => update('cpf_cnpj', e.target.value)} className="h-11 bg-background" placeholder="000.000.000-00" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="label-micro">Telefone</label>
              <Input value={form.telefone} onChange={e => update('telefone', e.target.value)} className="h-11 bg-background" />
            </div>
            <div className="space-y-1">
              <label className="label-micro">E-mail</label>
              <Input value={form.email} onChange={e => update('email', e.target.value)} className="h-11 bg-background" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="label-micro">Chave PIX</label>
            <Input value={form.pix} onChange={e => update('pix', e.target.value)} className="h-11 bg-background" placeholder="Chave PIX" />
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full h-11 gradient-primary text-primary-foreground font-semibold rounded-xl">
            {loading ? 'Salvando...' : 'Salvar Fornecedor'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
