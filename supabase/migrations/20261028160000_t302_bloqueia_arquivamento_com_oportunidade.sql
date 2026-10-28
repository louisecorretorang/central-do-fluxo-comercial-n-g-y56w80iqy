-- Migration: T3.02 — cliente com oportunidade em andamento não pode ser arquivado
-- Data: 2026-10-28 · SPEC-1-003 · Task T3.02 · critério CA-1-13
--
-- A SPEC-1-003 (fluxo, regra 6) diz: "Cliente com oportunidade em andamento **não** pode ser
-- arquivado (mensagem explicando o motivo)". Até aqui nada impedia isso:
--   * `toggleClienteSituacao` faz um UPDATE direto, sem consultar `oportunidades`;
--   * o trigger `trg_protege_situacao_cliente` (T2.02) checa apenas QUEM arquiva
--     (Administrador/Gestor), e não o QUE está sendo arquivado.
-- Resultado: um gestor arquivava um cliente com negociações em andamento e o trabalho comercial
-- ficava órfão de cadastro — a oportunidade continua "Em andamento" apontando para um cliente
-- arquivado, que some da lista padrão e da escolha de cliente.
--
-- Correção no banco (última linha de defesa, vale mesmo que a tela falhe):
--   * `cliente_tem_oportunidade_em_andamento(uuid)` — função de consulta reutilizável pela tela;
--   * `bloqueia_arquivamento_com_oportunidade_ativa()` + trigger BEFORE UPDATE em `clientes`:
--     recusa a transição ativo → arquivado quando existe oportunidade com situação 'Em andamento'.
--
-- Compatível com o que já existe: não altera políticas de RLS, não mexe em `protege_situacao_cliente`
-- (os dois triggers convivem; este é BEFORE UPDATE e só olha a transição para 'arquivado'), e
-- chamadas sem usuário (migrações, rotinas, service_role) continuam passando, como no trigger da T2.02.
-- Reversível: DROP TRIGGER + DROP FUNCTION (as duas funções).

-- ============================================================================
-- 1. Consulta reutilizável: o cliente tem oportunidade em andamento?
-- ============================================================================
-- SECURITY DEFINER para que a tela consiga consultar mesmo com RLS, sem precisar enxergar a
-- linha da oportunidade. Retorna apenas SIM/NÃO e a contagem não é exposta — dado de negócio
-- de outra equipe não vaza por aqui.
CREATE OR REPLACE FUNCTION public.cliente_tem_oportunidade_em_andamento(p_cliente_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.oportunidades o
     WHERE o.cliente_id = p_cliente_id
       AND o.situacao = 'Em andamento'
  );
$$;

COMMENT ON FUNCTION public.cliente_tem_oportunidade_em_andamento(UUID) IS
  'T3.02/CA-1-13: verdadeiro quando o cliente tem ao menos uma oportunidade em andamento.';

GRANT EXECUTE ON FUNCTION public.cliente_tem_oportunidade_em_andamento(UUID) TO authenticated;

-- ============================================================================
-- 2. Trigger: recusa arquivar cliente com oportunidade em andamento
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bloqueia_arquivamento_com_oportunidade_ativa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_qtd INTEGER;
BEGIN
  -- Só interessa a transição para 'arquivado'. Reativar e editar dados passam direto.
  IF NEW.situacao <> 'arquivado' OR OLD.situacao = 'arquivado' THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
    INTO v_qtd
    FROM public.oportunidades o
   WHERE o.cliente_id = NEW.id
     AND o.situacao = 'Em andamento';

  IF v_qtd > 0 THEN
    -- A tela traduz o código para uma mensagem amigável; o texto abaixo é o fallback
    -- para quem chamar o banco direto (SQL editor, integração futura).
    RAISE EXCEPTION
      'CLIENTE_COM_OPORTUNIDADE_EM_ANDAMENTO: este cliente tem % oportunidade(s) em andamento e não pode ser arquivado.',
      v_qtd
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bloqueia_arquivamento_com_oportunidade_ativa() IS
  'T3.02/CA-1-13: bloqueia ativo -> arquivado quando há oportunidade Em andamento.';

DROP TRIGGER IF EXISTS trg_bloqueia_arquivamento_com_oportunidade ON public.clientes;
CREATE TRIGGER trg_bloqueia_arquivamento_com_oportunidade
  BEFORE UPDATE OF situacao ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.bloqueia_arquivamento_com_oportunidade_ativa();

-- ============================================================================
-- 3. Consulta de diagnóstico — casos legados que já violam a regra
-- ============================================================================
-- A regra vale a partir de agora; o que já está gravado não é reescrito. Esta view lista os
-- clientes arquivados que ainda têm oportunidade em andamento, para decisão humana (mesmo
-- espírito do Plano B da T3.01: listar, nunca apagar por conta própria).
CREATE OR REPLACE VIEW public.clientes_arquivados_com_oportunidade_ativa AS
  SELECT c.id                AS cliente_id,
         c.razao_social,
         c.nome_completo,
         c.cnpj,
         c.cpf,
         count(o.id)         AS oportunidades_em_andamento
    FROM public.clientes c
    JOIN public.oportunidades o
      ON o.cliente_id = c.id
     AND o.situacao = 'Em andamento'
   WHERE c.situacao = 'arquivado'
   GROUP BY c.id, c.razao_social, c.nome_completo, c.cnpj, c.cpf;

COMMENT ON VIEW public.clientes_arquivados_com_oportunidade_ativa IS
  'T3.02/CA-1-13: legado — clientes já arquivados que mantêm oportunidade em andamento. Não corrige nada; serve para a N&G decidir caso a caso.';

-- ============================================================================
-- Reversão
-- ============================================================================
-- DROP VIEW IF EXISTS public.clientes_arquivados_com_oportunidade_ativa;
-- DROP TRIGGER IF EXISTS trg_bloqueia_arquivamento_com_oportunidade ON public.clientes;
-- DROP FUNCTION IF EXISTS public.bloqueia_arquivamento_com_oportunidade_ativa();
-- DROP FUNCTION IF EXISTS public.cliente_tem_oportunidade_em_andamento(UUID);
