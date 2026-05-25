# Holding Multi-Empresa + Módulo RH — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o sistema de contas a pagar single-empresa em plataforma holding multi-empresa com módulo RH completo (funcionários + folha de pagamento).

**Architecture:** `EmpresaContext` com localStorage persiste a empresa ativa e injeta `empresa_id` em todas as queries. Sprint 1 cria a base (empresas + seletor). Sprint 2 segrega dados existentes. Sprint 3 adiciona RH. Sprint 4 adiciona automações e testes.

**Tech Stack:** React 18 + TypeScript + Supabase (PostgreSQL + RLS) + Dexie 4 (IndexedDB) + React Hook Form + Zod + shadcn/ui + Playwright + Vitest

---

## Pré-requisitos

Antes de começar, confirme que as variáveis de ambiente estão configuradas em `.env`:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

---

# SPRINT 1 — Holding / Empresas

## Task 1: Migração SQL — tabela `empresas`

**Files:**
- Create: `supabase/migrations/004_empresas.sql`

- [ ] **Criar o arquivo de migração**

```sql
-- supabase/migrations/004_empresas.sql

CREATE TABLE IF NOT EXISTS empresas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      varchar(255) NOT NULL,
  cnpj      varchar(18),
  logo_url  text,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated select empresas"
  ON empresas FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated insert empresas"
  ON empresas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated update empresas"
  ON empresas FOR UPDATE TO authenticated USING (true);
```

- [ ] **Aplicar no Supabase**

No painel do Supabase → SQL Editor → colar e executar.
Confirmar que a tabela aparece em Table Editor.

- [ ] **Inserir empresa inicial (backfill)**

```sql
-- Executar APÓS criar a tabela. Insere a empresa padrão Sarelli.
INSERT INTO empresas (nome, cnpj)
VALUES ('Dra. Fernanda Sarelli', NULL)
ON CONFLICT DO NOTHING;
```

Copiar o `id` gerado — será usado no backfill das contas existentes (Sprint 2).

- [ ] **Commit**

```bash
git add supabase/migrations/004_empresas.sql
git commit -m "feat(db): add empresas table with RLS"
```

---

## Task 2: `EmpresaContext.tsx`

**Files:**
- Create: `src/contexts/EmpresaContext.tsx`
- Create: `src/test/EmpresaContext.test.tsx`

- [ ] **Escrever o teste antes do código (RED)**

```typescript
// src/test/EmpresaContext.test.tsx
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmpresaProvider, useEmpresa } from '@/contexts/EmpresaContext';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({
          data: [{ id: 'e1', nome: 'Empresa A', cnpj: null, logo_url: null, criado_em: '' }],
          error: null,
        }),
      }),
    }),
  },
}));

function TestConsumer() {
  const { empresaAtiva, empresas, loading } = useEmpresa();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <span data-testid="count">{empresas.length}</span>
      <span data-testid="ativa">{empresaAtiva?.nome ?? 'none'}</span>
    </div>
  );
}

describe('EmpresaContext', () => {
  beforeEach(() => localStorage.clear());

  it('loads companies from Supabase', async () => {
    render(<EmpresaProvider><TestConsumer /></EmpresaProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });

  it('restores empresa ativa from localStorage', async () => {
    const empresa = { id: 'e1', nome: 'Empresa A', cnpj: null, logo_url: null, criado_em: '' };
    localStorage.setItem('sarelli_empresa_ativa', JSON.stringify(empresa));
    render(<EmpresaProvider><TestConsumer /></EmpresaProvider>);
    await waitFor(() => expect(screen.getByTestId('ativa').textContent).toBe('Empresa A'));
  });
});
```

- [ ] **Rodar para confirmar falha (RED)**

```bash
npm run test -- src/test/EmpresaContext.test.tsx
```
Esperado: FAIL — "cannot find module '@/contexts/EmpresaContext'"

- [ ] **Implementar `EmpresaContext.tsx` (GREEN)**

```typescript
// src/contexts/EmpresaContext.tsx
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

  useEffect(() => { fetchEmpresas(); }, []);

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
```

- [ ] **Rodar testes (GREEN)**

```bash
npm run test -- src/test/EmpresaContext.test.tsx
```
Esperado: PASS (2 testes)

- [ ] **Commit**

```bash
git add src/contexts/EmpresaContext.tsx src/test/EmpresaContext.test.tsx
git commit -m "feat(context): add EmpresaContext with localStorage persistence"
```

---

## Task 3: `CompanySelectorPage.tsx`

**Files:**
- Create: `src/pages/CompanySelectorPage.tsx`

- [ ] **Criar a página**

```typescript
// src/pages/CompanySelectorPage.tsx
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
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-rose-400 flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Selecione uma empresa</h1>
        <p className="text-sm text-muted-foreground mt-1">Holding Sarelli</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl">
        {empresas.map((empresa) => (
          <button
            key={empresa.id}
            onClick={() => handleEnter(empresa)}
            className="border rounded-xl p-6 flex flex-col items-center gap-3 hover:shadow-md hover:border-primary/40 transition-all text-left group bg-card"
          >
            {empresa.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.nome}
                className="w-14 h-14 rounded-full object-cover border"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {empresa.nome[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="text-center">
              <p className="font-semibold text-foreground">{empresa.nome}</p>
              {empresa.cnpj && (
                <p className="text-xs text-muted-foreground mt-0.5">{empresa.cnpj}</p>
              )}
            </div>
            <Button size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity mt-1">
              Entrar
            </Button>
          </button>
        ))}

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
```

- [ ] **Commit**

```bash
git add src/pages/CompanySelectorPage.tsx
git commit -m "feat(pages): add CompanySelectorPage with company grid"
```

---

## Task 4: `NovaEmpresaDialog.tsx`

**Files:**
- Create: `src/components/NovaEmpresaDialog.tsx`

- [ ] **Criar o dialog**

```typescript
// src/components/NovaEmpresaDialog.tsx
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
              placeholder="Ex: Sarelli Consultoria"
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
```

- [ ] **Commit**

```bash
git add src/components/NovaEmpresaDialog.tsx
git commit -m "feat(components): add NovaEmpresaDialog"
```

---

## Task 5: Atualizar `App.tsx` — EmpresaProvider + rotas

**Files:**
- Modify: `src/App.tsx`

- [ ] **Adicionar EmpresaProvider, EmpresaRoute e rota `/empresas`**

Substituir o conteúdo de `src/App.tsx` por:

```typescript
// src/App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { EmpresaProvider, useEmpresa } from "@/contexts/EmpresaContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NovaContaPage from "./pages/NovaContaPage";
import ContaDetalhePage from "./pages/ContaDetalhePage";
import RelatoriosPage from "./pages/RelatoriosPage";
import PerfilPage from "./pages/PerfilPage";
import AdminDashboard from "./pages/AdminDashboard";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import RelatorioMensalPage from "./pages/RelatorioMensalPage";
import CompanySelectorPage from "./pages/CompanySelectorPage";
import FuncionariosPage from "./pages/rh/FuncionariosPage";
import NovoFuncionarioPage from "./pages/rh/NovoFuncionarioPage";
import FuncionarioDetalhePage from "./pages/rh/FuncionarioDetalhePage";
import NotFound from "./pages/NotFound";
import VersionMonitor from "./components/VersionMonitor";
import InstallPWA from "./components/InstallPWA";
import { useOfflineSync } from "./hooks/useOfflineSync";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Redireciona para /empresas se não há empresa ativa
function EmpresaRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { empresaAtiva, loading: empresaLoading } = useEmpresa();
  if (authLoading || empresaLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!empresaAtiva) return <Navigate to="/empresas" replace />;
  return <>{children}</>;
}

function Spinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-xl gradient-primary animate-pulse" />
    </div>
  );
}

function GlobalOfflineSync() {
  useOfflineSync();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GlobalOfflineSync />
      <InstallPWA />
      <VersionMonitor />
      <Toaster position="top-center" duration={3000} />
      <BrowserRouter>
        <AuthProvider>
          <EmpresaProvider>
            <Routes>
              {/* Pública */}
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

              {/* Seletor de empresa (requer auth, não requer empresa ativa) */}
              <Route path="/empresas" element={<ProtectedRoute><CompanySelectorPage /></ProtectedRoute>} />

              {/* Usuário comum (requer auth + empresa ativa) */}
              <Route path="/" element={<EmpresaRoute><DashboardPage /></EmpresaRoute>} />
              <Route path="/nova-conta" element={<EmpresaRoute><NovaContaPage /></EmpresaRoute>} />
              <Route path="/conta/:id" element={<EmpresaRoute><ContaDetalhePage /></EmpresaRoute>} />
              <Route path="/perfil" element={<EmpresaRoute><PerfilPage /></EmpresaRoute>} />

              {/* RH */}
              <Route path="/rh/funcionarios" element={<EmpresaRoute><FuncionariosPage /></EmpresaRoute>} />
              <Route path="/rh/funcionarios/novo" element={<EmpresaRoute><NovoFuncionarioPage /></EmpresaRoute>} />
              <Route path="/rh/funcionarios/:id" element={<EmpresaRoute><FuncionarioDetalhePage /></EmpresaRoute>} />

              {/* Admin only */}
              <Route path="/relatorios" element={<AdminRoute><RelatoriosPage /></AdminRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/usuarios" element={<AdminRoute><GerenciarUsuarios /></AdminRoute>} />
              <Route path="/admin/relatorio" element={<AdminRoute><RelatorioMensalPage /></AdminRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </EmpresaProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
```

> Nota: `FuncionariosPage`, `NovoFuncionarioPage` e `FuncionarioDetalhePage` ainda não existem — o app vai compilar com erro até o Sprint 3 Task 12-14. Se quiser compilar antes, comente essas 3 rotas.

- [ ] **Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): add EmpresaProvider, EmpresaRoute, and company selector route"
```

---

## Task 6: Atualizar `AppLayout.tsx` — empresa ativa no header

**Files:**
- Modify: `src/components/AppLayout.tsx`

- [ ] **Adicionar empresa ativa no header e botão "Trocar"**

Substituir o conteúdo de `src/components/AppLayout.tsx` por:

```typescript
// src/components/AppLayout.tsx
import { ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PlusCircle, BarChart3, User, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { cn } from '@/lib/utils';
import InstallPWA from '@/components/InstallPWA';

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { empresaAtiva } = useEmpresa();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            window.addEventListener('pagehide', () => window.location.reload(), { once: true });
          }
        });
      });
    });
  }, []);

  const navItems = [
    { path: '/', icon: Home, label: 'Início' },
    { path: '/nova-conta', icon: PlusCircle, label: 'Nova' },
    { path: '/rh/funcionarios', icon: Users, label: 'RH' },
    ...(isAdmin ? [
      { path: '/admin', icon: TrendingUp, label: 'Gestão' },
      { path: '/admin/relatorio', icon: BarChart3, label: 'Relatório' },
    ] : []),
    { path: '/perfil', icon: User, label: 'Perfil' },
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
      <div className="bg-gradient-to-r from-primary via-rose-400 to-pink-300 h-1 sticky top-0 z-50" />

      <header className="sticky top-1 z-40 bg-card border-b border-border px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-rose-400 flex items-center justify-center shadow-md shrink-0">
              <span className="text-xs font-black text-primary-foreground">
                {empresaAtiva?.nome?.[0]?.toUpperCase() ?? 'FS'}
              </span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">
                {empresaAtiva?.nome ?? 'Contas a Pagar'}
              </h1>
              <button
                onClick={() => navigate('/empresas')}
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                Trocar empresa →
              </button>
            </div>
          </div>
          {isAdmin && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Admin
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 pb-24 hide-scrollbar">
        {children}
      </main>

      <InstallPWA />

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-2xl mx-auto flex justify-around items-center h-16">
          {navItems.map(item => {
            const active = location.pathname === item.path ||
              (item.path === '/rh/funcionarios' && location.pathname.startsWith('/rh'));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 px-3 transition-all active:scale-90 min-w-[52px]',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                <span className={cn('text-[9px] leading-none', active ? 'font-bold' : 'font-medium')}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "feat(layout): show active empresa in header with company switcher"
```

---

# SPRINT 2 — Contas Segregadas por Empresa

## Task 7: Migração SQL — `empresa_id` em tabelas existentes

**Files:**
- Create: `supabase/migrations/005_empresa_id_columns.sql`

- [ ] **Criar migração**

```sql
-- supabase/migrations/005_empresa_id_columns.sql

ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);
ALTER TABLE fornecedores  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa ON contas_pagar(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa  ON fornecedores(empresa_id);
```

- [ ] **Aplicar no Supabase** (SQL Editor)

- [ ] **Backfill — associar dados existentes à empresa padrão**

```sql
-- Substituir 'SEU-UUID-AQUI' pelo id copiado na Task 1
UPDATE contas_pagar SET empresa_id = 'SEU-UUID-AQUI' WHERE empresa_id IS NULL;
UPDATE fornecedores  SET empresa_id = 'SEU-UUID-AQUI' WHERE empresa_id IS NULL;
```

- [ ] **Commit**

```bash
git add supabase/migrations/005_empresa_id_columns.sql
git commit -m "feat(db): add empresa_id to contas_pagar and fornecedores"
```

---

## Task 8: Dexie v3 — adicionar `empresa_id` ao cache local

**Files:**
- Modify: `src/lib/dexieDb.ts`

- [ ] **Adicionar `empresa_id` em `LocalConta` e versão 3 do schema Dexie**

Em `src/lib/dexieDb.ts`, adicionar `empresa_id` na interface `LocalConta`:

```typescript
// Na interface LocalConta, após a linha `atualizado_em: string;`
empresa_id: string | null;
```

Adicionar versão 3 do banco Dexie, após o bloco `version(2)`:

```typescript
    // Version 3: add empresa_id index to contas
    this.version(3).stores({
      syncQueue: '++id, operationId, table, action, status, timestamp',
      contas: 'id, _monthKey, _syncStatus, criado_por, status, data_vencimento, empresa_id',
      usuarios: 'id, auth_user_id',
      attachments: 'id, contaId, uploaded',
      syncMeta: 'key'
    });
```

- [ ] **Commit**

```bash
git add src/lib/dexieDb.ts
git commit -m "feat(db): add empresa_id to Dexie LocalConta schema (v3)"
```

---

## Task 9: Filtrar queries de contas por `empresa_id`

**Files:**
- Modify: `src/lib/offlineStore.ts`

- [ ] **Atualizar `fetchAndCacheContas` para aceitar e filtrar por `empresa_id`**

Alterar a assinatura da função `fetchAndCacheContas` (linha 21):

```typescript
// Antes:
export async function fetchAndCacheContas(month: Date): Promise<LocalConta[]> {

// Depois:
export async function fetchAndCacheContas(month: Date, empresaId: string): Promise<LocalConta[]> {
```

Na query Supabase, após `.lte('data_vencimento', fim)`, adicionar:

```typescript
    .eq('empresa_id', empresaId)
```

No mapeamento `localContas`, após `atualizado_em: c.atualizado_em,`, adicionar:

```typescript
    empresa_id: c.empresa_id ?? null,
```

Alterar `getLocalContas` para filtrar por empresa:

```typescript
// Antes:
export async function getLocalContas(month: Date): Promise<LocalConta[]> {
  const monthKey = getMonthKey(month);
  return db.contas.where('_monthKey').equals(monthKey).toArray();
}

// Depois:
export async function getLocalContas(month: Date, empresaId?: string): Promise<LocalConta[]> {
  const monthKey = getMonthKey(month);
  const all = await db.contas.where('_monthKey').equals(monthKey).toArray();
  if (!empresaId) return all;
  return all.filter(c => c.empresa_id === empresaId);
}
```

- [ ] **Commit**

```bash
git add src/lib/offlineStore.ts
git commit -m "feat(offline): filter contas by empresa_id"
```

---

## Task 10: Injetar `empresa_id` na criação de contas

**Files:**
- Modify: `src/pages/NovaContaPage.tsx` (localizar onde a conta é criada e adicionar `empresa_id`)

- [ ] **Encontrar onde a conta é inserida**

```bash
grep -n "addSyncOperation\|from('contas_pagar').insert" src/pages/NovaContaPage.tsx
```

- [ ] **Adicionar `useEmpresa` e injetar `empresa_id` no payload**

No topo do componente `NovaContaPage`, adicionar:

```typescript
import { useEmpresa } from '@/contexts/EmpresaContext';
// ...dentro do componente:
const { empresaAtiva } = useEmpresa();
```

No objeto de payload enviado ao Supabase/syncQueue, adicionar:

```typescript
empresa_id: empresaAtiva?.id ?? null,
```

- [ ] **Mesma mudança em `ContaDetalhePage.tsx`** para operações de UPDATE

```bash
grep -n "addSyncOperation\|from('contas_pagar')" src/pages/ContaDetalhePage.tsx
```

Adicionar `empresa_id: empresaAtiva?.id` nos payloads de update/insert onde não estiver presente.

- [ ] **Commit**

```bash
git add src/pages/NovaContaPage.tsx src/pages/ContaDetalhePage.tsx
git commit -m "feat(contas): inject empresa_id on create/update"
```

---

# SPRINT 3 — Módulo RH

## Task 11: Migração SQL — `funcionarios` + `pagamentos_funcionarios`

**Files:**
- Create: `supabase/migrations/006_funcionarios.sql`

- [ ] **Criar migração**

```sql
-- supabase/migrations/006_funcionarios.sql

CREATE TABLE IF NOT EXISTS funcionarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas(id),
  nome            varchar(255) NOT NULL,
  cpf             varchar(14),
  cargo           varchar(100) NOT NULL,
  salario         numeric(12,2) NOT NULL,
  data_admissao   date NOT NULL,
  banco           varchar(100),
  agencia         varchar(20),
  conta           varchar(30),
  pix             varchar(100),
  contrato_url    text,
  ativo           boolean DEFAULT true,
  criado_em       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagamentos_funcionarios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id    uuid NOT NULL REFERENCES funcionarios(id),
  empresa_id        uuid NOT NULL REFERENCES empresas(id),
  mes_referencia    date NOT NULL,
  valor_pago        numeric(12,2) NOT NULL,
  forma_pagamento   varchar(50) NOT NULL,
  data_pagamento    date NOT NULL,
  status            varchar(20) DEFAULT 'Pago',
  comprovante_url   text,
  observacoes       text,
  pago_por          uuid REFERENCES usuarios(id),
  criado_em         timestamptz DEFAULT now()
);

ALTER TABLE funcionarios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos_funcionarios  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated select funcionarios"
  ON funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert funcionarios"
  ON funcionarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update funcionarios"
  ON funcionarios FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated select pagamentos"
  ON pagamentos_funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert pagamentos"
  ON pagamentos_funcionarios FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_funcionarios_empresa    ON funcionarios(empresa_id);
CREATE INDEX idx_pagamentos_funcionario  ON pagamentos_funcionarios(funcionario_id);
CREATE INDEX idx_pagamentos_mes          ON pagamentos_funcionarios(mes_referencia);
```

- [ ] **Aplicar no Supabase** (SQL Editor)

- [ ] **Commit**

```bash
git add supabase/migrations/006_funcionarios.sql
git commit -m "feat(db): add funcionarios and pagamentos_funcionarios tables"
```

---

## Task 12: `FuncionariosPage.tsx`

**Files:**
- Create: `src/pages/rh/FuncionariosPage.tsx`

- [ ] **Criar diretório e página**

```bash
mkdir -p src/pages/rh
```

```typescript
// src/pages/rh/FuncionariosPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, UserCircle } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  salario: number;
  data_admissao: string;
  ativo: boolean;
}

export default function FuncionariosPage() {
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [pagosEsteMes, setPagosEsteMes] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativo' | 'inativo'>('ativo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaAtiva) return;
    const fetchData = async () => {
      setLoading(true);
      const { data: funcs } = await supabase
        .from('funcionarios')
        .select('id, nome, cargo, salario, data_admissao, ativo')
        .eq('empresa_id', empresaAtiva.id)
        .order('nome');

      const mesAtual = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const { data: pagamentos } = await supabase
        .from('pagamentos_funcionarios')
        .select('funcionario_id')
        .eq('empresa_id', empresaAtiva.id)
        .gte('mes_referencia', mesAtual);

      setFuncionarios((funcs ?? []) as Funcionario[]);
      setPagosEsteMes(new Set((pagamentos ?? []).map((p: any) => p.funcionario_id)));
      setLoading(false);
    };
    fetchData();
  }, [empresaAtiva]);

  const filtered = funcionarios.filter(f => {
    const matchBusca = f.nome.toLowerCase().includes(busca.toLowerCase());
    const matchAtivo = filtroAtivo === 'todos' ? true :
      filtroAtivo === 'ativo' ? f.ativo : !f.ativo;
    return matchBusca && matchAtivo;
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Funcionários</h1>
          <Button size="sm" onClick={() => navigate('/rh/funcionarios/novo')}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          {(['ativo', 'inativo', 'todos'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroAtivo(f)}
              className={cn(
                'text-xs px-3 py-1 rounded-full border transition-colors',
                filtroAtivo === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              )}
            >
              {f === 'ativo' ? 'Ativos' : f === 'inativo' ? 'Inativos' : 'Todos'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <UserCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum funcionário encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(f => {
              const pendente = !pagosEsteMes.has(f.id) && f.ativo;
              return (
                <button
                  key={f.id}
                  onClick={() => navigate(`/rh/funcionarios/${f.id}`)}
                  className="w-full border rounded-xl p-4 flex items-center justify-between hover:border-primary/40 transition-colors bg-card text-left"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{f.nome}</p>
                      {pendente && (
                        <Badge variant="destructive" className="text-[10px] h-4">
                          Pendente
                        </Badge>
                      )}
                      {!f.ativo && (
                        <Badge variant="secondary" className="text-[10px] h-4">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{f.cargo}</p>
                  </div>
                  <p className="text-sm font-medium text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(f.salario)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

- [ ] **Commit**

```bash
git add src/pages/rh/FuncionariosPage.tsx
git commit -m "feat(rh): add FuncionariosPage with salary pending badge"
```

---

## Task 13: `NovoFuncionarioPage.tsx`

**Files:**
- Create: `src/pages/rh/NovoFuncionarioPage.tsx`

- [ ] **Criar schema Zod e página**

```typescript
// src/pages/rh/NovoFuncionarioPage.tsx
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
```

- [ ] **Commit**

```bash
git add src/pages/rh/NovoFuncionarioPage.tsx
git commit -m "feat(rh): add NovoFuncionarioPage with Zod validation"
```

---

## Task 14: `PagarSalarioDialog.tsx`

**Files:**
- Create: `src/components/PagarSalarioDialog.tsx`

- [ ] **Criar dialog de pagamento**

```typescript
// src/components/PagarSalarioDialog.tsx
import { useState, ReactNode } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfMonth } from 'date-fns';

interface Props {
  funcionarioId: string;
  salarioPadrao: number;
  onPago: () => void;
  children: ReactNode;
}

export function PagarSalarioDialog({ funcionarioId, salarioPadrao, onPago, children }: Props) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(String(salarioPadrao));
  const [forma, setForma] = useState('PIX');
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mesRef, setMesRef] = useState(format(startOfMonth(new Date()), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const { empresaAtiva } = useEmpresa();
  const { usuario } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaAtiva) return;
    setLoading(true);
    const { error } = await supabase.from('pagamentos_funcionarios').insert({
      funcionario_id: funcionarioId,
      empresa_id: empresaAtiva.id,
      mes_referencia: `${mesRef}-01`,
      valor_pago: parseFloat(valor),
      forma_pagamento: forma,
      data_pagamento: dataPagamento,
      status: 'Pago',
      pago_por: usuario?.id ?? null,
    });
    if (error) { toast.error('Erro ao registrar pagamento.'); setLoading(false); return; }
    toast.success('Pagamento registrado!');
    setOpen(false);
    onPago();
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mês de Referência</Label>
              <Input
                type="month"
                value={mesRef}
                onChange={(e) => setMesRef(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Forma de Pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="Transferência">Transferência</SelectItem>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : 'Confirmar Pagamento'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Commit**

```bash
git add src/components/PagarSalarioDialog.tsx
git commit -m "feat(rh): add PagarSalarioDialog"
```

---

## Task 15: `FuncionarioDetalhePage.tsx`

**Files:**
- Create: `src/pages/rh/FuncionarioDetalhePage.tsx`

- [ ] **Criar página de detalhe**

```typescript
// src/pages/rh/FuncionarioDetalhePage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { PagarSalarioDialog } from '@/components/PagarSalarioDialog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, DollarSign, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string;
  salario: number;
  data_admissao: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix: string | null;
  contrato_url: string | null;
  ativo: boolean;
}

interface Pagamento {
  id: string;
  mes_referencia: string;
  valor_pago: number;
  forma_pagamento: string;
  data_pagamento: string;
  status: string;
  comprovante_url: string | null;
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function FuncionarioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [func, setFunc] = useState<Funcionario | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [{ data: f }, { data: p }] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('id', id).single(),
      supabase
        .from('pagamentos_funcionarios')
        .select('*')
        .eq('funcionario_id', id)
        .order('mes_referencia', { ascending: false }),
    ]);
    setFunc(f as Funcionario);
    setPagamentos((p ?? []) as Pagamento[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDesativar = async () => {
    if (!func) return;
    const { error } = await supabase
      .from('funcionarios')
      .update({ ativo: !func.ativo })
      .eq('id', func.id);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    toast.success(func.ativo ? 'Funcionário desativado.' : 'Funcionário reativado.');
    fetchData();
  };

  if (loading || !func) {
    return <AppLayout><div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-muted" />)}</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{func.nome}</h1>
              <Badge variant={func.ativo ? 'default' : 'secondary'}>
                {func.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{func.cargo}</p>
          </div>
        </div>

        {/* Dados */}
        <div className="border rounded-xl p-4 space-y-2 bg-card">
          <InfoRow label="Salário" value={brl(func.salario)} highlight />
          {func.cpf && <InfoRow label="CPF" value={func.cpf} />}
          <InfoRow label="Admissão" value={format(new Date(func.data_admissao + 'T12:00:00'), 'dd/MM/yyyy')} />
          {func.pix && <InfoRow label="PIX" value={func.pix} />}
          {func.banco && <InfoRow label="Banco" value={`${func.banco} | Ag: ${func.agencia} | Cc: ${func.conta}`} />}
          {func.contrato_url && (
            <a href={func.contrato_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1">
              <FileText className="w-4 h-4" /> Ver contrato
            </a>
          )}
        </div>

        <div className="flex gap-2">
          <PagarSalarioDialog funcionarioId={func.id} salarioPadrao={func.salario} onPago={fetchData}>
            <Button className="flex-1" disabled={!func.ativo}>
              <DollarSign className="w-4 h-4 mr-1" /> Registrar Pagamento
            </Button>
          </PagarSalarioDialog>
          <Button variant="outline" onClick={handleDesativar}>
            {func.ativo ? 'Desativar' : 'Reativar'}
          </Button>
        </div>

        <Separator />

        <div>
          <h2 className="text-sm font-semibold mb-3">Histórico de Pagamentos</h2>
          {pagamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum pagamento registrado.</p>
          ) : (
            <div className="space-y-2">
              {pagamentos.map(p => (
                <div key={p.id} className="border rounded-xl p-3 bg-card flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(p.mes_referencia + 'T12:00:00'), 'MMMM yyyy', { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.forma_pagamento} • {format(new Date(p.data_pagamento + 'T12:00:00'), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{brl(p.valor_pago)}</p>
                    <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? 'font-bold text-primary' : 'font-medium'}>{value}</span>
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add src/pages/rh/FuncionarioDetalhePage.tsx
git commit -m "feat(rh): add FuncionarioDetalhePage with payment history"
```

---

## Task 16: Verificar compilação

- [ ] **Rodar o dev server e verificar ausência de erros de TypeScript**

```bash
npm run dev
```

Abrir `http://localhost:8080` e verificar:
- [ ] Login funciona
- [ ] Após login, redireciona para `/empresas`
- [ ] Cards de empresas aparecem
- [ ] Clicar numa empresa vai para `/`
- [ ] Header mostra nome da empresa + link "Trocar empresa →"
- [ ] Bottom nav mostra ícone RH
- [ ] Clicar em RH vai para `/rh/funcionarios`

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(sprint3): complete RH module — funcionarios + pagamentos"
```

---

# SPRINT 4 — Melhorias Técnicas

## Task 17: Edge Function — criação automática de contas recorrentes

**Files:**
- Create: `supabase/functions/criar-contas-recorrentes/index.ts`

- [ ] **Criar diretório e função**

```bash
mkdir -p supabase/functions/criar-contas-recorrentes
```

```typescript
// supabase/functions/criar-contas-recorrentes/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const inicioMes = `${ano}-${mes}-01`;
  const fimMes = new Date(ano, hoje.getMonth() + 1, 0);
  const fimMesStr = `${ano}-${mes}-${String(fimMes.getDate()).padStart(2, '0')}`;

  const { data: recorrentes, error } = await supabase
    .from('contas_pagar')
    .select('*')
    .eq('recorrente', true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let criadas = 0;
  let ignoradas = 0;

  for (const conta of recorrentes ?? []) {
    const dia = conta.dia_vencimento_recorrente ?? 1;
    const diaStr = String(Math.min(dia, fimMes.getDate())).padStart(2, '0');
    const dataVencimento = `${ano}-${mes}-${diaStr}`;

    // Verificar idempotência: já existe esta conta neste mês para esta empresa?
    const { data: existente } = await supabase
      .from('contas_pagar')
      .select('id')
      .eq('empresa_id', conta.empresa_id)
      .eq('descricao', conta.descricao)
      .gte('data_vencimento', inicioMes)
      .lte('data_vencimento', fimMesStr)
      .neq('id', conta.id)   // não contar a própria conta-origem
      .maybeSingle();

    if (existente) { ignoradas++; continue; }

    const { error: insertError } = await supabase.from('contas_pagar').insert({
      empresa_id: conta.empresa_id,
      descricao: conta.descricao,
      fornecedor_id: conta.fornecedor_id ?? null,
      fornecedor_nome_livre: conta.fornecedor_nome_livre ?? null,
      categoria: conta.categoria ?? null,
      subcategoria: conta.subcategoria ?? null,
      valor: conta.valor,
      data_emissao: hoje.toISOString().split('T')[0],
      data_vencimento: dataVencimento,
      forma_pagamento: conta.forma_pagamento ?? null,
      status: 'Lancada',
      recorrente: true,
      dia_vencimento_recorrente: dia,
      criado_por: conta.criado_por ?? null,
    });

    if (!insertError) criadas++;
  }

  return new Response(
    JSON.stringify({ criadas, ignoradas, executadoEm: hoje.toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
```

- [ ] **Ativar pg_cron no Supabase** (SQL Editor)

```sql
-- Habilitar extensão pg_cron (apenas se não estiver ativa)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar para dia 1 de cada mês às 06:00 UTC
SELECT cron.schedule(
  'criar-contas-recorrentes',
  '0 6 1 * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/criar-contas-recorrentes',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    )
  $$
);
```

> Nota: `current_setting('app.supabase_url')` e `current_setting('app.service_role_key')` precisam ser configurados no Supabase como variáveis de banco via `ALTER DATABASE ... SET app.xxx = '...'`. Alternativamente, hardcode a URL no cron.

- [ ] **Commit**

```bash
git add supabase/functions/criar-contas-recorrentes/
git commit -m "feat(functions): add Edge Function for monthly recurring bills"
```

---

## Task 18: Realtime subscription no `DashboardPage`

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Localizar o useEffect de fetch principal**

```bash
grep -n "useEffect\|fetchAndCacheContas\|queryClient" src/pages/DashboardPage.tsx | head -20
```

- [ ] **Adicionar subscription Supabase Realtime**

No `DashboardPage`, importar `useQueryClient` e `useEmpresa`, então adicionar este `useEffect` após o fetch principal:

```typescript
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Dentro do componente, junto com os outros estados:
const { empresaAtiva } = useEmpresa();
const queryClient = useQueryClient();

// Adicionar este useEffect após o useEffect de fetch:
useEffect(() => {
  if (!empresaAtiva) return;

  const channel = supabase
    .channel(`contas_${empresaAtiva.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'contas_pagar',
        filter: `empresa_id=eq.${empresaAtiva.id}`,
      },
      () => {
        // Invalida o cache do mês atual para forçar refetch
        queryClient.invalidateQueries({ queryKey: ['contas'] });
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [empresaAtiva?.id, queryClient]);
```

- [ ] **Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat(dashboard): add Supabase Realtime subscription for live updates"
```

---

## Task 19: Playwright E2E — 3 fluxos críticos

**Files:**
- Create: `playwright/auth-empresa.spec.ts`
- Create: `playwright/contas-flow.spec.ts`
- Create: `playwright/funcionario-flow.spec.ts`

- [ ] **Criar arquivo de fixtures/env**

Criar `.env.test` (não commitar):
```
TEST_USER_NOME=seuusuario
TEST_USER_SENHA=suasenha
TEST_BASE_URL=http://localhost:8080
```

- [ ] **`playwright/auth-empresa.spec.ts`**

```typescript
// playwright/auth-empresa.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Auth + Empresa', () => {
  test('login → seletor de empresa → entrar', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="nome"], input[placeholder*="nome"], input[type="text"]', process.env.TEST_USER_NOME!);
    await page.fill('input[name="senha"], input[type="password"]', process.env.TEST_USER_SENHA!);
    await page.click('button[type="submit"]');

    // Deve ir para seletor ou dashboard se empresa já está no localStorage
    await page.waitForURL(/\/(empresas|$)/, { timeout: 10000 });

    if (page.url().includes('/empresas')) {
      // Clicar na primeira empresa disponível
      await page.click('.company-card, button:has-text("Entrar"), [data-testid="empresa-card"]');
      await page.waitForURL('/', { timeout: 5000 });
    }

    await expect(page).toHaveURL('/');
  });

  test('trocar empresa via header', async ({ page }) => {
    await page.goto('/');
    const trocar = page.locator('button:has-text("Trocar empresa"), a:has-text("Trocar empresa")');
    if (await trocar.isVisible()) {
      await trocar.click();
      await expect(page).toHaveURL('/empresas');
    }
  });
});
```

- [ ] **`playwright/contas-flow.spec.ts`**

```typescript
// playwright/contas-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Contas a Pagar', () => {
  test.beforeEach(async ({ page }) => {
    // Login rápido via localStorage (assumindo que a empresa já está selecionada de um teste anterior)
    await page.goto('/login');
    await page.fill('input[type="text"]', process.env.TEST_USER_NOME!);
    await page.fill('input[type="password"]', process.env.TEST_USER_SENHA!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(empresas|$)/, { timeout: 10000 });
    if (page.url().includes('/empresas')) {
      await page.click('button.border-2:not(.border-dashed), [data-testid="empresa-card"]');
      await page.waitForURL('/');
    }
  });

  test('criar conta e verificar na lista', async ({ page }) => {
    await page.goto('/nova-conta');
    await page.fill('input[placeholder*="Descrição"], input[name="descricao"]', 'Conta E2E Teste');
    await page.fill('input[type="number"], input[name="valor"]', '150.00');
    // Preencher data de vencimento
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.first().fill('2026-06-30');
    await page.click('button[type="submit"], button:has-text("Salvar"), button:has-text("Criar")');
    await page.waitForURL('/', { timeout: 5000 });
    await expect(page.locator('text=Conta E2E Teste')).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **`playwright/funcionario-flow.spec.ts`**

```typescript
// playwright/funcionario-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Módulo RH', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', process.env.TEST_USER_NOME!);
    await page.fill('input[type="password"]', process.env.TEST_USER_SENHA!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(empresas|$)/, { timeout: 10000 });
    if (page.url().includes('/empresas')) {
      await page.click('button.border-2:not(.border-dashed), [data-testid="empresa-card"]');
      await page.waitForURL('/');
    }
  });

  test('criar funcionário e ver na lista', async ({ page }) => {
    await page.goto('/rh/funcionarios/novo');
    await page.fill('input[id="nome"], input[placeholder*="Nome"]', 'Funcionário E2E');
    await page.fill('input[id="cargo"], input[placeholder*="cargo"]', 'Analista');
    await page.fill('input[type="number"]', '3500');
    await page.fill('input[type="date"]', '2026-01-01');
    await page.click('button[type="submit"], button:has-text("Cadastrar")');
    await page.waitForURL('/rh/funcionarios', { timeout: 5000 });
    await expect(page.locator('text=Funcionário E2E')).toBeVisible();
  });

  test('registrar pagamento de salário', async ({ page }) => {
    await page.goto('/rh/funcionarios');
    await page.click('text=Funcionário E2E');
    await page.waitForURL(/\/rh\/funcionarios\/.+/);
    await page.click('button:has-text("Registrar Pagamento")');
    // Dialog abre
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.click('button:has-text("Confirmar Pagamento")');
    await expect(page.locator('text=Pagamento registrado')).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Configurar `playwright.config.ts` para ler `.env.test`**

Verificar se `playwright.config.ts` inclui `dotenv`:

```typescript
// No topo de playwright.config.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
```

Se `dotenv` não estiver instalado como devDependency:
```bash
npm install -D dotenv
```

- [ ] **Rodar os testes (requer servidor rodando)**

```bash
# Terminal 1
npm run dev

# Terminal 2
npx playwright test playwright/auth-empresa.spec.ts --headed
```

- [ ] **Commit**

```bash
git add playwright/ .env.test.example
git commit -m "test(e2e): add Playwright specs for auth, contas, and RH flows"
```

---

## Task 20: Atualizar `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Atualizar seção de schema e próximas melhorias**

Adicionar ao CLAUDE.md na seção de Schema Principal:
```markdown
- `empresas` — id, nome, cnpj, logo_url
- `funcionarios` — empresa_id, nome, cpf, cargo, salario, data_admissao, pix, contrato_url, ativo
- `pagamentos_funcionarios` — funcionario_id, empresa_id, mes_referencia, valor_pago, forma_pagamento, status
```

Remover os 10 itens de "Próximas Melhorias" que foram implementados neste plano.

- [ ] **Commit final**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with new schema and completed features"
```

---

## Checklist de QA Final

Após completar todos os sprints, verificar:

- [ ] Login → empresa selecionada → dashboard com dados da empresa correta
- [ ] Criar conta → `empresa_id` preenchido no banco (verificar Supabase Table Editor)
- [ ] Trocar empresa → dados mudam no dashboard
- [ ] Nova empresa → aparece no seletor → entrar nela → criar conta → volta à empresa anterior → conta NÃO aparece
- [ ] Criar funcionário → aparece na lista com badge "Pendente" se mês atual
- [ ] Registrar pagamento → badge some → aparece no histórico
- [ ] Desativar funcionário → badge "Inativo" → botão "Reativar"
- [ ] `npm run lint` sem erros
- [ ] `npm run test` verde
- [ ] `npm run build` sem erros
