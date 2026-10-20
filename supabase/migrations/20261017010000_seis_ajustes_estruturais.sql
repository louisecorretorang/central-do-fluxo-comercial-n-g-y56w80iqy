-- Migration: 20261017010000_seis_ajustes_estruturais.sql
-- Descrição: 6 ajustes estruturais no sistema Central do Fluxo Comercial N&G:
-- 1. Valor fechado da oportunidade (valor_fechado)
-- 2. Motivo e observação da perda na oportunidade (motivo_perda_id, observacao_perda)
-- 3. Quem concluiu cada etapa (concluida_por_id)
-- 4. Documentos da oportunidade com múltiplos arquivos por item (oportunidades_documentos)
-- 5. Origem do cliente ligada à lista de origens (origem_id FK)
-- 6. Ativo/inativo em origens de lead e motivos do catálogo

-- Extensão unaccent caso necessária para normalização
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================================
-- ITEM 6: ATIVO/INATIVO EM ORIGENS E MOTIVOS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'origens_lead' AND column_name = 'situacao'
  ) THEN
    ALTER TABLE public.origens_lead
      ADD COLUMN situacao public.catalogo_situacao NOT NULL DEFAULT 'ativa';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'motivos' AND column_name = 'situacao'
  ) THEN
    ALTER TABLE public.motivos
      ADD COLUMN situacao public.catalogo_situacao NOT NULL DEFAULT 'ativa';
  END IF;
END $$;

-- ============================================================================
-- ITEM 1: VALOR FECHADO DA OPORTUNIDADE
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'oportunidades' AND column_name = 'valor_fechado'
  ) THEN
    ALTER TABLE public.oportunidades
      ADD COLUMN valor_fechado NUMERIC(15,2);
  END IF;
END $$;

-- Migração de dados Item 1: Para oportunidades já ganhas, preencher valor_fechado
-- a partir do evento de confirmação de ganho na tabela oportunidades_linha_tempo
UPDATE public.oportunidades o
SET valor_fechado = sub.val_fechado
FROM (
  SELECT
    t.oportunidade_id,
    COALESCE(
      (t.metadados->>'valor_fechado')::NUMERIC,
      NULLIF(regexp_replace(substring(t.descricao from 'Valor: R\$ ([0-9\.\,]+)'), '[^0-9\.]', '', 'g'), '')::NUMERIC
    ) AS val_fechado
  FROM public.oportunidades_linha_tempo t
  WHERE t.titulo ILIKE '%Fechamento confirmado%'
     OR (t.metadados ? 'valor_fechado' AND (t.metadados->>'valor_fechado') IS NOT NULL)
  ORDER BY t.created_at DESC
) sub
WHERE o.id = sub.oportunidade_id
  AND (o.situacao::TEXT LIKE '%Ganh%' OR o.situacao::TEXT = 'Concluída')
  AND o.valor_fechado IS NULL
  AND sub.val_fechado IS NOT NULL;

-- Fallback para ganhas que não tiveram linha de tempo específica
UPDATE public.oportunidades
SET valor_fechado = valor_estimado
WHERE situacao::TEXT LIKE '%Ganh%'
  AND valor_fechado IS NULL
  AND valor_estimado IS NOT NULL
  AND valor_estimado > 0;

-- ============================================================================
-- ITEM 2: MOTIVO E OBSERVAÇÃO DA PERDA NA OPORTUNIDADE
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'oportunidades' AND column_name = 'motivo_perda_id'
  ) THEN
    ALTER TABLE public.oportunidades
      ADD COLUMN motivo_perda_id UUID REFERENCES public.motivos(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_oportunidades_motivo_perda_id ON public.oportunidades(motivo_perda_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'oportunidades' AND column_name = 'observacao_perda'
  ) THEN
    ALTER TABLE public.oportunidades
      ADD COLUMN observacao_perda TEXT;
  END IF;
END $$;

-- Migração de dados Item 2: Para oportunidades já perdidas, extrair da linha do tempo
DO $$
DECLARE
  r RECORD;
  v_motivo_id UUID;
  v_obs TEXT;
  v_motivo_nome TEXT;
BEGIN
  FOR r IN
    SELECT o.id, t.metadados, t.descricao
    FROM public.oportunidades o
    JOIN LATERAL (
      SELECT metadados, descricao, created_at
      FROM public.oportunidades_linha_tempo
      WHERE oportunidade_id = o.id
        AND (titulo ILIKE '%Perdida%' OR (metadados ? 'motivo_id'))
      ORDER BY created_at DESC
      LIMIT 1
    ) t ON true
    WHERE o.situacao::TEXT = 'Perdida'
      AND o.motivo_perda_id IS NULL
  LOOP
    v_motivo_id := NULL;
    v_obs := NULL;

    -- Tentar pelo metadados->>'motivo_id'
    IF r.metadados ? 'motivo_id' AND (r.metadados->>'motivo_id') IS NOT NULL THEN
      BEGIN
        v_motivo_id := (r.metadados->>'motivo_id')::UUID;
        -- Verifica se existe na tabela motivos
        IF NOT EXISTS (SELECT 1 FROM public.motivos WHERE id = v_motivo_id) THEN
          v_motivo_id := NULL;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_motivo_id := NULL;
      END;
    END IF;

    -- Se não achou por UUID, tentar casar pelo nome do motivo
    IF v_motivo_id IS NULL THEN
      v_motivo_nome := r.metadados->>'motivo_nome';
      IF v_motivo_nome IS NULL AND r.descricao ILIKE '%Motivo: %' THEN
        v_motivo_nome := TRIM(split_part(split_part(r.descricao, 'Motivo: ', 2), ' — ', 1));
      END IF;

      IF v_motivo_nome IS NOT NULL AND TRIM(v_motivo_nome) <> '' THEN
        SELECT id INTO v_motivo_id
        FROM public.motivos
        WHERE LOWER(TRIM(nome)) = LOWER(TRIM(v_motivo_nome))
        LIMIT 1;

        -- Se não casou exatamente, preserva o texto na observação
        IF v_motivo_id IS NULL THEN
          v_obs := 'Motivo informado anteriormente: ' || v_motivo_nome;
        END IF;
      END IF;
    END IF;

    -- Observação complementar
    IF (r.metadados->>'observacao') IS NOT NULL AND TRIM(r.metadados->>'observacao') <> '' THEN
      IF v_obs IS NOT NULL THEN
        v_obs := v_obs || ' | ' || TRIM(r.metadados->>'observacao');
      ELSE
        v_obs := TRIM(r.metadados->>'observacao');
      END IF;
    END IF;

    UPDATE public.oportunidades
    SET motivo_perda_id = v_motivo_id,
        observacao_perda = COALESCE(v_obs, observacao_perda)
    WHERE id = r.id;
  END LOOP;
END $$;

-- ============================================================================
-- ITEM 3: QUEM CONCLUIU CADA ETAPA
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'oportunidades_etapas' AND column_name = 'concluida_por_id'
  ) THEN
    ALTER TABLE public.oportunidades_etapas
      ADD COLUMN concluida_por_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_oportunidades_etapas_concluida_por_id ON public.oportunidades_etapas(concluida_por_id);
  END IF;
END $$;

-- Migração de dados Item 3: Preencher concluida_por_id a partir da linha do tempo
UPDATE public.oportunidades_etapas oe
SET concluida_por_id = sub.usuario_id
FROM (
  SELECT
    (t.metadados->>'etapa_id')::UUID as etapa_id,
    t.usuario_id
  FROM public.oportunidades_linha_tempo t
  WHERE t.tipo = 'etapa_concluida'
    AND t.metadados ? 'etapa_id'
    AND t.usuario_id IS NOT NULL
  ORDER BY t.created_at DESC
) sub
WHERE oe.id = sub.etapa_id
  AND oe.situacao = 'concluida'
  AND oe.concluida_por_id IS NULL;

-- Fallback para etapas concluídas sem evento específico no log:
-- Usar o responsavel_usuario_id existente da etapa
UPDATE public.oportunidades_etapas
SET concluida_por_id = responsavel_usuario_id
WHERE situacao = 'concluida'
  AND concluida_por_id IS NULL
  AND responsavel_usuario_id IS NOT NULL;

-- ============================================================================
-- ITEM 4: TABELA PRÓPRIA DE DOCUMENTOS DA OPORTUNIDADE (VÁRIOS ARQUIVOS POR ITEM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.oportunidades_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id UUID NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.oportunidades_checklist_itens(id) ON DELETE CASCADE,
  arquivo_nome TEXT NOT NULL,
  arquivo_caminho TEXT NOT NULL,
  arquivo_tamanho BIGINT,
  enviado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oportunidades_docs_opp ON public.oportunidades_documentos(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_docs_item ON public.oportunidades_documentos(checklist_item_id);

-- Habilitar RLS
ALTER TABLE public.oportunidades_documentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS consistentes com o resto do sistema
DROP POLICY IF EXISTS "Usuários autenticados podem ver documentos se têm acesso à oportunidade" ON public.oportunidades_documentos;
CREATE POLICY "Usuários autenticados podem ver documentos se têm acesso à oportunidade"
  ON public.oportunidades_documentos
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user(auth.uid()) AND
    public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

DROP POLICY IF EXISTS "Usuários autenticados podem inserir documentos" ON public.oportunidades_documentos;
CREATE POLICY "Usuários autenticados podem inserir documentos"
  ON public.oportunidades_documentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user(auth.uid()) AND
    public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

DROP POLICY IF EXISTS "Usuários autenticados podem atualizar documentos" ON public.oportunidades_documentos;
CREATE POLICY "Usuários autenticados podem atualizar documentos"
  ON public.oportunidades_documentos
  FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user(auth.uid()) AND
    public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  )
  WITH CHECK (
    public.is_active_user(auth.uid()) AND
    public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

DROP POLICY IF EXISTS "Usuários autenticados podem excluir documentos" ON public.oportunidades_documentos;
CREATE POLICY "Usuários autenticados podem excluir documentos"
  ON public.oportunidades_documentos
  FOR DELETE
  TO authenticated
  USING (
    public.is_active_user(auth.uid()) AND
    (public.is_admin(auth.uid()) OR enviado_por = auth.uid())
  );

-- Migração de dados Item 4: migrar anexos existentes de oportunidades_checklist_itens para oportunidades_documentos
-- Preservando as colunas antigas em oportunidades_checklist_itens
INSERT INTO public.oportunidades_documentos (
  oportunidade_id,
  checklist_item_id,
  arquivo_nome,
  arquivo_caminho,
  arquivo_tamanho,
  enviado_por,
  enviado_em,
  created_at
)
SELECT
  oe.oportunidade_id,
  c.id AS checklist_item_id,
  c.arquivo_nome,
  c.arquivo_url AS arquivo_caminho,
  c.arquivo_tamanho,
  c.concluido_por AS enviado_por,
  COALESCE(c.concluido_em, c.updated_at, NOW()) AS enviado_em,
  COALESCE(c.concluido_em, c.created_at, NOW()) AS created_at
FROM public.oportunidades_checklist_itens c
JOIN public.oportunidades_etapas oe ON oe.id = c.etapa_oportunidade_id
WHERE c.arquivo_url IS NOT NULL
  AND TRIM(c.arquivo_url) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.oportunidades_documentos d
    WHERE d.checklist_item_id = c.id AND d.arquivo_caminho = c.arquivo_url
  );

-- ============================================================================
-- ITEM 5: ORIGEM DO CLIENTE LIGADA À LISTA DE ORIGENS (FK)
-- ============================================================================
-- 1. Garantir que a origem "Outro" exista no catálogo
INSERT INTO public.origens_lead (nome, situacao)
SELECT 'Outro', 'ativa'::public.catalogo_situacao
WHERE NOT EXISTS (
  SELECT 1 FROM public.origens_lead WHERE LOWER(TRIM(nome)) = 'outro'
);

-- 2. Adicionar coluna origem_id em clientes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'origem_id'
  ) THEN
    ALTER TABLE public.clientes
      ADD COLUMN origem_id UUID REFERENCES public.origens_lead(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_clientes_origem_id ON public.clientes(origem_id);
  END IF;
END $$;

-- 3. Migrar dados de clientes já cadastrados:
-- Se o texto da origem bater com uma origem da lista (comparação sem acento e sem case), ligue a ela.
-- Se não bater (mas tiver texto de origem preenchido), ligue à origem "Outro" e acrescente
-- "Origem informada: <texto antigo>" nas observações.
DO $$
DECLARE
  v_outro_id UUID;
  r RECORD;
  v_match_id UUID;
BEGIN
  SELECT id INTO v_outro_id
  FROM public.origens_lead
  WHERE LOWER(TRIM(nome)) = 'outro'
  LIMIT 1;

  FOR r IN
    SELECT id, origem, observacoes
    FROM public.clientes
    WHERE origem IS NOT NULL AND TRIM(origem) <> '' AND origem_id IS NULL
  LOOP
    -- Tenta casamento aproximado (unaccent + lower + trim)
    SELECT id INTO v_match_id
    FROM public.origens_lead
    WHERE LOWER(unaccent(TRIM(nome))) = LOWER(unaccent(TRIM(r.origem)))
    LIMIT 1;

    IF v_match_id IS NOT NULL THEN
      UPDATE public.clientes
      SET origem_id = v_match_id
      WHERE id = r.id;
    ELSE
      -- Liga a 'Outro' e anexa nas observações
      UPDATE public.clientes
      SET origem_id = v_outro_id,
          observacoes = CASE
            WHEN r.observacoes IS NULL OR TRIM(r.observacoes) = '' THEN 'Origem informada: ' || TRIM(r.origem)
            ELSE r.observacoes || E'\n' || 'Origem informada: ' || TRIM(r.origem)
          END
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- ATUALIZAÇÃO DAS RPCS (Funções do Banco)
-- ============================================================================

-- 1) confirmar_ganho_oportunidade: grava valor_fechado e MANTÉM valor_estimado como estava
CREATE OR REPLACE FUNCTION public.confirmar_ganho_oportunidade(
  p_oportunidade_id uuid,
  p_seguradora_id uuid,
  p_valor_fechado numeric,
  p_numero_proposta text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_usuario_id UUID;
  v_usuario_nome TEXT;
  v_seguradora_nome TEXT;
  v_opp RECORD;
BEGIN
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NULL OR NOT public.is_active_user(v_usuario_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  SELECT nome INTO v_usuario_nome FROM public.profiles WHERE id = v_usuario_id;
  v_usuario_nome := COALESCE(v_usuario_nome, 'Usuário');

  SELECT * INTO v_opp FROM public.oportunidades WHERE id = p_oportunidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oportunidade não encontrada.';
  END IF;

  IF p_seguradora_id IS NOT NULL THEN
    SELECT nome INTO v_seguradora_nome FROM public.seguradoras_operadoras WHERE id = p_seguradora_id;
  END IF;

  -- Grava o valor informado em "valor_fechado" e mantém o "valor_estimado" intacto
  UPDATE public.oportunidades
  SET seguradora_id = COALESCE(p_seguradora_id, seguradora_id),
      valor_fechado = COALESCE(p_valor_fechado, valor_fechado),
      numero_quiver = COALESCE(NULLIF(TRIM(p_numero_proposta), ''), numero_quiver),
      situacao = 'Ganha — em finalização'::public.oportunidade_situacao,
      updated_at = NOW()
  WHERE id = p_oportunidade_id;

  -- Linha do tempo
  INSERT INTO public.oportunidades_linha_tempo (
    oportunidade_id,
    tipo,
    titulo,
    descricao,
    usuario_id,
    metadados
  ) VALUES (
    p_oportunidade_id,
    'geral',
    'Fechamento confirmado — Ganha (em finalização)',
    'Confirmado por ' || v_usuario_nome || '. Seguradora: ' || COALESCE(v_seguradora_nome, 'Mantida') || ' | Valor fechado: R$ ' || COALESCE(p_valor_fechado::TEXT, '0') || ' | Nº Proposta/Quiver: ' || COALESCE(TRIM(p_numero_proposta), 'N/A'),
    v_usuario_id,
    jsonb_build_object(
      'seguradora_id', p_seguradora_id,
      'valor_fechado', p_valor_fechado,
      'numero_proposta', p_numero_proposta
    )
  );

  RETURN jsonb_build_object('sucesso', true);
END;
$function$;

-- 2) marcar_oportunidade_perdida: grava motivo_perda_id e observacao_perda na oportunidade
CREATE OR REPLACE FUNCTION public.marcar_oportunidade_perdida(
  p_oportunidade_id uuid,
  p_motivo_id uuid,
  p_observacao text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_usuario_id UUID;
  v_usuario_nome TEXT;
  v_motivo_nome TEXT;
  v_opp RECORD;
BEGIN
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NULL OR NOT public.is_active_user(v_usuario_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  SELECT nome INTO v_usuario_nome FROM public.profiles WHERE id = v_usuario_id;
  v_usuario_nome := COALESCE(v_usuario_nome, 'Usuário');

  SELECT * INTO v_opp FROM public.oportunidades WHERE id = p_oportunidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oportunidade não encontrada.';
  END IF;

  -- Validar motivo: deve existir e ser do tipo perda
  SELECT nome INTO v_motivo_nome
  FROM public.motivos
  WHERE id = p_motivo_id AND tipo = 'perda';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Motivo de perda inválido ou não cadastrado.';
  END IF;

  -- Gravar motivo_perda_id e observacao_perda na oportunidade
  UPDATE public.oportunidades
  SET situacao = 'Perdida'::public.oportunidade_situacao,
      motivo_perda_id = p_motivo_id,
      observacao_perda = NULLIF(TRIM(p_observacao), ''),
      updated_at = NOW()
  WHERE id = p_oportunidade_id;

  -- Linha do tempo
  INSERT INTO public.oportunidades_linha_tempo (
    oportunidade_id,
    tipo,
    titulo,
    descricao,
    usuario_id,
    metadados
  ) VALUES (
    p_oportunidade_id,
    'geral',
    'Oportunidade marcada como Perdida',
    'Registrado por ' || v_usuario_nome || '. Motivo: ' || v_motivo_nome || CASE WHEN p_observacao IS NOT NULL AND TRIM(p_observacao) <> '' THEN ' — ' || TRIM(p_observacao) ELSE '' END,
    v_usuario_id,
    jsonb_build_object(
      'motivo_id', p_motivo_id,
      'motivo_nome', v_motivo_nome,
      'observacao', p_observacao
    )
  );

  RETURN jsonb_build_object('sucesso', true);
END;
$function$;

-- 3) concluir_etapa_oportunidade:
-- - grava concluida_por_id (quem clicou em "Concluir etapa"), sem alterar responsavel_usuario_id
-- - valida documento contando como preenchido quando tiver PELO MENOS UM arquivo na nova tabela oportunidades_documentos
--   (ou na coluna legada arquivo_url para compatibilidade retroativa)
CREATE OR REPLACE FUNCTION public.concluir_etapa_oportunidade(
  p_oportunidade_id uuid,
  p_etapa_atual_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_usuario_id UUID;
  v_usuario_nome TEXT;
  v_opp RECORD;
  v_etapa RECORD;
  v_proxima RECORD;
  v_pendentes_count INT;
  v_pendentes_titulos TEXT;
  v_novo_resp_id UUID;
  v_fila_user RECORD;
  v_notif_msg TEXT;
  v_etapa_ganho_fechamento BOOLEAN := false;
  v_is_ultima BOOLEAN := false;
  v_nova_situacao public.oportunidade_situacao;
BEGIN
  -- Usuário ativo
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NULL OR NOT public.is_active_user(v_usuario_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  SELECT nome INTO v_usuario_nome FROM public.profiles WHERE id = v_usuario_id;
  v_usuario_nome := COALESCE(v_usuario_nome, 'Usuário');

  -- Carregar oportunidade
  SELECT * INTO v_opp FROM public.oportunidades WHERE id = p_oportunidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oportunidade não encontrada.';
  END IF;

  IF v_opp.situacao IN ('Perdida', 'Arquivada', 'Concluída') THEN
    RAISE EXCEPTION 'Esta oportunidade está com situação "%", não permitindo alterações.', v_opp.situacao;
  END IF;

  IF v_opp.etapa_atual_id != p_etapa_atual_id THEN
    RAISE EXCEPTION 'A etapa indicada não é a etapa atual desta oportunidade.';
  END IF;

  -- Carregar etapa atual
  SELECT * INTO v_etapa FROM public.oportunidades_etapas WHERE id = p_etapa_atual_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;

  -- Validar todos os itens obrigatórios do checklist da etapa:
  -- Para 'Documento': conta como preenchido se tiver PELO MENOS UM arquivo em oportunidades_documentos
  -- OU se arquivo_url na própria tabela estiver preenchido (ou marcado como concluido)
  SELECT
    COUNT(*),
    STRING_AGG(ci.titulo, ', ' ORDER BY ci.ordem)
  INTO v_pendentes_count, v_pendentes_titulos
  FROM public.oportunidades_checklist_itens ci
  WHERE ci.etapa_oportunidade_id = p_etapa_atual_id
    AND ci.obrigatorio = true
    AND (
      (ci.tipo = 'Confirmação' AND ci.concluido = false)
      OR (
        ci.tipo = 'Documento' AND NOT (
          ci.concluido = true
          OR (ci.arquivo_url IS NOT NULL AND TRIM(ci.arquivo_url) <> '')
          OR EXISTS (
            SELECT 1 FROM public.oportunidades_documentos doc
            WHERE doc.checklist_item_id = ci.id
          )
        )
      )
      OR (ci.tipo = 'Informação' AND (ci.valor IS NULL OR TRIM(ci.valor) = ''))
    );

  IF v_pendentes_count > 0 THEN
    RAISE EXCEPTION 'Falta preencher os seguintes itens obrigatórios: %', v_pendentes_titulos;
  END IF;

  -- Se esta etapa for a etapa de ganho (is_etapa_ganho = true)
  IF v_etapa.is_etapa_ganho = true THEN
    v_etapa_ganho_fechamento := true;
  END IF;

  -- Marcar a etapa atual como concluída:
  -- Grava quem clicou em "concluida_por_id". O responsável da etapa NÃO muda.
  UPDATE public.oportunidades_etapas
  SET situacao = 'concluida',
      concluida_em = NOW(),
      concluida_por_id = v_usuario_id,
      updated_at = NOW()
  WHERE id = p_etapa_atual_id;

  -- Registrar na linha do tempo a conclusão da etapa
  INSERT INTO public.oportunidades_linha_tempo (
    oportunidade_id,
    tipo,
    titulo,
    descricao,
    usuario_id,
    metadados
  ) VALUES (
    p_oportunidade_id,
    'etapa_concluida',
    'Etapa concluída: ' || v_etapa.nome,
    'Concluída por ' || v_usuario_nome || '.',
    v_usuario_id,
    jsonb_build_object('etapa_id', v_etapa.id, 'ordem', v_etapa.ordem, 'nome', v_etapa.nome)
  );

  -- Buscar próxima etapa
  SELECT * INTO v_proxima
  FROM public.oportunidades_etapas
  WHERE oportunidade_id = p_oportunidade_id
    AND ordem > v_etapa.ordem
  ORDER BY ordem ASC
  LIMIT 1;

  IF v_proxima.id IS NOT NULL THEN
    -- Há próxima etapa! Determinar responsável pela regra da etapa
    IF v_proxima.responsavel_tipo = 'responsavel_comercial' THEN
      v_novo_resp_id := v_opp.responsavel_comercial_id;
    ELSE
      -- fila_equipe: fica sem responsável atribuído individualmente (na fila da equipe)
      v_novo_resp_id := NULL;
    END IF;

    UPDATE public.oportunidades_etapas
    SET situacao = 'em_andamento',
        iniciada_em = NOW(),
        responsavel_usuario_id = v_novo_resp_id,
        updated_at = NOW()
    WHERE id = v_proxima.id;

    -- Atualizar etapa_atual na oportunidade
    v_nova_situacao := v_opp.situacao;
    IF v_etapa_ganho_fechamento THEN
      v_nova_situacao := 'Ganha — em finalização'::public.oportunidade_situacao;
    END IF;

    UPDATE public.oportunidades
    SET etapa_atual_id = v_proxima.id,
        situacao = v_nova_situacao,
        updated_at = NOW()
    WHERE id = p_oportunidade_id;

    -- Notificações
    v_notif_msg := 'A oportunidade ' || v_opp.protocolo || ' chegou para você na etapa ' || v_proxima.nome || '.';

    IF v_proxima.responsavel_tipo = 'responsavel_comercial' AND v_novo_resp_id IS NOT NULL THEN
      INSERT INTO public.notificacoes (
        destinatario_id,
        titulo,
        mensagem,
        link,
        oportunidade_id
      ) VALUES (
        v_novo_resp_id,
        'Nova etapa atribuída (' || v_opp.protocolo || ')',
        v_notif_msg,
        '/oportunidades/' || p_oportunidade_id::TEXT,
        p_oportunidade_id
      );

      -- Linha do tempo: avanço com atribuição
      INSERT INTO public.oportunidades_linha_tempo (
        oportunidade_id,
        tipo,
        titulo,
        descricao,
        usuario_id,
        metadados
      ) VALUES (
        p_oportunidade_id,
        'troca_responsavel',
        'Etapa atual: ' || v_proxima.nome,
        'Atribuída ao responsável comercial da oportunidade.',
        v_usuario_id,
        jsonb_build_object('etapa_id', v_proxima.id, 'responsavel_id', v_novo_resp_id)
      );
    ELSE
      -- fila_equipe: notificar todos os usuários ativos da equipe e função da etapa
      FOR v_fila_user IN
        SELECT DISTINCT p.id
        FROM public.profiles p
        JOIN public.profile_equipes pe ON pe.profile_id = p.id
        WHERE p.situacao = 'ativo'
          AND pe.equipe_id = v_proxima.equipe_id
          AND (v_proxima.funcao IS NULL OR p.funcao = v_proxima.funcao)
      LOOP
        INSERT INTO public.notificacoes (
          destinatario_id,
          titulo,
          mensagem,
          link,
          oportunidade_id
        ) VALUES (
          v_fila_user.id,
          'Nova oportunidade na fila (' || v_opp.protocolo || ')',
          v_notif_msg,
          '/oportunidades/' || p_oportunidade_id::TEXT,
          p_oportunidade_id
        );
      END LOOP;

      -- Linha do tempo: avanço para fila
      INSERT INTO public.oportunidades_linha_tempo (
        oportunidade_id,
        tipo,
        titulo,
        descricao,
        usuario_id,
        metadados
      ) VALUES (
        p_oportunidade_id,
        'etapa_concluida',
        'Etapa atual: ' || v_proxima.nome,
        'Etapa disponibilizada na fila da equipe responsável.',
        v_usuario_id,
        jsonb_build_object('etapa_id', v_proxima.id, 'equipe_id', v_proxima.equipe_id)
      );
    END IF;

  ELSE
    -- Era a última etapa do fluxo: oportunidade passa a "Concluída"
    v_is_ultima := true;
    UPDATE public.oportunidades
    SET situacao = 'Concluída'::public.oportunidade_situacao,
        updated_at = NOW()
    WHERE id = p_oportunidade_id;

    INSERT INTO public.oportunidades_linha_tempo (
      oportunidade_id,
      tipo,
      titulo,
      descricao,
      usuario_id,
      metadados
    ) VALUES (
      p_oportunidade_id,
      'geral',
      'Fluxo finalizado — Oportunidade Concluída',
      'Todas as etapas foram concluídas com êxito.',
      v_usuario_id,
      jsonb_build_object('situacao', 'Concluída')
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'proxima_etapa_id', v_proxima.id,
    'era_etapa_ganho', v_etapa_ganho_fechamento,
    'era_ultima_etapa', v_is_ultima
  );
END;
$function$;

-- 4) voltar_etapa_oportunidade:
-- limpa concluida_em E concluida_por_id da etapa que voltou a ficar aberta
CREATE OR REPLACE FUNCTION public.voltar_etapa_oportunidade(
  p_oportunidade_id uuid,
  p_etapa_atual_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_usuario_id UUID;
  v_usuario_nome TEXT;
  v_opp RECORD;
  v_etapa_atual RECORD;
  v_etapa_anterior RECORD;
BEGIN
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NULL OR NOT public.is_active_user(v_usuario_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  IF p_motivo IS NULL OR TRIM(p_motivo) = '' THEN
    RAISE EXCEPTION 'O motivo do retorno da etapa é obrigatório.';
  END IF;

  SELECT nome INTO v_usuario_nome FROM public.profiles WHERE id = v_usuario_id;
  v_usuario_nome := COALESCE(v_usuario_nome, 'Usuário');

  SELECT * INTO v_opp FROM public.oportunidades WHERE id = p_oportunidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oportunidade não encontrada.';
  END IF;

  IF v_opp.situacao IN ('Perdida', 'Arquivada', 'Concluída') THEN
    RAISE EXCEPTION 'Não é possível movimentar uma oportunidade com situação "%".', v_opp.situacao;
  END IF;

  SELECT * INTO v_etapa_atual FROM public.oportunidades_etapas WHERE id = p_etapa_atual_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa atual não encontrada.';
  END IF;

  -- Buscar a etapa imediatamente anterior por ordem
  SELECT * INTO v_etapa_anterior
  FROM public.oportunidades_etapas
  WHERE oportunidade_id = p_oportunidade_id
    AND ordem < v_etapa_atual.ordem
  ORDER BY ordem DESC
  LIMIT 1;

  IF v_etapa_anterior.id IS NULL THEN
    RAISE EXCEPTION 'Esta já é a primeira etapa do fluxo. Não há etapa anterior.';
  END IF;

  -- Etapa atual volta para pendente
  UPDATE public.oportunidades_etapas
  SET situacao = 'pendente',
      concluida_em = NULL,
      concluida_por_id = NULL,
      updated_at = NOW()
  WHERE id = v_etapa_atual.id;

  -- Etapa anterior volta a ser atual (em_andamento, limpa concluida_em e concluida_por_id)
  UPDATE public.oportunidades_etapas
  SET situacao = 'em_andamento',
      concluida_em = NULL,
      concluida_por_id = NULL,
      updated_at = NOW()
  WHERE id = v_etapa_anterior.id;

  -- Se estava em Ganha — em finalização e voltou antes da etapa de ganho, restaura "Em andamento"
  IF v_opp.situacao = 'Ganha — em finalização' AND v_etapa_anterior.is_etapa_ganho = false AND v_etapa_anterior.ordem <= v_etapa_atual.ordem THEN
    UPDATE public.oportunidades
    SET etapa_atual_id = v_etapa_anterior.id,
        situacao = 'Em andamento'::public.oportunidade_situacao,
        updated_at = NOW()
    WHERE id = p_oportunidade_id;
  ELSE
    UPDATE public.oportunidades
    SET etapa_atual_id = v_etapa_anterior.id,
        updated_at = NOW()
    WHERE id = p_oportunidade_id;
  END IF;

  -- Registrar na linha do tempo
  INSERT INTO public.oportunidades_linha_tempo (
    oportunidade_id,
    tipo,
    titulo,
    descricao,
    usuario_id,
    metadados
  ) VALUES (
    p_oportunidade_id,
    'geral',
    'Etapa retornada: ' || v_etapa_anterior.nome,
    'Retornado por ' || v_usuario_nome || '. Motivo: ' || TRIM(p_motivo),
    v_usuario_id,
    jsonb_build_object(
      'de_etapa_id', v_etapa_atual.id,
      'para_etapa_id', v_etapa_anterior.id,
      'motivo', TRIM(p_motivo)
    )
  );

  RETURN jsonb_build_object('sucesso', true, 'etapa_anterior_id', v_etapa_anterior.id);
END;
$function$;
