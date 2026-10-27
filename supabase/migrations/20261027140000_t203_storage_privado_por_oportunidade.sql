-- Migration: T2.03 — Pasta de documentos privada com regra por oportunidade
-- Data: 2026-10-27 · SPEC-1-002 · Task T2.03
--
-- Situação encontrada (prova RED em 06_notas/2026-10-27-t2-03-prova-red.md):
-- o bucket `oportunidades-anexos` é privado, mas as quatro políticas de storage.objects
-- só checam `is_active_user(auth.uid())`. Nenhuma olha de qual oportunidade é o arquivo.
-- Resultado: qualquer usuário ativo, sabendo o caminho, gera URL assinada de documento
-- de outra equipe. A tabela oportunidades_documentos já está protegida (T2.02); o
-- arquivo não estava.
--
-- O caminho do objeto é construído em src/services/oportunidades.ts como
--   `{oportunidade_id}/{etapa_id}/{item_id}_{timestamp}_{nome}`
-- então a oportunidade é o primeiro segmento. A função abaixo extrai esse UUID de forma
-- segura: se o caminho não começar com UUID (arquivo legado ou fora do padrão), devolve
-- NULL e a política nega — falha fechada, nunca aberta.
--
-- Decisão de escopo (Pedro, 27/10/2026 13:49): anexar basta poder ver a oportunidade;
-- não exige ser responsável da etapa.
--
-- Reversível: recriar as políticas anteriores (bloco de reversão no fim).

-- ============================================================
-- 1. Extração segura do id da oportunidade a partir do caminho
-- ============================================================
-- Extrai o UUID do primeiro segmento do caminho. Não lê tabela nenhuma: é só
-- parsing de texto, então NÃO é SECURITY DEFINER (não precisa de privilégio algum).
-- IMMUTABLE porque depende apenas do argumento; search_path fixo por higiene.
CREATE OR REPLACE FUNCTION public.oportunidade_do_caminho(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_primeiro text;
BEGIN
  IF p_name IS NULL OR p_name = '' THEN
    RETURN NULL;
  END IF;

  v_primeiro := split_part(p_name, '/', 1);

  -- Só aceita o formato canônico de UUID; qualquer outra coisa nega o acesso.
  IF v_primeiro ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN v_primeiro::uuid;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.oportunidade_do_caminho(text) TO authenticated;

-- ============================================================
-- 2. Storage — leitura e escrita pela visibilidade da oportunidade
-- ============================================================
-- Antes: USING (bucket_id = 'oportunidades-anexos' AND is_active_user(auth.uid()))

DROP POLICY IF EXISTS "anexos_select_authenticated" ON storage.objects;
CREATE POLICY "anexos_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'oportunidades-anexos'
    AND public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(public.oportunidade_do_caminho(name), auth.uid())
  );

DROP POLICY IF EXISTS "anexos_insert_authenticated" ON storage.objects;
CREATE POLICY "anexos_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'oportunidades-anexos'
    AND public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(public.oportunidade_do_caminho(name), auth.uid())
  );

-- UPDATE: mantém a regra da visibilidade (renomear/mover arquivo continua restrito).
DROP POLICY IF EXISTS "anexos_update_authenticated" ON storage.objects;
CREATE POLICY "anexos_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'oportunidades-anexos'
    AND public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(public.oportunidade_do_caminho(name), auth.uid())
  )
  WITH CHECK (
    bucket_id = 'oportunidades-anexos'
    AND public.is_active_user(auth.uid())
    AND public.pode_ver_oportunidade(public.oportunidade_do_caminho(name), auth.uid())
  );

-- DELETE zero no Storage (RN-06: não existe exclusão definitiva; o app nunca remove
-- arquivo — conferido: nenhuma chamada a .remove() no código do frontend).
DROP POLICY IF EXISTS "anexos_delete_authenticated" ON storage.objects;

-- ============================================================
-- 3. View de verificação — passa a cobrir o Storage
-- ============================================================
-- Substitui a versão da T2.02, corrigindo também a dívida registrada lá: a checagem
-- anterior só acusava DELETE quando a política era 'd' ou FOR ALL para PUBLIC, e
-- deixava passar FOR ALL TO authenticated. Agora qualquer política que conceda
-- DELETE (cmd 'd' ou 'ALL') é acusada, com a tabela e o nome.
--
-- DROP + CREATE em vez de CREATE OR REPLACE: a versão antiga herdava o tipo `name`
-- de c.relname na coluna `tabela`, e o CREATE OR REPLACE falha ao mudar o tipo de
-- uma coluna de view. A view não guarda dados e o app não a consulta (verificado:
-- nenhuma referência em src/), então recriar é seguro.
DROP VIEW IF EXISTS public.verificacao_regras_de_acesso;
CREATE VIEW public.verificacao_regras_de_acesso AS
SELECT
  c.relname::text AS tabela,
  'DELETE ativo'::text AS problema
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
      AND (pol.polcmd = 'd' OR pol.polcmd = '*')
  )
UNION ALL
SELECT
  c.relname::text AS tabela,
  'sem nenhuma política'::text AS problema
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
  )
UNION ALL
-- Storage: política de DELETE no bucket de anexos (RN-06)
SELECT
  'storage.objects (oportunidades-anexos)'::text AS tabela,
  'DELETE ativo'::text AS problema
WHERE EXISTS (
  SELECT 1 FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage' AND c.relname = 'objects'
    AND (pol.polcmd = 'd' OR pol.polcmd = '*')
    AND pg_get_expr(pol.polqual, pol.polrelid) LIKE '%oportunidades-anexos%'
)
UNION ALL
-- Storage: política de leitura do bucket que não olha a oportunidade (o furo da T2.03)
SELECT
  'storage.objects (oportunidades-anexos)'::text AS tabela,
  'leitura sem regra de oportunidade'::text AS problema
WHERE EXISTS (
  SELECT 1 FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage' AND c.relname = 'objects'
    AND pol.polcmd IN ('r', '*')
    AND coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') LIKE '%oportunidades-anexos%'
    AND coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') NOT LIKE '%pode_ver_oportunidade%'
);

GRANT SELECT ON public.verificacao_regras_de_acesso TO authenticated;

-- ============================================================
-- Reversão (estado de 27/10/2026, antes desta migração)
-- ============================================================
-- DROP VIEW IF EXISTS public.verificacao_regras_de_acesso;
-- (recriar a versão anterior: 20261026220000_t202_regras_de_acesso.sql, seção da view)
--
-- DROP POLICY IF EXISTS "anexos_select_authenticated" ON storage.objects;
-- CREATE POLICY "anexos_select_authenticated" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (bucket_id = 'oportunidades-anexos' AND public.is_active_user(auth.uid()));
-- (idem para insert e update)
--
-- CREATE POLICY "anexos_delete_authenticated" ON storage.objects
--   FOR DELETE TO authenticated
--   USING (bucket_id = 'oportunidades-anexos' AND public.is_active_user(auth.uid()));
--
-- DROP FUNCTION IF EXISTS public.oportunidade_do_caminho(text);
