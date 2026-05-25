# Design: Holding Multi-Empresa + Módulo RH

**Data:** 2026-05-25  
**Status:** Aprovado pelo usuário  
**Projeto:** Controle Financeiro Sarelli

---

## Contexto

O sistema atual controla contas a pagar de uma única empresa. A holding Sarelli possui múltiplas empresas totalmente independentes (contas, fornecedores e funcionários separados). Todos os usuários cadastrados têm acesso a todas as empresas.

---

## Escopo — 4 Sprints em Sequência

```
Sprint 1 — Holding / Empresas (base para tudo)
Sprint 2 — Contas segregadas por empresa
Sprint 3 — Módulo RH (funcionários + pagamentos)
Sprint 4 — Melhorias técnicas (recorrência, realtime, E2E)
```

---

## Sprint 1 — Holding / Empresas

### Schema

```sql
CREATE TABLE empresas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            varchar(255) NOT NULL,
  cnpj            varchar(18),
  logo_url        text,
  criado_em       timestamptz DEFAULT now()
);

-- RLS: authenticated pode SELECT e INSERT; admin pode UPDATE/DELETE
```

### Estado Global

- `EmpresaContext` expõe `empresaAtiva`, `setEmpresaAtiva`
- `empresaAtiva` persiste em `localStorage` (key: `sarelli_empresa_ativa`)
- Todas as queries passam `empresa_id = empresaAtiva.id`

### Rota Nova

- `/empresas` → `CompanySelectorPage`

### Fluxo de Entrada

```
Login OK
  → empresaAtiva no localStorage?
      Sim → Dashboard
      Não → CompanySelectorPage
```

### CompanySelectorPage

- Grid de cards: logo (ou inicial do nome), nome, CNPJ
- Hover: card eleva, botão "Entrar"
- Último card: dashed border "Nova Empresa"
- Se só 1 empresa cadastrada → redirect automático pro Dashboard
- Botão "Nova Empresa" → `NovaEmpresaDialog`

### NovaEmpresaDialog

Campos:
- Nome (obrigatório)
- CNPJ (opcional, máscara XX.XXX.XXX/XXXX-XX)
- Logo (upload opcional, Supabase Storage `empresas/logos/`)

Ao criar: entra na empresa recém-criada automaticamente.

### Header (AppLayout)

- Exibe logo/nome da empresa ativa
- Botão "Trocar" → navega para `/empresas`

---

## Sprint 2 — Contas Segregadas por Empresa

### Migração

```sql
ALTER TABLE contas_pagar  ADD COLUMN empresa_id uuid REFERENCES empresas(id);
ALTER TABLE fornecedores   ADD COLUMN empresa_id uuid REFERENCES empresas(id);

-- Backfill: associar registros existentes à primeira empresa cadastrada
-- (executar após criar a empresa inicial)
```

### Mudanças de Código

- `offlineStore.ts`: todas as queries `contas_pagar` e `fornecedores` ganham `.eq('empresa_id', empresaAtiva.id)`
- `addSyncOperation`: payload inclui `empresa_id` automaticamente via context
- Dexie `contas` store: adicionar índice `empresa_id`
- `NovaContaPage` / `ContaDetalhePage`: `empresa_id` injetado automaticamente (não visível ao usuário)

### RLS Atualizado

```sql
-- Usuário vê contas da empresa ativa (filtro no client, RLS garante autenticado)
-- Admin vê tudo (política existente mantida)
```

---

## Sprint 3 — Módulo RH

### Schema

```sql
CREATE TABLE funcionarios (
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
  contrato_url    text,           -- upload opcional
  ativo           boolean DEFAULT true,
  criado_em       timestamptz DEFAULT now()
);

CREATE TABLE pagamentos_funcionarios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id    uuid NOT NULL REFERENCES funcionarios(id),
  empresa_id        uuid NOT NULL REFERENCES empresas(id),
  mes_referencia    date NOT NULL,         -- primeiro dia do mês
  valor_pago        numeric(12,2) NOT NULL,
  forma_pagamento   varchar(50) NOT NULL,  -- PIX | Transferência | Dinheiro
  data_pagamento    date NOT NULL,
  status            varchar(20) DEFAULT 'Pago',
  comprovante_url   text,
  observacoes       text,
  pago_por          uuid REFERENCES usuarios(id),
  criado_em         timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_funcionarios_empresa ON funcionarios(empresa_id);
CREATE INDEX idx_pagamentos_funcionario ON pagamentos_funcionarios(funcionario_id);
CREATE INDEX idx_pagamentos_mes ON pagamentos_funcionarios(mes_referencia);
```

### Rotas

```
/rh/funcionarios           → FuncionariosPage (lista)
/rh/funcionarios/novo      → NovoFuncionarioPage
/rh/funcionarios/:id       → FuncionarioDetalhePage
```

### FuncionariosPage

- Tabela: nome, cargo, salário (BRL), data admissão, status (Ativo/Inativo)
- Busca por nome, filtro Ativo/Inativo
- Badge vermelho "Salário pendente" se não há `pagamentos_funcionarios` no mês atual
- Botão "Novo Funcionário"
- Filtra por `empresa_id` da empresa ativa

### NovoFuncionarioPage / Edição

Formulário com React Hook Form + Zod:
- **Pessoal:** nome*, CPF, cargo*, data admissão*
- **Financeiro:** salário*, banco, agência, conta, PIX
- **Contrato:** upload PDF (opcional, componente `FileUpload` existente)

Validações:
- CPF: formato `000.000.000-00`
- Salário: > 0
- Data admissão: não futura

### FuncionarioDetalhePage

**Seção superior:** dados completos + botão Editar + botão "Desativar" (soft delete)

**Seção inferior — Histórico de Pagamentos:**
- Timeline mensal com: mês de referência, valor pago, forma, data, link comprovante
- Badge de status: `Pago` (verde) / `Pendente` (amarelo — se mês atual sem registro)
- Botão "Registrar Pagamento" → `PagarSalarioDialog`

### PagarSalarioDialog

Campos:
- Mês referência (date picker, mês/ano)
- Valor (pré-preenchido com `funcionario.salario`, editável)
- Forma de pagamento (select: PIX, Transferência, Dinheiro)
- Data pagamento (default: hoje)
- Comprovante (upload opcional)
- Observações

Ao salvar: insere em `pagamentos_funcionarios` + toast "Pagamento registrado".

### Navegação

Item "RH" no menu lateral (`AppLayout`), com sub-items:
- Funcionários

---

## Sprint 4 — Melhorias Técnicas

### 1. Recorrência Automática

**Edge Function:** `supabase/functions/criar-contas-recorrentes/index.ts`

Lógica:
1. Busca todas `contas_pagar` com `recorrente = true`
2. Para cada uma, calcula data de vencimento do mês atual (`dia_vencimento_recorrente`)
3. Verifica se já existe conta com mesma `descricao` + `empresa_id` + mês atual
4. Se não existe → cria cópia com `status = 'Lancada'` e `data_emissao = hoje`
5. Retorna sumário `{ criadas: N, ignoradas: N }`

**pg_cron:** `SELECT cron.schedule('criar-contas-recorrentes', '0 6 1 * *', 'SELECT net.http_post(...)');`

**Idempotência:** verificação por `(empresa_id, descricao, date_trunc('month', data_vencimento))` antes de inserir.

### 2. Real-time no Dashboard

Em `DashboardPage`:
```typescript
supabase
  .channel('contas_pagar_realtime')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'contas_pagar',
    filter: `empresa_id=eq.${empresaAtiva.id}`
  }, (payload) => {
    queryClient.invalidateQueries(['contas', mesAtual]);
    // toast discreto apenas em INSERT de outro usuário
  })
  .subscribe();
```

Cleanup no `useEffect` return.

### 3. Testes E2E Playwright

5 specs em `playwright/`:

| Arquivo | Fluxo |
|---|---|
| `auth.spec.ts` | Login → seletor empresas → entrar → dashboard |
| `contas.spec.ts` | Criar conta → ver na lista → marcar paga → verificar status |
| `empresa-switch.spec.ts` | Criar 2 empresas → trocar → confirmar isolamento de dados |
| `funcionario.spec.ts` | Criar funcionário → ver na lista → registrar pagamento |
| `recorrencia.spec.ts` | Criar conta recorrente → chamar Edge Function → verificar criação |

---

## Ordem de Implementação Recomendada

1. Schema SQL (migrations): `empresas` → colunas em tabelas existentes → `funcionarios` → `pagamentos_funcionarios`
2. `EmpresaContext` + `localStorage`
3. `CompanySelectorPage` + `NovaEmpresaDialog`
4. Ajuste de todas as queries existentes para filtrar por `empresa_id`
5. Header com empresa ativa + botão trocar
6. Módulo RH (pages + components)
7. Edge Function recorrência + pg_cron
8. Realtime subscription no Dashboard
9. Playwright E2E specs

---

## Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Acesso empresas | Todos veem todas | Simplifica auth, holding pequena |
| Empresa ativa | localStorage + Context | Persiste entre sessões, offline-first compatível |
| Funcionários inativos | Soft delete (`ativo=false`) | Preserva histórico de pagamentos |
| Pagamentos | Individual por funcionário | Controle granular, comprovante por pessoa |
| Upload contrato | Mesmo `FileUpload` existente | Reutiliza lógica de Storage já validada |
| Backfill empresa_id | Script manual pós-migração | Seguro, evita assumir empresa padrão |

---

## Arquivos Novos

```
src/
  contexts/EmpresaContext.tsx
  pages/
    CompanySelectorPage.tsx
    rh/FuncionariosPage.tsx
    rh/NovoFuncionarioPage.tsx
    rh/FuncionarioDetalhePage.tsx
  components/
    NovaEmpresaDialog.tsx
    PagarSalarioDialog.tsx
supabase/
  migrations/
    004_empresas.sql
    005_funcionarios.sql
  functions/
    criar-contas-recorrentes/index.ts
playwright/
  auth.spec.ts
  contas.spec.ts
  empresa-switch.spec.ts
  funcionario.spec.ts
  recorrencia.spec.ts
```

## Arquivos Modificados

```
src/
  App.tsx                    (novas rotas, EmpresaProvider)
  components/AppLayout.tsx   (header empresa ativa, menu RH)
  lib/offlineStore.ts        (filtros empresa_id)
  lib/dexieDb.ts             (índice empresa_id)
  pages/DashboardPage.tsx    (realtime subscription)
  hooks/useAuth.tsx          (sem mudança de interface)
```
