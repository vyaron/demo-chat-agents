-- QuickChat schema — run in Supabase SQL Editor

create table if not exists conversations (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists messages (
  id              uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id       text not null,
  sender_name     text not null,
  content         text not null,
  created_at      timestamptz default now()
);

create index if not exists messages_conversation_id_idx on messages(conversation_id);
create index if not exists messages_created_at_idx on messages(created_at);

-- Seed data
insert into conversations (id, name, avatar_url) values
  ('11111111-1111-1111-1111-111111111111', 'Alice', 'https://i.pravatar.cc/150?u=alice'),
  ('22222222-2222-2222-2222-222222222222', 'Bob',   'https://i.pravatar.cc/150?u=bob')
on conflict (id) do nothing;

insert into messages (conversation_id, sender_id, sender_name, content) values
  ('11111111-1111-1111-1111-111111111111', 'alice', 'Alice', 'Hey! Are we still meeting tomorrow?'),
  ('11111111-1111-1111-1111-111111111111', 'demo-user', 'You', 'Yes! 10am works for me'),
  ('11111111-1111-1111-1111-111111111111', 'alice', 'Alice', 'Perfect, see you then 👍'),
  ('22222222-2222-2222-2222-222222222222', 'bob', 'Bob', 'Did you see the game last night?'),
  ('22222222-2222-2222-2222-222222222222', 'demo-user', 'You', 'Amazing finish! 🏆')
on conflict do nothing;
