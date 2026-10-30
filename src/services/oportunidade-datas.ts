import { supabase } from '@/lib/supabase/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * T5.03b — datas de fechamento da oportunidade.
 *
 * Fica num módulo próprio em vez de engordar `getOportunidadeById`: aquele select é grande e
 * mexer nele por dois campos seria risco desnecessário. São colunas aditivas (T5.03a), então a
 * consulta nunca quebra por ausência delas no banco.
 */
export async function getDatasFechamento(
  oportunidadeId: string,
): Promise<{ data_ganho: string | null; data_perda: string | null }> {
  try {
    const { data, error } = await db
      .from('oportunidades')
      .select('data_ganho, data_perda')
      .eq('id', oportunidadeId)
      .single()

    if (error || !data) {
      return { data_ganho: null, data_perda: null }
    }

    return {
      data_ganho: data.data_ganho || null,
      data_perda: data.data_perda || null,
    }
  } catch {
    return { data_ganho: null, data_perda: null }
  }
}
