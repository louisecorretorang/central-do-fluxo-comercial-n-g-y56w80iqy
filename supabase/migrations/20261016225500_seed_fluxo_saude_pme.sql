-- Migration: Modelo de Fluxo "Saúde PME 3 a 29 vidas" com 12 etapas e checklists
-- Data/Hora: 20261016225500

DO $$
DECLARE
  v_prod_saude_id UUID;
  v_equipe_saude_id UUID;
  v_modelo_id UUID;
  v_etapa_id UUID;
BEGIN
  -- 1. Obter referências do produto e da equipe
  SELECT id INTO v_prod_saude_id 
  FROM public.produtos 
  WHERE nome = 'Saúde PME 3 a 29 vidas' 
  LIMIT 1;

  SELECT id INTO v_equipe_saude_id 
  FROM public.equipes 
  WHERE nome = 'Saúde e Odonto' 
  LIMIT 1;

  -- 2. Inserir ou atualizar o modelo de fluxo (Idempotente)
  SELECT id INTO v_modelo_id 
  FROM public.fluxo_modelos 
  WHERE nome = 'Saúde PME 3 a 29 vidas' 
  LIMIT 1;

  IF v_modelo_id IS NULL THEN
    INSERT INTO public.fluxo_modelos (
      nome, 
      produto_id, 
      seguradora_id, 
      is_generico, 
      versao, 
      situacao, 
      descricao
    ) VALUES (
      'Saúde PME 3 a 29 vidas',
      v_prod_saude_id,
      NULL,
      false,
      1,
      'ativo',
      'Fluxo padrão para contratação e implantação de Saúde PME de 3 a 29 vidas em qualquer operadora (ex.: SulAmérica, Porto Saúde, Bradesco, Amil). A etapa 10 permite continuidade sem exigir cancelamento se não houver plano anterior ou se já tiver sido cancelado. Não guarda informações médicas: apenas registra entrega de documentos.'
    )
    RETURNING id INTO v_modelo_id;
  ELSE
    UPDATE public.fluxo_modelos
    SET produto_id = v_prod_saude_id,
        seguradora_id = NULL,
        is_generico = false,
        versao = 1,
        situacao = 'ativo',
        descricao = 'Fluxo padrão para contratação e implantação de Saúde PME de 3 a 29 vidas em qualquer operadora (ex.: SulAmérica, Porto Saúde, Bradesco, Amil). A etapa 10 permite continuidade sem exigir cancelamento se não houver plano anterior ou se já tiver sido cancelado. Não guarda informações médicas: apenas registra entrega de documentos.'
    WHERE id = v_modelo_id;
  END IF;

  -- 3. Limpar etapas existentes para reconstrução estritamente idempotente
  DELETE FROM public.fluxo_etapas WHERE modelo_id = v_modelo_id;

  -- ============================================================================
  -- ETAPA 1: Lead (Trabalho interno) - Responsável comercial
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 1, 'Lead', 'Identificação da origem e indicadores do lead de saúde PME',
    'Trabalho interno', 'responsavel_comercial', NULL, NULL, NULL, false
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'Origem', 'Informação', 'texto', NULL, true),
    (v_etapa_id, 2, 'Parceiro ou indicador', 'Informação', 'texto', NULL, false);

  -- ============================================================================
  -- ETAPA 2: Qualificação (Aguardando cliente) - Responsável comercial
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 2, 'Qualificação', 'Coleta de dados da empresa, vidas, idades, localização e preferências de rede',
    'Aguardando cliente', 'responsavel_comercial', NULL, NULL, NULL, false
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'CNPJ', 'Informação', 'texto', NULL, true),
    (v_etapa_id, 2, 'Nº de titulares e dependentes', 'Informação', 'número', NULL, true),
    (v_etapa_id, 3, 'Idades dos beneficiários', 'Informação', 'texto', NULL, true),
    (v_etapa_id, 4, 'Cidade', 'Informação', 'texto', NULL, true),
    (v_etapa_id, 5, 'Plano atual e tempo de permanência', 'Informação', 'texto', NULL, true),
    (v_etapa_id, 6, 'Hospital ou rede de preferência', 'Informação', 'texto', NULL, false),
    (v_etapa_id, 7, 'Com ou sem coparticipação', 'Informação', 'opções', '["Com", "Sem", "Indiferente"]'::jsonb, false);

  -- ============================================================================
  -- ETAPA 3: Cotação multioperadora (Trabalho interno) - Responsável comercial
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 3, 'Cotação multioperadora', 'Cálculo nas diversas operadoras e anexo das cotações',
    'Trabalho interno', 'responsavel_comercial', NULL, NULL, NULL, false
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'Cotações anexadas', 'Documento', NULL, NULL, true),
    (v_etapa_id, 2, 'Operadoras cotadas', 'Informação', 'texto', NULL, true);

  -- ============================================================================
  -- ETAPA 4: Comparativo enviado (Aguardando cliente) - Responsável comercial
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 4, 'Comparativo enviado', 'Apresentação comparativa enviada ao cliente com acompanhamento de contato',
    'Aguardando cliente', 'responsavel_comercial', NULL, NULL, NULL, false
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'Comparativo enviado ao cliente', 'Confirmação', NULL, NULL, true),
    (v_etapa_id, 2, 'Data do próximo contato', 'Informação', 'data', NULL, true);

  -- ============================================================================
  -- ETAPA 5: Negociação (Aguardando cliente) - Responsável comercial
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 5, 'Negociação', 'Esclarecimento de dúvidas e definição da operadora e plano',
    'Aguardando cliente', 'responsavel_comercial', NULL, NULL, NULL, false
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'Dúvidas do cliente tratadas', 'Confirmação', NULL, NULL, false),
    (v_etapa_id, 2, 'Operadora e plano escolhidos', 'Informação', 'texto', NULL, true);

  -- ============================================================================
  -- ETAPA 6: Documentação para implantação (Aguardando cliente) - Responsável comercial
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 6, 'Documentação para implantação', 'Coleta de documentos cadastrais e societários. Não guarda informações médicas: apenas registro de entrega de documentos.',
    'Aguardando cliente', 'responsavel_comercial', NULL, NULL, NULL, false
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'Cartão CNPJ', 'Documento', NULL, NULL, true),
    (v_etapa_id, 2, 'Contrato social', 'Documento', NULL, NULL, true),
    (v_etapa_id, 3, 'Documentos dos beneficiários — CPF, RG, nome da mãe, nascimento', 'Documento', NULL, NULL, true),
    (v_etapa_id, 4, 'Comprovante de vínculo dos dependentes', 'Documento', NULL, NULL, false),
    (v_etapa_id, 5, 'Carteirinha ou comprovante do plano anterior', 'Documento', NULL, NULL, false),
    (v_etapa_id, 6, 'Carta de não adesão de sócio + RG + comprovante de outro plano', 'Documento', NULL, NULL, false);

  -- ============================================================================
  -- ETAPA 7: Digitação no portal da operadora (Trabalho interno) - Responsável comercial
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 7, 'Digitação no portal da operadora', 'Digitação e transmissão da proposta cadastral no portal da operadora selecionada',
    'Trabalho interno', 'responsavel_comercial', NULL, NULL, NULL, false
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'Proposta digitada e enviada para análise', 'Confirmação', NULL, NULL, true);

  -- ============================================================================
  -- ETAPA 8: Assinatura e críticas (Aguardando cliente) - Responsável comercial
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 8, 'Assinatura e críticas', 'Acompanhamento da assinatura digital do cliente e resolução de exigências/críticas da operadora',
    'Aguardando cliente', 'responsavel_comercial', NULL, NULL, NULL, false
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'Assinatura digital do cliente', 'Confirmação', NULL, NULL, true),
    (v_etapa_id, 2, 'Críticas da operadora resolvidas', 'Confirmação', NULL, NULL, true);

  -- ============================================================================
  -- ETAPA 9: Primeiro boleto (Aguardando cliente) - Responsável comercial
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 9, 'Primeiro boleto', 'Envio da primeira fatura/boleto para quitação inicial do contrato',
    'Aguardando cliente', 'responsavel_comercial', NULL, NULL, NULL, false
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'Boleto enviado', 'Confirmação', NULL, NULL, true),
    (v_etapa_id, 2, 'Pagamento confirmado', 'Confirmação', NULL, NULL, true);

  -- ============================================================================
  -- ETAPA 10: Cancelamento do plano anterior (Aguardando cliente) - Responsável comercial
  -- Permite continuidade sem exigir cancelamento se não houver plano anterior ou se já tiver sido cancelado.
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 10, 'Cancelamento do plano anterior', 'Permite continuidade sem exigir cancelamento quando o cliente não possuir plano anterior ativo ou quando ele já tiver sido cancelado. A orientação permanece sob responsabilidade do comercial.',
    'Aguardando cliente', 'responsavel_comercial', NULL, NULL, NULL, false
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'Cliente possui plano anterior ativo?', 'Informação', 'opções', '["Sim", "Não"]'::jsonb, true),
    (v_etapa_id, 2, 'Plano anterior já foi cancelado? (aplicável somente se houver plano anterior)', 'Informação', 'opções', '["Sim", "Não"]'::jsonb, false),
    (v_etapa_id, 3, 'Orientação ou modelo de carta de cancelamento enviado, somente após confirmação da implantação e do pagamento do novo plano (aplicável somente se o plano anterior ainda estiver ativo e não tiver sido cancelado)', 'Confirmação', NULL, NULL, false);

  -- ============================================================================
  -- ETAPA 11: Fechamento (Trabalho interno) - Responsável comercial — ETAPA DE GANHO
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 11, 'Fechamento', 'Registro no sistema de gestão Quiver e confirmação do fechamento da oportunidade',
    'Trabalho interno', 'responsavel_comercial', NULL, NULL, NULL, true
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'Registro feito no Quiver', 'Confirmação', NULL, NULL, true),
    (v_etapa_id, 2, 'Mensalidade fechada', 'Informação', 'valor', NULL, true);

  -- ============================================================================
  -- ETAPA 12: Boas-vindas e implantação (Trabalho interno) - Fila de equipe Saúde e Odonto / Pós-venda
  -- ============================================================================
  INSERT INTO public.fluxo_etapas (
    modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, equipe_id, funcao, prazo_dias, is_etapa_ganho
  ) VALUES (
    v_modelo_id, 12, 'Boas-vindas e implantação', 'Transição para o time de pós-venda da equipe Saúde e Odonto com entrega de manuais e contato do RH',
    'Trabalho interno', 'fila_equipe', v_equipe_saude_id, 'Pós-venda', NULL, false
  ) RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, opcoes, obrigatorio) VALUES
    (v_etapa_id, 1, 'Materiais de acesso enviados', 'Confirmação', NULL, NULL, true),
    (v_etapa_id, 2, 'Contato do RH registrado', 'Informação', 'texto', NULL, true);

END $$;
