-- ============================================================================
-- T3.01 — Validação de CPF/CNPJ no banco + unicidade sobre documento normalizado
--
-- Contexto: a tela já validava os dígitos, mas o banco aceitava qualquer coisa. A
-- SPEC-1-003 exige que "o banco recuse documento inválido ou repetido, mesmo que a
-- tela falhe" (regra 3 do fluxo). Sem isso, qualquer chamada direta à API contorna a
-- validação inteira.
--
-- O que esta migração faz:
--   1. cria `public.documento_valido(text, text)`: valida CPF e CNPJ por dígito
--      verificador, incluindo o CNPJ alfanumérico (valor ASCII - 48, módulo 11);
--   2. normaliza os documentos já gravados (remove máscara, letras em maiúsculas);
--   3. recria os índices únicos sobre o documento normalizado;
--   4. adiciona CHECK na tabela, em NOT VALID, para não travar em dado legado
--      inconsistente — a lista de pendências fica na view de duplicados.
--
-- ATENÇÃO NA APLICAÇÃO: o passo 4 (CREATE UNIQUE INDEX) falha de propósito se ainda
-- houver documento repetido após a normalização. Se falhar, rode
--   SELECT * FROM public.clientes_documentos_duplicados;
-- e resolva os casos antes de reaplicar (Plano B da SPEC: decisão humana, nada é apagado).
--
-- Reversível: os índices antigos voltam no rollback; nenhum documento é apagado.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Função de validação de documento
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.documento_valido(p_documento TEXT, p_tipo TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_doc TEXT;
  v_soma INTEGER;
  v_resto INTEGER;
  v_dv1 INTEGER;
  v_dv2 INTEGER;
  v_pesos1 INTEGER[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  v_pesos2 INTEGER[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  i INTEGER;
BEGIN
  IF p_documento IS NULL OR btrim(p_documento) = '' THEN
    RETURN FALSE;
  END IF;

  IF p_tipo = 'PJ' THEN
    -- CNPJ: 14 posições, letras e números (alfanumérico desde 31/07/2026).
    v_doc := upper(regexp_replace(p_documento, '[^0-9A-Za-z]', '', 'g'));
    IF length(v_doc) <> 14 THEN
      RETURN FALSE;
    END IF;
    -- Repetição total nunca é válida (00000000000000, AAAAAAAAAAAAAA).
    -- Usa repeat() em vez de retrovisor em regex: comportamento idêntico e sem
    -- depender de quantificação de backreference no motor de regex do Postgres.
    IF v_doc = repeat(substring(v_doc FROM 1 FOR 1), 14) THEN
      RETURN FALSE;
    END IF;
    -- Os dois últimos são sempre dígitos verificadores numéricos.
    IF substring(v_doc FROM 13 FOR 2) !~ '^[0-9]{2}$' THEN
      RETURN FALSE;
    END IF;

    -- valor do caractere = ASCII - 48  (dígitos 0-9 => 0-9; A => 17, B => 18, ...)
    v_soma := 0;
    FOR i IN 1..12 LOOP
      v_soma := v_soma + (ascii(substring(v_doc FROM i FOR 1)) - 48) * v_pesos1[i];
    END LOOP;
    v_resto := v_soma % 11;
    v_dv1 := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;
    IF v_dv1 <> (substring(v_doc FROM 13 FOR 1))::INTEGER THEN
      RETURN FALSE;
    END IF;

    v_soma := 0;
    FOR i IN 1..13 LOOP
      v_soma := v_soma + (ascii(substring(v_doc FROM i FOR 1)) - 48) * v_pesos2[i];
    END LOOP;
    v_resto := v_soma % 11;
    v_dv2 := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;
    IF v_dv2 <> (substring(v_doc FROM 14 FOR 1))::INTEGER THEN
      RETURN FALSE;
    END IF;

    RETURN TRUE;

  ELSIF p_tipo = 'PF' THEN
    -- CPF: sempre 11 dígitos numéricos.
    v_doc := regexp_replace(p_documento, '[^0-9]', '', 'g');
    IF length(v_doc) <> 11 THEN
      RETURN FALSE;
    END IF;
    IF v_doc = repeat(substring(v_doc FROM 1 FOR 1), 11) THEN
      RETURN FALSE;
    END IF;

    v_soma := 0;
    FOR i IN 1..9 LOOP
      v_soma := v_soma + (substring(v_doc FROM i FOR 1))::INTEGER * (11 - i);
    END LOOP;
    v_resto := v_soma % 11;
    v_dv1 := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;
    IF v_dv1 <> (substring(v_doc FROM 10 FOR 1))::INTEGER THEN
      RETURN FALSE;
    END IF;

    v_soma := 0;
    FOR i IN 1..10 LOOP
      v_soma := v_soma + (substring(v_doc FROM i FOR 1))::INTEGER * (12 - i);
    END LOOP;
    v_resto := v_soma % 11;
    v_dv2 := CASE WHEN v_resto < 2 THEN 0 ELSE 11 - v_resto END;
    IF v_dv2 <> (substring(v_doc FROM 11 FOR 1))::INTEGER THEN
      RETURN FALSE;
    END IF;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.documento_valido(TEXT, TEXT) IS
  'T3.01 — valida CPF (PF) e CNPJ numérico ou alfanumérico (PJ) por dígito verificador.';

-- ----------------------------------------------------------------------------
-- 2. Normalizar documentos já gravados
--    (a tela já gravava sem máscara; isto cobre registros anteriores ou importados)
-- ----------------------------------------------------------------------------
UPDATE public.clientes
   SET cnpj = upper(regexp_replace(cnpj, '[^0-9A-Za-z]', '', 'g'))
 WHERE cnpj IS NOT NULL
   AND cnpj <> upper(regexp_replace(cnpj, '[^0-9A-Za-z]', '', 'g'));

UPDATE public.clientes
   SET cpf = regexp_replace(cpf, '[^0-9]', '', 'g')
 WHERE cpf IS NOT NULL
   AND cpf <> regexp_replace(cpf, '[^0-9]', '', 'g');

-- ----------------------------------------------------------------------------
-- 3. Diagnóstico de duplicados (Plano B da SPEC — nada é apagado)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.clientes_documentos_duplicados AS
SELECT
  'PJ'::TEXT AS tipo,
  cnpj      AS documento,
  count(*)  AS quantidade,
  array_agg(id ORDER BY created_at)          AS ids,
  array_agg(coalesce(razao_social, nome_fantasia, '(sem nome)') ORDER BY created_at) AS nomes
FROM public.clientes
WHERE cnpj IS NOT NULL AND cnpj <> ''
GROUP BY cnpj
HAVING count(*) > 1
UNION ALL
SELECT
  'PF'::TEXT AS tipo,
  cpf        AS documento,
  count(*)   AS quantidade,
  array_agg(id ORDER BY created_at)           AS ids,
  array_agg(coalesce(nome_completo, '(sem nome)') ORDER BY created_at) AS nomes
FROM public.clientes
WHERE cpf IS NOT NULL AND cpf <> ''
GROUP BY cpf
HAVING count(*) > 1;

COMMENT ON VIEW public.clientes_documentos_duplicados IS
  'T3.01 — documentos repetidos na base. Nada é apagado: serve para decisão humana (Plano B da SPEC-1-003).';

-- ----------------------------------------------------------------------------
-- 4. Índices únicos sobre o documento normalizado
--    Os índices antigos comparavam o texto como estava; se algum registro tivesse
--    máscara, "12.345.678/0001-90" e "12345678000190" passariam como diferentes.
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_clientes_cnpj_unique;
DROP INDEX IF EXISTS public.idx_clientes_cpf_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_cnpj_unique
  ON public.clientes (upper(regexp_replace(cnpj, '[^0-9A-Za-z]', '', 'g')))
  WHERE cnpj IS NOT NULL AND cnpj <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_cpf_unique
  ON public.clientes (regexp_replace(cpf, '[^0-9]', '', 'g'))
  WHERE cpf IS NOT NULL AND cpf <> '';

-- ----------------------------------------------------------------------------
-- 5. CHECK de validade — NOT VALID para não travar em dado legado inconsistente.
--    Vale para toda escrita nova; o legado fica visível na view de duplicados.
-- ----------------------------------------------------------------------------
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS chk_clientes_cnpj_valido;
ALTER TABLE public.clientes
  ADD CONSTRAINT chk_clientes_cnpj_valido
  CHECK (cnpj IS NULL OR cnpj = '' OR public.documento_valido(cnpj, 'PJ'))
  NOT VALID;

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS chk_clientes_cpf_valido;
ALTER TABLE public.clientes
  ADD CONSTRAINT chk_clientes_cpf_valido
  CHECK (cpf IS NULL OR cpf = '' OR public.documento_valido(cpf, 'PF'))
  NOT VALID;
