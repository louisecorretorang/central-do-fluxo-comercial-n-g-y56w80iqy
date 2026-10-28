/**
 * Utilitários de validação, formatação de documentos e máscaras (pt-BR)
 */

export const onlyDigits = (val?: string | null): string => {
  if (!val) return ''
  return val.replace(/\D/g, '')
}

/**
 * T3.01 — normalização canônica de documento para gravação e comparação.
 *
 * Histórico: até aqui a tela gravava `onlyDigits(...)`. Para CPF isso está certo — CPF só tem
 * números. Para CNPJ passou a estar errado em 31/07/2026, quando a Receita Federal começou a
 * emitir o **CNPJ alfanumérico** (14 posições, podendo conter letras). Descartar as letras
 * transformava "00.000.000/E08G-12" em "000000000081" — 12 dígitos — e o cadastro era recusado
 * como inválido, sem o usuário entender por quê.
 *
 * Regra: CNPJ mantém letras e números, em maiúsculas (a RFB usa maiúsculas); CPF só dígitos.
 * É esta a forma que vai para o banco e a que a unicidade compara.
 */
export const normalizarDocumento = (val: string | null | undefined, tipo: 'PF' | 'PJ'): string => {
  if (!val) return ''
  if (tipo === 'PJ') {
    // Mantém apenas letras e números; letras sempre em maiúsculas.
    return val
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
      .slice(0, 14)
  }
  return onlyDigits(val).slice(0, 11)
}

export const formatCPF = (val?: string | null): string => {
  const digits = onlyDigits(val).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

export const formatCNPJ = (val?: string | null): string => {
  // T3.01 — aceita o CNPJ alfanumérico: letras entram na máscara (00.000.000/0000-00).
  const digits = normalizarDocumento(val, 'PJ')
  if (!digits) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

export const formatPhoneBR = (val?: string | null): string => {
  const digits = onlyDigits(val).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

export const formatDateBR = (val?: string | null): string => {
  if (!val) return ''
  // Se for ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    const [y, m, d] = val.slice(0, 10).split('-')
    return `${d}/${m}/${y}`
  }
  // Se for dígitos digitados
  const digits = onlyDigits(val).slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
}

export const parseDateBRToISO = (val?: string | null): string | null => {
  if (!val) return null
  const digits = onlyDigits(val)
  if (digits.length !== 8) return null
  const d = digits.slice(0, 2)
  const m = digits.slice(2, 4)
  const y = digits.slice(4, 8)
  return `${y}-${m}-${d}`
}

/**
 * Validação algorítmica de CPF
 */
export const isValidCPF = (val?: string | null): boolean => {
  const digits = onlyDigits(val)
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(digits.charAt(9), 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(digits.charAt(10), 10)) return false

  return true
}

/**
 * Validação algorítmica de CNPJ — aceita o formato numérico e o **alfanumérico**.
 *
 * T3.01 — o CNPJ alfanumérico existe desde 31/07/2026 (Receita Federal). A regra de cálculo
 * não mudou: continua módulo 11 com pesos 2–9. O que muda é como cada caractere vira número:
 * valor ASCII menos 48. Assim os dígitos mantêm o valor de sempre e as letras ficam A=17,
 * B=18, C=19… (manual de DV da RFB). Os dois dígitos verificadores continuam numéricos.
 *
 * Compatibilidade: um CNPJ só de números produz exatamente o mesmo cálculo de antes, então
 * nenhum cadastro existente muda de resultado.
 */
export const isValidCNPJ = (val?: string | null): boolean => {
  const doc = normalizarDocumento(val, 'PJ')
  if (doc.length !== 14) return false
  // Repetição total (00000000000000, AAAAAAAAAAAAAA) nunca é válida.
  if (/^(.)\1{13}$/.test(doc)) return false

  // Os dois últimos caracteres são sempre dígitos verificadores numéricos.
  if (!/^\d{2}$/.test(doc.slice(12))) return false

  const valorCaractere = (ch: string) => ch.charCodeAt(0) - 48

  // Primeiro dígito verificador — pesos 5,4,3,2,9,8,7,6,5,4,3,2 sobre os 12 primeiros.
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let soma = 0
  for (let i = 0; i < 12; i++) soma += valorCaractere(doc.charAt(i)) * pesos1[i]
  let resto = soma % 11
  const dv1 = resto < 2 ? 0 : 11 - resto
  if (dv1 !== parseInt(doc.charAt(12), 10)) return false

  // Segundo dígito verificador — pesos 6,5,4,3,2,9,8,7,6,5,4,3,2 sobre os 13 primeiros.
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  soma = 0
  for (let i = 0; i < 13; i++) soma += valorCaractere(doc.charAt(i)) * pesos2[i]
  resto = soma % 11
  const dv2 = resto < 2 ? 0 : 11 - resto
  if (dv2 !== parseInt(doc.charAt(13), 10)) return false

  return true
}

export const ESTADOS_BRASIL = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
]
