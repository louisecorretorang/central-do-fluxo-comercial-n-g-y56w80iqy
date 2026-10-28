-- Migration: T4.01 — abertura de oportunidade grava histórico e notifica a etapa 1
-- Data: 2026-10-28 · SPEC-1-004 · Task T4.01 · regra 1 (itens f) e regra 2
--
-- O que faltava em `abrir_oportunidade`:
--   * **histórico** (regra 1f): nada era gravado na linha do tempo ao criar a oportunidade, então
--     a ficha nascia sem registro de origem. A tabela `oportunidades_linha_tempo` já existia
--     (criada em 20261016233000) e já tem o tipo 'criacao' previsto no comentário da coluna `tipo`;
--     as outras funções (concluir etapa, ganho, perda) já escrevem nela. Faltava só esta.
--   * **notificação** (regra 1f): o responsável da etapa 1 não era avisado quando outra pessoa
--     abria a oportunidade. A tabela `notificacoes` já existe e é usada por `concluir_etapa_oportunidade`.
--
-- Por que reaproveitar `oportunidades_linha_tempo` em vez de criar `oportunidades_historico`:
-- criar uma segunda tabela de eventos faria a ficha do cliente ter duas fontes de verdade para o
-- mesmo fato, e a T5.04 (histórico automático, linha do tempo) teria que unir as duas. A decisão
-- (opção A, autorizada por Pedro em 28/10 17:17) é usar a tabela que já existe.
--
-- Reversível: basta restaurar a versão anterior de `abrir_oportunidade` (CREATE OR REPLACE é
-- idempotente); nenhuma tabela, coluna ou política é criada ou alterada aqui.

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

  -- 7. Validar origem
  IF NOT EXISTS (SELECT 1 FROM public.origens_lead WHERE id = p_origem_id) THEN
    RAISE EXCEPTION 'Origem de lead informada não existe.';
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
      -- Guardar o responsável da etapa 1 numa variável própria: `v_responsavel_etapa_id`
      -- é reaproveitada a cada volta do laço e, ao final, guarda a última etapa (que pode
      -- ser de fila, com NULL). Usar aquela variável aqui fazia a notificação nunca sair —
      -- bug pego pelo teste da T4.01 antes de publicar.
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
  -- Reaproveita a tabela que as outras funções de movimento já usam (ver nota no topo).
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
  -- (Regra 1f: "notifica o responsável da etapa 1, se não for quem criou".)
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
  -- A ficha já mostra o aviso; falta o lado do administrador, que é o que a SPEC pede.
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
  'T4.01: abre a oportunidade numa operação única — modelo, protocolo, snapshot de etapas/itens, histórico e notificações.';

-- Reversão: reaplicar a versão anterior desta função (a de 20261016231000), que não grava
-- histórico nem notifica. Nenhum objeto é criado ou removido por esta migração.
