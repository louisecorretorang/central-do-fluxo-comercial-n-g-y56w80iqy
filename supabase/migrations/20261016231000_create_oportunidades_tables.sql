-- ============================================================================
-- Migration: Criação das tabelas de oportunidades, cópia de fluxo e geração de protocolo
-- Data: 2026-10-16
-- ============================================================================

-- 1. Enums necessários
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oportunidade_situacao') THEN
    CREATE TYPE public.oportunidade_situacao AS ENUM (
      'Em andamento',
      'Ganha',
      'Perdida',
      'Descartada',
      'Adiada'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'etapa_oportunidade_situacao') THEN
    CREATE TYPE public.etapa_oportunidade_situacao AS ENUM (
      'pendente',
      'em_andamento',
      'concluida'
    );
  END IF;
END $$;

-- 2. Tabela de contadores sequenciais de protocolo por ano
CREATE TABLE IF NOT EXISTS public.oportunidades_protocolo_seq (
  ano INT PRIMARY KEY,
  ultimo_numero INT NOT NULL DEFAULT 0
);

ALTER TABLE public.oportunidades_protocolo_seq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "protocolo_seq_select" ON public.oportunidades_protocolo_seq;
CREATE POLICY "protocolo_seq_select" ON public.oportunidades_protocolo_seq
  FOR SELECT TO authenticated USING (true);

-- 3. Tabela de Oportunidades
CREATE TABLE IF NOT EXISTS public.oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo TEXT NOT NULL UNIQUE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  seguradora_id UUID REFERENCES public.seguradoras_operadoras(id) ON DELETE RESTRICT,
  fluxo_modelo_id UUID NOT NULL REFERENCES public.fluxo_modelos(id) ON DELETE RESTRICT,
  fluxo_versao INT NOT NULL DEFAULT 1,
  usou_fluxo_generico BOOLEAN NOT NULL DEFAULT false,
  equipe_id UUID REFERENCES public.equipes(id) ON DELETE SET NULL,
  responsavel_comercial_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  origem_id UUID NOT NULL REFERENCES public.origens_lead(id) ON DELETE RESTRICT,
  valor_estimado NUMERIC(14, 2) NOT NULL DEFAULT 0,
  data_prevista_fechamento DATE NOT NULL,
  observacoes TEXT,
  situacao public.oportunidade_situacao NOT NULL DEFAULT 'Em andamento',
  etapa_atual_id UUID,
  criado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices em oportunidades
CREATE INDEX IF NOT EXISTS idx_oportunidades_cliente ON public.oportunidades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_produto ON public.oportunidades(produto_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_seguradora ON public.oportunidades(seguradora_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_responsavel ON public.oportunidades(responsavel_comercial_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_situacao ON public.oportunidades(situacao);
CREATE INDEX IF NOT EXISTS idx_oportunidades_created_at ON public.oportunidades(created_at DESC);

-- Trigger de updated_at para oportunidades
DROP TRIGGER IF EXISTS trigger_oportunidades_updated_at ON public.oportunidades;
CREATE TRIGGER trigger_oportunidades_updated_at
  BEFORE UPDATE ON public.oportunidades
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Tabela de Cópia das Etapas da Oportunidade (Snapshot)
CREATE TABLE IF NOT EXISTS public.oportunidades_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id UUID NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo public.fluxo_etapa_tipo NOT NULL,
  responsavel_tipo public.fluxo_responsavel_tipo NOT NULL,
  equipe_id UUID REFERENCES public.equipes(id) ON DELETE SET NULL,
  funcao public.user_funcao,
  responsavel_usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  prazo_dias INT,
  is_etapa_ganho BOOLEAN NOT NULL DEFAULT false,
  situacao public.etapa_oportunidade_situacao NOT NULL DEFAULT 'pendente',
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_oportunidade_etapa_ordem UNIQUE (oportunidade_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_oportunidades_etapas_opp ON public.oportunidades_etapas(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_etapas_responsavel ON public.oportunidades_etapas(responsavel_usuario_id);

DROP TRIGGER IF EXISTS trigger_oportunidades_etapas_updated_at ON public.oportunidades_etapas;
CREATE TRIGGER trigger_oportunidades_etapas_updated_at
  BEFORE UPDATE ON public.oportunidades_etapas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Tabela de Cópia dos Itens do Checklist da Etapa (Snapshot)
CREATE TABLE IF NOT EXISTS public.oportunidades_checklist_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_oportunidade_id UUID NOT NULL REFERENCES public.oportunidades_etapas(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  titulo TEXT NOT NULL,
  tipo public.checklist_item_tipo NOT NULL,
  formato public.checklist_campo_formato,
  opcoes JSONB,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  valor TEXT,
  concluido BOOLEAN NOT NULL DEFAULT false,
  concluido_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  concluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_oportunidade_checklist_ordem UNIQUE (etapa_oportunidade_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_oportunidades_checklist_etapa ON public.oportunidades_checklist_itens(etapa_oportunidade_id);

DROP TRIGGER IF EXISTS trigger_oportunidades_checklist_updated_at ON public.oportunidades_checklist_itens;
CREATE TRIGGER trigger_oportunidades_checklist_updated_at
  BEFORE UPDATE ON public.oportunidades_checklist_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 6. Adicionar FK de etapa_atual_id em oportunidades apontando para oportunidades_etapas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_oportunidade_etapa_atual'
      AND table_name = 'oportunidades'
  ) THEN
    ALTER TABLE public.oportunidades
      ADD CONSTRAINT fk_oportunidade_etapa_atual
      FOREIGN KEY (etapa_atual_id)
      REFERENCES public.oportunidades_etapas(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Função para gerar próximo protocolo atômico NG-ANO-000001
CREATE OR REPLACE FUNCTION public.gerar_proximo_protocolo()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_ano INT;
  v_proximo INT;
  v_protocolo TEXT;
BEGIN
  v_ano := EXTRACT(YEAR FROM NOW())::INT;

  -- Garante registro e lock exclusivo na linha do ano
  INSERT INTO public.oportunidades_protocolo_seq (ano, ultimo_numero)
  VALUES (v_ano, 1)
  ON CONFLICT (ano) DO UPDATE
    SET ultimo_numero = public.oportunidades_protocolo_seq.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_proximo;

  v_protocolo := 'NG-' || v_ano::TEXT || '-' || LPAD(v_proximo::TEXT, 6, '0');
  RETURN v_protocolo;
END;
$$;

-- 8. Função RPC principal: abrir_oportunidade
CREATE OR REPLACE FUNCTION public.abrir_oportunidade(
  p_cliente_id UUID,
  p_produto_id UUID,
  p_seguradora_id UUID,
  p_responsavel_comercial_id UUID,
  p_origem_id UUID,
  p_valor_estimado NUMERIC,
  p_data_prevista_fechamento DATE,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_criador_id UUID;
  v_produto_equipe_id UUID;
  v_modelo_id UUID;
  v_modelo_versao INT;
  v_usou_generico BOOLEAN := false;
  v_protocolo TEXT;
  v_oportunidade_id UUID;
  v_primeira_etapa_id UUID;
  v_etapa_orig record;
  v_item_orig record;
  v_nova_etapa_id UUID;
  v_responsavel_etapa_id UUID;
  v_situacao_etapa public.etapa_oportunidade_situacao;
BEGIN
  -- 1. Identificar usuário autenticado
  v_criador_id := auth.uid();
  IF v_criador_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autenticado.';
  END IF;

  -- 2. Validar perfil ativo do criador
  IF NOT public.is_active_user(v_criador_id) THEN
    RAISE EXCEPTION 'Usuário inativo ou não autorizado.';
  END IF;

  -- 3. Validar se o cliente existe e está ativo
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente selecionado não foi encontrado.';
  END IF;

  -- 4. Validar produto e obter sua equipe
  SELECT equipe_id INTO v_produto_equipe_id
  FROM public.produtos
  WHERE id = p_produto_id AND situacao = 'ativa';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado ou inativo.';
  END IF;

  -- 5. Validar seguradora (se informada)
  IF p_seguradora_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.seguradoras_operadoras
      WHERE id = p_seguradora_id AND situacao = 'ativa'
    ) THEN
      RAISE EXCEPTION 'Seguradora/operadora informada não está ativa.';
    END IF;
  END IF;

  -- 6. Validar responsável comercial
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_responsavel_comercial_id AND situacao = 'ativo'
  ) THEN
    RAISE EXCEPTION 'Responsável comercial inválido ou inativo.';
  END IF;

  -- 7. Validar origem
  IF NOT EXISTS (SELECT 1 FROM public.origens_lead WHERE id = p_origem_id) THEN
    RAISE EXCEPTION 'Origem de lead informada não existe.';
  END IF;

  -- 8. Seleção do Modelo de Fluxo na ordem de prioridade estrita:
  -- (a) modelo ativo com produto = produto escolhido E seguradora = seguradora escolhida (se seguradora informada)
  IF p_seguradora_id IS NOT NULL THEN
    SELECT id, versao INTO v_modelo_id, v_modelo_versao
    FROM public.fluxo_modelos
    WHERE produto_id = p_produto_id
      AND seguradora_id = p_seguradora_id
      AND situacao = 'ativo'
    LIMIT 1;
  END IF;

  -- (b) modelo ativo do mesmo produto sem seguradora fixa (seguradora_id IS NULL E is_generico = false)
  IF v_modelo_id IS NULL THEN
    SELECT id, versao INTO v_modelo_id, v_modelo_versao
    FROM public.fluxo_modelos
    WHERE produto_id = p_produto_id
      AND seguradora_id IS NULL
      AND is_generico = false
      AND situacao = 'ativo'
    LIMIT 1;
  END IF;

  -- (c) fluxo genérico ativo (is_generico = true E situacao = 'ativo')
  IF v_modelo_id IS NULL THEN
    SELECT id, versao INTO v_modelo_id, v_modelo_versao
    FROM public.fluxo_modelos
    WHERE is_generico = true
      AND situacao = 'ativo'
    LIMIT 1;

    IF v_modelo_id IS NOT NULL THEN
      v_usou_generico := true;
    END IF;
  END IF;

  IF v_modelo_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum fluxo de trabalho ativo disponível no sistema.';
  END IF;

  -- 9. Gerar número de protocolo sequencial seguro
  v_protocolo := public.gerar_proximo_protocolo();

  -- 10. Inserir a Oportunidade
  INSERT INTO public.oportunidades (
    protocolo,
    cliente_id,
    produto_id,
    seguradora_id,
    fluxo_modelo_id,
    fluxo_versao,
    usou_fluxo_generico,
    equipe_id,
    responsavel_comercial_id,
    origem_id,
    valor_estimado,
    data_prevista_fechamento,
    observacoes,
    situacao,
    criado_por
  ) VALUES (
    v_protocolo,
    p_cliente_id,
    p_produto_id,
    p_seguradora_id,
    v_modelo_id,
    COALESCE(v_modelo_versao, 1),
    v_usou_generico,
    v_produto_equipe_id,
    p_responsavel_comercial_id,
    p_origem_id,
    COALESCE(p_valor_estimado, 0),
    p_data_prevista_fechamento,
    NULLIF(TRIM(p_observacoes), ''),
    'Em andamento',
    v_criador_id
  ) RETURNING id INTO v_oportunidade_id;

  -- 11. Clonar etapas e itens de checklist (Snapshot)
  FOR v_etapa_orig IN
    SELECT *
    FROM public.fluxo_etapas
    WHERE modelo_id = v_modelo_id
    ORDER BY ordem ASC
  LOOP
    -- Resolver responsável da etapa
    IF v_etapa_orig.responsavel_tipo = 'responsavel_comercial' THEN
      v_responsavel_etapa_id := p_responsavel_comercial_id;
    ELSE
      -- fila_equipe: fica na fila da equipe + função
      v_responsavel_etapa_id := NULL;
    END IF;

    -- Primeira etapa (ordem = 1) fica 'em_andamento'; as demais 'pendente'
    IF v_etapa_orig.ordem = 1 THEN
      v_situacao_etapa := 'em_andamento';
    ELSE
      v_situacao_etapa := 'pendente';
    END IF;

    INSERT INTO public.oportunidades_etapas (
      oportunidade_id,
      ordem,
      nome,
      descricao,
      tipo,
      responsavel_tipo,
      equipe_id,
      funcao,
      responsavel_usuario_id,
      prazo_dias,
      is_etapa_ganho,
      situacao,
      iniciada_em
    ) VALUES (
      v_oportunidade_id,
      v_etapa_orig.ordem,
      v_etapa_orig.nome,
      v_etapa_orig.descricao,
      v_etapa_orig.tipo,
      v_etapa_orig.responsavel_tipo,
      COALESCE(v_etapa_orig.equipe_id, v_produto_equipe_id),
      v_etapa_orig.funcao,
      v_responsavel_etapa_id,
      v_etapa_orig.prazo_dias,
      v_etapa_orig.is_etapa_ganho,
      v_situacao_etapa,
      CASE WHEN v_etapa_orig.ordem = 1 THEN NOW() ELSE NULL END
    ) RETURNING id INTO v_nova_etapa_id;

    IF v_etapa_orig.ordem = 1 THEN
      v_primeira_etapa_id := v_nova_etapa_id;
    END IF;

    -- Clonar itens de checklist desta etapa
    FOR v_item_orig IN
      SELECT *
      FROM public.fluxo_checklist_itens
      WHERE etapa_id = v_etapa_orig.id
      ORDER BY ordem ASC
    LOOP
      INSERT INTO public.oportunidades_checklist_itens (
        etapa_oportunidade_id,
        ordem,
        titulo,
        tipo,
        formato,
        opcoes,
        obrigatorio,
        concluido
      ) VALUES (
        v_nova_etapa_id,
        v_item_orig.ordem,
        v_item_orig.titulo,
        v_item_orig.tipo,
        v_item_orig.formato,
        v_item_orig.opcoes,
        v_item_orig.obrigatorio,
        false
      );
    END LOOP;
  END LOOP;

  -- 12. Atualizar etapa_atual_id na oportunidade
  IF v_primeira_etapa_id IS NOT NULL THEN
    UPDATE public.oportunidades
    SET etapa_atual_id = v_primeira_etapa_id
    WHERE id = v_oportunidade_id;
  END IF;

  -- 13. Retornar dados essenciais em JSON
  RETURN jsonb_build_object(
    'id', v_oportunidade_id,
    'protocolo', v_protocolo,
    'usou_fluxo_generico', v_usou_generico,
    'fluxo_modelo_id', v_modelo_id,
    'fluxo_versao', COALESCE(v_modelo_versao, 1),
    'etapa_atual_id', v_primeira_etapa_id
  );
END;
$$;

-- 9. RLS Policies
ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidades_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidades_checklist_itens ENABLE ROW LEVEL SECURITY;

-- Oportunidades: Leitura para qualquer usuário ativo
DROP POLICY IF EXISTS "oportunidades_select" ON public.oportunidades;
CREATE POLICY "oportunidades_select" ON public.oportunidades
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

-- Oportunidades: Inserção direta ou via RPC
DROP POLICY IF EXISTS "oportunidades_insert" ON public.oportunidades;
CREATE POLICY "oportunidades_insert" ON public.oportunidades
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));

-- Oportunidades: Atualização por usuários ativos
DROP POLICY IF EXISTS "oportunidades_update" ON public.oportunidades;
CREATE POLICY "oportunidades_update" ON public.oportunidades
  FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

-- Etapas da oportunidade
DROP POLICY IF EXISTS "oportunidades_etapas_select" ON public.oportunidades_etapas;
CREATE POLICY "oportunidades_etapas_select" ON public.oportunidades_etapas
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "oportunidades_etapas_insert" ON public.oportunidades_etapas;
CREATE POLICY "oportunidades_etapas_insert" ON public.oportunidades_etapas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "oportunidades_etapas_update" ON public.oportunidades_etapas;
CREATE POLICY "oportunidades_etapas_update" ON public.oportunidades_etapas
  FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

-- Checklist da etapa da oportunidade
DROP POLICY IF EXISTS "oportunidades_checklist_select" ON public.oportunidades_checklist_itens;
CREATE POLICY "oportunidades_checklist_select" ON public.oportunidades_checklist_itens
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "oportunidades_checklist_insert" ON public.oportunidades_checklist_itens;
CREATE POLICY "oportunidades_checklist_insert" ON public.oportunidades_checklist_itens
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "oportunidades_checklist_update" ON public.oportunidades_checklist_itens;
CREATE POLICY "oportunidades_checklist_update" ON public.oportunidades_checklist_itens
  FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));
