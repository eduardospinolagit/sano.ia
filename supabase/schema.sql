-- ═══════════════════════════════════════════════════════════════
-- Sano.ia — Schema do banco (Supabase)
-- Executar no SQL Editor do projeto Supabase
-- ═══════════════════════════════════════════════════════════════

-- ─── Extensões ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── tenants ─────────────────────────────────────────────────
create table tenants (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text not null unique,
  email         text not null unique,
  status        text not null default 'trial'
                  check (status in ('trial','active','suspended','canceled')),
  plan_id       uuid,
  trial_ends_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── tenant_members ──────────────────────────────────────────
create table tenant_members (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_email  text not null,
  role        text not null default 'viewer'
                check (role in ('owner','admin','viewer')),
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (tenant_id, user_email)
);

-- ─── tenant_wa_sessions ──────────────────────────────────────
create table tenant_wa_sessions (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null references tenants(id) on delete cascade unique,
  auth_dir          text not null,
  wa_status         text not null default 'disconnected'
                      check (wa_status in ('disconnected','connecting','qr_pending','connected')),
  wa_phone          text,
  last_connected_at timestamptz,
  qr_expires_at     timestamptz,
  created_at        timestamptz not null default now()
);

-- ─── agents ──────────────────────────────────────────────────
-- Configuração do agente de IA do tenant
create table agents (
  id                      uuid primary key default uuid_generate_v4(),
  tenant_id               uuid not null references tenants(id) on delete cascade unique,
  name                    text not null default 'Agente',
  is_active               boolean not null default true,
  persona_prompt          text,
  system_rules            text,
  model_name              text not null default 'gpt-4o-mini',
  temperature             numeric not null default 0.85,
  language                text not null default 'pt-BR',
  max_tokens              int not null default 400,
  voice_id                text,
  audio_reply_probability numeric not null default 0,
  delay_profile           jsonb,
  active_hours_config     jsonb,
  response_style          text not null default 'casual'
                            check (response_style in ('casual','formal','playful','intimate')),
  relationship_level_max  int not null default 3,
  objective               text not null default 'general'
                            check (objective in ('general','scheduling','quote','lead_qualify','sales','support','survey','custom')),
  objective_meta          jsonb default '{}',
  followup_enabled        boolean not null default false,
  followup_delay_hours    int not null default 24,
  followup_messages       jsonb default '[]',
  followup_max_attempts   int not null default 3,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ─── knowledge_entries ───────────────────────────────────────
create table knowledge_entries (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  title       text not null,
  content     text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── quick_replies ────────────────────────────────────────────
create table quick_replies (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  trigger_keywords text[] not null default '{}',
  reply_text       text not null,
  priority         int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ─── users ───────────────────────────────────────────────────
-- Contatos que conversam com o agente
create table users (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  phone         text not null,
  display_name  text,
  timezone      text,
  origin        text,
  is_blocked    boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  unique (tenant_id, phone)
);

-- ─── conversations ────────────────────────────────────────────
create table conversations (
  id                 uuid primary key default uuid_generate_v4(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  user_id            uuid not null references users(id),
  agent_id           uuid not null references agents(id),
  status             text not null default 'active'
                       check (status in ('active','paused','closed')),
  relationship_level int not null default 0,
  emotional_state    text,
  summary            text,
  started_at         timestamptz not null default now(),
  last_message_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz
);

-- ─── messages ─────────────────────────────────────────────────
create table messages (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references users(id),
  agent_id        uuid not null references agents(id),
  direction       text not null check (direction in ('inbound','outbound')),
  role            text not null check (role in ('user','assistant','system')),
  type            text not null default 'text' check (type in ('text','audio','image')),
  content         text,
  media_url       text,
  transcription   text,
  status          text not null default 'received'
                    check (status in ('received','processed','sent','failed')),
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

-- ─── user_memory ──────────────────────────────────────────────
create table user_memory (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  user_id      uuid not null references users(id),
  agent_id     uuid not null references agents(id),
  memory_type  text not null
                 check (memory_type in ('identity','preference','emotional','history','sensitive')),
  memory_key   text not null,
  memory_value text not null,
  confidence   numeric not null default 0.8,
  source       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

-- ─── logs ─────────────────────────────────────────────────────
create table logs (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  user_id         uuid references users(id) on delete set null,
  message_id      uuid references messages(id) on delete set null,
  level           text not null check (level in ('info','warn','error')),
  event           text not null,
  data            jsonb,
  created_at      timestamptz not null default now()
);

-- ─── Índices ─────────────────────────────────────────────────
create index on messages(tenant_id, conversation_id, created_at desc);
create index on messages(tenant_id, direction, created_at desc);
create index on conversations(tenant_id, user_id, status);
create index on users(tenant_id, phone);
create index on user_memory(tenant_id, user_id, agent_id);
create index on knowledge_entries(tenant_id, is_active);
create index on logs(tenant_id, level, created_at desc);

-- ─── Updated_at automático ────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_tenants_updated    before update on tenants    for each row execute function set_updated_at();
create trigger trg_agents_updated     before update on agents     for each row execute function set_updated_at();
create trigger trg_users_updated      before update on users      for each row execute function set_updated_at();
create trigger trg_knowledge_updated  before update on knowledge_entries for each row execute function set_updated_at();
