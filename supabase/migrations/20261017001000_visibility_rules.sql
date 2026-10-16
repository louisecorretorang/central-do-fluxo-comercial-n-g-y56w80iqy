-- Migration: Função de visibilidade de oportunidades e RLS correspondente
-- Regras:
-- - Administrador vê todas as oportunidades.
-- - Gestor vê as oportunidades de suas equipes (oportunidades.equipe_id pertencente a uma equipe do gestor).
-- - Colaborador vê:
--     1) as que são dele como responsável comercial (responsavel_comercial_id = usuario_id);
--     2) as em que ele é o responsável da etapa atual (etapa_atual.responsavel_usuario_id = usuario_id);
--     3) as em que ele foi responsável por alguma etapa no histórico (oportunidades_etapas com responsavel_usuario_id = usuario_id);
--     4) as da fila da sua equipe (etapa atual com responsavel_tipo = 'fila_equipe' e etapa_atual.equipe_id pertencente a uma equipe do colaborador).

CREATE OR REPLACE FUNCTION public.pode_ver_oportunidade(
  p_oportunidade_id UUID,
  p_usuario_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_perfil public.user_perfil;
  v_situacao public.user_situacao;
  v_opp RECORD;
  v_etapa_atual RECORD;
  v_pertence_equipe BOOLEAN;
BEGIN
  -- Se usuário for nulo, negar
  IF p_usuario_id IS NULL THEN
    RETURN false;
  END IF;

  -- Checar status e perfil do usuário
  SELECT perfil, situacao INTO v_perfil, v_situacao
  FROM public.profiles
  WHERE id = p_usuario_id;

  IF v_situacao IS DISTINCT FROM 'ativo' THEN
    RETURN false;
  END IF;

  -- 1) Administrador vê todas as oportunidades
  IF v_perfil = 'Administrador' THEN
    RETURN true;
  END IF;

  -- Buscar dados da oportunidade
  SELECT id, equipe_id, responsavel_comercial_id, etapa_atual_id
  INTO v_opp
  FROM public.oportunidades
  WHERE id = p_oportunidade_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 2) Gestor vê as oportunidades das suas equipes
  IF v_perfil = 'Gestor' THEN
    IF v_opp.equipe_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.profile_equipes pe
        WHERE pe.profile_id = p_usuario_id
          AND pe.equipe_id = v_opp.equipe_id
      ) INTO v_pertence_equipe;

      IF v_pertence_equipe THEN
        RETURN true;
      END IF;
    END IF;

    -- Caso a oportunidade seja do próprio gestor como responsável comercial
    IF v_opp.responsavel_comercial_id = p_usuario_id THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  -- 3) Colaborador (e qualquer outro perfil ativo)
  -- 3.1) É o responsável comercial da oportunidade
  IF v_opp.responsavel_comercial_id = p_usuario_id THEN
    RETURN true;
  END IF;

  -- Buscar dados da etapa atual (se existir)
  IF v_opp.etapa_atual_id IS NOT NULL THEN
    SELECT responsavel_tipo, equipe_id, responsavel_usuario_id
    INTO v_etapa_atual
    FROM public.oportunidades_etapas
    WHERE id = v_opp.etapa_atual_id;

    IF FOUND THEN
      -- 3.2) É o responsável da etapa atual
      IF v_etapa_atual.responsavel_usuario_id = p_usuario_id THEN
        RETURN true;
      END IF;

      -- 3.4) Fila da sua equipe (etapa atual com responsavel_tipo = 'fila_equipe' e equipe vinculada ao usuário)
      IF v_etapa_atual.responsavel_tipo = 'fila_equipe' AND v_etapa_atual.equipe_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.profile_equipes pe
          WHERE pe.profile_id = p_usuario_id
            AND pe.equipe_id = v_etapa_atual.equipe_id
        ) INTO v_pertence_equipe;

        IF v_pertence_equipe THEN
          RETURN true;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 3.3) Foi responsável por alguma etapa (histórico)
  IF EXISTS (
    SELECT 1
    FROM public.oportunidades_etapas oe
    WHERE oe.oportunidade_id = p_oportunidade_id
      AND oe.responsavel_usuario_id = p_usuario_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Atualizar política de leitura em public.oportunidades
DROP POLICY IF EXISTS "oportunidades_select" ON public.oportunidades;
CREATE POLICY "oportunidades_select" ON public.oportunidades
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(id, auth.uid())
  );

-- Atualizar política de leitura em public.oportunidades_etapas para respeitar a visibilidade da oportunidade mãe
DROP POLICY IF EXISTS "oportunidades_etapas_select" ON public.oportunidades_etapas;
CREATE POLICY "oportunidades_etapas_select" ON public.oportunidades_etapas
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

-- Atualizar política de leitura em public.oportunidades_checklist_itens
DROP POLICY IF EXISTS "oportunidades_checklist_select" ON public.oportunidades_checklist_itens;
CREATE POLICY "oportunidades_checklist_select" ON public.oportunidades_checklist_itens
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.oportunidades_etapas oe
      WHERE oe.id = etapa_oportunidade_id
        AND public.pode_ver_oportunidade(oe.oportunidade_id, auth.uid())
    )
  );

-- Atualizar política de leitura em public.oportunidades_interacoes
DROP POLICY IF EXISTS "oportunidades_interacoes_select" ON public.oportunidades_interacoes;
CREATE POLICY "oportunidades_interacoes_select" ON public.oportunidades_interacoes
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

-- Atualizar política de leitura em public.oportunidades_linha_tempo
DROP POLICY IF EXISTS "oportunidades_linha_tempo_select" ON public.oportunidades_linha_tempo;
CREATE POLICY "oportunidades_linha_tempo_select" ON public.oportunidades_linha_tempo
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );
