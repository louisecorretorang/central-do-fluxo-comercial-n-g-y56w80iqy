-- Migration: T2.02 — Regras de acesso em todas as tabelas + bloqueio de exclusões
-- Data: 2026-10-26 · SPEC-1-002 · Task T2.02
--
-- Matriz da SPEC (01_projeto/regras-e-permissoes.md + SPEC-1-002):
--   Oportunidades e tudo que pende delas:
--     - Administrador: lê tudo, cria, altera tudo; NÃO exclui (só arquivar)
--     - Gestor: lê/altera as das suas equipes (+ as próprias como responsável comercial)
--     - Colaborador: lê as que é responsável comercial, as que foi/é responsável de etapa
--       e as cuja etapa atual está na fila da sua equipe + função; altera só a etapa atual
--       em que é responsável (checklist, conclusão), interações e dados básicos das suas
--     - NINGUÉM exclui
--   Clientes e contatos: todos os ativos leem e criam; alteram admin, gestor e o
--     responsável comercial do cliente; NINGUÉM exclui (arquivar: admin e gestor)
--   Catálogo e modelos de fluxo: todos os ativos leem; só admin altera; NINGUÉM exclui
--   Notificações: cada pessoa lê e marca como lidas só as suas
--   Histórico: ninguém altera nem exclui; gravado pelo próprio sistema
--   D-03 (sem resposta → proposta da consultoria): colaborador de outra equipe vê que a
--     oportunidade existe (produto, situação, responsável) sem abrir ficha nem documentos
--
-- Princípios: permissões no banco (linha vermelha 5); nenhuma exclusão definitiva (RN-06);
-- funções de movimento já são SECURITY DEFINER e continuam funcionando.
-- Reversível: cada bloco tem DROP POLICY correspondente; nada de dados é apagado.

-- ============================================================
-- 0. Função de visibilidade estendida (fila da equipe + função)
-- ============================================================
-- A versão do tronco checava só a equipe da fila; a matriz da SPEC pede
-- equipe + função (ex.: Saúde e Odonto / Pós-venda). Etapas sem função exigida
-- continuam valendo só pela equipe (comportamento já validado na T2.01).

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
  v_funcao public.user_funcao;
  v_opp RECORD;
  v_etapa_atual RECORD;
  v_pertence_equipe BOOLEAN;
BEGIN
  IF p_usuario_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT perfil, situacao, funcao INTO v_perfil, v_situacao, v_funcao
  FROM public.profiles
  WHERE id = p_usuario_id;

  IF v_situacao IS DISTINCT FROM 'ativo' THEN
    RETURN false;
  END IF;

  -- 1) Administrador vê todas as oportunidades
  IF v_perfil = 'Administrador' THEN
    RETURN true;
  END IF;

  SELECT id, equipe_id, responsavel_comercial_id, etapa_atual_id
  INTO v_opp
  FROM public.oportunidades
  WHERE id = p_oportunidade_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 2) Gestor: oportunidades das suas equipes (ou as dele como responsável comercial)
  IF v_perfil = 'Gestor' THEN
    IF v_opp.equipe_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.profile_equipes pe
        WHERE pe.profile_id = p_usuario_id AND pe.equipe_id = v_opp.equipe_id
      ) INTO v_pertence_equipe;
      IF v_pertence_equipe THEN
        RETURN true;
      END IF;
    END IF;
    IF v_opp.responsavel_comercial_id = p_usuario_id THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  -- 3) Colaborador
  -- 3.1) Responsável comercial da oportunidade
  IF v_opp.responsavel_comercial_id = p_usuario_id THEN
    RETURN true;
  END IF;

  IF v_opp.etapa_atual_id IS NOT NULL THEN
    SELECT responsavel_tipo, equipe_id, responsavel_usuario_id, funcao
    INTO v_etapa_atual
    FROM public.oportunidades_etapas
    WHERE id = v_opp.etapa_atual_id;

    IF FOUND THEN
      -- 3.2) Responsável da etapa atual
      IF v_etapa_atual.responsavel_usuario_id = p_usuario_id THEN
        RETURN true;
      END IF;

      -- 3.4) Fila da sua equipe + função (função vazia na etapa = só a equipe basta)
      IF v_etapa_atual.responsavel_tipo = 'fila_equipe' AND v_etapa_atual.equipe_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM public.profile_equipes pe
          WHERE pe.profile_id = p_usuario_id AND pe.equipe_id = v_etapa_atual.equipe_id
        ) INTO v_pertence_equipe;

        IF v_pertence_equipe THEN
          IF v_etapa_atual.funcao IS NULL OR v_etapa_atual.funcao = v_funcao THEN
            RETURN true;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 3.3) Foi responsável por alguma etapa (histórico)
  IF EXISTS (
    SELECT 1 FROM public.oportunidades_etapas oe
    WHERE oe.oportunidade_id = p_oportunidade_id
      AND oe.responsavel_usuario_id = p_usuario_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ============================================================
-- 1. Oportunidades e dependentes — visibilidade real no banco
-- ============================================================

-- Oportunidades: leitura pela função de visibilidade
DROP POLICY IF EXISTS "oportunidades_select" ON public.oportunidades;
CREATE POLICY "oportunidades_select" ON public.oportunidades
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(id, auth.uid())
  );

-- Inserção: qualquer usuário ativo cria (RN-01: sempre via abrir_oportunidade no app;
-- a política de banco mantém a porta aberta para o RPC SECURITY DEFINER e para o admin)
DROP POLICY IF EXISTS "oportunidades_insert" ON public.oportunidades;
CREATE POLICY "oportunidades_insert" ON public.oportunidades
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));

-- Atualização: admin e gestor (equipe) sempre; colaborador só nas suas (dados básicos).
-- O movimento de etapas fica nas funções SECURITY DEFINER (concluir/assumir/voltar/ganho/perda).
DROP POLICY IF EXISTS "oportunidades_update" ON public.oportunidades;
CREATE POLICY "oportunidades_update" ON public.oportunidades
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.is_admin(auth.uid())
      OR (
        -- Gestor da equipe da oportunidade
        EXISTS (
          SELECT 1 FROM public.profile_equipes pe
          WHERE pe.profile_id = auth.uid()
            AND pe.equipe_id = oportunidades.equipe_id
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.perfil = 'Gestor'
            )
        )
        -- Ou responsável comercial (colaborador/gestor: dados básicos das suas)
        OR oportunidades.responsavel_comercial_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND (
      public.is_admin(auth.uid())
      OR (
        EXISTS (
          SELECT 1 FROM public.profile_equipes pe
          WHERE pe.profile_id = auth.uid()
            AND pe.equipe_id = oportunidades.equipe_id
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.perfil = 'Gestor'
            )
        )
        OR oportunidades.responsavel_comercial_id = auth.uid()
      )
    )
  );

-- Sem política de DELETE em oportunidades: ninguém exclui (RN-06).

-- Etapas da oportunidade: leitura pela visibilidade; alteração só admin/gestor da equipe
-- (o movimento de etapas é pelas funções SECURITY DEFINER)
DROP POLICY IF EXISTS "oportunidades_etapas_select" ON public.oportunidades_etapas;
CREATE POLICY "oportunidades_etapas_select" ON public.oportunidades_etapas
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

DROP POLICY IF EXISTS "oportunidades_etapas_insert" ON public.oportunidades_etapas;
CREATE POLICY "oportunidades_etapas_insert" ON public.oportunidades_etapas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND (
      public.is_admin(auth.uid())
      OR public.pode_ver_oportunidade(oportunidade_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "oportunidades_etapas_update" ON public.oportunidades_etapas;
CREATE POLICY "oportunidades_etapas_update" ON public.oportunidades_etapas
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.oportunidades o
        WHERE o.id = oportunidades_etapas.oportunidade_id
          AND (
            -- Gestor da equipe da oportunidade
            EXISTS (
              SELECT 1 FROM public.profile_equipes pe
              WHERE pe.profile_id = auth.uid()
                AND pe.equipe_id = o.equipe_id
                AND EXISTS (
                  SELECT 1 FROM public.profiles p
                  WHERE p.id = auth.uid() AND p.perfil = 'Gestor'
                )
            )
            -- Ou responsável atual da etapa (concluir/assumir direto)
            OR oportunidades_etapas.responsavel_usuario_id = auth.uid()
          )
      )
    )
  )
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.oportunidades o
        WHERE o.id = oportunidades_etapas.oportunidade_id
          AND (
            EXISTS (
              SELECT 1 FROM public.profile_equipes pe
              WHERE pe.profile_id = auth.uid()
                AND pe.equipe_id = o.equipe_id
                AND EXISTS (
                  SELECT 1 FROM public.profiles p
                  WHERE p.id = auth.uid() AND p.perfil = 'Gestor'
                )
            )
            OR oportunidades_etapas.responsavel_usuario_id = auth.uid()
          )
      )
    )
  );

-- Sem política de DELETE em etapas: ninguém exclui.

-- Itens do checklist: leitura pela visibilidade; alteração por quem pode ver a oportunidade
-- (o bloqueio de obrigatórios fica no banco na T5.01; aqui vale a matriz de leitura/alteração)
DROP POLICY IF EXISTS "oportunidades_checklist_select" ON public.oportunidades_checklist_itens;
CREATE POLICY "oportunidades_checklist_select" ON public.oportunidades_checklist_itens
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.oportunidades_etapas oe
      WHERE oe.id = etapa_oportunidade_id
        AND public.pode_ver_oportunidade(oe.oportunidade_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "oportunidades_checklist_insert" ON public.oportunidades_checklist_itens;
CREATE POLICY "oportunidades_checklist_insert" ON public.oportunidades_checklist_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.oportunidades_etapas oe
      WHERE oe.id = etapa_oportunidade_id
        AND public.pode_ver_oportunidade(oe.oportunidade_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "oportunidades_checklist_update" ON public.oportunidades_checklist_itens;
CREATE POLICY "oportunidades_checklist_update" ON public.oportunidades_checklist_itens
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.oportunidades_etapas oe
      WHERE oe.id = etapa_oportunidade_id
        AND public.pode_ver_oportunidade(oe.oportunidade_id, auth.uid())
    )
  )
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.oportunidades_etapas oe
      WHERE oe.id = etapa_oportunidade_id
        AND public.pode_ver_oportunidade(oe.oportunidade_id, auth.uid())
    )
  );

-- Sem política de DELETE em itens: ninguém exclui.

-- Interações: leitura pela visibilidade; criação por quem vê; alteração só do autor;
-- DELETE zero (antes qualquer ativo podia apagar interação)
DROP POLICY IF EXISTS "oportunidades_interacoes_select" ON public.oportunidades_interacoes;
CREATE POLICY "oportunidades_interacoes_select" ON public.oportunidades_interacoes
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

DROP POLICY IF EXISTS "oportunidades_interacoes_insert" ON public.oportunidades_interacoes;
CREATE POLICY "oportunidades_interacoes_insert" ON public.oportunidades_interacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

DROP POLICY IF EXISTS "oportunidades_interacoes_update" ON public.oportunidades_interacoes;
CREATE POLICY "oportunidades_interacoes_update" ON public.oportunidades_interacoes
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND registrado_por = auth.uid()
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  )
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND registrado_por = auth.uid()
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

DROP POLICY IF EXISTS "oportunidades_interacoes_delete" ON public.oportunidades_interacoes;

-- Linha do tempo (histórico): leitura pela visibilidade; gravação pelo sistema
-- (funções SECURITY DEFINER); ninguém altera nem exclui
DROP POLICY IF EXISTS "oportunidades_linha_tempo_select" ON public.oportunidades_linha_tempo;
CREATE POLICY "oportunidades_linha_tempo_select" ON public.oportunidades_linha_tempo
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

DROP POLICY IF EXISTS "oportunidades_linha_tempo_insert" ON public.oportunidades_linha_tempo;
CREATE POLICY "oportunidades_linha_tempo_insert" ON public.oportunidades_linha_tempo
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

-- Sem política de UPDATE/DELETE em linha_tempo: histórico é imutável (RN-07).

-- Documentos: mantém a visibilidade; UPDATE restrito ao autor (antes quem via alterava)
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar documentos" ON public.oportunidades_documentos;
CREATE POLICY "Usuários autenticados podem atualizar documentos"
  ON public.oportunidades_documentos
  FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND enviado_por = auth.uid()
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  )
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND enviado_por = auth.uid()
    AND public.pode_ver_oportunidade(oportunidade_id, auth.uid())
  );

-- ============================================================
-- 2. Clientes e contatos — alteração restrita, exclusão zero
-- ============================================================

-- Clientes: todos os ativos leem e criam; alteram admin, gestor e o responsável comercial;
-- NINGUÉM exclui (arquivar = update de situacao, permitido a admin/gestor/responsável)
DROP POLICY IF EXISTS "clientes_select_policy" ON public.clientes;
CREATE POLICY "clientes_select_policy" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "clientes_insert_policy" ON public.clientes;
CREATE POLICY "clientes_insert_policy" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "clientes_update_policy" ON public.clientes;
CREATE POLICY "clientes_update_policy" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.is_admin(auth.uid())
      OR responsavel_comercial_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'Gestor'
      )
    )
  )
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND (
      public.is_admin(auth.uid())
      OR responsavel_comercial_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.perfil = 'Gestor'
      )
    )
  );

-- DELETE zero em clientes (antes admin podia apagar; RN-06: arquivar, nunca apagar)
DROP POLICY IF EXISTS "clientes_delete_policy" ON public.clientes;

-- Contatos: leem/criam todos os ativos; alteram quem pode alterar o cliente;
-- DELETE zero (antes qualquer ativo apagava contato)
DROP POLICY IF EXISTS "clientes_contatos_select_policy" ON public.clientes_contatos;
CREATE POLICY "clientes_contatos_select_policy" ON public.clientes_contatos
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "clientes_contatos_insert_policy" ON public.clientes_contatos;
CREATE POLICY "clientes_contatos_insert_policy" ON public.clientes_contatos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "clientes_contatos_update_policy" ON public.clientes_contatos
;
CREATE POLICY "clientes_contatos_update_policy" ON public.clientes_contatos
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = clientes_contatos.cliente_id
          AND (
            c.responsavel_comercial_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.perfil = 'Gestor'
            )
          )
      )
    )
  )
  WITH CHECK (
    public.is_active_user(auth.uid())
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = clientes_contatos.cliente_id
          AND (
            c.responsavel_comercial_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.perfil = 'Gestor'
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "clientes_contatos_delete_policy" ON public.clientes_contatos;

-- ============================================================
-- 3. Catálogo e modelos de fluxo — leitura para todos, escrita só admin, DELETE zero
-- ============================================================
-- FOR ALL virava INSERT+UPDATE+DELETE para o admin; RN-06 manda arquivar, não apagar.
-- Catálogo e fluxos não têm coluna de situação-arquivado em tudo; a exclusão fica
-- bloqueada no banco e a gestão de itens inativos é feita pelas colunas situacao.

DROP POLICY IF EXISTS "seguradoras_admin_modify" ON public.seguradoras_operadoras;
CREATE POLICY "seguradoras_admin_insert" ON public.seguradoras_operadoras
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "seguradoras_admin_update" ON public.seguradoras_operadoras
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "produtos_admin_modify" ON public.produtos;
CREATE POLICY "produtos_admin_insert" ON public.produtos
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "produtos_admin_update" ON public.produtos
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "origens_lead_admin_modify" ON public.origens_lead;
CREATE POLICY "origens_lead_admin_insert" ON public.origens_lead
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "origens_lead_admin_update" ON public.origens_lead
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "motivos_admin_modify" ON public.motivos;
CREATE POLICY "motivos_admin_insert" ON public.motivos
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "motivos_admin_update" ON public.motivos
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "fluxo_modelos_admin_modify" ON public.fluxo_modelos;
CREATE POLICY "fluxo_modelos_admin_insert" ON public.fluxo_modelos
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "fluxo_modelos_admin_update" ON public.fluxo_modelos
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "fluxo_etapas_admin_modify" ON public.fluxo_etapas;
CREATE POLICY "fluxo_etapas_admin_insert" ON public.fluxo_etapas
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "fluxo_etapas_admin_update" ON public.fluxo_etapas
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "fluxo_checklist_admin_modify" ON public.fluxo_checklist_itens;
CREATE POLICY "fluxo_checklist_admin_insert" ON public.fluxo_checklist_itens
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "fluxo_checklist_admin_update" ON public.fluxo_checklist_itens
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- 4. Notificações — mantém (cada pessoa lê e marca só as suas)
-- ============================================================
-- Políticas "notificacoes_select_own", "notificacoes_update_own" e
-- "notificacoes_insert_auth" já conformes; nada a fazer.

-- ============================================================
-- 5. Consulta de verificação (CA-1-09)
-- ============================================================
-- Retorna as tabelas do domínio que ainda têm política de DELETE ativa
-- (deve voltar VAZIA depois desta migração) e as que estão sem nenhuma política.
CREATE OR REPLACE VIEW public.verificacao_regras_de_acesso AS
SELECT
  c.relname AS tabela,
  'DELETE ativo' AS problema
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'oportunidades', 'oportunidades_etapas', 'oportunidades_checklist_itens',
    'oportunidades_interacoes', 'oportunidades_linha_tempo', 'oportunidades_documentos',
    'clientes', 'clientes_contatos', 'seguradoras_operadoras', 'produtos',
    'origens_lead', 'motivos', 'fluxo_modelos', 'fluxo_etapas', 'fluxo_checklist_itens'
  )
  AND EXISTS (
    SELECT 1 FROM pg_policy pol
    WHERE pol.polrelid = c.oid
      AND (pol.polcmd = 'd' OR (pol.polcmd = '*' AND array_position(pol.polroles, 0) IS NOT NULL))
  )
UNION ALL
SELECT
  c.relname AS tabela,
  'sem nenhuma política' AS problema
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'oportunidades', 'oportunidades_etapas', 'oportunidades_checklist_itens',
    'oportunidades_interacoes', 'oportunidades_linha_tempo', 'oportunidades_documentos',
    'clientes', 'clientes_contatos', 'seguradoras_operadoras', 'produtos',
    'origens_lead', 'motivos', 'fluxo_modelos', 'fluxo_etapas', 'fluxo_checklist_itens',
    'notificacoes', 'profiles', 'equipes', 'profile_equipes'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_policy pol WHERE pol.polrelid = c.oid
  );

-- Conceder leitura da view de verificação a administradores (uso na conferência)
GRANT SELECT ON public.verificacao_regras_de_acesso TO authenticated;

-- ============================================================
-- Reversão (resumo): DROP VIEW public.verificacao_regras_de_acesso;
-- recriar as políticas anteriores conforme as migrações originais
-- (20261016213000, 20261016220000, 20261016223000, 20261016231000,
--  20261016233000, 20261017001000, 20261017010000) e a função
-- pode_ver_oportunidade da migração 20261017001000.
-- ============================================================
