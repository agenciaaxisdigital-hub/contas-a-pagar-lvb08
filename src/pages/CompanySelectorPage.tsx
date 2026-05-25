import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmpresa, type Empresa } from '@/contexts/EmpresaContext';
import { NovaEmpresaDialog } from '@/components/NovaEmpresaDialog';
import { Plus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CompanySelectorPage() {
  const { empresas, loading, setEmpresaAtiva } = useEmpresa();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && empresas.length === 1) {
      setEmpresaAtiva(empresas[0]);
      navigate('/', { replace: true });
    }
  }, [loading, empresas, setEmpresaAtiva, navigate]);

  const handleEnter = (empresa: Empresa) => {
    setEmpresaAtiva(empresa);
    navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-xl bg-primary/20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ background: 'linear-gradient(135deg, #3A3D42 0%, #6B7280 100%)' }}>
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Selecione uma empresa</h1>
        <p className="text-sm text-muted-foreground mt-1">Agência Axis Digital</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl">
        {empresas.map((empresa) => {
          const bg = empresa.cor_fundo ?? '#F3F4F6';
          return (
            <button
              key={empresa.id}
              onClick={() => handleEnter(empresa)}
              className="border rounded-2xl overflow-hidden flex flex-col hover:shadow-lg hover:border-primary/40 hover:scale-[1.02] transition-all duration-200 text-left group bg-card"
            >
              {/* Logo area */}
              <div
                className="w-full flex items-center justify-center"
                style={{ backgroundColor: bg, minHeight: '140px', padding: '28px 24px' }}
              >
                {empresa.logo_url ? (
                  <img
                    src={empresa.logo_url}
                    alt={empresa.nome}
                    style={{ maxHeight: '90px', width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-3xl font-bold text-primary">
                      {empresa.nome[0].toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {/* Info area */}
              <div className="flex items-center justify-between px-4 py-3 gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{empresa.nome}</p>
                  {empresa.cnpj && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{empresa.cnpj}</p>
                  )}
                </div>
                <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  Entrar →
                </span>
              </div>
            </button>
          );
        })}

        <NovaEmpresaDialog>
          <button className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary min-h-[160px]">
            <Plus className="w-8 h-8" />
            <span className="text-sm font-medium">Nova Empresa</span>
          </button>
        </NovaEmpresaDialog>
      </div>
    </div>
  );
}
