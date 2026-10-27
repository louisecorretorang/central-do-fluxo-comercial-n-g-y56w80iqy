-- Migration: T2.02 (fix) — arquivar cliente restrito a Administrador e Gestor
-- Data: 2026-10-27 · SPEC-1-002 · Task T2.02
--
-- A matriz de `01_projeto/regras-e-permissoes.md` diz: "Arquivar cliente: administradores e
-- gestores". A política de UPDATE em clientes (migração 20261026220000) permite que o
-- responsável comercial — que pode ser Colaborador — altere a linha para editar dados.
-- Isso abria a porta para arquivar sem ser admin/gestor.
--
-- Correção no banco: trigger que recusa mudança de `situacao` quando quem chama não é
-- Administrador nem Gestor. Edição de dados cadastrais continua liberada ao responsável.
-- Reversível: DROP TRIGGER + DROP FUNCTION.

CREATE OR REPLACE FUNCTION public.protege_situacao_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_perfil public.user_perfil;
BEGIN
  -- Sem mudança de situação, não bloqueia nada.
  IF NEW.situacao IS NOT DISTINCT FROM OLD.situacao THEN
    RETURN NEW;
  END IF;

  -- service_role / chamadas sem usuário (migrações, rotinas) passam.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT perfil INTO v_perfil FROM public.profiles WHERE id = auth.uid();

  IF v_perfil NOT IN ('Administrador', 'Gestor') THEN
    RAISE EXCEPTION 'Apenas administradores e gestores podem arquivar ou reativar clientes.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protege_situacao_cliente ON public.clientes;
CREATE TRIGGER trg_protege_situacao_cliente
  BEFORE UPDATE OF situacao ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.protege_situacao_cliente();

-- Reversão:
-- DROP TRIGGER IF EXISTS trg_protege_situacao_cliente ON public.clientes;
-- DROP FUNCTION IF EXISTS public.protege_situacao_cliente();
