import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Hash, Check, Edit2, Loader2, Save } from 'lucide-react'
import { updateNumeroQuiver } from '@/services/oportunidades'

interface QuiverCardProps {
  oportunidadeId: string
  numeroQuiver: string | null
  usuarioId: string
  onAtualizacao: () => void
}

export function QuiverCard({
  oportunidadeId,
  numeroQuiver,
  usuarioId,
  onAtualizacao,
}: QuiverCardProps) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(numeroQuiver || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleSalvar = async () => {
    setSalvando(true)
    setErro(null)

    const res = await updateNumeroQuiver(oportunidadeId, valor, usuarioId)
    setSalvando(false)

    if (res.error) {
      setErro(res.error)
    } else {
      setEditando(false)
      onAtualizacao()
    }
  }

  return (
    <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 flex-shrink-0">
            <Hash className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Nº da proposta / apólice no Quiver
              </span>
              {numeroQuiver && (
                <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] font-semibold">
                  Vinculado
                </Badge>
              )}
            </div>

            {!editando ? (
              <p className="text-sm font-semibold font-mono text-slate-900 mt-0.5">
                {numeroQuiver ? (
                  numeroQuiver
                ) : (
                  <span className="text-xs font-normal text-slate-400 italic">
                    Nenhum número cadastrado ainda.
                  </span>
                )}
              </p>
            ) : (
              <div className="mt-2 flex items-center gap-2 max-w-sm">
                <Input
                  type="text"
                  placeholder="Ex.: QUI-98214-2026"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  disabled={salvando}
                  className="h-9 text-xs rounded-xl border-slate-300 font-mono"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSalvar}
                  disabled={salvando}
                  className="h-9 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold btn-press"
                >
                  {salvando ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 mr-1" />
                      Salvar
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setValor(numeroQuiver || '')
                    setEditando(false)
                  }}
                  disabled={salvando}
                  className="h-9 px-2 text-xs text-slate-500 rounded-xl"
                >
                  Cancelar
                </Button>
              </div>
            )}

            {erro && <p className="text-[11px] text-red-600 mt-1">{erro}</p>}
          </div>
        </div>

        {!editando && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValor(numeroQuiver || '')
              setEditando(true)
            }}
            className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold btn-press self-start sm:self-center"
          >
            <Edit2 className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
            {numeroQuiver ? 'Alterar número' : 'Informar nº Quiver'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
