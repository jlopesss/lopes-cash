-- ============================================================
-- Lopes Cash — Supabase Schema
-- Execute no SQL Editor do seu projeto Supabase
-- ============================================================

-- Perfil do usuário (complementa auth.users)
create table if not exists public.profiles (
  id             uuid references auth.users on delete cascade primary key,
  name           text,
  email          text,
  default_budget numeric(10,2) default 0,
  currency       text default 'BRL',
  language       text default 'pt-BR',
  created_at     timestamptz default now()
);

-- Categorias (seedadas na criação da conta via JS)
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade not null,
  name       text not null,
  emoji      text,
  color      text,
  position   int default 0,
  created_at timestamptz default now()
);

-- Subcategorias
create table if not exists public.subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete cascade not null,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  name        text not null,
  position    int default 0,
  created_at  timestamptz default now()
);

-- Orçamentos mensais (override por mês)
create table if not exists public.monthly_budgets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade not null,
  year       int not null,
  month      int not null,
  amount     numeric(10,2) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, year, month)
);

-- Gastos
create table if not exists public.expenses (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references public.profiles(id) on delete cascade not null,
  category_id          uuid references public.categories(id),
  subcategory_id       uuid references public.subcategories(id),
  amount               numeric(10,2) not null,
  date                 date not null,
  time                 time,
  description          text,
  installment_group_id uuid,
  installment_number   int,
  installment_total    int,
  currency             text default 'BRL',
  original_amount      numeric(10,2),
  original_currency    text,
  exchange_rate        numeric(10,4),
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- Índices
create index if not exists idx_expenses_user_date
  on public.expenses(user_id, date desc);

create index if not exists idx_expenses_user_month
  on public.expenses(user_id, extract(year from date), extract(month from date));

create index if not exists idx_monthly_budgets_lookup
  on public.monthly_budgets(user_id, year, month);

create index if not exists idx_categories_user
  on public.categories(user_id, position);

-- ============================================================
-- Trigger: criar perfil automaticamente ao cadastrar usuário
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.subcategories  enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.expenses       enable row level security;

-- Policies: cada usuário só acessa seus próprios dados

-- profiles
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- categories
create policy "categories_own" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- subcategories
create policy "subcategories_own" on public.subcategories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- monthly_budgets
create policy "budgets_own" on public.monthly_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- expenses
create policy "expenses_own" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
