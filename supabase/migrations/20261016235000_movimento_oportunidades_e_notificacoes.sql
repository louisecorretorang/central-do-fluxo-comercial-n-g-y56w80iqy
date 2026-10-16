-- ============================================================================
-- Migration: Movimento da oportunidade, regras de etapa, ganho, perda, arquivo e notificações
-- Data: 2026-10-16
-- ============================================================================

-- 1. Atualizar enum oportunidade_situacao para aceitar novos estados
-- 'Em andamento', 'Ganha — em finalização', 'Concluída', 'Perdida', 'Arquivada'
ALTER TYPE public.oportunidade_situacao ADD VALUE IF NOT EXISTS 'Ganha — em finalização';
ALTER TYPE public.oportunidade_situacao ADD VALUE IF NOT EXISTS 'Concluída';
ALTER TYPE public.oportunidade_situacao ADD VALUE IF NOT EXISTS 'Arquivada';

-- 2. Tabela de Notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT,
  oportunidade_id UUID REFERENCES public.oportunidades(id) ON DELETE CASCADE,
  lida BOOLEAN NOT NULL DEFAULT false,
  lida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_destinatario ON public.notificacoes(destinatario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON public.notificacoes(destinatario_id, lida);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notificacoes_select_own" ON public.notificacoes;
CREATE POLICY "notificacoes_select_own" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (destinatario_id = auth.uid());

DROP POLICY IF EXISTS "notificacoes_update_own" ON public.notificacoes;
CREATE POLICY "notificacoes_update_own" ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (destinatario_id = auth.uid())
  WITH CHECK (destinatario_id = auth.uid());

DROP POLICY IF EXISTS "notificacoes_insert_auth" ON public.notificacoes;
CREATE POLICY "notificacoes_insert_auth" ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));

-- 3. Função RPC para Concluir Etapa Atual
CREATE OR REPLACE FUNCTION public.concluir_etapa_oportunidade(
  p_oportunidade_id UUID,
  p_etapa_atual_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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

  -- Validar todos os itens obrigatórios do checklist da etapa
  SELECT
    COUNT(*),
    STRING_AGG(titulo, ', ' ORDER BY ordem)
  INTO v_pendentes_count, v_pendentes_titulos
  FROM public.oportunidades_checklist_itens
  WHERE etapa_oportunidade_id = p_etapa_atual_id
    AND obrigatorio = true
    AND (
      (tipo = 'Confirmação' AND concluido = false)
      OR (tipo = 'Documento' AND (arquivo_url IS NULL OR TRIM(arquivo_url) = ''))
      OR (tipo = 'Informação' AND (valor IS NULL OR TRIM(valor) = ''))
    );

  IF v_pendentes_count > 0 THEN
    RAISE EXCEPTION 'Falta preencher os seguintes itens obrigatórios: %', v_pendentes_titulos;
  END IF;

  -- Se esta etapa for a etapa de ganho (is_etapa_ganho = true)
  IF v_etapa.is_etapa_ganho = true THEN
    v_etapa_ganho_fechamento := true;
  END IF;

  -- Marcar a etapa atual como concluída
  UPDATE public.oportunidades_etapas
  SET situacao = 'concluida',
      concluida_em = NOW(),
      responsavel_usuario_id = COALESCE(responsavel_usuario_id, v_usuario_id),
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
$$;

-- 4. Função RPC para "Assumir" etapa da fila
CREATE OR REPLACE FUNCTION public.assumir_etapa_oportunidade(
  p_oportunidade_id UUID,
  p_etapa_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_usuario_id UUID;
  v_usuario_nome TEXT;
  v_usuario_funcao public.user_funcao;
  v_etapa RECORD;
  v_pertence_equipe BOOLEAN;
BEGIN
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NULL OR NOT public.is_active_user(v_usuario_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  SELECT nome, funcao INTO v_usuario_nome, v_usuario_funcao
  FROM public.profiles
  WHERE id = v_usuario_id;

  SELECT * INTO v_etapa
  FROM public.oportunidades_etapas
  WHERE id = p_etapa_id AND oportunidade_id = p_oportunidade_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;

  IF v_etapa.responsavel_tipo != 'fila_equipe' THEN
    RAISE EXCEPTION 'Esta etapa já tem regra de responsável comercial fixo.';
  END IF;

  -- Checar se usuário pertence à equipe da etapa
  SELECT EXISTS (
    SELECT 1 FROM public.profile_equipes
    WHERE profile_id = v_usuario_id AND equipe_id = v_etapa.equipe_id
  ) INTO v_pertence_equipe;

  IF NOT v_pertence_equipe THEN
    RAISE EXCEPTION 'Você não pertence à equipe responsável por esta etapa.';
  END IF;

  -- Checar função se a etapa exigir função específica
  IF v_etapa.funcao IS NOT NULL AND v_etapa.funcao != v_usuario_funcao THEN
    -- Admin pode assumir qualquer função
    IF NOT public.is_admin(v_usuario_id) THEN
      RAISE EXCEPTION 'Esta etapa é destinada para a função %.', v_etapa.funcao;
    END IF;
  END IF;

  -- Atribuir
  UPDATE public.oportunidades_etapas
  SET responsavel_usuario_id = v_usuario_id,
      updated_at = NOW()
  WHERE id = p_etapa_id;

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
    'troca_responsavel',
    'Etapa assumida: ' || v_etapa.nome,
    v_usuario_nome || ' assumiu a responsabilidade por esta etapa.',
    v_usuario_id,
    jsonb_build_object('etapa_id', p_etapa_id, 'assumido_por', v_usuario_id)
  );

  RETURN jsonb_build_object('sucesso', true, 'responsavel_usuario_id', v_usuario_id);
END;
$$;

-- 5. Função RPC para "Voltar Etapa"
CREATE OR REPLACE FUNCTION public.voltar_etapa_oportunidade(
  p_oportunidade_id UUID,
  p_etapa_atual_id UUID,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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
      updated_at = NOW()
  WHERE id = v_etapa_atual.id;

  -- Etapa anterior volta a ser atual (em_andamento, remove data de conclusao)
  UPDATE public.oportunidades_etapas
  SET situacao = 'em_andamento',
      concluida_em = NULL,
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
$$;

-- 6. Função RPC para Confirmar Fechamento (Etapa de Ganho)
CREATE OR REPLACE FUNCTION public.confirmar_ganho_oportunidade(
  p_oportunidade_id UUID,
  p_seguradora_id UUID,
  p_valor_fechado NUMERIC,
  p_numero_proposta TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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

  UPDATE public.oportunidades
  SET seguradora_id = COALESCE(p_seguradora_id, seguradora_id),
      valor_estimado = COALESCE(p_valor_fechado, valor_estimado),
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
    'Confirmado por ' || v_usuario_nome || '. Seguradora: ' || COALESCE(v_seguradora_nome, 'Mantida') || ' | Valor: R$ ' || COALESCE(p_valor_fechado::TEXT, '0') || ' | Nº Proposta/Quiver: ' || COALESCE(TRIM(p_numero_proposta), 'N/A'),
    v_usuario_id,
    jsonb_build_object(
      'seguradora_id', p_seguradora_id,
      'valor_fechado', p_valor_fechado,
      'numero_proposta', p_numero_proposta
    )
  );

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

-- 7. Função RPC para "Marcar como perdida"
CREATE OR REPLACE FUNCTION public.marcar_oportunidade_perdida(
  p_oportunidade_id UUID,
  p_motivo_id UUID,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
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

  -- Validar motivo
  SELECT nome INTO v_motivo_nome
  FROM public.motivos
  WHERE id = p_motivo_id AND tipo = 'perda';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Motivo de perda inválido ou não cadastrado.';
  END IF;

  UPDATE public.oportunidades
  SET situacao = 'Perdida'::public.oportunidade_situacao,
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
$$;

-- 8. Função RPC para "Arquivar Oportunidade" (Apenas Admin e Gestor)
CREATE OR REPLACE FUNCTION public.arquivar_oportunidade(
  p_oportunidade_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_usuario_id UUID;
  v_usuario_nome TEXT;
  v_usuario_perfil public.user_perfil;
  v_opp RECORD;
BEGIN
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NULL OR NOT public.is_active_user(v_usuario_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  SELECT nome, perfil INTO v_usuario_nome, v_usuario_perfil
  FROM public.profiles
  WHERE id = v_usuario_id;

  IF v_usuario_perfil NOT IN ('Administrador', 'Gestor') THEN
    RAISE EXCEPTION 'Apenas Administradores e Gestores podem arquivar oportunidades.';
  END IF;

  SELECT * INTO v_opp FROM public.oportunidades WHERE id = p_oportunidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oportunidade não encontrada.';
  END IF;

  UPDATE public.oportunidades
  SET situacao = 'Arquivada'::public.oportunidade_situacao,
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
    'Oportunidade Arquivada',
    'Arquivada por ' || COALESCE(v_usuario_nome, 'Usuário') || ' (' || v_usuario_perfil || ').' || CASE WHEN p_motivo IS NOT NULL AND TRIM(p_motivo) <> '' THEN ' Motivo: ' || TRIM(p_motivo) ELSE '' END,
    v_usuario_id,
    jsonb_build_object('motivo', p_motivo, 'perfil', v_usuario_perfil)
  );

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

-- 9. Marcar notificação como lida
CREATE OR REPLACE FUNCTION public.marcar_notificacoes_lidas(
  p_notificacao_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  IF p_notificacao_id IS NOT NULL THEN
    UPDATE public.notificacoes
    SET lida = true,
        lida_em = NOW()
    WHERE id = p_notificacao_id AND destinatario_id = v_usuario_id;
  ELSE
    UPDATE public.notificacoes
    SET lida = true,
        lida_em = NOW()
    WHERE destinatario_id = v_usuario_id AND lida = false;
  END IF;

  RETURN jsonb_build_object('sucesso', true);
END;
$$;
