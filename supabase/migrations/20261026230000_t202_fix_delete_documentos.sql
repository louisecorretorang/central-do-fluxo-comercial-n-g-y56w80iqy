-- Migration: T2.02 (fix) — DELETE zero em oportunidades_documentos
-- Data: 2026-10-26 · SPEC-1-002 · Task T2.02
--
-- A view public.verificacao_regras_de_acesso acusou "DELETE ativo" em
-- oportunidades_documentos: a política criada na T1.02 ("Usuários autenticados podem
-- excluir documentos" — admin ou autor) ficou de fora do recorte da migração principal.
-- A checklist da SPEC manda bloquear exclusão em clientes, oportunidades e tabelas
-- dependentes; documentos é dependente. Conferido: nenhum código do app exclui documento
-- (anexar sempre adiciona). RN-06: nada é apagado de verdade.
-- Reversível: recriar a política anterior para voltar ao estado de 26/10 (manhã).

DROP POLICY IF EXISTS "Usuários autenticados podem excluir documentos" ON public.oportunidades_documentos;

-- Reversão:
-- CREATE POLICY "Usuários autenticados podem excluir documentos"
--   ON public.oportunidades_documentos
--   FOR DELETE TO authenticated
--   USING (
--     public.is_active_user(auth.uid())
--     AND (public.is_admin(auth.uid()) OR enviado_por = auth.uid())
--   );
