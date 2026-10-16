-- Migration: Perfis de usuários, Equipes, Vínculo Usuário-Equipes e Regras de Segurança
-- Timestamp gerado: 20261016201500

-- 1. Criação dos tipos enum (se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_perfil') THEN
    CREATE TYPE public.user_perfil AS ENUM ('Administrador', 'Gestor', 'Colaborador');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_funcao') THEN
    CREATE TYPE public.user_funcao AS ENUM ('Comercial', 'Pós-venda', 'Gestão');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_situacao') THEN
    CREATE TYPE public.user_situacao AS ENUM ('ativo', 'inativo');
  END IF;
END $$;

-- 2. Tabela de equipes
CREATE TABLE IF NOT EXISTS public.equipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed obrigatório das duas equipes cadastradas
INSERT INTO public.equipes (nome, descricao)
VALUES 
  ('Seguros', 'Equipe comercial e operacional de Seguros em Geral'),
  ('Saúde e Odonto', 'Equipe especializada em Benefícios, Planos de Saúde e Odontológico')
ON CONFLICT (nome) DO NOTHING;

-- 3. Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  perfil public.user_perfil NOT NULL DEFAULT 'Colaborador',
  funcao public.user_funcao NOT NULL DEFAULT 'Comercial',
  situacao public.user_situacao NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela de vínculo usuário <-> equipes (N:N)
CREATE TABLE IF NOT EXISTS public.profile_equipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  equipe_id UUID NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profile_equipe_unique UNIQUE (profile_id, equipe_id)
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_perfil ON public.profiles(perfil);
CREATE INDEX IF NOT EXISTS idx_profiles_situacao ON public.profiles(situacao);
CREATE INDEX IF NOT EXISTS idx_profile_equipes_profile_id ON public.profile_equipes(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_equipes_equipe_id ON public.profile_equipes(equipe_id);

-- 5. Função helper para verificar se o usuário autenticado é Administrador (SECURITY DEFINER para não recursar)
CREATE OR REPLACE FUNCTION public.is_admin(user_uid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_perfil public.user_perfil;
  v_situacao public.user_situacao;
BEGIN
  SELECT perfil, situacao INTO v_perfil, v_situacao
  FROM public.profiles
  WHERE id = user_uid;

  RETURN (v_perfil = 'Administrador' AND v_situacao = 'ativo');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Trigger para criar perfil automaticamente quando um usuário é inserido em auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_nome TEXT;
  v_telefone TEXT;
  v_perfil public.user_perfil;
  v_funcao public.user_funcao;
  v_default_equipe UUID;
BEGIN
  -- Determinar nome a partir do raw_user_meta_data
  v_nome := COALESCE(
    NEW.raw_user_meta_data->>'nome',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  v_telefone := NEW.raw_user_meta_data->>'telefone';

  -- Se for a Louise (dona/primeiro usuário), garante perfil Administrador e função Gestão
  IF LOWER(NEW.email) = 'louise.faraguti@corretorang.com.br' THEN
    v_perfil := 'Administrador';
    v_funcao := 'Gestão';
  ELSE
    -- Se vier perfil no metadata e for válido
    BEGIN
      v_perfil := COALESCE((NEW.raw_user_meta_data->>'perfil')::public.user_perfil, 'Colaborador');
    EXCEPTION WHEN OTHERS THEN
      v_perfil := 'Colaborador';
    END;

    BEGIN
      v_funcao := COALESCE((NEW.raw_user_meta_data->>'funcao')::public.user_funcao, 'Comercial');
    EXCEPTION WHEN OTHERS THEN
      v_funcao := 'Comercial';
    END;
  END IF;

  INSERT INTO public.profiles (id, nome, email, telefone, perfil, funcao, situacao)
  VALUES (
    NEW.id,
    v_nome,
    NEW.email,
    v_telefone,
    v_perfil,
    v_funcao,
    'ativo'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    telefone = COALESCE(EXCLUDED.telefone, public.profiles.telefone);

  -- Se for Louise, vincular nas duas equipes por padrão se ainda não tiver vínculos
  IF LOWER(NEW.email) = 'louise.faraguti@corretorang.com.br' THEN
    INSERT INTO public.profile_equipes (profile_id, equipe_id)
    SELECT NEW.id, e.id
    FROM public.equipes e
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 8. Backfill / Sincronização do usuário inicial Louise Faraguti (já presente em auth.users)
DO $$
DECLARE
  v_louise_id UUID;
  v_seguros_id UUID;
  v_saude_id UUID;
BEGIN
  SELECT id INTO v_louise_id FROM auth.users WHERE email = 'louise.faraguti@corretorang.com.br' LIMIT 1;

  IF v_louise_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, nome, email, telefone, perfil, funcao, situacao)
    VALUES (
      v_louise_id,
      'Louise Faraguti',
      'louise.faraguti@corretorang.com.br',
      '(13) 99700-0000',
      'Administrador',
      'Gestão',
      'ativo'
    )
    ON CONFLICT (id) DO UPDATE
    SET
      perfil = 'Administrador',
      funcao = 'Gestão',
      situacao = 'ativo',
      nome = 'Louise Faraguti';

    SELECT id INTO v_seguros_id FROM public.equipes WHERE nome = 'Seguros';
    SELECT id INTO v_saude_id FROM public.equipes WHERE nome = 'Saúde e Odonto';

    IF v_seguros_id IS NOT NULL THEN
      INSERT INTO public.profile_equipes (profile_id, equipe_id)
      VALUES (v_louise_id, v_seguros_id)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_saude_id IS NOT NULL THEN
      INSERT INTO public.profile_equipes (profile_id, equipe_id)
      VALUES (v_louise_id, v_saude_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- 9. Habilitar RLS em todas as tabelas
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_equipes ENABLE ROW LEVEL SECURITY;

-- 10. Políticas de RLS para EQUIPES
-- Todos os autenticados podem ver equipes
DROP POLICY IF EXISTS "equipes_select_policy" ON public.equipes;
CREATE POLICY "equipes_select_policy" ON public.equipes
  FOR SELECT TO authenticated
  USING (true);

-- Apenas administradores podem inserir/atualizar equipes
DROP POLICY IF EXISTS "equipes_admin_all" ON public.equipes;
CREATE POLICY "equipes_admin_all" ON public.equipes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 11. Políticas de RLS para PROFILES
-- Leitura:
-- - Administradores podem ler todos os perfis
-- - Usuário pode ler o próprio perfil
-- - Gestores/Colaboradores podem ler perfis ativos para visualização no sistema
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin(auth.uid())
    OR situacao = 'ativo'
  );

-- Inserção: apenas administradores ou pelo trigger do sistema
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Atualização:
-- Regra de ouro:
-- 1) Administrador pode atualizar qualquer perfil.
-- 2) Usuário comum pode atualizar apenas seu próprio nome e telefone; NÃO pode alterar seu perfil, função ou situação.
-- 3) Nenhum administrador pode desativar ou alterar seu próprio perfil para não-admin se for o único admin (evitar lockout).
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR id = auth.uid()
  )
  WITH CHECK (
    -- Se for admin, pode atualizar
    public.is_admin(auth.uid())
    OR (
      -- Se for o próprio usuário (não admin), NÃO pode alterar perfil, função nem situação
      id = auth.uid()
      AND perfil = (SELECT p.perfil FROM public.profiles p WHERE p.id = auth.uid())
      AND funcao = (SELECT p.funcao FROM public.profiles p WHERE p.id = auth.uid())
      AND situacao = (SELECT p.situacao FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- Deleção: apenas Administrador (opcional, foco é desativar)
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 12. Políticas de RLS para PROFILE_EQUIPES
-- Leitura: todos os autenticados
DROP POLICY IF EXISTS "profile_equipes_select" ON public.profile_equipes;
CREATE POLICY "profile_equipes_select" ON public.profile_equipes
  FOR SELECT TO authenticated
  USING (true);

-- Modificações: apenas administradores
DROP POLICY IF EXISTS "profile_equipes_modify_admin" ON public.profile_equipes;
CREATE POLICY "profile_equipes_modify_admin" ON public.profile_equipes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
