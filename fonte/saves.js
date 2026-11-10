/*
 * saves.js — as builds salvas do Caderno do Contractor: versões guardadas no navegador e arquivos .txt
 * para baixar e carregar. Funciona no navegador (window.WCSaves) e no Node (globalThis.WCSaves).
 *
 * Build salva: { id: 'b:…', nome, criadaEm, versoes: [versão…] }, versões da mais velha para a mais nova.
 * Versão:      { id: 'v:…', rotulo, salvaEm (ISO), texto (o Copy Text of Build colado), cfg (as escolhas
 *                feitas na página), resumo: { mundo, saldo, contractors } }
 *
 * O arquivo .txt tem um cabeçalho para ler, o texto corrigido (para colar numa LLM) e, no fim, os dados
 * em JSON para a página carregar de novo.
 */
(function (raiz) {
  'use strict'
  const FORMATO = 'caderno-contractor'
  const MARCA_TEXTO = '----- Texto corrigido da build -----'
  const MARCA_DADOS = '----- Dados para carregar no Caderno do Contractor (não edite daqui para baixo) -----'
  // Campos que a página recalcula ao abrir a build: não precisam ocupar espaço no save.
  const CALCULADOS = ['candidatos', 'tagsBase', 'arqBase', 'arqAuto', 'tagsDef', 'arquetipos', 'meu']

  function novoId(prefixo) { return `${prefixo}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` }

  function compactarCfg(cfg) {
    if (!cfg) return null
    const c = JSON.parse(JSON.stringify(cfg))
    for (const p of [c.c1, c.so, ...(Array.isArray(c.companions) ? c.companions : [])]) {
      if (p && typeof p === 'object') for (const k of CALCULADOS) delete p[k]
    }
    return c
  }

  // JSON que vem de um arquivo: sem chaves que mexem no protótipo dos objetos.
  function lerJSON(texto) {
    return JSON.parse(texto, (k, v) => (k === '__proto__' || k === 'constructor' || k === 'prototype' ? undefined : v))
  }

  const dataValida = s => typeof s === 'string' && !Number.isNaN(Date.parse(s))

  function limparVersao(v) {
    if (!v || typeof v !== 'object' || typeof v.texto !== 'string' || !v.texto.trim()) return null
    const r = v.resumo && typeof v.resumo === 'object' ? v.resumo : {}
    return {
      id: typeof v.id === 'string' && /^v:[\w-]+$/.test(v.id) ? v.id : novoId('v'),
      rotulo: String(v.rotulo ?? '').slice(0, 120),
      salvaEm: dataValida(v.salvaEm) ? v.salvaEm : new Date().toISOString(),
      texto: v.texto,
      cfg: v.cfg && typeof v.cfg === 'object' && !Array.isArray(v.cfg) ? v.cfg : null,
      resumo: { mundo: String(r.mundo ?? '').slice(0, 200), saldo: Number.isFinite(r.saldo) ? r.saldo : null, contractors: String(r.contractors ?? '').slice(0, 200) },
    }
  }

  function limparBuild(b) {
    if (!b || typeof b !== 'object') return null
    const versoes = (Array.isArray(b.versoes) ? b.versoes : []).map(limparVersao).filter(Boolean)
    if (!versoes.length) return null
    versoes.sort((x, y) => x.salvaEm.localeCompare(y.salvaEm))
    return {
      id: typeof b.id === 'string' && /^b:[\w-]+$/.test(b.id) ? b.id : novoId('b'),
      nome: String(b.nome || versoes[versoes.length - 1].resumo.contractors || 'Build sem nome').trim().slice(0, 120) || 'Build sem nome',
      criadaEm: dataValida(b.criadaEm) ? b.criadaEm : versoes[0].salvaEm,
      versoes,
    }
  }

  const ultima = b => b.versoes[b.versoes.length - 1]

  // Rótulo da próxima versão no seu estilo: depois de "+15" vem "+16". Sem número no começo, fica vazio.
  function sugerirRotulo(build) {
    if (!build || !build.versoes.length) return ''
    const m = String(ultima(build).rotulo || '').trim().match(/^([+-]?)(\d+)/)
    return m ? `${m[1]}${parseInt(m[2], 10) + 1}` : ''
  }

  function dataBonita(iso) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const z = n => String(n).padStart(2, '0')
    return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`
  }

  const paraArquivo = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100)
  const mundoCurto = m => String(m || '').replace(/\s*\[.*$/, '').trim()

  // Como os saves do Interactive: "save_Kukulkan PvP +15 - SCP.txt".
  function nomeArquivo(build, versao) {
    let nome = `save_${paraArquivo(build.nome) || 'build'}`
    if (versao && versao.rotulo) nome += ` ${paraArquivo(versao.rotulo)}`
    const mundo = mundoCurto((versao || ultima(build)).resumo.mundo)
    if (mundo) nome += ` - ${paraArquivo(mundo)}`
    if (!versao) nome += ' (todas as versões)'
    return `${nome}.txt`
  }

  const linhaSaldo = r => (r.saldo != null ? ` · saldo final ${r.saldo}` : '')
  const dados = obj => `${MARCA_DADOS}\n${JSON.stringify({ formato: FORMATO, v: 1, ...obj })}\n`

  function arquivoVersao(build, versao, textoCorrigido) {
    const r = versao.resumo
    return [
      'Caderno do Contractor · Waifu Catalog',
      `Build: ${build.nome}`,
      `Versão: ${versao.rotulo || '(sem nome)'} · salva em ${dataBonita(versao.salvaEm)}`,
      r.mundo ? `Mundo: ${r.mundo}${linhaSaldo(r)}` : null,
      'Para abrir de novo: Caderno do Contractor → Saves → Carregar arquivo.',
      '',
      MARCA_TEXTO,
      String(textoCorrigido || versao.texto).trimEnd(),
      '',
      dados({ tipo: 'versao', builds: [{ ...build, versoes: [versao] }] }),
    ].filter(l => l != null).join('\n')
  }

  function arquivoBuild(build) {
    return [
      'Caderno do Contractor · Waifu Catalog',
      `Build: ${build.nome} · ${build.versoes.length} ${build.versoes.length === 1 ? 'versão' : 'versões'}`,
      ...build.versoes.map(v => `- ${v.rotulo || '(sem nome)'} · ${dataBonita(v.salvaEm)}${v.resumo.mundo ? ` · ${mundoCurto(v.resumo.mundo)}` : ''}${linhaSaldo(v.resumo)}`),
      'Para abrir de novo: Caderno do Contractor → Saves → Carregar arquivo.',
      '',
      dados({ tipo: 'build', builds: [build] }),
    ].join('\n')
  }

  function arquivoBackup(builds, extras) {
    const versoes = builds.reduce((a, b) => a + b.versoes.length, 0)
    return [
      'Caderno do Contractor · Waifu Catalog',
      `Backup de tudo: ${builds.length} ${builds.length === 1 ? 'build' : 'builds'}, ${versoes} ${versoes === 1 ? 'versão' : 'versões'}${extras && extras.meus ? `, ${extras.meus.length} em Meus personagens` : ''}.`,
      ...builds.map(b => `- ${b.nome} (${b.versoes.length})`),
      'Para carregar: Caderno do Contractor → Saves → Carregar arquivo. O que já existe não é apagado.',
      '',
      dados({ tipo: 'backup', builds, meus: (extras && extras.meus) || [], prefs: (extras && extras.prefs) || {} }),
    ].join('\n')
  }

  // Descobre o que é o arquivo: um save desta página (versão, build ou backup), o texto de uma build,
  // personagens para Meus personagens, ou um save do próprio Interactive (que esta página não abre).
  function lerArquivo(texto) {
    const t = String(texto || '').replace(/^\uFEFF/, '')
    const i = t.indexOf(MARCA_DADOS)
    let bruto = null
    if (i >= 0) bruto = t.slice(i + MARCA_DADOS.length).trim()
    else if (/^\s*[[{]/.test(t)) bruto = t.trim()
    if (bruto != null) {
      let d
      try { d = lerJSON(bruto) }
      catch (e) { return { tipo: 'erro', erro: 'Os dados do fim do arquivo estão estragados (o JSON não fecha). Use outro arquivo ou um backup.' } }
      if (d && d.formato === FORMATO && Array.isArray(d.builds)) {
        return {
          tipo: ['versao', 'build', 'backup'].includes(d.tipo) ? d.tipo : 'build',
          builds: d.builds.map(limparBuild).filter(Boolean),
          meus: Array.isArray(d.meus) ? d.meus : null,
          prefs: d.prefs && typeof d.prefs === 'object' && !Array.isArray(d.prefs) ? d.prefs : null,
        }
      }
      if (d && typeof d === 'object' && !Array.isArray(d) && 'startingWorld' in d && 'baseBudget' in d) return { tipo: 'interactive' }
      if (Array.isArray(d) || (d && d.formato === 'wcfix-personagens')) return { tipo: 'personagens', texto: bruto }
      return { tipo: 'desconhecido' }
    }
    if (/^\s*Starting World:/m.test(t) || /^\s*Starting budget\s/m.test(t)) return { tipo: 'texto-build', texto: t.trim() }
    return { tipo: 'desconhecido' }
  }

  // Junta builds vindas de arquivo às que já existem: a mesma build (mesmo id) ganha só as versões que faltam.
  function mesclarBuilds(atuais, novas) {
    const lista = (atuais || []).map(b => ({ ...b, versoes: b.versoes.slice() }))
    let buildsNovas = 0
    let versoesNovas = 0
    for (const n of novas || []) {
      const b = lista.find(x => x.id === n.id)
      if (!b) { lista.push({ ...n, versoes: n.versoes.slice() }); buildsNovas++; versoesNovas += n.versoes.length; continue }
      for (const v of n.versoes) if (!b.versoes.some(x => x.id === v.id)) { b.versoes.push(v); versoesNovas++ }
      b.versoes.sort((x, y) => x.salvaEm.localeCompare(y.salvaEm))
    }
    return { lista, buildsNovas, versoesNovas }
  }

  raiz.WCSaves = {
    FORMATO, MARCA_DADOS, MARCA_TEXTO,
    novoId, compactarCfg, limparBuild, limparVersao, ultima, sugerirRotulo, dataBonita, nomeArquivo,
    arquivoVersao, arquivoBuild, arquivoBackup, lerArquivo, mesclarBuilds,
  }
})(typeof window !== 'undefined' ? window : globalThis)
