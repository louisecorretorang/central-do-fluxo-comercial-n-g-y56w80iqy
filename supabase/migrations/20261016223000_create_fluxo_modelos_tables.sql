-- Migration: Modelos de fluxo, etapas e itens de checklist
-- Timestamp gerado: 20261016223000

-- 1. Criação dos tipos enum (se não existirem)
DO $$
BEGIN
  -- Situação do modelo de fluxo
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fluxo_situacao') THEN
    CREATE TYPE public.fluxo_situacao AS ENUM ('ativo', 'inativo');
  END IF;

  -- Tipo de etapa
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fluxo_etapa_tipo') THEN
    CREATE TYPE public.fluxo_etapa_tipo AS ENUM (
      'Trabalho interno',
      'Aguardando cliente',
      'Aguardando seguradora'
    );
  END IF;

  -- Tipo de responsável padrão da etapa
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fluxo_responsavel_tipo') THEN
    CREATE TYPE public.fluxo_responsavel_tipo AS ENUM (
      'responsavel_comercial',
      'fila_equipe'
    );
  END IF;

  -- Tipo de item de checklist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checklist_item_tipo') THEN
    CREATE TYPE public.checklist_item_tipo AS ENUM (
      'Documento',
      'Informação',
      'Confirmação'
    );
  END IF;

  -- Formato do campo quando for Informação
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checklist_campo_formato') THEN
    CREATE TYPE public.checklist_campo_formato AS ENUM (
      'texto',
      'número',
      'valor',
      'data',
      'sim_nao',
      'opções'
    );
  END IF;
END $$;

-- 2. Tabela de Modelos de Fluxo
CREATE TABLE IF NOT EXISTS public.fluxo_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  seguradora_id UUID REFERENCES public.seguradoras_operadoras(id) ON DELETE SET NULL,
  is_generico BOOLEAN NOT NULL DEFAULT false,
  versao INTEGER NOT NULL DEFAULT 1,
  situacao public.fluxo_situacao NOT NULL DEFAULT 'ativo',
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fluxo_modelos_produto ON public.fluxo_modelos (produto_id);
CREATE INDEX IF NOT EXISTS idx_fluxo_modelos_seguradora ON public.fluxo_modelos (seguradora_id);
CREATE INDEX IF NOT EXISTS idx_fluxo_modelos_situacao ON public.fluxo_modelos (situacao);
CREATE INDEX IF NOT EXISTS idx_fluxo_modelos_generico ON public.fluxo_modelos (is_generico);

DROP TRIGGER IF EXISTS trg_fluxo_modelos_updated_at ON public.fluxo_modelos;
CREATE TRIGGER trg_fluxo_modelos_updated_at
  BEFORE UPDATE ON public.fluxo_modelos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Tabela de Etapas do Fluxo
CREATE TABLE IF NOT EXISTS public.fluxo_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id UUID NOT NULL REFERENCES public.fluxo_modelos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo public.fluxo_etapa_tipo NOT NULL,
  responsavel_tipo public.fluxo_responsavel_tipo NOT NULL DEFAULT 'responsavel_comercial',
  equipe_id UUID REFERENCES public.equipes(id) ON DELETE SET NULL,
  funcao public.user_funcao,
  prazo_dias INTEGER,
  is_etapa_ganho BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fluxo_etapas_ordem UNIQUE (modelo_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_fluxo_etapas_modelo ON public.fluxo_etapas (modelo_id, ordem);
CREATE INDEX IF NOT EXISTS idx_fluxo_etapas_equipe ON public.fluxo_etapas (equipe_id);

DROP TRIGGER IF EXISTS trg_fluxo_etapas_updated_at ON public.fluxo_etapas;
CREATE TRIGGER trg_fluxo_etapas_updated_at
  BEFORE UPDATE ON public.fluxo_etapas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Tabela de Itens de Checklist da Etapa
CREATE TABLE IF NOT EXISTS public.fluxo_checklist_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id UUID NOT NULL REFERENCES public.fluxo_etapas(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  tipo public.checklist_item_tipo NOT NULL,
  formato public.checklist_campo_formato,
  opcoes JSONB,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fluxo_checklist_ordem UNIQUE (etapa_id, ordem)
);

CREATE INDEX IF NOT EXISTS idx_fluxo_checklist_etapa ON public.fluxo_checklist_itens (etapa_id, ordem);

DROP TRIGGER IF EXISTS trg_fluxo_checklist_updated_at ON public.fluxo_checklist_itens;
CREATE TRIGGER trg_fluxo_checklist_updated_at
  BEFORE UPDATE ON public.fluxo_checklist_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Habilitar RLS em todas as tabelas
ALTER TABLE public.fluxo_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluxo_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluxo_checklist_itens ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de RLS
-- Leitura para qualquer usuário ativo
DROP POLICY IF EXISTS "fluxo_modelos_select_policy" ON public.fluxo_modelos;
CREATE POLICY "fluxo_modelos_select_policy" ON public.fluxo_modelos
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "fluxo_etapas_select_policy" ON public.fluxo_etapas;
CREATE POLICY "fluxo_etapas_select_policy" ON public.fluxo_etapas
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "fluxo_checklist_select_policy" ON public.fluxo_checklist_itens;
CREATE POLICY "fluxo_checklist_select_policy" ON public.fluxo_checklist_itens
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

-- Escrita restrita a Administrador
DROP POLICY IF EXISTS "fluxo_modelos_admin_modify" ON public.fluxo_modelos;
CREATE POLICY "fluxo_modelos_admin_modify" ON public.fluxo_modelos
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "fluxo_etapas_admin_modify" ON public.fluxo_etapas;
CREATE POLICY "fluxo_etapas_admin_modify" ON public.fluxo_etapas
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "fluxo_checklist_admin_modify" ON public.fluxo_checklist_itens;
CREATE POLICY "fluxo_checklist_admin_modify" ON public.fluxo_checklist_itens
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 7. Seeds Idempotentes dos 2 modelos pedidos
DO $$
DECLARE
  v_prod_emp_id UUID;
  v_seg_porto_id UUID;
  v_modelo_generico_id UUID;
  v_modelo_emp_id UUID;
  v_etapa_id UUID;
BEGIN
  -- Obter referências de Seguro Empresarial e Porto Seguro
  SELECT id INTO v_prod_emp_id FROM public.produtos WHERE nome = 'Seguro Empresarial' LIMIT 1;
  SELECT id INTO v_seg_porto_id FROM public.seguradoras_operadoras WHERE nome = 'Porto Seguro' LIMIT 1;

  -- ============================================================================
  -- MODELO A: FLUXO GENÉRICO
  -- ============================================================================
  SELECT id INTO v_modelo_generico_id FROM public.fluxo_modelos WHERE nome = 'Fluxo Genérico' LIMIT 1;

  IF v_modelo_generico_id IS NULL THEN
    INSERT INTO public.fluxo_modelos (nome, produto_id, seguradora_id, is_generico, versao, situacao, descricao)
    VALUES (
      'Fluxo Genérico',
      NULL,
      NULL,
      true,
      1,
      'ativo',
      'Vale para qualquer produto que não tenha fluxo próprio.'
    )
    RETURNING id INTO v_modelo_generico_id;
  ELSE
    UPDATE public.fluxo_modelos
    SET is_generico = true,
        versao = 1,
        situacao = 'ativo',
        descricao = 'Vale para qualquer produto que não tenha fluxo próprio.'
    WHERE id = v_modelo_generico_id;
  END IF;

  -- Limpar etapas existentes do modelo para garantir idempotência completa com a estrutura pedida
  DELETE FROM public.fluxo_etapas WHERE modelo_id = v_modelo_generico_id;

  -- Etapa 1: Lead
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_generico_id, 1, 'Lead', 'Identificação e registro inicial do lead', 'Trabalho interno', 'responsavel_comercial', NULL, false)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio)
  VALUES (v_etapa_id, 1, 'Origem do contato', 'Informação', 'texto', true);

  -- Etapa 2: Qualificação
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_generico_id, 2, 'Qualificação', 'Entendimento das necessidades e perfil do cliente', 'Aguardando cliente', 'responsavel_comercial', NULL, false)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio)
  VALUES (v_etapa_id, 1, 'Necessidade do cliente', 'Informação', 'texto', true);

  -- Etapa 3: Cotação
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_generico_id, 3, 'Cotação', 'Cálculo e formatação da cotação com as seguradoras', 'Trabalho interno', 'responsavel_comercial', NULL, false)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio)
  VALUES (v_etapa_id, 1, 'Cotação anexada', 'Documento', NULL, true);

  -- Etapa 4: Proposta enviada
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_generico_id, 4, 'Proposta enviada', 'Envio da proposta formatada para apreciação do cliente', 'Aguardando cliente', 'responsavel_comercial', NULL, false)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio)
  VALUES (v_etapa_id, 1, 'Proposta enviada ao cliente', 'Confirmação', NULL, true);

  -- Etapa 5: Negociação e fechamento (ETAPA DE GANHO)
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_generico_id, 5, 'Negociação e fechamento', 'Alinhamento final e aprovação do fechamento', 'Aguardando cliente', 'responsavel_comercial', NULL, true)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio)
  VALUES (v_etapa_id, 1, 'Cliente aprovou', 'Confirmação', NULL, true);


  -- ============================================================================
  -- MODELO B: SEGURO EMPRESARIAL — PORTO SEGURO
  -- ============================================================================
  SELECT id INTO v_modelo_emp_id FROM public.fluxo_modelos WHERE nome = 'Seguro Empresarial — Porto Seguro' LIMIT 1;

  IF v_modelo_emp_id IS NULL THEN
    INSERT INTO public.fluxo_modelos (nome, produto_id, seguradora_id, is_generico, versao, situacao, descricao)
    VALUES (
      'Seguro Empresarial — Porto Seguro',
      v_prod_emp_id,
      v_seg_porto_id,
      false,
      1,
      'ativo',
      'Fluxo específico para Seguro Empresarial na Porto Seguro.'
    )
    RETURNING id INTO v_modelo_emp_id;
  ELSE
    UPDATE public.fluxo_modelos
    SET produto_id = v_prod_emp_id,
        seguradora_id = v_seg_porto_id,
        is_generico = false,
        versao = 1,
        situacao = 'ativo',
        descricao = 'Fluxo específico para Seguro Empresarial na Porto Seguro.'
    WHERE id = v_modelo_emp_id;
  END IF;

  -- Limpar etapas existentes para reconstrução idempotente
  DELETE FROM public.fluxo_etapas WHERE modelo_id = v_modelo_emp_id;

  -- Etapa 1: Coleta de dados do risco (Aguardando cliente)
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_emp_id, 1, 'Coleta de dados do risco', 'Levantamento cadastral do local e das coberturas necessárias', 'Aguardando cliente', 'responsavel_comercial', NULL, false)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio) VALUES
    (v_etapa_id, 1, 'Tipo de pessoa e CPF/CNPJ', 'Informação', 'texto', true),
    (v_etapa_id, 2, 'Motivo, ex. profissional liberal ou locatário', 'Informação', 'texto', true),
    (v_etapa_id, 3, 'Endereço do risco', 'Informação', 'texto', true),
    (v_etapa_id, 4, 'Atividade exercida no local', 'Informação', 'texto', true),
    (v_etapa_id, 5, 'Valores desejados por cobertura — incêndio, danos elétricos, vidros, aluguel, RC, RC empregador, danos morais', 'Informação', 'texto', true),
    (v_etapa_id, 6, 'Imóvel alugado?', 'Informação', 'sim_nao', true),
    (v_etapa_id, 7, 'Aluguel mensal', 'Informação', 'valor', false),
    (v_etapa_id, 8, 'Dados do proprietário para cláusula beneficiária', 'Informação', 'texto', false),
    (v_etapa_id, 9, 'Sinistros nos últimos 12 meses', 'Informação', 'sim_nao', true);

  -- Etapa 2: Cotação (Trabalho interno)
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_emp_id, 2, 'Cotação', 'Cálculo no portal Porto Seguro e conferência técnica das coberturas', 'Trabalho interno', 'responsavel_comercial', NULL, false)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio) VALUES
    (v_etapa_id, 1, 'PDF da cotação', 'Documento', NULL, true),
    (v_etapa_id, 2, 'Conferido: Danos Morais não passa de 100% da RC', 'Confirmação', NULL, true),
    (v_etapa_id, 3, 'Indenização a valor de novo definida', 'Confirmação', NULL, false),
    (v_etapa_id, 4, 'Franquias revisadas', 'Confirmação', NULL, false);

  -- Etapa 3: Cotação enviada (Aguardando cliente)
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_emp_id, 3, 'Cotação enviada', 'Apresentação formal da cotação com acompanhamento da validade', 'Aguardando cliente', 'responsavel_comercial', NULL, false)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio) VALUES
    (v_etapa_id, 1, 'Cotação enviada ao cliente', 'Confirmação', NULL, true),
    (v_etapa_id, 2, 'Validade da cotação', 'Informação', 'data', true),
    (v_etapa_id, 3, 'Cliente aprovou a cotação', 'Confirmação', NULL, true);

  -- Etapa 4: Elaborar proposta (Trabalho interno)
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_emp_id, 4, 'Elaborar proposta', 'Coleta dos dados finais e transmissão da proposta na seguradora', 'Trabalho interno', 'responsavel_comercial', NULL, false)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio) VALUES
    (v_etapa_id, 1, 'E-mail, estado civil, profissão, PPE e endereço de cobrança', 'Informação', 'texto', true),
    (v_etapa_id, 2, 'Proposta finalizada na seguradora', 'Confirmação', NULL, true);

  -- Etapa 5: Registro no Quiver — pendente (Trabalho interno) — ETAPA DE GANHO
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_emp_id, 5, 'Registro no Quiver — pendente', 'Lançamento da proposta comercial no sistema de gestão Quiver', 'Trabalho interno', 'responsavel_comercial', NULL, true)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio) VALUES
    (v_etapa_id, 1, 'Nº da proposta da companhia', 'Informação', 'texto', true),
    (v_etapa_id, 2, 'Prêmio, parcelas e comissão', 'Informação', 'texto', true);

  -- Etapa 6: Aguardando apólice (Aguardando seguradora, prazo 1 dia)
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_emp_id, 6, 'Aguardando apólice', 'Acompanhamento da emissão da apólice junto à Porto Seguro', 'Aguardando seguradora', 'responsavel_comercial', 1, false)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio) VALUES
    (v_etapa_id, 1, 'Apólice recebida da seguradora', 'Confirmação', NULL, true);

  -- Etapa 7: Apólice emitida (Trabalho interno)
  INSERT INTO public.fluxo_etapas (modelo_id, ordem, nome, descricao, tipo, responsavel_tipo, prazo_dias, is_etapa_ganho)
  VALUES (v_modelo_emp_id, 7, 'Apólice emitida', 'Atualização cadastral no Quiver e envio dos documentos ao cliente', 'Trabalho interno', 'responsavel_comercial', NULL, false)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.fluxo_checklist_itens (etapa_id, ordem, titulo, tipo, formato, obrigatorio) VALUES
    (v_etapa_id, 1, 'Nº e data de emissão lançados no Quiver', 'Confirmação', NULL, true),
    (v_etapa_id, 2, 'Apólice', 'Documento', NULL, true),
    (v_etapa_id, 3, 'Boleto', 'Documento', NULL, false),
    (v_etapa_id, 4, 'Apólice e boleto enviados ao cliente', 'Confirmação', NULL, true);

END $$;
