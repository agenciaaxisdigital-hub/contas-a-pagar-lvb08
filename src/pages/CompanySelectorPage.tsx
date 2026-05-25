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
          const isDark = bg !== '#FFFFFF' && bg !== '#ffffff' && bg !== '#F3F4F6';
          return (
            <button
              key={empresa.id}
              onClick={() => handleEnter(empresa)}
              className="border rounded-xl overflow-hidden flex flex-col items-center gap-3 hover:shadow-md hover:border-primary/40 transition-all text-left group bg-card"
            >
              {/* Logo area — same background as the logo */}
              <div
                className="w-full flex items-center justify-center p-5"
                style={{ backgroundColor: bg }}
              >
                {empresa.logo_url ? (
                  <img
                    src={empresa.logo_url}
                    alt={empresa.nome}
                    className="h-16 w-auto max-w-[160px] object-contain"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {empresa.nome[0].toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {/* Info area */}
              <div className="text-center px-4 pb-4">
                <p className="font-semibold text-foreground">{empresa.nome}</p>
                {empresa.cnpj && (
                  <p className="text-xs text-muted-foreground mt-0.5">{empresa.cnpj}</p>
                )}
                <Button size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                  Entrar
                </Button>
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
