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
├── sw.js               # Service Worker (cache-first shell, network-first Supabase) — bumpar CACHE_NAME a cada deploy
├── vercel.json         # Headers: sw.js sem cache, .js/.css max-age=3600, imagens imutáveis
├── css/
│   ├── tokens.css      # Design tokens (cores, sombras, keyframes)
│   ├── base.css        # Reset + tipografia + utilitários
│   ├── auth.css        # Tela de login/cadastro
│   └── app.css         # Componentes do app (cards, modais, charts, etc.)
├── js/
│   ├── config.js       # Supabase URL + anon key (placeholders até configurar)
│   ├── utils.js        # formatCurrency, compactBRL, monthName, todayISO, isoDate, prevMonth
│   ├── db.js           # Todas as queries Supabase (profiles, expenses, budgets, categories)
│   ├── offline-queue.js# IndexedDB queue para gastos offline + syncPendingExpenses()
│   ├── reorder.js      # initReorder(): arrastar para reordenar listas pela alça (≡)
│   ├── home.js         # View home (resumo mensal, últimos 10 gastos clicáveis, donut mini)
│   ├── historico.js    # View histórico (rodapé gasto+saldo, lixeira visível, filtros por categoria)
│   ├── perfil.js       # View perfil + view orçamentos + CRUD de categorias/subcategorias
│   ├── graficos.js     # View gráficos (donut por categoria, donut por subcategoria, barras por mês)
│   ├── expense-modal.js# Modal novo/editar gasto (numpad customizado, parcelamento, pickers com CRUD inline)
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

### CRUD de categorias e subcategorias no picker
`#cat-picker` serve as duas listas; `_pickerMode` (`'cat'` | `'sub'`) diz qual está na tela, e o
botão "Nova" decide o que criar a partir dele. O seletor de mês dos gráficos reaproveita o mesmo
picker — por isso `openGrafMonthPicker()` esconde "Nova" e o "voltar".  
Cada item tem alça de arrasto (≡) e lápis. O padrão dos modais é o mesmo nos dois níveis:
`openCatEditModal(id)` / `openSubcatEditModal(id)` editam, `(null)` cria.  
`closeCatEditModal()` re-renderiza o picker via `openCategoryPicker()` se ele estiver aberto.  
As subcategorias do modal de edição da categoria são uma **lista vertical** (não chips em wrap):
o reordenar é um arrasto para cima/baixo.

### Ordem de exibição
`categories.position` e `subcategories.position` guardam a ordem. `initReorder()` (`js/reorder.js`)
liga o arrasto pela alça — nunca pelo item inteiro, senão conflita com o toque que seleciona.  
`getCategories()` ordena os dois níveis (`referencedTable: 'subcategories'` para o aninhado).

### Exclusão de categoria/subcategoria
Só exclui se **não houver gasto vinculado**; havendo, mostra a mensagem e nem abre o confirm.  
Não é cosmético: `expenses.category_id` e `expenses.subcategory_id` referenciam suas tabelas
**sem `on delete`** (NO ACTION), então o banco recusa com erro de FK. As contagens
(`countExpensesByCategory` / `countExpensesBySubcategory`) existem para explicar o porquê.  
Um gasto em subcategoria também aponta para a categoria, então contar por `category_id` já cobre
os gastos das subcategorias dela.  
`deleteSubcategoryGuarded()` centraliza a regra (usada pelo × dos chips e pelo modal do picker).

### Empilhamento de modais
Todos os `.modal-overlay` têm `z-index: 100` e empilham por **ordem no DOM**. O `#confirm-modal`
vem antes dos modais de edição no HTML mas é aberto a partir deles, então tem `z-index: 110`
explícito — sem isso, renderiza atrás.  
`_findTopmostModal()` decide qual modal o botão "voltar" fecha e é uma **lista fixa de ids**: a
ordem tem que espelhar o empilhamento real, e modal novo precisa ser adicionado nela, senão o
back fecha o de baixo e deixa o novo órfão na tela.

### Confirm modal flexível
`showConfirm(title, labelSingle, labelAll, onSingle, onAll)` — quando `labelAll` é `null`, o segundo botão fica oculto.  
Usado tanto para confirmação simples ("Excluir?") quanto para escolhas de parcelamento.

### Histórico — excluir
Cada item tem lixeira sempre visível (`.hist-del-btn`). Toque na lixeira → `showConfirm`.  
Parcelados: confirmação com duas opções (só esta / todas). Simples: confirmação única.  
Toque no corpo do item → abre modal de edição.

### Gráficos
Três: donut por **categoria**, donut por **subcategoria** e barras **por mês** (ano inteiro).  
Nas barras, a linha da meta é um **patamar por mês** (degraus quando muda) — não a média do ano:
a meta de março vale março inteiro, e ligar os meses por diagonal sugeriria uma meta mudando no
meio do mês. Por isso a escala usa o maior entre o maior gasto e a **maior meta**, senão a linha
sairia do topo.  
Cada barra mostra o total escrito na vertical (`BAR_LABEL_FS`, `compactBRL()` em `utils.js`),
dentro da barra quando cabe e acima dela quando não cabe. Os valores só aparecem depois da
animação, senão flutuam sobre o fundo enquanto a barra cresce.

### Service Worker
`CACHE_NAME` em `sw.js` deve ser incrementado a cada deploy para invalidar o cache PWA.  
Arquivo novo em `js/` precisa entrar **nos dois lugares**: `<script>` no `index.html` e `SHELL` no `sw.js`.

**O cache tem que ser o retrato de um deploy só.** Já quebrou o app em produção uma vez
(commit 6c5c646): a home não renderizava e o pull-to-refresh morria porque um `app.js` novo
carregou junto com um `index.html` velho, e o `getElementById` de um elemento que só existia
no HTML novo estourava no meio do boot. Três defesas, não mexer sem entender:

- `install` usa `cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))`. Sem o
  `reload`, o `max-age=3600` dos `.js` no `vercel.json` deixa o `addAll` gravar JS de até 1h
  atrás ao lado de um HTML novo.
- `sw.js` mantém `skipWaiting` + `clients.claim` (a versão nova precisa assumir logo), e o
  `app.js` recarrega a página **uma vez** no `controllerchange`. É esse reload que garante HTML e
  JS do mesmo deploy quando o SW troca no meio do carregamento. Não recarrega se não havia
  `controller` (primeira instalação), senão pisca à toa.
- Esse listener fica **no topo do `app.js`, fora do `DOMContentLoaded`**, de propósito: é o
  mecanismo de recuperação, e precisa rodar mesmo se o boot quebrar. Ele já existiu dentro do
  `DOMContentLoaded` e era inútil exatamente quando mais fazia falta. Pelo mesmo motivo, note que
  `serviceWorker.register()`/`reg.update()` só acontecem no fim do `DOMContentLoaded`: um throw
  antes deles impede o app de buscar a versão que o consertaria. **Só um listener de
  `controllerchange` no projeto.**

### Boot resiliente
Os `init*` passam por `initUI()`, que isola cada um em `try/catch`. Uma tela cujo wiring falhe
não pode impedir o `navigate()` e o `initPullToRefresh()` que vêm depois — são eles que deixam o
app utilizável e permitem a recuperação. Ao adicionar um `init*`, colocar na lista de `initUI()`.

## Convenções de código

- Sem TypeScript, sem transpilação — JS puro ES2020+
- Funções globais entre arquivos (sem módulos ES): cada arquivo expõe funções que outros chamam diretamente
- Não usar `console.log` em produção
- CSS via custom properties (`var(--primary)`, `var(--bg-card)`, etc.) — tokens em `css/tokens.css`
- Números monetários sempre via `formatCurrency()` de `utils.js`
- Datas sempre em ISO (`YYYY-MM-DD`) internamente; exibição via `monthName()` e `formatCurrency()`
