-- Migration: fix_handle_situacao_login_ban_types
-- Data: 2026-10-26 · Correção do tipo de ID ao atualizar auth.users e auth.refresh_tokens
--
-- Problema:
-- Em public.handle_situacao_login_ban(), auth.refresh_tokens.user_id é VARCHAR/TEXT,
-- enquanto NEW.id em public.profiles é UUID (ou VARCHAR caso em algum contexto seja recebido como string).
-- A comparação 'WHERE user_id = NEW.id' falhava com:
--   ERROR: 42883: operator does not exist: character varying = uuid
--
-- Solução:
-- 1. Converter explicitamente para UUID (v_user_uuid := NEW.id::uuid) com bloco BEGIN ... EXCEPTION
--    capturando invalid_text_representation para que formatos inválidos nunca impeçam a atualização do profile.
-- 2. Atualizar auth.users WHERE id = v_user_uuid.
-- 3. Atualizar auth.refresh_tokens WHERE user_id = v_user_uuid::text (ou v_user_id_text) para bater perfeitamente
--    com a coluna character varying sem erro de operador.

CREATE OR REPLACE FUNCTION public.handle_situacao_login_ban()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_banned_until TIMESTAMPTZ;
  v_refresh_token TEXT;
  v_user_uuid UUID;
  v_user_id_text TEXT;
BEGIN
  -- Validar e converter NEW.id com segurança
  BEGIN
    v_user_uuid := NEW.id::uuid;
    v_user_id_text := v_user_uuid::text;
  EXCEPTION
    WHEN invalid_text_representation THEN
      -- Se NEW.id não for um UUID válido, não quebra a atualização do perfil
      RETURN NEW;
    WHEN OTHERS THEN
      RETURN NEW;
  END;

  IF NEW.situacao = 'inativo' THEN
    -- Ban permanente enquanto estiver inativo (o trigger remove ao reativar).
    v_banned_until := 'infinity'::timestamptz;
    v_refresh_token := 'ban'::text;
  ELSE
    v_banned_until := NULL;
    v_refresh_token := NULL;
  END IF;

  -- 1. Ban em auth.users: bloqueia o login (GoTrue) e invalida o JWT na renovação.
  -- auth.users.id é UUID.
  BEGIN
    UPDATE auth.users
       SET banned_until = v_banned_until
     WHERE id = v_user_uuid;
  EXCEPTION
    WHEN OTHERS THEN
      -- Evitar travar update caso auth.users tenha alguma inconsistência
      NULL;
  END;

  -- 2. Revogar refresh tokens: a sessão aberta não sobrevive à renovação.
  -- auth.refresh_tokens.user_id é character varying (text).
  IF v_refresh_token IS NOT NULL THEN
    BEGIN
      UPDATE auth.refresh_tokens
         SET revoked = true
       WHERE user_id = v_user_id_text
         AND revoked = false;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;
