import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppLayout from '@/components/AppLayout';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  cpf: z.string().optional(),
  cargo: z.string().min(1, 'Cargo obrigatório'),
  salario: z.coerce.number().positive('Salário deve ser maior que zero'),
  data_admissao: z.string().min(1, 'Data de admissão obrigatória'),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  pix: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NovoFuncionarioPage() {
  const navigate = useNavigate();
  const { empresaAtiva } = useEmpresa();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!empresaAtiva) return;
    const { error } = await supabase.from('funcionarios').insert({
      ...data,
      empresa_id: empresaAtiva.id,
      cpf: data.cpf || null,
      banco: data.banco || null,
      agencia: data.agencia || null,
      conta: data.conta || null,
      pix: data.pix || null,
    });
    if (error) { toast.error('Erro ao cadastrar funcionário.'); return; }
    toast.success('Funcionário cadastrado!');
    navigate('/rh/funcionarios');
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Novo Funcionário</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados Pessoais</h2>
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input {...register('nome')} placeholder="Nome completo" />
              {errors.nome && <p className="text-xs text-destructive">{errors.nome.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input {...register('cpf')} placeholder="000.000.000-00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cargo *</Label>
                <Input {...register('cargo')} placeholder="Ex: Assistente" />
                {errors.cargo && <p className="text-xs text-destructive">{errors.cargo.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Data Admissão *</Label>
                <Input type="date" {...register('data_admissao')} />
                {errors.data_admissao && <p className="text-xs text-destructive">{errors.data_admissao.message}</p>}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Financeiro</h2>
            <div className="space-y-1.5">
              <Label>Salário (R$) *</Label>
              <Input type="number" step="0.01" min="0" {...register('salario')} placeholder="0,00" />
              {errors.salario && <p className="text-xs text-destructive">{errors.salario.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>PIX</Label>
              <Input {...register('pix')} placeholder="CPF, email ou chave aleatória" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Input {...register('banco')} placeholder="Ex: Itaú" />
              </div>
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input {...register('agencia')} placeholder="0000" />
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Input {...register('conta')} placeholder="00000-0" />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Cadastrar Funcionário'}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}
