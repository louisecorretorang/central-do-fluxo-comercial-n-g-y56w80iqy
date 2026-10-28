import { Link } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { OportunidadeResumo } from '@/types/oportunidades'
import { formatCurrencyBRL } from '@/components/NewOpportunityModal'
import { formatDateBR } from '@/lib/clientes-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Props {
  itens: OportunidadeResumo[]
  /** Mensagem exibida quando a aba não tem nenhuma oportunidade. */
  vazio: string
}

/**
 * T3.02/CA-1-12 — lista de oportunidades de UMA aba da ficha do cliente.
 *
 * Foi extraída do bloco inline de `ClienteDetalhes` porque as três abas (em aberto, ganhas e
 * perdidas) mostram a mesma linha; duplicar o JSX três vezes faria a próxima alteração de
 * layout esquecer uma das abas — foi exatamente esse tipo de duplicação que escondeu o bug do
 * download na T2.04 (`TrilhaEtapas` × `ChecklistEtapaAtual`).
 */
export default function ListaOportunidadesDoCliente({ itens, vazio }: Props) {
  if (itens.length === 0) {
    return (
      <div className="text-center py-8 px-4 border-t border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-2">
          <Briefcase className="w-5 h-5" />
        </div>
        <p className="text-xs text-slate-500">{vazio}</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-100 border-t border-slate-100">
      {itens.map((opp) => (
        <div
          key={opp.id}
          className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 font-bold">
                {opp.protocolo}
              </span>
              <span className="font-bold text-sm text-[#0C2D48]">
                {opp.produto_nome}
                {opp.seguradora_nome ? ` — ${opp.seguradora_nome}` : ''}
              </span>
              <Badge className="bg-slate-100 text-slate-700 border-none text-[10px]">
                {opp.situacao}
              </Badge>
              {opp.usou_fluxo_generico && (
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                  Fluxo padrão
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-500 mt-1.5">
              <span className="font-medium text-teal-800">
                Etapa: {opp.etapa_atual_nome || 'Inicial'}
              </span>
              <span>Resp: {opp.responsavel_comercial_nome}</span>
              <span className="font-semibold text-slate-700">
                {formatCurrencyBRL(opp.valor_estimado)}
              </span>
              <span>Previsto: {formatDateBR(opp.data_prevista_fechamento)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-9 px-3.5 rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Link to={`/oportunidades/${opp.id}`}>Ver oportunidade</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
