-- Migration: T2.01 — Bloqueio server-side do usuário inativo (CA-1-08)
-- Data: 2026-10-20 · SPEC-1-002 · Task T2.01
--
-- Antes: desativar um usuário só gravava profiles.situacao = 'inativo'.
-- O auth.users não mudava: o usuário continuava autenticando e com JWT válido.
-- O bloqueio existia apenas no frontend (signIn + ProtectedRoute).
--
-- Depois: qualquer gravação de situacao = 'inativo' em public.profiles
-- (edge function admin-users, fallback do frontend ou SQL direto) também:
--   1. grava banned_until em auth.users (login recusado pelo GoTrue);
--   2. revoga os refresh tokens (a sessão aberta não renova).
-- Ao voltar para 'ativo', o ban é removido.
-- Reversível: DROP TRIGGER + DROP FUNCTION no fim do arquivo.

CREATE OR REPLACE FUNCTION public.handle_situacao_login_ban()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_banned_until TIMESTAMPTZ;
  v_refresh_token TEXT;
BEGIN
  IF NEW.situacao = 'inativo' THEN
    -- Ban permanente enquanto estiver inativo (o trigger remove ao reativar).
    v_banned_until := 'infinity'::timestamptz;
    v_refresh_token := 'ban'::text;
  ELSE
    v_banned_until := NULL;
    v_refresh_token := NULL;
  END IF;

  -- 1. Ban em auth.users: bloqueia o login (GoTrue) e invalida o JWT na renovação.
  UPDATE auth.users
     SET banned_until = v_banned_until
   WHERE id = NEW.id;

  -- 2. Revogar refresh tokens: a sessão aberta não sobrevive à renovação.
  IF v_refresh_token IS NOT NULL THEN
    UPDATE auth.refresh_tokens
       SET revoked = true
     WHERE user_id = NEW.id
       AND revoked = false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_situacao_login_ban ON public.profiles;
CREATE TRIGGER trg_profiles_situacao_login_ban
  AFTER UPDATE OF situacao ON public.profiles
  FOR EACH ROW
  WHEN (OLD.situacao IS DISTINCT FROM NEW.situacao)
  EXECUTE FUNCTION public.handle_situacao_login_ban();

-- Reversão:
-- DROP TRIGGER IF EXISTS trg_profiles_situacao_login_ban ON public.profiles;
-- DROP FUNCTION IF EXISTS public.handle_situacao_login_ban();
