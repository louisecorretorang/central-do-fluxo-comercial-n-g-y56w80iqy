import { supabase } from '@/lib/supabase/client'
import {
  SeguradoraOperadora,
  ProdutoCatalogo,
  OrigemLead,
  MotivoCatalogo,
  CatalogoData,
} from '@/types/catalogo'

// Helper para queries em tabelas de catálogo sem acoplamento estrito aos tipos estáticos antigos de Database
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Busca todas as Seguradoras e Operadoras cadastradas no catálogo
 */
export async function getSeguradorasOperadoras(): Promise<{
  data: SeguradoraOperadora[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await db
      .from('seguradoras_operadoras')
      .select('*')
      .order('frente', { ascending: true })
      .order('nome', { ascending: true })

    if (error) {
      console.error('Erro ao buscar seguradoras e operadoras:', error)
      return { data: null, error: new Error(error.message) }
    }

    return { data: (data as SeguradoraOperadora[]) || [], error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha ao buscar seguradoras e operadoras'
    return { data: null, error: new Error(message) }
  }
}

/**
 * Busca todos os Produtos cadastrados no catálogo
 */
export async function getProdutosCatalogo(): Promise<{
  data: ProdutoCatalogo[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await db
      .from('produtos')
      .select('*')
      .order('frente', { ascending: true })
      .order('nome', { ascending: true })

    if (error) {
      console.error('Erro ao buscar produtos:', error)
      return { data: null, error: new Error(error.message) }
    }

    return { data: (data as ProdutoCatalogo[]) || [], error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha ao buscar produtos'
    return { data: null, error: new Error(message) }
  }
}

/**
 * Busca todas as Origens de Lead cadastradas no catálogo
 */
export async function getOrigensLead(apenasAtivas: boolean = false): Promise<{
  data: OrigemLead[] | null
  error: Error | null
}> {
  try {
    let query = db.from('origens_lead').select('*').order('nome', { ascending: true })
    if (apenasAtivas) {
      query = query.eq('situacao', 'ativa')
    }
    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar origens de lead:', error)
      return { data: null, error: new Error(error.message) }
    }

    return { data: (data as OrigemLead[]) || [], error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha ao buscar origens de lead'
    return { data: null, error: new Error(message) }
  }
}

/**
 * Busca todos os Motivos cadastrados no catálogo
 */
export async function getMotivosCatalogo(apenasAtivos: boolean = false): Promise<{
  data: MotivoCatalogo[] | null
  error: Error | null
}> {
  try {
    let query = db
      .from('motivos')
      .select('*')
      .order('tipo', { ascending: true })
      .order('nome', { ascending: true })

    if (apenasAtivos) {
      query = query.eq('situacao', 'ativa')
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar motivos:', error)
      return { data: null, error: new Error(error.message) }
    }

    return { data: (data as MotivoCatalogo[]) || [], error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha ao buscar motivos'
    return { data: null, error: new Error(message) }
  }
}

/**
 * Busca o catálogo completo para exibição unificada
 */
export async function getCatalogoCompleto(): Promise<{
  data: CatalogoData | null
  error: Error | null
}> {
  try {
    const [seguradorasRes, produtosRes, origensRes, motivosRes] = await Promise.all([
      getSeguradorasOperadoras(),
      getProdutosCatalogo(),
      getOrigensLead(),
      getMotivosCatalogo(),
    ])

    if (seguradorasRes.error) throw seguradorasRes.error
    if (produtosRes.error) throw produtosRes.error
    if (origensRes.error) throw origensRes.error
    if (motivosRes.error) throw motivosRes.error

    return {
      data: {
        seguradoras: seguradorasRes.data || [],
        produtos: produtosRes.data || [],
        origensLead: origensRes.data || [],
        motivos: motivosRes.data || [],
      },
      error: null,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha ao carregar catálogo completo'
    return { data: null, error: new Error(message) }
  }
}
