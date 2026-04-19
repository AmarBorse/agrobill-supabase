-- ============================================================
--  AgroBill Pro — Supabase Database Schema
--  Run this entire file in: Supabase > SQL Editor > New Query
-- ============================================================

-- 1. USER PROFILES (linked to auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  phone       text,
  created_at  timestamptz default now()
);

-- 2. SHOPS (one per user for now, extensible to many)
create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  address     text,
  gstin       text,
  phone       text,
  created_at  timestamptz default now()
);

-- 3. PRODUCTS
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  category    text not null default 'Seeds',
  unit        text not null default 'kg',
  price       numeric(12,2) not null default 0,
  hsn         text,
  stock       integer default 0,
  gst         integer default 0,   -- GST % : 0, 5, 12, or 18
  created_at  timestamptz default now()
);

-- 4. BILLS
create table public.bills (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  bill_number     text not null,
  shop_name       text,
  shop_address    text,
  shop_gstin      text,
  shop_phone      text,
  customer_name   text default 'Walk-in Customer',
  customer_phone  text,
  subtotal        numeric(12,2) default 0,
  tax_amount      numeric(12,2) default 0,
  discount        numeric(12,2) default 0,
  total           numeric(12,2) default 0,
  bill_date       text,
  bill_time       text,
  created_at      timestamptz default now()
);

-- 5. BILL ITEMS (line items for each bill)
create table public.bill_items (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references public.bills(id) on delete cascade,
  name        text not null,
  hsn         text,
  qty         integer not null default 1,
  unit        text,
  price       numeric(12,2) not null,
  gst         integer default 0,
  tax_amount  numeric(12,2) default 0,
  total       numeric(12,2) default 0
);

-- ============================================================
--  ROW LEVEL SECURITY (RLS) — Users only see their own data
-- ============================================================

alter table public.profiles  enable row level security;
alter table public.shops     enable row level security;
alter table public.products  enable row level security;
alter table public.bills     enable row level security;
alter table public.bill_items enable row level security;

-- PROFILES
create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- SHOPS
create policy "Users can manage own shops"   on public.shops    for all using (auth.uid() = user_id);

-- PRODUCTS
create policy "Users can manage own products" on public.products for all using (auth.uid() = user_id);

-- BILLS
create policy "Users can manage own bills"   on public.bills    for all using (auth.uid() = user_id);

-- BILL ITEMS (access via bill ownership)
create policy "Users can manage own bill items" on public.bill_items
  for all using (
    exists (
      select 1 from public.bills b
      where b.id = bill_items.bill_id and b.user_id = auth.uid()
    )
  );

-- ============================================================
--  AUTO-CREATE PROFILE ON SIGN UP
--  Trigger: When a user registers, auto-insert into profiles
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'User'),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
--  INDEXES for performance
-- ============================================================

create index on public.products  (user_id);
create index on public.bills     (user_id);
create index on public.bill_items(bill_id);
create index on public.shops     (user_id);
