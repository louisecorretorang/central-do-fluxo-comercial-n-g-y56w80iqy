-- Migration: Cadastro de Clientes e Contatos com RLS e regras de negócio
-- Timestamp gerado: 20261016213000

-- 1. Criação dos tipos enum (se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cliente_tipo') THEN
    CREATE TYPE public.cliente_tipo AS ENUM ('PJ', 'PF');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cliente_porte') THEN
    CREATE TYPE public.cliente_porte AS ENUM ('micro', 'pequena', 'média', 'grande');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cliente_situacao') THEN
    CREATE TYPE public.cliente_situacao AS ENUM ('ativo', 'arquivado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'indicado_por_tipo') THEN
    CREATE TYPE public.indicado_por_tipo AS ENUM ('cliente', 'colaborador', 'parceiro');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contato_cargo_area') THEN
    CREATE TYPE public.contato_cargo_area AS ENUM ('RH', 'Financeiro', 'Sócio', 'Administrativo', 'Outro');
  END IF;
END $$;

-- 2. Tabela de clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.cliente_tipo NOT NULL,
  
  -- Campos específicos PJ
  cnpj TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  segmento TEXT,
  porte public.cliente_porte,
  numero_vidas INTEGER,
  
  -- Campos específicos PF
  cpf TEXT,
  nome_completo TEXT,
  data_de_nascimento DATE,
  
  -- Campos comuns
  cidade TEXT,
  uf VARCHAR(2),
  origem TEXT,
  indicado_por_tipo public.indicado_por_tipo,
  indicado_por_nome TEXT,
  responsavel_comercial_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  observacoes TEXT,
  situacao public.cliente_situacao NOT NULL DEFAULT 'ativo',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint/índices únicos para CPF e CNPJ (armazenando apenas dígitos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_cnpj_unique ON public.clientes (cnpj) WHERE (cnpj IS NOT NULL AND cnpj <> '');
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_cpf_unique ON public.clientes (cpf) WHERE (cpf IS NOT NULL AND cpf <> '');

CREATE INDEX IF NOT EXISTS idx_clientes_situacao ON public.clientes (situacao);
CREATE INDEX IF NOT EXISTS idx_clientes_tipo ON public.clientes (tipo);
CREATE INDEX IF NOT EXISTS idx_clientes_responsavel ON public.clientes (responsavel_comercial_id);
CREATE INDEX IF NOT EXISTS idx_clientes_razao_social ON public.clientes (razao_social);
CREATE INDEX IF NOT EXISTS idx_clientes_nome_completo ON public.clientes (nome_completo);

-- Trigger para updated_at em clientes
DROP TRIGGER IF EXISTS trg_clientes_updated_at ON public.clientes;
CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Tabela de contatos do cliente
CREATE TABLE IF NOT EXISTS public.clientes_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cargo_area public.contato_cargo_area NOT NULL DEFAULT 'Outro',
  telefone TEXT,
  email TEXT,
  principal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_contatos_cliente_id ON public.clientes_contatos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_clientes_contatos_principal ON public.clientes_contatos (cliente_id, principal);

-- Trigger para updated_at em clientes_contatos
DROP TRIGGER IF EXISTS trg_clientes_contatos_updated_at ON public.clientes_contatos;
CREATE TRIGGER trg_clientes_contatos_updated_at
  BEFORE UPDATE ON public.clientes_contatos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger / função para garantir que apenas UM contato seja principal por cliente
CREATE OR REPLACE FUNCTION public.handle_contato_principal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.principal = TRUE THEN
    -- Desmarca os outros contatos do mesmo cliente
    UPDATE public.clientes_contatos
    SET principal = FALSE
    WHERE cliente_id = NEW.cliente_id
      AND id <> NEW.id
      AND principal = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clientes_contatos_principal ON public.clientes_contatos;
CREATE TRIGGER trg_clientes_contatos_principal
  BEFORE INSERT OR UPDATE OF principal ON public.clientes_contatos
  FOR EACH ROW
  WHEN (NEW.principal = TRUE)
  EXECUTE FUNCTION public.handle_contato_principal();

-- 4. Habilitar RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_contatos ENABLE ROW LEVEL SECURITY;

-- 5. Helper para verificar se usuário autenticado está ativo
CREATE OR REPLACE FUNCTION public.is_active_user(user_uid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_situacao public.user_situacao;
BEGIN
  SELECT situacao INTO v_situacao
  FROM public.profiles
  WHERE id = user_uid;

  RETURN (v_situacao = 'ativo');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. Políticas de RLS para CLIENTES
-- Leitura: usuários autenticados e ativos
DROP POLICY IF EXISTS "clientes_select_policy" ON public.clientes;
CREATE POLICY "clientes_select_policy" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

-- Inserção: usuários autenticados e ativos
DROP POLICY IF EXISTS "clientes_insert_policy" ON public.clientes;
CREATE POLICY "clientes_insert_policy" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));

-- Atualização: usuários autenticados e ativos (pode atualizar dados e arquivar/reativar)
DROP POLICY IF EXISTS "clientes_update_policy" ON public.clientes;
CREATE POLICY "clientes_update_policy" ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

-- Exclusão: Nenhum cliente é apagado (apenas arquivado via update), apenas admins têm bypass se necessário
DROP POLICY IF EXISTS "clientes_delete_policy" ON public.clientes;
CREATE POLICY "clientes_delete_policy" ON public.clientes
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7. Políticas de RLS para CLIENTES_CONTATOS
DROP POLICY IF EXISTS "clientes_contatos_select_policy" ON public.clientes_contatos;
CREATE POLICY "clientes_contatos_select_policy" ON public.clientes_contatos
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "clientes_contatos_insert_policy" ON public.clientes_contatos;
CREATE POLICY "clientes_contatos_insert_policy" ON public.clientes_contatos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "clientes_contatos_update_policy" ON public.clientes_contatos;
CREATE POLICY "clientes_contatos_update_policy" ON public.clientes_contatos
  FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "clientes_contatos_delete_policy" ON public.clientes_contatos;
CREATE POLICY "clientes_contatos_delete_policy" ON public.clientes_contatos
  FOR DELETE TO authenticated
  USING (public.is_active_user(auth.uid()));
