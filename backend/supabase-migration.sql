-- Create required extensions and tables for Supabase
create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  price numeric not null default 0,
  stock integer not null default 0,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null default 1,
  total numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "Profiles select own data" on profiles
  for select using (auth.uid() = id);
create policy "Profiles insert own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "Profiles update own profile" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

alter table products enable row level security;
create policy "Products select for authenticated" on products
  for select using (auth.role() = 'authenticated');

alter table orders enable row level security;
create policy "Orders insert own order" on orders
  for insert with check (auth.uid() = user_id);
create policy "Orders select own orders" on orders
  for select using (auth.uid() = user_id);
