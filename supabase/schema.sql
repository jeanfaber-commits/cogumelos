-- =========================================================================
-- Banco do Controle de Produção de Cogumelos
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run.
-- É idempotente: pode rodar de novo a qualquer momento com segurança.
-- (Inclui a configuração do passo 2 e o estoque/lotes do passo 3.)
-- =========================================================================

-- ---------------------------------------------------------------- CONFIG ---
create table if not exists configuracao (
  id             int primary key default 1,
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users (id),
  constraint apenas_uma_linha check (id = 1)
);

create table if not exists configuracao_historico (
  id             bigint generated always as identity primary key,
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid
);

create or replace function registra_config_historico()
returns trigger language plpgsql security definer as $$
begin
  insert into configuracao_historico (dados, atualizado_em, atualizado_por)
  values (new.dados, new.atualizado_em, new.atualizado_por);
  return new;
end; $$;

drop trigger if exists trg_config_historico on configuracao;
create trigger trg_config_historico
  after insert or update on configuracao
  for each row execute function registra_config_historico();

-- --------------------------------------------------------------- ESTOQUE ---
-- Livro-razão: cada linha é uma movimentação imutável. Quantidade assinada
-- (+ entra, - sai). Saldo = soma das linhas não canceladas.
create table if not exists estoque_movimentacao (
  id           bigint generated always as identity primary key,
  item         text not null check (item in ('cl_f2','sorgo_seco','spawn','substrato')),
  quantidade   numeric not null,
  tipo         text not null check (tipo in ('producao','compra','consumo','perda','ajuste')),
  lote_id      bigint,
  observacao   text,
  criado_em    timestamptz not null default now(),
  criado_por   uuid,
  cancelado_em timestamptz,
  cancelado_por uuid
);
create index if not exists idx_mov_item on estoque_movimentacao (item);
create index if not exists idx_mov_lote on estoque_movimentacao (lote_id);

-- ----------------------------------------------------------------- LOTES ---
-- Estado atual de cada lote de produção. As transições de etapa são
-- registradas automaticamente no histórico pelo gatilho abaixo.
create table if not exists lote (
  id            bigint generated always as identity primary key,
  codigo        text not null,
  tipo          text not null check (tipo in ('composto','spawn','producao')),
  etapa         text not null,
  quantidade_kg numeric not null,
  bolsas        int,
  conteiner     int,
  iniciado_em   timestamptz not null default now(),
  etapa_desde   timestamptz not null default now(),
  previsto_para timestamptz,
  observacao    text,
  criado_por    uuid,
  cancelado_em  timestamptz,
  cancelado_por uuid
);
create index if not exists idx_lote_etapa on lote (etapa);
create index if not exists idx_lote_tipo on lote (tipo);

create table if not exists lote_historico (
  id            bigint generated always as identity primary key,
  lote_id       bigint not null,
  etapa         text not null,
  quantidade_kg numeric,
  bolsas        int,
  conteiner     int,
  registrado_em timestamptz not null default now(),
  registrado_por uuid
);

create or replace function registra_lote_historico()
returns trigger language plpgsql security definer as $$
begin
  insert into lote_historico (lote_id, etapa, quantidade_kg, bolsas, conteiner, registrado_por)
  values (new.id, new.etapa, new.quantidade_kg, new.bolsas, new.conteiner,
          coalesce(auth.uid(), new.criado_por));
  return new;
end; $$;

drop trigger if exists trg_lote_historico on lote;
create trigger trg_lote_historico
  after insert or update on lote
  for each row execute function registra_lote_historico();

-- ------------------------------------------------ SEGURANÇA (RLS) ----------
alter table configuracao            enable row level security;
alter table configuracao_historico  enable row level security;
alter table estoque_movimentacao    enable row level security;
alter table lote                    enable row level security;
alter table lote_historico          enable row level security;

-- configuração
drop policy if exists "config_ler" on configuracao;
create policy "config_ler" on configuracao for select to authenticated using (true);
drop policy if exists "config_inserir" on configuracao;
create policy "config_inserir" on configuracao for insert to authenticated with check (true);
drop policy if exists "config_atualizar" on configuracao;
create policy "config_atualizar" on configuracao for update to authenticated using (true) with check (true);
drop policy if exists "historico_ler" on configuracao_historico;
create policy "historico_ler" on configuracao_historico for select to authenticated using (true);

-- estoque
drop policy if exists "mov_ler" on estoque_movimentacao;
create policy "mov_ler" on estoque_movimentacao for select to authenticated using (true);
drop policy if exists "mov_inserir" on estoque_movimentacao;
create policy "mov_inserir" on estoque_movimentacao for insert to authenticated with check (true);
drop policy if exists "mov_atualizar" on estoque_movimentacao;
create policy "mov_atualizar" on estoque_movimentacao for update to authenticated using (true) with check (true);

-- lotes
drop policy if exists "lote_ler" on lote;
create policy "lote_ler" on lote for select to authenticated using (true);
drop policy if exists "lote_inserir" on lote;
create policy "lote_inserir" on lote for insert to authenticated with check (true);
drop policy if exists "lote_atualizar" on lote;
create policy "lote_atualizar" on lote for update to authenticated using (true) with check (true);
drop policy if exists "lote_hist_ler" on lote_historico;
create policy "lote_hist_ler" on lote_historico for select to authenticated using (true);

-- --------------------------------------------------------------- COLHEITA ---
-- Colheita contínua, registrada por contêiner e por sessão (ex.: manhã/tarde).
create table if not exists colheita (
  id           bigint generated always as identity primary key,
  colhido_em   timestamptz not null default now(),
  conteiner    int not null,
  peso_kg      numeric not null check (peso_kg >= 0),
  turno        text,
  observacao   text,
  criado_por   uuid,
  cancelado_em timestamptz,
  cancelado_por uuid
);
create index if not exists idx_colheita_data on colheita (colhido_em);

alter table colheita enable row level security;
drop policy if exists "colheita_ler" on colheita;
create policy "colheita_ler" on colheita for select to authenticated using (true);
drop policy if exists "colheita_inserir" on colheita;
create policy "colheita_inserir" on colheita for insert to authenticated with check (true);
drop policy if exists "colheita_atualizar" on colheita;
create policy "colheita_atualizar" on colheita for update to authenticated using (true) with check (true);

-- ------------------------------------------------ CONTAMINAÇÃO POR LOTE ----
-- Bolsas perdidas por contaminação, contabilizadas no próprio lote (alimenta
-- o indicador de sanidade). Coluna adicionada de forma idempotente.
alter table lote add column if not exists bolsas_contaminadas int not null default 0;

-- ------------------------------------------------ MARCOS DE DATA (LOTE) -----
-- Datas reais de cada transição, para o app calibrar os tempos das etapas a
-- partir do próprio histórico (colonização, frutificação e spawn reais).
alter table lote add column if not exists pronto_em       timestamptz;
alter table lote add column if not exists frutificacao_em timestamptz;
alter table lote add column if not exists encerrado_em     timestamptz;

-- ------------------------------------------------ RECEITA DO LOTE ----------
-- Snapshot da mistura usada no lote de composto (ingredientes, matéria seca e
-- umidade no momento do registro). Permite, depois, ligar rendimento e
-- contaminação à formulação que foi realmente usada.
alter table lote add column if not exists receita jsonb;

-- ------------------------------------ EVENTOS DE CONTAMINAÇÃO (CAUSA-RAIZ) --
-- Cada registro de contaminação vira um evento com etapa e causa provável,
-- para análise de Pareto e correlação. O total por lote continua em
-- lote.bolsas_contaminadas (para o indicador de sanidade).
create table if not exists contaminacao (
  id           bigint generated always as identity primary key,
  lote_id      bigint not null,
  quantidade   int not null check (quantidade > 0),
  etapa        text not null check (etapa in ('spawn','colonizacao','frutificacao')),
  causa        text not null check (causa in ('spawn','pasteurizacao','manuseio','ambiente','desconhecida','outro')),
  observacao   text,
  criado_em    timestamptz not null default now(),
  criado_por   uuid,
  cancelado_em timestamptz,
  cancelado_por uuid
);
create index if not exists idx_contaminacao_lote on contaminacao (lote_id);
create index if not exists idx_contaminacao_data on contaminacao (criado_em);

alter table contaminacao enable row level security;
drop policy if exists "contam_ler" on contaminacao;
create policy "contam_ler" on contaminacao for select to authenticated using (true);
drop policy if exists "contam_inserir" on contaminacao;
create policy "contam_inserir" on contaminacao for insert to authenticated with check (true);
drop policy if exists "contam_atualizar" on contaminacao;
create policy "contam_atualizar" on contaminacao for update to authenticated using (true) with check (true);
