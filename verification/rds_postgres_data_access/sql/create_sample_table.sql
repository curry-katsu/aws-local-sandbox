create table if not exists sandbox_messages (
  id bigserial primary key,
  source text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sandbox_messages_created_at_idx
  on sandbox_messages (created_at desc);
