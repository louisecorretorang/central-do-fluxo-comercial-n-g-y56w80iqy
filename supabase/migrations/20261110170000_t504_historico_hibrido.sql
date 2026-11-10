-- Migration: T5.04 — histórico automático (D-24, opção C — híbrido)
-- Data: 2026-11-10 · SPEC-1-005 · Task T5.04 · CA-1-23
--
-- Decisão da Kimberly (D-24, registrada por Pedro em 10/11): híbrido — trigger apenas
-- onde o service não cobre, e o service continua com o que já funciona.
--
-- Furos reais fechados nesta migração (mapeamento em 10/11):
--   1. Item de checklist DESMARCADO não deixava registro nenhum (o service só grava
--      evento quando concluido = true).
--   2. Valor de item de checklist EDITADO depois de concluído não deixava registro
--      (os inputs de Informação não ficam desabilitados quando o item está concluído).
--   3. VALOR DA OPORTUNIDADE não tinha evento em nenhum caminho (o único UPDATE de
--      oportunidades no frontend é o nº Quiver, que já registra; valor só mudaria por
--      chamada direta ao banco — e é exatamente o caso que a regra 10 manda cobrir).
--
-- O que NÃO muda: as gravações existentes do service (checklist concluído, documento,
-- interação, quiver) continuam como estão, pelo INSERT direto de sempre — sem evento
-- duplicado. As funções de movimento (concluir/voltar/assumir/ganho/perda/arquivar)
-- continuam gravando por função no banco, como já fazem.
--
-- Reversão: DROP dos triggers/funções criados aqui.

-- ============================================================================
-- 1. Trigger de valor da oportunidade (furo 3)
-- ============================================================================
-- Grava quando valor_estimado muda. Ignora INSERT (a abertura já grava 'criacao')
-- e ignora quando quem grava é uma função SECURITY DEFINER de movimento (ganho grava
-- valor_fechado, não estimado; e as funções já registram seus próprios eventos).
CREATE OR REPLACE FUNCTION public.trg_t504_valor_oportunidade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Só reage a mudança real de valor (NULL tratado como 0, como a tela exibe)
  IF COALESCE(NEW.valor_estimado, 0) = COALESCE(OLD.valor_estimado, 0) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.oportunidades_linha_tempo (
    oportunidade_id, tipo, titulo, descricao, usuario_id, metadados
  ) VALUES (
    NEW.id,
    'geral',
    'Valor da oportunidade alterado',
    'De ' || to_char(COALESCE(OLD.valor_estimado, 0), 'FM9999999999990.00') ||
      ' para ' || to_char(COALESCE(NEW.valor_estimado, 0), 'FM9999999999990.00'),
    auth.uid(),
    jsonb_build_object(
      'campo', 'valor_estimado',
      'de', OLD.valor_estimado,
      'para', NEW.valor_estimado
    )
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_t504_valor_oportunidade ON public.oportunidades;
CREATE TRIGGER trg_t504_valor_estimado
  AFTER UPDATE OF valor_estimado ON public.oportunidades
  FOR EACH ROW
  WHEN (COALESCE(NEW.valor_estimado, 0) IS DISTINCT FROM COALESCE(OLD.valor_estimado, 0))
  EXECUTE FUNCTION public.trg_t504_valor_oportunidade();

-- ============================================================================
-- 2. Trigger de checklist: desmarcar e editar valor (furos 1 e 2)
-- ============================================================================
-- Grava quando: (a) item concluído é DESMARCADO; (b) o valor de um item concluído
-- muda. Itens marcados continuam com o evento do service (sem duplicidade).
CREATE OR REPLACE FUNCTION public.trg_t504_checklist_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_oportunidade_id UUID;
  v_etapa_nome TEXT;
BEGIN
  SELECT e.oportunidade_id, e.nome
    INTO v_oportunidade_id, v_etapa_nome
  FROM public.oportunidades_etapas e
  WHERE e.id = NEW.etapa_oportunidade_id;

  -- (a) Desmarcar um item concluído
  IF OLD.concluido = true AND NEW.concluido = false THEN
    INSERT INTO public.oportunidades_linha_tempo (
      oportunidade_id, tipo, titulo, descricao, usuario_id, metadados
    ) VALUES (
      v_oportunidade_id,
      'checklist_item',
      'Item de checklist desmarcado: "' || NEW.titulo || '"',
      'Item da etapa "' || v_etapa_nome || '" foi desmarcado' ||
        CASE WHEN NEW.valor IS NOT NULL AND btrim(NEW.valor) <> ''
             THEN ' (valor mantido: ' || NEW.valor || ')'
             ELSE '' END
        || '.',
      auth.uid(),
      jsonb_build_object(
        'item_id', NEW.id,
        'etapa_id', NEW.etapa_oportunidade_id,
        'acao', 'desmarcado'
      )
    );
    RETURN NULL;
  END IF;

  -- (b) Valor editado em item concluído (mantém concluído)
  IF OLD.concluido = true AND NEW.concluido = true
     AND COALESCE(NEW.valor, '') IS DISTINCT FROM COALESCE(OLD.valor, '') THEN
    INSERT INTO public.oportunidades_linha_tempo (
      oportunidade_id, tipo, titulo, descricao, usuario_id, metadados
    ) VALUES (
      v_oportunidade_id,
      'checklist_item',
      'Valor de item alterado: "' || NEW.titulo || '"',
      'Item da etapa "' || v_etapa_nome || '": valor era "' ||
        COALESCE(OLD.valor, '(vazio)') || '" e passou a "' ||
        COALESCE(NEW.valor, '(vazio)') || '".',
      auth.uid(),
      jsonb_build_object(
        'item_id', NEW.id,
        'etapa_id', NEW.etapa_oportunidade_id,
        'acao', 'valor_editado',
        'de', OLD.valor,
        'para', NEW.valor
      )
    );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_t504_checklist_historico ON public.oportunidades_checklist_itens;
CREATE TRIGGER trg_t504_checklist_historico
  AFTER UPDATE ON public.oportunidades_checklist_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_t504_checklist_historico();

-- ============================================================================
-- 3. Reversão documentada (não executada aqui)
-- ============================================================================
-- DROP TRIGGER IF EXISTS trg_t504_valor_estimado ON public.oportunidades;
-- DROP TRIGGER IF EXISTS trg_t504_checklist_historico ON public.oportunidades_checklist_itens;
-- DROP FUNCTION IF EXISTS public.trg_t504_valor_oportunidade();
-- DROP FUNCTION IF EXISTS public.trg_t504_checklist_historico();
