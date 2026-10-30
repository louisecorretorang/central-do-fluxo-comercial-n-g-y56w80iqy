-- Migration: T5.02b — etapa de fila: qualquer pessoa da equipe + função movimenta (D-23)
-- Data: 2026-10-30 · SPEC-1-005 (regra 3, emenda necessária) · Task T5.02 · D-23 opção B
--
-- Decisão de Pedro (30/10 16:32), registrada como D-23 em 01_projeto/decisoes.md:
-- em etapa de `fila_equipe`, qualquer pessoa da mesma equipe + função **conclui e volta a etapa
-- sem precisar assumir**. Assumir passa a ser apenas o marcador de "quem está cuidando".
--
-- Por que: a regra 3 da SPEC-1-005, lida ao pé da letra ("só o responsável da etapa atual, um
-- gestor da equipe ou um administrador conclui"), travava a fila inteira quando a pessoa que
-- assumiu estava ausente — o colega da mesma fila não podia assumir ("já assumida") nem concluir
-- ("apenas o responsável"). Uma fila de pós-venda existe justamente para qualquer um da equipe
-- pegar o trabalho.
--
-- O que muda: apenas a função `pode_movimentar_etapa` — é ela que `concluir_etapa_oportunidade`
-- e `voltar_etapa_oportunidade` consultam. `assumir_etapa_oportunidade` fica como está: continua
-- sendo operação única (o segundo recebe "já assumida por <nome>"), porque assumir é declarar
-- intenção, não pegar o trabalho à força.
--
-- Sem mudança de dados. Reversão: reaplicar `pode_movimentar_etapa` da migração 20261030160000.

CREATE OR REPLACE FUNCTION public.pode_movimentar_etapa(
  p_usuario_id UUID,
  p_oportunidade_id UUID,
  p_etapa_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_perfil public.user_perfil;
  v_funcao public.user_funcao;
  v_etapa RECORD;
  v_opp_equipe UUID;
  v_pertence_equipe BOOLEAN;
BEGIN
  IF p_usuario_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT perfil, funcao INTO v_perfil, v_funcao
  FROM public.profiles
  WHERE id = p_usuario_id;

  IF v_perfil IS NULL THEN
    RETURN false;
  END IF;

  -- Administrador movimenta qualquer etapa
  IF v_perfil = 'Administrador' THEN
    RETURN true;
  END IF;

  SELECT * INTO v_etapa
  FROM public.oportunidades_etapas
  WHERE id = p_etapa_id AND oportunidade_id = p_oportunidade_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 1) É o responsável da etapa
  IF v_etapa.responsavel_usuario_id = p_usuario_id THEN
    RETURN true;
  END IF;

  -- 2) D-23 (opção B) — etapa de fila: qualquer pessoa da equipe + função movimenta.
  -- Vale mesmo que outra pessoa já tenha assumido a etapa: o assumir é só o marcador de
  -- "quem está cuidando", não uma reserva exclusiva.
  IF v_etapa.responsavel_tipo = 'fila_equipe' THEN
    IF v_etapa.equipe_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
          FROM public.profile_equipes pe
         WHERE pe.profile_id = p_usuario_id
           AND pe.equipe_id = v_etapa.equipe_id
      ) INTO v_pertence_equipe;

      IF v_pertence_equipe
         AND (v_etapa.funcao IS NULL OR v_etapa.funcao = v_funcao) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  -- 3) Gestor da equipe da etapa (ou da equipe da oportunidade)
  IF v_perfil = 'Gestor' THEN
    SELECT equipe_id INTO v_opp_equipe
    FROM public.oportunidades
    WHERE id = p_oportunidade_id;

    IF EXISTS (
      SELECT 1
        FROM public.profile_equipes pe
       WHERE pe.profile_id = p_usuario_id
         AND pe.equipe_id IS NOT NULL
         AND pe.equipe_id IN (v_etapa.equipe_id, v_opp_equipe)
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.pode_movimentar_etapa(UUID, UUID, UUID) IS
  'T5.02/D-23: responsável da etapa, qualquer membro da equipe+função em etapa de fila, gestor da equipe ou administrador.';

-- ============================================================================
-- 2. Mensagem de recusa mais precisa em `concluir_etapa_oportunidade`
-- ============================================================================
-- Antes, quem não podia movimentar uma etapa de fila SEM responsável recebia "Assuma a etapa
-- antes de concluí-la" — conselho impossível de seguir para quem não pertence à equipe/função.
-- Agora a mensagem diz o que realmente acontece em cada caso.
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
  v_usuario_funcao public.user_funcao;
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
  v_pertence_equipe BOOLEAN;
BEGIN
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NULL OR NOT public.is_active_user(v_usuario_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado.';
  END IF;

  SELECT nome, funcao INTO v_usuario_nome, v_usuario_funcao
  FROM public.profiles WHERE id = v_usuario_id;
  v_usuario_nome := COALESCE(v_usuario_nome, 'Usuário');

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

  SELECT * INTO v_etapa FROM public.oportunidades_etapas WHERE id = p_etapa_atual_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;

  -- T5.02 / D-23 — quem pode concluir.
  IF NOT public.pode_movimentar_etapa(v_usuario_id, p_oportunidade_id, p_etapa_atual_id) THEN
    IF v_etapa.responsavel_tipo = 'fila_equipe' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.profile_equipes pe
         WHERE pe.profile_id = v_usuario_id AND pe.equipe_id = v_etapa.equipe_id
      ) INTO v_pertence_equipe;

      IF NOT v_pertence_equipe THEN
        RAISE EXCEPTION 'Esta etapa está na fila de outra equipe. Você não pode concluí-la.';
      END IF;
      IF v_etapa.funcao IS NOT NULL AND v_etapa.funcao <> v_usuario_funcao THEN
        RAISE EXCEPTION 'Esta etapa da fila é destinada à função %. Você não pode concluí-la.', v_etapa.funcao;
      END IF;
    END IF;
    RAISE EXCEPTION 'Apenas o responsável pela etapa, um gestor da equipe ou um administrador pode concluí-la.';
  END IF;

  -- T5.01 — obrigatórios (Documento exige arquivo em oportunidades_documentos).
  SELECT COUNT(*), STRING_AGG(titulo, ', ' ORDER BY ordem)
  INTO v_pendentes_count, v_pendentes_titulos
  FROM public.oportunidades_checklist_itens i
  WHERE i.etapa_oportunidade_id = p_etapa_atual_id
    AND i.obrigatorio = true
    AND (
      (i.tipo = 'Confirmação' AND i.concluido = false)
      OR (i.tipo = 'Informação' AND (i.valor IS NULL OR TRIM(i.valor) = ''))
      OR (i.tipo = 'Documento' AND NOT EXISTS (
            SELECT 1 FROM public.oportunidades_documentos d WHERE d.checklist_item_id = i.id
          ))
    );

  IF v_pendentes_count > 0 THEN
    RAISE EXCEPTION 'Falta preencher os seguintes itens obrigatórios: %', v_pendentes_titulos;
  END IF;

  IF v_etapa.is_etapa_ganho = true THEN
    v_etapa_ganho_fechamento := true;
  END IF;

  UPDATE public.oportunidades_etapas
  SET situacao = 'concluida',
      concluida_em = NOW(),
      responsavel_usuario_id = COALESCE(responsavel_usuario_id, v_usuario_id),
      updated_at = NOW()
  WHERE id = p_etapa_atual_id;

  INSERT INTO public.oportunidades_linha_tempo (
    oportunidade_id, tipo, titulo, descricao, usuario_id, metadados
  ) VALUES (
    p_oportunidade_id, 'etapa_concluida',
    'Etapa concluída: ' || v_etapa.nome,
    'Concluída por ' || v_usuario_nome || '.',
    v_usuario_id,
    jsonb_build_object('etapa_id', v_etapa.id, 'ordem', v_etapa.ordem, 'nome', v_etapa.nome)
  );

  SELECT * INTO v_proxima
  FROM public.oportunidades_etapas
  WHERE oportunidade_id = p_oportunidade_id AND ordem > v_etapa.ordem
  ORDER BY ordem ASC LIMIT 1;

  IF v_proxima.id IS NOT NULL THEN
    IF v_proxima.responsavel_tipo = 'responsavel_comercial' THEN
      v_novo_resp_id := v_opp.responsavel_comercial_id;
    ELSE
      v_novo_resp_id := NULL;
    END IF;

    UPDATE public.oportunidades_etapas
    SET situacao = 'em_andamento', iniciada_em = NOW(),
        responsavel_usuario_id = v_novo_resp_id, updated_at = NOW()
    WHERE id = v_proxima.id;

    v_nova_situacao := v_opp.situacao;
    IF v_etapa_ganho_fechamento THEN
      v_nova_situacao := 'Ganha — em finalização'::public.oportunidade_situacao;
    END IF;

    UPDATE public.oportunidades
    SET etapa_atual_id = v_proxima.id, situacao = v_nova_situacao, updated_at = NOW()
    WHERE id = p_oportunidade_id;

    v_notif_msg := 'A oportunidade ' || v_opp.protocolo || ' chegou para você na etapa ' || v_proxima.nome || '.';

    IF v_proxima.responsavel_tipo = 'responsavel_comercial' AND v_novo_resp_id IS NOT NULL THEN
      INSERT INTO public.notificacoes (destinatario_id, titulo, mensagem, link, oportunidade_id)
      VALUES (v_novo_resp_id, 'Nova etapa atribuída (' || v_opp.protocolo || ')', v_notif_msg,
              '/oportunidades/' || p_oportunidade_id::TEXT, p_oportunidade_id);

      INSERT INTO public.oportunidades_linha_tempo (
        oportunidade_id, tipo, titulo, descricao, usuario_id, metadados
      ) VALUES (
        p_oportunidade_id, 'troca_responsavel', 'Etapa atual: ' || v_proxima.nome,
        'Atribuída ao responsável comercial da oportunidade.', v_usuario_id,
        jsonb_build_object('etapa_id', v_proxima.id, 'responsavel_id', v_novo_resp_id)
      );
    ELSE
      FOR v_fila_user IN
        SELECT DISTINCT p.id
        FROM public.profiles p
        JOIN public.profile_equipes pe ON pe.profile_id = p.id
        WHERE p.situacao = 'ativo'
          AND pe.equipe_id = v_proxima.equipe_id
          AND (v_proxima.funcao IS NULL OR p.funcao = v_proxima.funcao)
      LOOP
        INSERT INTO public.notificacoes (destinatario_id, titulo, mensagem, link, oportunidade_id)
        VALUES (v_fila_user.id, 'Nova oportunidade na fila (' || v_opp.protocolo || ')',
                v_notif_msg, '/oportunidades/' || p_oportunidade_id::TEXT, p_oportunidade_id);
      END LOOP;

      INSERT INTO public.oportunidades_linha_tempo (
        oportunidade_id, tipo, titulo, descricao, usuario_id, metadados
      ) VALUES (
        p_oportunidade_id, 'etapa_concluida', 'Etapa atual: ' || v_proxima.nome,
        'Etapa disponibilizada na fila da equipe responsável.', v_usuario_id,
        jsonb_build_object('etapa_id', v_proxima.id, 'equipe_id', v_proxima.equipe_id)
      );
    END IF;
  ELSE
    v_is_ultima := true;
    UPDATE public.oportunidades
    SET situacao = 'Concluída'::public.oportunidade_situacao, updated_at = NOW()
    WHERE id = p_oportunidade_id;

    INSERT INTO public.oportunidades_linha_tempo (
      oportunidade_id, tipo, titulo, descricao, usuario_id, metadados
    ) VALUES (
      p_oportunidade_id, 'geral', 'Fluxo finalizado — Oportunidade Concluída',
      'Todas as etapas foram concluídas com êxito.', v_usuario_id,
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