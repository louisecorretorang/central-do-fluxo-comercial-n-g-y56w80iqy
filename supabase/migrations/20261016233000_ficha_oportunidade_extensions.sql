-- ============================================================================
-- Migration: Campos e tabelas para a Ficha da Oportunidade
-- - Coluna numero_quiver em oportunidades
-- - Colunas de anexo em oportunidades_checklist_itens (arquivo_nome, arquivo_url, arquivo_tamanho)
-- - Tabela oportunidades_interacoes (contatos com cliente: Ligação, WhatsApp, E-mail, Reunião, Outro)
-- - Tabela oportunidades_linha_tempo (auditoria/histórico com tipo, titulo, descricao, metadados)
-- - Bucket de storage privado 'oportunidades-anexos' com políticas RLS para usuários ativos
-- Data: 2026-10-16
-- ============================================================================

-- 1. Coluna do número da proposta/apólice no Quiver na tabela oportunidades
ALTER TABLE public.oportunidades
  ADD COLUMN IF NOT EXISTS numero_quiver TEXT;

-- 2. Colunas para anexos em itens do checklist (Documentos)
ALTER TABLE public.oportunidades_checklist_itens
  ADD COLUMN IF NOT EXISTS arquivo_nome TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_url TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_tamanho BIGINT;

-- 3. Enum para tipo de interação
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interacao_tipo') THEN
    CREATE TYPE public.interacao_tipo AS ENUM (
      'Ligação',
      'WhatsApp',
      'E-mail',
      'Reunião',
      'Outro'
    );
  END IF;
END $$;

-- 4. Tabela de Interações
CREATE TABLE IF NOT EXISTS public.oportunidades_interacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id UUID NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
  tipo public.interacao_tipo NOT NULL,
  data_contato TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resumo TEXT NOT NULL,
  registrado_por UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oportunidades_interacoes_opp ON public.oportunidades_interacoes(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_interacoes_data ON public.oportunidades_interacoes(data_contato DESC);

DROP TRIGGER IF EXISTS trigger_oportunidades_interacoes_updated_at ON public.oportunidades_interacoes;
CREATE TRIGGER trigger_oportunidades_interacoes_updated_at
  BEFORE UPDATE ON public.oportunidades_interacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Tabela de Linha do Tempo
CREATE TABLE IF NOT EXISTS public.oportunidades_linha_tempo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id UUID NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'criacao', 'etapa_concluida', 'troca_responsavel', 'documento', 'interacao', 'checklist_item', 'quiver', 'geral'
  titulo TEXT NOT NULL,
  descricao TEXT,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadados JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oportunidades_timeline_opp ON public.oportunidades_linha_tempo(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_timeline_created_at ON public.oportunidades_linha_tempo(created_at DESC);

-- 6. Habilitar RLS
ALTER TABLE public.oportunidades_interacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidades_linha_tempo ENABLE ROW LEVEL SECURITY;

-- Políticas para oportunidades_interacoes
DROP POLICY IF EXISTS "oportunidades_interacoes_select" ON public.oportunidades_interacoes;
CREATE POLICY "oportunidades_interacoes_select" ON public.oportunidades_interacoes
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "oportunidades_interacoes_insert" ON public.oportunidades_interacoes;
CREATE POLICY "oportunidades_interacoes_insert" ON public.oportunidades_interacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "oportunidades_interacoes_update" ON public.oportunidades_interacoes;
CREATE POLICY "oportunidades_interacoes_update" ON public.oportunidades_interacoes
  FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()))
  WITH CHECK (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "oportunidades_interacoes_delete" ON public.oportunidades_interacoes;
CREATE POLICY "oportunidades_interacoes_delete" ON public.oportunidades_interacoes
  FOR DELETE TO authenticated
  USING (public.is_active_user(auth.uid()));

-- Políticas para oportunidades_linha_tempo
DROP POLICY IF EXISTS "oportunidades_linha_tempo_select" ON public.oportunidades_linha_tempo;
CREATE POLICY "oportunidades_linha_tempo_select" ON public.oportunidades_linha_tempo
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));

DROP POLICY IF EXISTS "oportunidades_linha_tempo_insert" ON public.oportunidades_linha_tempo;
CREATE POLICY "oportunidades_linha_tempo_insert" ON public.oportunidades_linha_tempo
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()));

-- 7. Criar bucket de storage privado para anexos da oportunidade
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'oportunidades-anexos',
  'oportunidades-anexos',
  false,
  52428800, -- 50 MB
  NULL
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 8. Políticas de RLS para o storage (bucket oportunidades-anexos)
-- Somente usuários ativos podem baixar, enviar ou deletar arquivos
DROP POLICY IF EXISTS "anexos_select_authenticated" ON storage.objects;
CREATE POLICY "anexos_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'oportunidades-anexos'
    AND public.is_active_user(auth.uid())
  );

DROP POLICY IF EXISTS "anexos_insert_authenticated" ON storage.objects;
CREATE POLICY "anexos_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'oportunidades-anexos'
    AND public.is_active_user(auth.uid())
  );

DROP POLICY IF EXISTS "anexos_update_authenticated" ON storage.objects;
CREATE POLICY "anexos_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'oportunidades-anexos'
    AND public.is_active_user(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'oportunidades-anexos'
    AND public.is_active_user(auth.uid())
  );

DROP POLICY IF EXISTS "anexos_delete_authenticated" ON storage.objects;
CREATE POLICY "anexos_delete_authenticated" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'oportunidades-anexos'
    AND public.is_active_user(auth.uid())
  );

-- 9. Popular linha do tempo inicial para oportunidades existentes que ainda não têm registro
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id, protocolo, criado_por, created_at FROM public.oportunidades LOOP
    IF NOT EXISTS (SELECT 1 FROM public.oportunidades_linha_tempo WHERE oportunidade_id = r.id AND tipo = 'criacao') THEN
      INSERT INTO public.oportunidades_linha_tempo (
        oportunidade_id,
        tipo,
        titulo,
        descricao,
        usuario_id,
        created_at
      ) VALUES (
        r.id,
        'criacao',
        'Oportunidade aberta',
        'Protocolo ' || r.protocolo || ' registrado no fluxo comercial.',
        r.criado_por,
        r.created_at
      );
    END IF;
  END LOOP;
END $$;
