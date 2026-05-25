import { useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

interface Props { children: ReactNode }

export function NovaEmpresaDialog({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const { setEmpresaAtiva, refetchEmpresas } = useEmpresa();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('empresas')
      .insert({ nome: nome.trim(), cnpj: cnpj.trim() || null })
      .select()
      .single();
    if (error || !data) {
      toast.error('Erro ao criar empresa.');
      setLoading(false);
      return;
    }
    await refetchEmpresas();
    setEmpresaAtiva(data as any);
    toast.success(`Empresa "${data.nome}" criada!`);
    setOpen(false);
    setNome('');
    setCnpj('');
    navigate('/', { replace: true });
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Empresa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Axis Consultoria"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !nome.trim()}>
            {loading ? 'Criando...' : 'Criar e Entrar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
