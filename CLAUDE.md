# Contas a Pagar — Controle Financeiro Sarelli

## Stack
- React 18.3.1 + TypeScript 5.8.3 + Vite 5.4.19
- Supabase 2.99.3 (auth, DB, Storage)
- Dexie 4.4.1 (IndexedDB — offline-first, sync queue)
- shadcn/ui + Tailwind 3.4.17 + Lucide icons
- React Hook Form 7.61.1 + Zod 3.25.76
- TanStack Query 5.83.0 (server state)
- Vitest 3.2.4 + Playwright 1.57.0

## Commands
```bash
npm run dev        # localhost:8080
npm run build      # production
npm run lint       # ESLint
npm run test       # Vitest one-shot
npm run test:watch # TDD mode
```

## .env Required
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

## Architecture

**Offline-first:** toda escrita vai via `addSyncOperation()` → `syncQueue` (Dexie) → `useOfflineSync` sincroniza quando online com retry exponencial (2s * 2^n, max 5min, jitter 25%).

**Auth customizado:** login por nome+senha, não email. `useAuth` → `signInByNome()` → Supabase custom. Timeout de 5s para recovery offline.

**Roles:** `admin` (vê tudo, aprova) vs `user` (vê próprio). Verificar com `useAuth().isAdmin`. RLS enforced no Supabase.

**IDs:** UUIDs gerados no cliente (para funcionar offline antes do sync).

## Onde ficam as coisas
```
src/
  pages/          # rotas (Login, Dashboard, ContaDetalhe, Admin, Relatorios, Perfil)
  components/     # shadcn/ui (50+) + custom (AppLayout, FileUpload, UserSelect)
  hooks/          # useAuth, useOfflineSync, useNotifications
  integrations/supabase/  # client.ts (singleton), types.ts (gerado)
  lib/
    dexieDb.ts    # schema IndexedDB (5 stores)
    offlineStore.ts   # fetchAndCacheContas, addSyncOperation, getLocalContas
    gerarPdfConta.ts  # export PDF (jsPDF)
    utils.ts      # cn(), formatBRL, formatDate
  contexts/
    EmpresaContext.tsx  # empresa ativa + lista de empresas
  pages/rh/
    FuncionariosPage.tsx, NovoFuncionarioPage.tsx, FuncionarioDetalhePage.tsx
  components/
    PagarSalarioDialog.tsx, NovaEmpresaDialog.tsx
supabase/migrations/  # 3 arquivos SQL (schema + seed)
supabase/functions/
  criar-contas-recorrentes/  # Edge Function mensal
```

## Schema Principal
- `empresas` — id, nome, cnpj, logo_url
- `usuarios` — id, auth_user_id, nome, tipo (admin|user)
- `fornecedores` — empresa_id, CNPJ, banco, PIX
- `contas_pagar` — empresa_id, valor, datas, status (Lancada|Paga|Recorrente), forma_pagamento, comprovante_url, recorrente, dia_vencimento_recorrente
- `logs_contas` — audit trail de mudanças de status
- `funcionarios` — empresa_id, nome, cpf, cargo, salario, data_admissao, pix, contrato_url, ativo
- `pagamentos_funcionarios` — funcionario_id, empresa_id, mes_referencia, valor_pago, forma_pagamento, status

## Padrões Obrigatórios
- UI: `cn()` para classes condicionais, nunca inline styles
- Notificações: `toast.success/error()` via Sonner
- Datas: `date-fns` + `ptBR` locale, UTC no banco, formatar na exibição
- Moeda: `R$` BRL, `. ` mil, `,` decimal
- Ícones: `lucide-react` only
- Supabase queries: sempre via `@/integrations/supabase/client`
- Formulários: `useForm` + `zodResolver` obrigatório

## Routing
```
/           → DashboardPage (tabs: Pendentes/Pagas/Vencidas)
/nova-conta → NovaContaPage
/conta/:id  → ContaDetalhePage (edit, upload, PDF, status flow)
/perfil     → PerfilPage
/admin      → AdminDashboard (admin only)
/admin/usuarios → GerenciarUsuarios (admin only)
/relatorios → RelatoriosPage (admin only)
```
Wrappers: `<ProtectedRoute>`, `<AdminRoute>`, `<PublicRoute>`

## Gotchas / Bugs Conhecidos
- tsconfig: `strict: false`, `noUnusedLocals: false` — não ativar sem refatorar
- pdfjs-dist: lazy-loaded (manual chunk) para não estourar bundle
- SW desativado no preview Lovable — verificar em `main.tsx`
- Arquivos: Supabase Storage (`contas-a-pagar-lvb08/contas/...`) → acesso por signed URL
- Workbox cacheia arquivos de storage 7 dias, max 3MB por arquivo

---

## Próximas Melhorias (Prioridade)

### Alta
4. **Strict TypeScript** — ativar `strict: true` e eliminar `any` implícitos (melhor DX e menos bugs)
5. **Bundle analysis** — `vite-bundle-visualizer`; react-pdf + Three.js são pesados, avaliar lazy/dynamic imports
6. **Aprovação multi-step** — workflow visual claro: Lancada → Aprovada (admin) → Paga; hoje aprovado_por existe no schema mas sem UI completa
7. **Filtros no Dashboard** — busca por fornecedor, categoria, valor, período além do mês atual

### Baixa
8. **Fornecedor inline** — editar dados do fornecedor direto no detalhe da conta sem navegar
9. **Export XLSX** — relatório exportável em Excel além de PDF
10. **.env.example** — criar template para onboarding
