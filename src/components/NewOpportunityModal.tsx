        if (catRes.data) {
          // T4.02 (emenda 20/10) — só o que está ativo aparece na abertura.
          // Produtos e seguradoras já eram filtrados; as origens não eram, então uma origem
          // desativada continuava podendo ser escolhida aqui.
          setProdutos(catRes.data.produtos.filter((p) => p.situacao === 'ativa'))
          setSeguradoras(catRes.data.seguradoras.filter((s) => s.situacao === 'ativa'))
          setOrigens(catRes.data.origensLead.filter((o) => o.situacao === 'ativa'))
        }
