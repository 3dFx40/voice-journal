create table if not exists public.voice_notes (
  id uuid primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  type text not null check (
    type in ('dream', 'idea', 'reminder', 'thought', 'journal', 'other')
  ),
  transcript text not null,
  title text,
  tags text[] not null default '{}'
);

create index if not exists voice_notes_created_at_idx
  on public.voice_notes (created_at desc);

create index if not exists voice_notes_type_idx
  on public.voice_notes (type);

alter table public.voice_notes enable row level security;

comment on table public.voice_notes is
  'Private Voice Journal notes. The app accesses this table only from server routes with a Supabase secret/service-role key.';
