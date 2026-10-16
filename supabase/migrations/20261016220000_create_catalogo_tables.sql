-- Migration: Catálogo do sistema (Seguradoras/Operadoras, Produtos, Origens de Lead, Motivos)
-- Timestamp gerado: 20261016220000

-- 1. Criação dos tipos enum (se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catalogo_frente') THEN
    CREATE TYPE public.catalogo_frente AS ENUM ('Seguros', 'Saúde');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'canal_cotacao') THEN
    CREATE TYPE public.canal_cotacao AS ENUM ('Portal', 'Multicálculo', 'E-mail', 'WhatsApp');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catalogo_situacao') THEN
    CREATE TYPE public.catalogo_situacao AS ENUM ('ativa', 'inativa');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'motivo_tipo') THEN
    CREATE TYPE public.motivo_tipo AS ENUM ('perda', 'descarte', 'adiamento');
  END IF;
END $$;

-- 2. Tabela de Seguradoras e Operadoras
CREATE TABLE IF NOT EXISTS public.seguradoras_operadoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  frente public.catalogo_frente NOT NULL,
  canal_cotacao public.canal_cotacao NOT NULL,
  situacao public.catalogo_situacao NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seguradoras_frente ON public.seguradoras_operadoras (frente);
CREATE INDEX IF NOT EXISTS idx_seguradoras_situacao ON public.seguradoras_operadoras (situacao);

DROP TRIGGER IF EXISTS trg_seguradoras_updated_at ON public.seguradoras_operadoras;
CREATE TRIGGER trg_seguradoras_updated_at
  BEFORE UPDATE ON public.seguradoras_operadoras
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Tabela de Produtos
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  frente public.catalogo_frente NOT NULL,
  equipe_id UUID REFERENCES public.equipes(id) ON DELETE SET NULL,
  equipe_nome TEXT NOT NULL,
  situacao public.catalogo_situacao NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_frente ON public.produtos (frente);
CREATE INDEX IF NOT EXISTS idx_produtos_equipe_id ON public.produtos (equipe_id);
CREATE INDEX IF NOT EXISTS idx_produtos_situacao ON public.produtos (situacao);

DROP TRIGGER IF EXISTS trg_produtos_updated_at ON public.produtos;
CREATE TRIGGER trg_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Tabela de Origens de Lead
CREATE TABLE IF NOT EXISTS public.origens_lead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabela de Motivos (perda, descarte, adiamento)
CREATE TABLE IF NOT EXISTS public.motivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo public.motivo_tipo NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT motivos_nome_tipo_unique UNIQUE (nome, tipo)
);

CREATE INDEX IF NOT EXISTS idx_motivos_tipo ON public.motivos (tipo);

-- 6. Habilitar RLS em todas as tabelas de catálogo
ALTER TABLE public.seguradoras_operadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origens_lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motivos ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de RLS
-- Leitura para qualquer usuário ativo
DROP POLICY IF EXISTS "seguradoras_select_policy" ON public.seguradoras_operadoras;
CREATE POLICY "seguradoras_select_policy" ON public.seguradoras_operadoras
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "produtos_select_policy" ON public.produtos;
CREATE POLICY "produtos_select_policy" ON public.produtos
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "origens_lead_select_policy" ON public.origens_lead;
CREATE POLICY "origens_lead_select_policy" ON public.origens_lead
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "motivos_select_policy" ON public.motivos;
CREATE POLICY "motivos_select_policy" ON public.motivos
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

-- Escrita restrita a Administrador
DROP POLICY IF EXISTS "seguradoras_admin_modify" ON public.seguradoras_operadoras;
CREATE POLICY "seguradoras_admin_modify" ON public.seguradoras_operadoras
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "produtos_admin_modify" ON public.produtos;
CREATE POLICY "produtos_admin_modify" ON public.produtos
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "origens_lead_admin_modify" ON public.origens_lead;
CREATE POLICY "origens_lead_admin_modify" ON public.origens_lead
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "motivos_admin_modify" ON public.motivos;
CREATE POLICY "motivos_admin_modify" ON public.motivos
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 8. Seeds Idempotentes
-- 8.1 Seguradoras e operadoras
INSERT INTO public.seguradoras_operadoras (nome, frente, canal_cotacao, situacao)
VALUES
  ('Porto Seguro', 'Seguros', 'Portal', 'ativa'),
  ('Tokio Marine', 'Seguros', 'Portal', 'ativa'),
  ('Akad Digital', 'Seguros', 'Portal', 'ativa'),
  ('Capemisa', 'Seguros', 'Portal', 'ativa'),
  ('Porto Saúde', 'Saúde', 'Portal', 'ativa'),
  ('SulAmérica', 'Saúde', 'Portal', 'ativa'),
  ('Ana Costa Saúde', 'Saúde', 'Multicálculo', 'ativa'),
  ('Santa Saúde', 'Saúde', 'Multicálculo', 'ativa')
ON CONFLICT (nome) DO UPDATE
SET
  frente = EXCLUDED.frente,
  canal_cotacao = EXCLUDED.canal_cotacao,
  situacao = EXCLUDED.situacao;

-- 8.2 Produtos (com amarração à equipe correspondente)
DO $$
DECLARE
  v_equipe_seguros_id UUID;
  v_equipe_saude_id UUID;
BEGIN
  SELECT id INTO v_equipe_seguros_id FROM public.equipes WHERE nome = 'Seguros';
  SELECT id INTO v_equipe_saude_id FROM public.equipes WHERE nome = 'Saúde e Odonto';

  -- Seguros
  INSERT INTO public.produtos (nome, frente, equipe_id, equipe_nome, situacao) VALUES
    ('Auto/Moto', 'Seguros', v_equipe_seguros_id, 'Seguros', 'ativa'),
    ('RC Profissional', 'Seguros', v_equipe_seguros_id, 'Seguros', 'ativa'),
    ('Seguro Empresarial', 'Seguros', v_equipe_seguros_id, 'Seguros', 'ativa'),
    ('RC Eventos', 'Seguros', v_equipe_seguros_id, 'Seguros', 'ativa'),
    ('AP Eventos', 'Seguros', v_equipe_seguros_id, 'Seguros', 'ativa'),
    ('Vida', 'Seguros', v_equipe_seguros_id, 'Seguros', 'ativa'),
    ('Frota', 'Seguros', v_equipe_seguros_id, 'Seguros', 'ativa'),
    ('Residencial', 'Seguros', v_equipe_seguros_id, 'Seguros', 'ativa'),
    ('D&O', 'Seguros', v_equipe_seguros_id, 'Seguros', 'ativa'),
    ('Garantia', 'Seguros', v_equipe_seguros_id, 'Seguros', 'ativa'),
    ('Risco Cibernético', 'Seguros', v_equipe_seguros_id, 'Seguros', 'ativa')
  ON CONFLICT (nome) DO UPDATE
  SET
    frente = EXCLUDED.frente,
    equipe_id = EXCLUDED.equipe_id,
    equipe_nome = EXCLUDED.equipe_nome,
    situacao = EXCLUDED.situacao;

  -- Saúde
  INSERT INTO public.produtos (nome, frente, equipe_id, equipe_nome, situacao) VALUES
    ('Saúde PME 3 a 29 vidas', 'Saúde', v_equipe_saude_id, 'Saúde e Odonto', 'ativa'),
    ('Saúde PME 30 a 99 vidas', 'Saúde', v_equipe_saude_id, 'Saúde e Odonto', 'ativa'),
    ('Odonto', 'Saúde', v_equipe_saude_id, 'Saúde e Odonto', 'ativa')
  ON CONFLICT (nome) DO UPDATE
  SET
    frente = EXCLUDED.frente,
    equipe_id = EXCLUDED.equipe_id,
    equipe_nome = EXCLUDED.equipe_nome,
    situacao = EXCLUDED.situacao;
END $$;

-- 8.3 Origens de lead
INSERT INTO public.origens_lead (nome)
VALUES
  ('Indicação de cliente'),
  ('Indicação de colaborador'),
  ('Parceiro'),
  ('Redes sociais/LinkedIn'),
  ('Site'),
  ('QuiverZap/WhatsApp geral'),
  ('Carteira (cliente ativo)'),
  ('Outro')
ON CONFLICT (nome) DO NOTHING;

-- 8.4 Motivos (dados iniciais de perda)
INSERT INTO public.motivos (nome, tipo)
VALUES
  ('Preço', 'perda'),
  ('Optou por outra corretora', 'perda'),
  ('Optou pelo plano do sindicato/categoria', 'perda'),
  ('Cliente desistiu', 'perda'),
  ('Sem retorno do cliente', 'perda'),
  ('Momento inadequado', 'perda'),
  ('Não aprovado pela seguradora/operadora', 'perda'),
  ('Cobertura não atende', 'perda'),
  ('Outro', 'perda')
ON CONFLICT (nome, tipo) DO NOTHING;
