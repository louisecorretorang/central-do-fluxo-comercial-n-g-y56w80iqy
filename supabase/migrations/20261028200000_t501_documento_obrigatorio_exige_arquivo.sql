-- Migration: T5.01 — item Documento obrigatório só conta como preenchido com arquivo de verdade
-- Data: 2026-10-28 · SPEC-1-005 · Task T5.01 · CA-1-19 · Emenda de 20/10 (verificação da T1.02)
--
-- A emenda da SPEC-1-005 diz, textualmente:
--   "Item Documento obrigatório só conta como preenchido com ao menos um arquivo em
--    `oportunidades_documentos`; hoje marcar o item como concluído também libera."
--
-- Como estava: `concluir_etapa_oportunidade` decidia que um item Documento estava preenchido
-- olhando a coluna `arquivo_url` da própria linha do checklist — coluna legada, de quando o
-- anexo era único por item. Desde a criação de `oportunidades_documentos` (tabela própria,
-- vários arquivos por item), a gravação passou a acontecer lá; `arquivo_url` só é atualizada
-- "por compatibilidade". Consequências reais:
--   * item com arquivo na tabela nova mas sem `arquivo_url` (qualquer gravação fora da tela,
--     ou uma futura correção na tela) contava como VAZIO e travava a etapa;
--   * marcar `concluido = true` no item sem arquivo nenhum LIBERAVA a etapa — o furo que a
--     emenda aponta.
--
-- Correção: o critério do tipo 'Documento' passa a ser EXISTS em `oportunidades_documentos`
-- para aquele item. Antes de trocar o critério, os itens legados que têm `arquivo_url` mas
-- nenhuma linha na tabela nova recebem a linha correspondente — sem isso, quem já anexou
-- documento veria o item "sumir" e a etapa travaria.
--
-- Reversível: restaurar a versão anterior de `concluir_etapa_oportunidade`. A migração de dados
-- é aditiva (só insere linhas em `oportunidades_documentos`); nenhuma linha é apagada ou alterada.

-- ============================================================================
-- 1. Migrar os anexos legados de `arquivo_url` para `oportunidades_documentos`
-- ============================================================================
-- Idempotente: o NOT EXISTS evita duplicar a linha se a migração rodar de novo.
INSERT INTO public.oportunidades_documentos (
  oportunidade_id,
  checklist_item_id,
  arquivo_nome,
  arquivo_caminho,
  arquivo_tamanho,
  enviado_por,
  enviado_em
)
SELECT
  e.oportunidade_id,
  i.id,
  COALESCE(NULLIF(TRIM(i.arquivo_nome), ''), 'documento-anexado'),
  i.arquivo_url,
  i.arquivo_tamanho,
  i.concluido_por,
  COALESCE(i.concluido_em, i.created_at)
FROM public.oportunidades_checklist_itens i
JOIN public.oportunidades_etapas e ON e.id = i.etapa_oportunidade_id
WHERE i.tipo = 'Documento'
  AND i.arquivo_url IS NOT NULL
  AND TRIM(i.arquivo_url) <> ''
  AND NOT EXISTS (
    SELECT 1
      FROM public.oportunidades_documentos d
     WHERE d.checklist_item_id = i.id
  );

COMMENT ON TABLE public.oportunidades_documentos IS
  'Anexos por item de checklist (vários por item). T5.01: é esta tabela que define se um item Documento está preenchido.';

-- ============================================================================
-- 2. `concluir_etapa_oportunidade` — critério correto para item Documento
-- ============================================================================
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

  -- T5.01 — Validar os itens obrigatórios do checklist da etapa.
  -- Diferença em relação à versão anterior: 'Documento' exige ao menos um arquivo em
  -- oportunidades_documentos (a tabela real dos anexos), e não mais a coluna legada
  -- `arquivo_url`. Consequência pretendida: marcar o item como concluído sem arquivo
  -- NÃO libera mais a etapa (emenda de 20/10 da SPEC-1-005).
  SELECT
    COUNT(*),
    STRING_AGG(titulo, ', ' ORDER BY ordem)
  INTO v_pendentes_count, v_pendentes_titulos
  FROM public.oportunidades_checklist_itens i
  WHERE i.etapa_oportunidade_id = p_etapa_atual_id
    AND i.obrigatorio = true
    AND (
      (i.tipo = 'Confirmação' AND i.concluido = false)
      OR (i.tipo = 'Informação' AND (i.valor IS NULL OR TRIM(i.valor) = ''))
      OR (
        i.tipo = 'Documento'
        AND NOT EXISTS (
          SELECT 1
            FROM public.oportunidades_documentos d
           WHERE d.checklist_item_id = i.id
        )
      )
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

COMMENT ON FUNCTION public.concluir_etapa_oportunidade(UUID, UUID) IS
  'T5.01: conclui a etapa atual conferindo os obrigatórios. Item Documento exige arquivo em oportunidades_documentos.';

-- Reversão: reaplicar a versão de 20261016235000 (critério antigo por arquivo_url).
-- A migração de dados do passo 1 é aditiva e não precisa ser desfeita.

-- ============================================================================
-- 3. Emenda da T4.02 — origem inativa não pode ser usada na abertura
-- ============================================================================
-- A tela passou a filtrar as origens ativas (NewOpportunityModal). Aqui o banco também recusa,
-- para que a regra não dependa só da tela — mesma lógica das outras validações da função.
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
  v_criador_nome TEXT;
  v_produto_equipe_id UUID;
  v_modelo_id UUID;
  v_modelo_nome TEXT;
  v_modelo_versao INT;
  v_usou_generico BOOLEAN := false;
  v_protocolo TEXT;
  v_oportunidade_id UUID;
  v_primeira_etapa_id UUID;
  v_primeira_etapa_nome TEXT;
  v_primeira_etapa_responsavel_id UUID;
  v_etapa_orig record;
  v_item_orig record;
  v_nova_etapa_id UUID;
  v_responsavel_etapa_id UUID;
  v_situacao_etapa public.etapa_oportunidade_situacao;
  v_admin record;
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

  SELECT nome INTO v_criador_nome FROM public.profiles WHERE id = v_criador_id;

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

  -- 7. Validar origem — T4.02 (emenda 20/10): precisa existir E estar ativa.
  IF NOT EXISTS (
    SELECT 1 FROM public.origens_lead
    WHERE id = p_origem_id AND situacao = 'ativa'
  ) THEN
    RAISE EXCEPTION 'Origem de lead informada não existe ou está inativa.';
  END IF;

  -- 8. Seleção do Modelo de Fluxo na ordem de prioridade estrita:
  -- (a) modelo ativo com produto = produto escolhido E seguradora = seguradora escolhida
  IF p_seguradora_id IS NOT NULL THEN
    SELECT id, versao, nome INTO v_modelo_id, v_modelo_versao, v_modelo_nome
    FROM public.fluxo_modelos
    WHERE produto_id = p_produto_id
      AND seguradora_id = p_seguradora_id
      AND situacao = 'ativo'
    LIMIT 1;
  END IF;

  -- (b) modelo ativo do mesmo produto sem seguradora fixa
  IF v_modelo_id IS NULL THEN
    SELECT id, versao, nome INTO v_modelo_id, v_modelo_versao, v_modelo_nome
    FROM public.fluxo_modelos
    WHERE produto_id = p_produto_id
      AND seguradora_id IS NULL
      AND is_generico = false
      AND situacao = 'ativo'
    LIMIT 1;
  END IF;

  -- (c) fluxo genérico ativo
  IF v_modelo_id IS NULL THEN
    SELECT id, versao, nome INTO v_modelo_id, v_modelo_versao, v_modelo_nome
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
    IF v_etapa_orig.responsavel_tipo = 'responsavel_comercial' THEN
      v_responsavel_etapa_id := p_responsavel_comercial_id;
    ELSE
      v_responsavel_etapa_id := NULL;
    END IF;

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
      v_primeira_etapa_nome := v_etapa_orig.nome;
      v_primeira_etapa_responsavel_id := v_responsavel_etapa_id;
    END IF;

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

  -- 13. T4.01 — histórico: registrar a criação na linha do tempo da oportunidade.
  INSERT INTO public.oportunidades_linha_tempo (
    oportunidade_id,
    tipo,
    titulo,
    descricao,
    usuario_id,
    metadados
  ) VALUES (
    v_oportunidade_id,
    'criacao',
    'Oportunidade criada',
    'Aberta por ' || COALESCE(v_criador_nome, 'usuário') || ' no fluxo "' ||
      COALESCE(v_modelo_nome, 'fluxo') || '" (versão ' || COALESCE(v_modelo_versao, 1) || ').',
    v_criador_id,
    jsonb_build_object(
      'protocolo', v_protocolo,
      'fluxo_modelo_id', v_modelo_id,
      'fluxo_versao', COALESCE(v_modelo_versao, 1),
      'usou_fluxo_generico', v_usou_generico,
      'etapa_inicial', v_primeira_etapa_nome
    )
  );

  -- 14. T4.01 — notificar o responsável da etapa 1, quando não for quem criou.
  IF v_primeira_etapa_responsavel_id IS NOT NULL
     AND v_primeira_etapa_responsavel_id <> v_criador_id THEN
    INSERT INTO public.notificacoes (
      destinatario_id,
      titulo,
      mensagem,
      link,
      oportunidade_id
    ) VALUES (
      v_primeira_etapa_responsavel_id,
      'Nova oportunidade atribuída (' || v_protocolo || ')',
      'A oportunidade ' || v_protocolo || ' foi aberta por ' ||
        COALESCE(v_criador_nome, 'um colega') || ' e está com você na etapa "' ||
        COALESCE(v_primeira_etapa_nome, 'inicial') || '".',
      '/oportunidades/' || v_oportunidade_id::TEXT,
      v_oportunidade_id
    );
  END IF;

  -- 15. T4.01 / regra 2 — fluxo genérico usado: avisar os administradores.
  IF v_usou_generico THEN
    FOR v_admin IN
      SELECT p.id
        FROM public.profiles p
       WHERE p.perfil = 'Administrador'
         AND p.situacao = 'ativo'
         AND p.id <> v_criador_id
    LOOP
      INSERT INTO public.notificacoes (
        destinatario_id,
        titulo,
        mensagem,
        link,
        oportunidade_id
      ) VALUES (
        v_admin.id,
        'Produto sem fluxo próprio',
        'A oportunidade ' || v_protocolo || ' foi aberta com o fluxo genérico porque o produto ' ||
          'não tem fluxo configurado. Configure o fluxo para a próxima.',
        '/oportunidades/' || v_oportunidade_id::TEXT,
        v_oportunidade_id
      );
    END LOOP;
  END IF;

  -- 16. Retornar dados essenciais em JSON
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

COMMENT ON FUNCTION public.abrir_oportunidade(UUID, UUID, UUID, UUID, UUID, NUMERIC, DATE, TEXT) IS
  'T4.01/T4.02: abertura numa operação única; exige origem ativa; grava histórico e notifica.';
