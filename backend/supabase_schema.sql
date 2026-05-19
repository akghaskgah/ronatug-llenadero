-- Supabase schema for Electron app state and file uploads
-- Ejecutar este script en el editor SQL de Supabase una vez.

create table if not exists public.app_state (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, value)
values ('app_state', '{}'::jsonb)
on conflict (id) do nothing;
