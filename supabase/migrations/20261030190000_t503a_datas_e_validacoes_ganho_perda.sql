-- Migration: T5.03a — data do ganho, data da perda e validações no banco
-- Data: 2026-10-30 · SPEC-1-005 · Task T5.03a · CA-1-22 · emenda de 20/10 (auditoria do tronco)
--
-- Recorte autorizado por Pedro (30/10 19:32): **banco apenas**. A tela fica para a T5.03b.
--
-- Quatro furos confirmados no SQL real do repositório:
--
-- 1. Não existiam `data_ganho` nem `data_perda`. A emenda de 20/10 registra: "o tronco não grava
--    data do ganho nem data da perda (só na linha do tempo); a SPEC-1-006 usa essas datas no
--    Painel". Sem as colunas, o Painel não tem de onde tirar o número.
--
-- 2. `confirmar_ganho_oportunidade` não validava nada: aceitava seguradora, valor e nº da
--    proposta nulos, e ainda usava `COALESCE` para gravar "o que já estava". A regra 7 da SPEC
--    diz "seguradora, valor fechado, nº da proposta, todos obrigatórios".
--
-- 3. `marcar_oportunidade_perdida` não limpava `etapa_atual_id`. A regra 9 da SPEC diz
--    "nenhuma etapa fica atual" — com a etapa ainda apontada, a ficha continua mostrando
--    "etapa atual" numa oportunidade perdida.
--
-- 4. A observação da perda era opcional (`DEFAULT NULL`). A regra 9 exige "motivo (lista de
--    perda) e observação obrigatórios".
--
-- Também entra a regra 8: concluir a última etapa de um fluxo que **não tem** etapa de ganho
-- deve pedir a confirmação de ganho naquele momento, em vez de fechar como "Concluída" em
-- silêncio. A função passa a recusar nesse caso e devolve o sinal `precisa_confirmar_ganho`,
-- que a T5.03b usa na tela.
--
-- Dados legados: preenche `data_ganho`/`data_perda` das oportunidades já ganhas/perdidas a partir
-- do primeiro registro correspondente na linha do tempo. É uma APROXIMAÇÃO declarada — a linha do
-- tempo guarda quando o evento foi registrado, que pode diferir da data real do fechamento.
-- Idempotente: só toca quem está com a data nula.
--
-- Reversão: reaplicar as três funções de 20261017010000 e 20261016235000; as colunas são aditivas
-- (podem ficar, sem efeito).

-- ============================================================================
-- 1. Colunas de data
-- ============================================================================
ALTER TABLE public.oportunidades
  ADD COLUMN IF NOT EXISTS data_ganho DATE,
  ADD COLUMN IF NOT EXISTS data_perda DATE;

COMMENT ON COLUMN public.oportunidades.data_ganho IS
  'T5.03: data em que a oportunidade foi marcada como ganha (regra 7 da SPEC-1-005).';
COMMENT ON COLUMN public.oportunidades.data_perda IS
  'T5.03: data em que a oportunidade foi marcada como perdida (regra 9 da SPEC-1-005).';

-- ============================================================================
-- 2. `confirmar_ganho_oportunidade` — os três campos são obrigatórios
-- ============================================================================
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

  IF v_opp.situacao IN ('Perdida', 'Arquivada', 'Concluída') THEN
    RAISE EXCEPTION 'Esta oportunidade está com situação "%", não permitindo confirmar o ganho.', v_opp.situacao;
  END IF;

  -- T5.03 — regra 7: seguradora, valor fechado e nº da proposta são obrigatórios.
  IF p_seguradora_id IS NULL THEN
    RAISE EXCEPTION 'Selecione a seguradora/operadora para confirmar o ganho.';
  END IF;
  IF p_valor_fechado IS NULL OR p_valor_fechado <= 0 THEN
    RAISE EXCEPTION 'Informe o valor fechado da proposta em R$.';
  END IF;
  IF p_numero_proposta IS NULL OR TRIM(p_numero_proposta) = '' THEN
    RAISE EXCEPTION 'Informe o nº da proposta ou apólice gerada.';
  END IF;

  SELECT nome INTO v_seguradora_nome
  FROM public.seguradoras_operadoras
  WHERE id = p_seguradora_id AND situacao = 'ativa';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seguradora/operadora informada não existe ou está inativa.';
  END IF;

  UPDATE public.oportunidades
  SET seguradora_id = p_seguradora_id,
      valor_fechado = p_valor_fechado,
      numero_quiver = TRIM(p_numero_proposta),
      situacao = 'Ganha — em finalização'::public.oportunidade_situacao,
      -- T5.03: grava a data do ganho (uma vez só; não sobrescreve se já houver)
      data_ganho = COALESCE(data_ganho, CURRENT_DATE),
      updated_at = NOW()
  WHERE id = p_oportunidade_id;

  INSERT INTO public.oportunidades_linha_tempo (
    oportunidade_id, tipo, titulo, descricao, usuario_id, metadados
  ) VALUES (
    p_oportunidade_id,
    'geral',
    'Fechamento confirmado — Ganha (em finalização)',
    'Confirmado por ' || v_usuario_nome || '. Seguradora: ' || v_seguradora_nome ||
      ' | Valor fechado: R$ ' || p_valor_fechado::TEXT ||
      ' | Nº Proposta/Quiver: ' || TRIM(p_numero_proposta),
    v_usuario_id,
    jsonb_build_object(
      'seguradora_id', p_seguradora_id,
      'valor_fechado', p_valor_fechado,
      'numero_proposta', TRIM(p_numero_proposta),
      'data_ganho', COALESCE(v_opp.data_ganho, CURRENT_DATE)
    )
  );

  -- Se a etapa de ganho era a última do fluxo, o ganho confirmado encerra a oportunidade.
  -- Sem isso ela ficaria em "Ganha — em finalização" para sempre.
  IF v_opp.etapa_atual_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.oportunidades_etapas
       WHERE oportunidade_id = p_oportunidade_id
         AND situacao <> 'concluida'
    ) THEN
      UPDATE public.oportunidades
      SET situacao = 'Concluída'::public.oportunidade_situacao, updated_at = NOW()
      WHERE id = p_oportunidade_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'data_ganho', COALESCE(v_opp.data_ganho, CURRENT_DATE)
  );
END;
$$;

COMMENT ON FUNCTION public.confirmar_ganho_oportunidade(UUID, UUID, NUMERIC, TEXT) IS
  'T5.03: exige seguradora, valor > 0 e nº da proposta; grava data_ganho (regra 7).';

-- ============================================================================
-- 3. `marcar_oportunidade_perdida` — observação obrigatória, data e limpeza da etapa
-- ============================================================================
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

  IF v_opp.situacao IN ('Perdida', 'Arquivada', 'Concluída') THEN
    RAISE EXCEPTION 'Esta oportunidade está com situação "%", não permitindo marcar perda.', v_opp.situacao;
  END IF;

  -- T5.03 — regra 9: motivo E observação obrigatórios.
  IF p_motivo_id IS NULL THEN
    RAISE EXCEPTION 'Selecione o motivo da perda.';
  END IF;
  IF p_observacao IS NULL OR TRIM(p_observacao) = '' THEN
    RAISE EXCEPTION 'Descreva o motivo da perda na observação.';
  END IF;

  SELECT nome INTO v_motivo_nome
  FROM public.motivos
  WHERE id = p_motivo_id AND tipo = 'perda';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Motivo de perda inválido ou não cadastrado.';
  END IF;

  UPDATE public.oportunidades
  SET situacao = 'Perdida'::public.oportunidade_situacao,
      motivo_perda_id = p_motivo_id,
      observacao_perda = TRIM(p_observacao),
      -- T5.03: grava a data da perda (uma vez só) e limpa a etapa atual (regra 9:
      -- "nenhuma etapa fica atual")
      data_perda = COALESCE(data_perda, CURRENT_DATE),
      etapa_atual_id = NULL,
      updated_at = NOW()
  WHERE id = p_oportunidade_id;

  -- A etapa que estava em andamento deixa de estar (mantém o histórico dela)
  UPDATE public.oportunidades_etapas
  SET situacao = 'pendente',
      updated_at = NOW()
  WHERE oportunidade_id = p_oportunidade_id
    AND situacao = 'em_andamento';

  INSERT INTO public.oportunidades_linha_tempo (
    oportunidade_id, tipo, titulo, descricao, usuario_id, metadados
  ) VALUES (
    p_oportunidade_id,
    'geral',
    'Oportunidade marcada como Perdida',
    'Registrado por ' || v_usuario_nome || '. Motivo: ' || v_motivo_nome ||
      ' — ' || TRIM(p_observacao),
    v_usuario_id,
    jsonb_build_object(
      'motivo_id', p_motivo_id,
      'motivo_nome', v_motivo_nome,
      'observacao', TRIM(p_observacao),
      'data_perda', COALESCE(v_opp.data_perda, CURRENT_DATE)
    )
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'data_perda', COALESCE(v_opp.data_perda, CURRENT_DATE)
  );
END;
$$;

COMMENT ON FUNCTION public.marcar_oportunidade_perdida(UUID, UUID, TEXT) IS
  'T5.03: exige motivo e observação; grava data_perda e limpa a etapa atual (regra 9).';

-- ============================================================================
-- 4. Regra 8 — última etapa sem etapa de ganho pede a confirmação
-- ============================================================================
-- Reaproveita a função da T5.02/D-23 e acrescenta duas coisas:
--   * recusa concluir a última etapa quando o fluxo não tem etapa de ganho e o ganho ainda não
--     foi confirmado, devolvendo `precisa_confirmar_ganho = true`;
--   * grava `data_ganho` quando a etapa de ganho é concluída.
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
  v_fluxo_tem_ganho BOOLEAN;
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

  -- T5.03 — descobre se o fluxo desta oportunidade tem alguma etapa de ganho
  SELECT EXISTS (
    SELECT 1 FROM public.oportunidades_etapas
     WHERE oportunidade_id = p_oportunidade_id AND is_etapa_ganho = true
  ) INTO v_fluxo_tem_ganho;

  -- Regra 8: última etapa de fluxo SEM etapa de ganho pede a confirmação antes de fechar
  SELECT EXISTS (
    SELECT 1 FROM public.oportunidades_etapas
     WHERE oportunidade_id = p_oportunidade_id AND ordem > v_etapa.ordem
  ) INTO v_is_ultima;

  IF NOT v_is_ultima
     AND NOT v_fluxo_tem_ganho
     AND v_opp.situacao = 'Em andamento'::public.oportunidade_situacao THEN
    RAISE EXCEPTION 'Este fluxo não tem etapa de ganho. Confirme o ganho (seguradora, valor e nº da proposta) antes de concluir a última etapa.'
      USING ERRCODE = 'P0001',
            HINT = 'precisa_confirmar_ganho';
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
    SET etapa_atual_id = v_proxima.id,
        situacao = v_nova_situacao,
        -- T5.03: concluir a etapa de ganho grava a data do ganho
        data_ganho = CASE
          WHEN v_etapa_ganho_fechamento THEN COALESCE(data_ganho, CURRENT_DATE)
          ELSE data_ganho
        END,
        updated_at = NOW()
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
    -- Última etapa. Se ela É a etapa de ganho, a confirmação de ganho ainda vai acontecer:
    -- marca "Ganha — em finalização" e deixa o fechamento para `confirmar_ganho_oportunidade`.
    -- Marcar "Concluída" aqui impediria a confirmação (a função recusa oportunidade concluída).
    IF v_etapa_ganho_fechamento THEN
      UPDATE public.oportunidades
      SET situacao = 'Ganha — em finalização'::public.oportunidade_situacao,
          data_ganho = COALESCE(data_ganho, CURRENT_DATE),
          updated_at = NOW()
      WHERE id = p_oportunidade_id;

      INSERT INTO public.oportunidades_linha_tempo (
        oportunidade_id, tipo, titulo, descricao, usuario_id, metadados
      ) VALUES (
        p_oportunidade_id, 'geral', 'Ganho em finalização — aguardando confirmação',
        'Etapa de ganho concluída por ' || v_usuario_nome || '; confirme seguradora, valor e nº da proposta.',
        v_usuario_id, jsonb_build_object('situacao', 'Ganha — em finalização')
      );
    ELSE
      UPDATE public.oportunidades
      SET situacao = 'Concluída'::public.oportunidade_situacao,
          updated_at = NOW()
      WHERE id = p_oportunidade_id;

      INSERT INTO public.oportunidades_linha_tempo (
        oportunidade_id, tipo, titulo, descricao, usuario_id, metadados
      ) VALUES (
        p_oportunidade_id, 'geral', 'Fluxo finalizado — Oportunidade Concluída',
        'Todas as etapas foram concluídas com êxito.', v_usuario_id,
        jsonb_build_object('situacao', 'Concluída')
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'proxima_etapa_id', v_proxima.id,
    'era_etapa_ganho', v_etapa_ganho_fechamento,
    'era_ultima_etapa', NOT EXISTS (
      SELECT 1 FROM public.oportunidades_etapas
       WHERE oportunidade_id = p_oportunidade_id AND ordem > v_etapa.ordem
    ),
    'precisa_confirmar_ganho', false
  );
END;
$$;

COMMENT ON FUNCTION public.concluir_etapa_oportunidade(UUID, UUID) IS
  'T5.01/T5.02/T5.03: valida quem conclui e os obrigatórios; exige ganho no fim de fluxo sem etapa de ganho; grava data_ganho.';

-- ============================================================================
-- 5. Dados legados — data do ganho e da perda a partir da linha do tempo
-- ============================================================================
-- APROXIMAÇÃO DECLARADA: usa a data do primeiro registro correspondente na linha do tempo, que
-- é quando o evento foi registrado no sistema — pode diferir da data real do fechamento.
-- Idempotente: só preenche quem está com a data nula.
UPDATE public.oportunidades o
   SET data_ganho = sub.dt
  FROM (
    SELECT lt.oportunidade_id, MIN(lt.created_at::date) AS dt
      FROM public.oportunidades_linha_tempo lt
     WHERE lt.tipo = 'geral'
       AND lt.titulo ILIKE '%Ganha%'
     GROUP BY lt.oportunidade_id
  ) AS sub
 WHERE o.id = sub.oportunidade_id
   AND o.data_ganho IS NULL
   AND o.situacao IN ('Ganha', 'Ganha — em finalização', 'Concluída');

UPDATE public.oportunidades o
   SET data_perda = sub.dt
  FROM (
    SELECT lt.oportunidade_id, MIN(lt.created_at::date) AS dt
      FROM public.oportunidades_linha_tempo lt
     WHERE lt.tipo = 'geral'
       AND lt.titulo ILIKE '%Perdida%'
     GROUP BY lt.oportunidade_id
  ) AS sub
 WHERE o.id = sub.oportunidade_id
   AND o.data_perda IS NULL
   AND o.situacao = 'Perdida';
