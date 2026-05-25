# Identidade Visual Axis — Contas a Pagar

## Objetivo
Substituir a identidade rosa/dourada (Fernanda Sarelli política) pela identidade da Agência Axis: charcoal escuro + prata metálica, mantendo a tipografia Outfit e referenciando Fernanda Sarelli apenas como subtítulo de texto.

## Paleta de Cores

| Token CSS | Valor HSL | Hex | Uso |
|---|---|---|---|
| `--primary` | `220 8% 25%` | `#3A3D42` | botões, nav ativo, destaques |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | texto sobre primary |
| `--secondary` | `220 5% 92%` | `#E8E9EB` | superfícies secundárias |
| `--secondary-foreground` | `220 8% 20%` | `#2E3035` | texto sobre secondary |
| `--accent` | `220 5% 56%` | `#8A8F98` | ícones, subdetalhes, prata médio |
| `--accent-foreground` | `0 0% 100%` | `#FFFFFF` | texto sobre accent |
| `--background` | `220 10% 97%` | `#F5F6F8` | fundo geral |
| `--foreground` | `220 10% 10%` | `#191B1F` | texto principal |
| `--card` | `0 0% 100%` | `#FFFFFF` | cards |
| `--card-foreground` | `220 10% 10%` | `#191B1F` | texto nos cards |
| `--muted` | `220 8% 94%` | `#EDEEF0` | fundo muted |
| `--muted-foreground` | `220 6% 45%` | `#6B7280` | texto muted |
| `--border` | `220 8% 90%` | `#E2E4E8` | bordas |
| `--input` | `220 8% 90%` | `#E2E4E8` | bordas de input |
| `--ring` | `220 8% 25%` | `#3A3D42` | focus ring |
| `--destructive` | `0 72% 51%` | inalterado | erros (semântico) |

Dark mode (`.dark`) segue a mesma lógica: fundo `#0F1115`, primary `#9CA3AF` (prata claro).

Dourado `#c8aa64` removido. Substituído por prata `#9CA3AF` onde era usado como cor de ícone secundário.

Gradiente principal: `linear-gradient(135deg, #3A3D42 0%, #6B7280 50%, #9CA3AF 100%)`

## Tipografia
Sem alterações — mantém **Outfit** (Google Fonts) em todos os pesos.

## Login Page (`LoginPage.tsx`)

### Layout
- Fundo: gradiente escuro `#0F1115 → #1A1D24 → #0F1215` (160deg)
- Animação de nós: cor dos nós/linhas muda de `rgba(236,72,153,...)` para `rgba(150,155,165,...)` (prata)
- Linhas ao mouse: `rgba(154,163,175,...)` no lugar do dourado

### Identidade no topo
- Remove: `<img src={fotoFernanda}>` e `<img src={logoSarelli}>`
- Adiciona: `<img src={logoAxis}>` centralizado, `width: clamp(100px, 22vw, 140px)`, sem borda colorida
- Texto abaixo do logo:
  - `"Fernanda Sarelli"` — Outfit 600, `#FFFFFF`, 18px
  - `"CONTAS A PAGAR"` — Outfit 600, tracking `0.3em`, `#9CA3AF`, 11px uppercase

### Card glassmorphism (dark)
- `background: rgba(20, 23, 28, 0.72)`
- `backdropFilter: blur(16px)`
- `border: 1.5px solid rgba(150,155,165,0.15)`
- `boxShadow: 0 8px 40px rgba(0,0,0,0.35)`
- Inputs: `background: rgba(255,255,255,0.07)`, texto branco, placeholder cinza claro
- Label: `#9CA3AF` (prata)
- Focus borda input: `#8A8F98` (prata médio)

### Botão submit
- `background: linear-gradient(135deg, #3A3D42 0%, #6B7280 50%, #9CA3AF 100%)`
- `boxShadow: 0 6px 24px rgba(0,0,0,0.35)`

### Footer
- Remove link `drafernandacarelli.com.br` e texto político
- Substitui por `"Agência Axis Digital"` em `#6B7280`, 11px

## AppLayout (`AppLayout.tsx`)
- Stripe top: `from-[#3A3D42] via-[#6B7280] to-[#9CA3AF]`
- Avatar header: `bg-gradient-to-br from-[#3A3D42] to-[#6B7280]`
- Nav ativo: `text-[#3A3D42]` (charcoal) substituindo `text-primary` rosa
- Badge Admin: `bg-[#3A3D42]/10 text-[#3A3D42]`

## CSS Variables (`src/index.css`)
Alterar apenas os tokens listados na paleta acima. Manter `--radius: 0.75rem` e todos os tokens de sidebar inalterados em estrutura (só atualizar os valores de cor).

## Assets
- Adicionar `src/assets/logo-axis.png` (o logo fornecido pelo usuário)
- Manter `src/assets/foto-fernanda.png` e `src/assets/Logo_Sarelli.png` no projeto (podem ser usados em outras páginas)

## O que NÃO muda
- Badges de status: Paga (verde), Vencida (vermelho), Pendente (amarelo) — semânticos, não mudam
- Tipografia Outfit
- Layout e estrutura das páginas
- Lógica de negócio

## Testes
- Executar `npm run test` após implementação — nenhum teste deve quebrar (zero dependência visual nos testes)
- Verificar visualmente: Login, CompanySelector, Dashboard, NovaContaPage, GerenciarUsuarios
