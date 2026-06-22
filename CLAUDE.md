# Lopes Cash — CLAUDE.md

App de controle de gastos pessoais (PWA). Vanilla JS + Supabase + Vercel.

## Stack

- **Frontend:** HTML + CSS + JavaScript vanilla, sem bundler nem framework
- **Banco / Auth:** Supabase (PostgreSQL + Auth email/senha)
- **Deploy:** Vercel via GitHub (push → deploy automático)
- **PWA:** Web App Manifest + Service Worker + offline queue (IndexedDB)

## Estrutura de arquivos

```
lopes-cash/
├── index.html          # SPA principal (views via hash: #home, #historico, #graficos, #perfil, #orcamentos)
├── auth.html           # Login / Cadastro
├── manifest.json       # PWA manifest com ícones oficiais
├── sw.js               # Service Worker v10 (cache-first shell, network-first Supabase) — bumpar a cada deploy
├── vercel.json         # Headers: sw.js sem cache, imagens imutáveis
├── css/
│   ├── tokens.css      # Design tokens (cores, sombras, keyframes)
│   ├── base.css        # Reset + tipografia + utilitários
│   ├── auth.css        # Tela de login/cadastro
│   └── app.css         # Componentes do app (cards, modais, charts, etc.)
├── js/
│   ├── config.js       # Supabase URL + anon key (placeholders até configurar)
│   ├── utils.js        # formatCurrency, monthName, todayISO, isoDate, prevMonth
│   ├── db.js           # Todas as queries Supabase (profiles, expenses, budgets, categories)
│   ├── offline-queue.js# IndexedDB queue para gastos offline + syncPendingExpenses()
│   ├── home.js         # View home (resumo mensal, últimos gastos clicáveis, donut mini)
│   ├── historico.js    # View histórico (botão lixeira visível, filtros por categoria)
│   ├── perfil.js       # View perfil + view orçamentos + CRUD de categorias/subcategorias
│   ├── graficos.js     # View gráficos (donut animado + barras animadas) — agrupado por categoria
│   ├── expense-modal.js# Modal novo/editar gasto (numpad customizado, parcelamento, categoria picker com CRUD inline)
│   ├── app.js          # Bootstrap, roteador hash, tab bar, toast, confirm modal
│   └── auth.js         # Login / Cadastro / Recuperar senha
├── img/icons/          # Ícones PWA oficiais (192, 512, maskable, SVG)
└── sql/schema.sql      # Schema completo para rodar no Supabase (profiles, expenses, budgets, categories)
```

## Roteamento

Hash-based SPA: `location.hash` → `navigate(view)` → `showView(view)`.  
Views permitidas: `home`, `historico`, `graficos`, `perfil`, `orcamentos`.

## Estado global

```js
window.appState = { user, profile, categories, currentView }
```

## Banco de dados (Supabase)

Principais tabelas: `profiles`, `categories`, `subcategories`, `monthly_budgets`, `expenses`.  
RLS habilitado em todas. Trigger `on_auth_user_created` cria o perfil automaticamente.  
Parcelamento: campos `installment_group_id` (UUID), `installment_number`, `installment_total` em `expenses`.

## Offline

Quando `navigator.onLine === false`, novos gastos são salvos no IndexedDB (`js/offline-queue.js`).  
Ao voltar online, `syncPendingExpenses()` envia tudo ao Supabase e atualiza a view atual.  
O banner "Sem conexão · trabalhando offline" fica visível enquanto offline.

## Configurar Supabase (primeira vez)

1. Criar projeto em supabase.com
2. Rodar `sql/schema.sql` no SQL Editor
3. Preencher `js/config.js` com `SUPABASE_URL` e `SUPABASE_ANON_KEY`
4. Em **Authentication → URL Configuration**: adicionar a URL do Vercel em Site URL e Redirect URLs

## Comportamentos importantes

### Numpad customizado
O campo de valor (`#expense-amount`) tem `readonly` + `inputmode="none"` para bloquear o teclado nativo.  
Ao abrir novo gasto, `openNumpad()` é chamado com 120ms de delay (após animação do modal).  
Estado: `_numpadRaw` (string). Máx 12 dígitos, máx 2 casas decimais. `numpadOk()` escreve no campo e fecha.

### CRUD de categorias no picker
O picker de categorias (`#cat-picker`) tem botão "Nova" e ícone de lápis em cada item.  
`openCatEditModal(id)` abre o modal de edição; `openCatEditModal(null)` cria nova.  
`closeCatEditModal()` verifica se o picker está aberto e o re-renderiza automaticamente via `openCategoryPicker()`.  
Subcategorias são chips dentro do modal de edição da categoria.

### Confirm modal flexível
`showConfirm(title, labelSingle, labelAll, onSingle, onAll)` — quando `labelAll` é `null`, o segundo botão fica oculto.  
Usado tanto para confirmação simples ("Excluir?") quanto para escolhas de parcelamento.

### Histórico — excluir
Cada item tem lixeira sempre visível (`.hist-del-btn`). Toque na lixeira → `showConfirm`.  
Parcelados: confirmação com duas opções (só esta / todas). Simples: confirmação única.  
Toque no corpo do item → abre modal de edição.

### Gráficos
Donut e barras agrupam por **categoria** (não subcategoria). Subcategoria é detalhe de organização, não aparece nos gráficos.

### Service Worker
`CACHE_NAME` em `sw.js` deve ser incrementado a cada deploy para invalidar o cache PWA.  
Versão atual: `lopes-cash-v10`.

## Convenções de código

- Sem TypeScript, sem transpilação — JS puro ES2020+
- Funções globais entre arquivos (sem módulos ES): cada arquivo expõe funções que outros chamam diretamente
- Não usar `console.log` em produção
- CSS via custom properties (`var(--primary)`, `var(--bg-card)`, etc.) — tokens em `css/tokens.css`
- Números monetários sempre via `formatCurrency()` de `utils.js`
- Datas sempre em ISO (`YYYY-MM-DD`) internamente; exibição via `monthName()` e `formatCurrency()`
