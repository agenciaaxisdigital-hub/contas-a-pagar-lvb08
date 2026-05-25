import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  logo_url: string | null;
  criado_em: string;
}

interface EmpresaContextType {
  empresaAtiva: Empresa | null;
  setEmpresaAtiva: (empresa: Empresa) => void;
  empresas: Empresa[];
  loading: boolean;
  refetchEmpresas: () => Promise<void>;
}

const EmpresaContext = createContext<EmpresaContextType | null>(null);

const STORAGE_KEY = 'sarelli_empresa_ativa';

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresaAtiva, setEmpresaAtivaState] = useState<Empresa | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmpresas = async () => {
    const { data } = await supabase
      .from('empresas')
      .select('*')
      .order('criado_em', { ascending: true });
    if (data) setEmpresas(data as Empresa[]);
    setLoading(false);
  };

  useEffect(() => {
    // Wait for auth session before fetching — prevents RLS race condition
    // where the query fires as anon before the session token is restored.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchEmpresas();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchEmpresas();
      } else if (event === 'SIGNED_OUT') {
        setEmpresas([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setEmpresaAtiva = (empresa: Empresa) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(empresa));
    setEmpresaAtivaState(empresa);
  };

  return (
    <EmpresaContext.Provider value={{ empresaAtiva, setEmpresaAtiva, empresas, loading, refetchEmpresas: fetchEmpresas }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error('useEmpresa must be used within EmpresaProvider');
  return ctx;
}
