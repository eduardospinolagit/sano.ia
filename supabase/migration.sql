-- ═══════════════════════════════════════════════════════════════
-- Sano.ia — Migration (compartilha banco com SpiceHOT)
-- Cria tabelas novas + adiciona colunas tenant/agent nas existentes
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ─── NOVAS TABELAS ────────────────────────────────────────────

create table if not exists tenants (
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

create table if not exists tenant_members (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_email  text not null,
  role        text not null default 'viewer'
                check (role in ('owner','admin','viewer')),
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (tenant_id, user_email)
);

create table if not exists tenant_wa_sessions (
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

create table if not exists agents (
  id                   uuid primary key default uuid_generate_v4(),
  tenant_id            uuid not null references tenants(id) on delete cascade unique,
  name                 text not null,
  persona              text,
  system_prompt        text,
  response_style       text not null default 'casual'
                         check (response_style in ('casual','formal','playful','intimate')),
  language             text not null default 'pt-BR',
  model                text not null default 'gpt-4o-mini',
  temperature          numeric not null default 0.8,
  max_tokens           integer not null default 400,
  delay_profile        jsonb,
  active_hours_config  jsonb,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists knowledge_entries (
  id         uuid primary key default uuid_generate_v4(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  agent_id   uuid references agents(id) on delete cascade,
  title      text not null,
  content    text not null,
  tags       text[] default '{}',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quick_replies (
  id         uuid primary key default uuid_generate_v4(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  agent_id   uuid references agents(id) on delete cascade,
  trigger    text not null,
  response   text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── ADICIONAR COLUNAS ÀS TABELAS EXISTENTES ─────────────────

-- users: adicionar tenant_id
alter table users
  add column if not exists tenant_id uuid references tenants(id) on delete cascade;

-- conversations: adicionar tenant_id e agent_id
alter table conversations
  add column if not exists tenant_id uuid references tenants(id) on delete cascade,
  add column if not exists agent_id  uuid references agents(id);

-- messages: adicionar tenant_id e agent_id
alter table messages
  add column if not exists tenant_id uuid references tenants(id) on delete cascade,
  add column if not exists agent_id  uuid references agents(id);

-- user_memory: adicionar tenant_id e agent_id
alter table user_memory
  add column if not exists tenant_id uuid references tenants(id) on delete cascade,
  add column if not exists agent_id  uuid references agents(id);

-- logs: adicionar tenant_id e colunas usadas pelo Sano.ia
alter table logs
  add column if not exists tenant_id uuid references tenants(id) on delete cascade,
  add column if not exists event     text,
  add column if not exists data      jsonb;

-- ─── NOVAS COLUNAS NA TABELA AGENTS ─────────────────────────
alter table agents
  add column if not exists objective             text not null default 'general'
    check (objective in ('general','scheduling','quote','lead_qualify','sales','support','survey','custom')),
  add column if not exists followup_enabled      boolean not null default false,
  add column if not exists followup_delay_hours  int not null default 24,
  add column if not exists followup_max_attempts int not null default 3;

-- ─── ÍNDICES ──────────────────────────────────────────────────

create index if not exists idx_sano_messages_tenant   on messages(tenant_id, conversation_id, created_at desc);
create index if not exists idx_sano_conversations     on conversations(tenant_id, user_id, status);
create index if not exists idx_sano_users_tenant      on users(tenant_id, phone);
create index if not exists idx_sano_user_memory       on user_memory(tenant_id, user_id, agent_id);
create index if not exists idx_sano_knowledge         on knowledge_entries(tenant_id, is_active);
create index if not exists idx_sano_logs              on logs(tenant_id, level, created_at desc);

-- ─── Updated_at automático ────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenants_updated_at') then
    create trigger trg_tenants_updated_at before update on tenants
      for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_agents_updated_at') then
    create trigger trg_agents_updated_at before update on agents
      for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_knowledge_updated_at') then
    create trigger trg_knowledge_updated_at before update on knowledge_entries
      for each row execute function set_updated_at();
  end if;
end $$;

-- ─── Localização do agente (2026-04-14) ──────────────────────
alter table agents
  add column if not exists location_enabled  boolean not null default false,
  add column if not exists location_lat      double precision,
  add column if not exists location_lng      double precision,
  add column if not exists location_name     text,
  add column if not exists location_address  text;

-- ─── Notificações para o empresário (2026-04-14) ─────────────
alter table agents
  add column if not exists notification_enabled boolean not null default false,
  add column if not exists notification_phone   text,
  add column if not exists notification_fields  jsonb not null default '["cliente","resumo"]';

-- remove coluna de estilo se existir (substituída por notification_fields)
alter table agents drop column if exists notification_style;
