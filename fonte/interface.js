/*
 * interface.js — as telas do Caderno do Contractor: abas, saves, pessoas e tags, retinue, heritage,
 * challenges, missões, Meus personagens, regras e resultado. As contas ficam em motor.js (window.WCFix);
 * os saves, em saves.js (window.WCSaves); os dados do Interactive, em window.WC_DADOS; a build de
 * exemplo, em window.WC_EXEMPLO.
 */
(function () {
  'use strict'
  const W = window.WCFix
  const banco = (window.WC_DADOS && W.criarBanco(window.WC_DADOS)) || W.bancoMinimo()
  const CHAVE = 'wcfix:v2'
  const CHAVE_V1 = 'wcfix:v1'
  const CHAVE_MEUS = 'wcfix:meus:v1'
  // Preferências que valem para todas as builds: a base do bônus dos challenges.
  const CHAVE_PREFS = 'wcfix:prefs:v1'
  // As builds salvas, com todas as versões.
  const CHAVE_BUILDS = 'wcfix:builds:v1'
  const S = window.WCSaves
  const ABAS = ['build', 'saves', 'pessoas', 'retinue', 'heritage', 'challenges', 'missoes', 'resultado', 'meus', 'regras']
  const TIPOS_RECOMPENSA = ['Credits', 'TX Tickets', 'IMG Tickets', 'Perk', 'Companion', 'Other']
  const ORDEM = Object.keys(W.TAG_DEFESA)
  const est = {
    modelo: null, cfg: null, res: null,
    aba: 'build', sub: 'resumo',
    meus: [],
    editor: null, // { r: registro em edição, novo, voltarPara: chave da pessoa da build }
    painelMeus: null, // 'importar' | 'copiar'
    buscaCopiar: '', filtroMeus: '',
    seletor: {}, // chave da pessoa -> texto da busca, enquanto o seletor de personagem está aberto
    focar: null,
    abrirSO: null, // os campos da origem do SO estão abertos? null = decidir sozinho
    prefs: {},
    focarMissao: null,
    // Saves: a biblioteca, a build e a versão abertas, e a assinatura do que foi salvo (para saber se mudou).
    builds: [], buildAtual: null, versaoAtual: null, assinaturaSalva: null,
    nomeNovo: '', rotulo: '', versoesAbertas: {},
    // Retinue: filtro e busca.
    filtroSequito: 'todos', buscaSequito: '',
  }
  const $ = id => document.getElementById(id)
  const fmt = W.fmt
  const tierTxt = W.tierTxt
  const largo = window.matchMedia('(min-width: 1100px)')

  // ---------------------------------------------------------------- utilidades de DOM
  function h(tag, props, ...filhos) {
    const e = document.createElement(tag)
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue
      if (k === 'class') e.className = v
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v)
      else if (k === 'value') e.value = v
      else if (['checked', 'selected', 'disabled', 'hidden', 'readOnly'].includes(k)) e[k] = true
      else e.setAttribute(k, v === true ? '' : v)
    }
    for (const f of filhos.flat(Infinity)) if (f != null && f !== false) e.append(f instanceof Node ? f : document.createTextNode(String(f)))
    return e
  }
  const botao = (rotulo, aoClicar, classe = 'sec', extra = {}) => h('button', { type: 'button', class: classe, onclick: aoClicar, ...extra }, rotulo)
  const campo = (rotulo, controle, classe) => h('label', { class: `campo${classe ? ` ${classe}` : ''}` }, rotulo, controle)
  const nota = (...t) => h('p', { class: 'nota' }, ...t)
  const cardVazio = t => h('div', { class: 'card' }, h('p', { class: 'vazio', style: 'margin:0' }, t))
  function lista(opcoes, atual, aoMudar, props) {
    return h('select', { ...(props || {}), onchange: e => aoMudar(e.target.value) },
      opcoes.map(([v, t]) => h('option', { value: v, selected: String(v) === String(atual) }, t)))
  }
  function caixaTexto(valor, aoMudar, props) {
    return h('input', { type: 'text', value: valor || '', autocomplete: 'off', ...(props || {}), oninput: e => aoMudar(e.target.value) })
  }
  function caixaNumero(valor, aoMudar) {
    return h('input', { type: 'number', step: 'any', inputmode: 'decimal', value: String(valor ?? 0), oninput: e => aoMudar(parseFloat(e.target.value) || 0) })
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } }
  const nomeTag = t => W.curtoDefesa(W.TAG_DEFESA[t])
  const tiers = []
  for (let t = 1; t <= 13; t++) tiers.push([String(t), `T${tierTxt(t)} (${fmt(W.precoTier(t))})`])
  function descPersonagem(c) { return c ? `${c.mundo || 'sem mundo'}${c.sub ? ` · ${c.sub}` : ''} · T${tierTxt(c.tier)}` : '' }

  let tempoToast
  function toast(msg) {
    const t = $('toast')
    t.textContent = msg
    t.hidden = false
    clearTimeout(tempoToast)
    tempoToast = setTimeout(() => { t.hidden = true }, 3200)
  }

  async function copiarTexto(texto) {
    try { await navigator.clipboard.writeText(texto); return true }
    catch (e) { /* sem permissão: tenta do jeito antigo */ }
    const ta = h('textarea', { style: 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0' })
    ta.value = texto
    document.body.append(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') }
    catch (e) { ok = false }
    ta.remove()
    return ok
  }

  // Lê um arquivo escolhido (File.text() não existe em navegador antigo de celular).
  function lerArquivoTexto(arquivo) {
    if (arquivo.text) return arquivo.text()
    return new Promise((resolver, falhar) => {
      const leitor = new FileReader()
      leitor.onload = () => resolver(String(leitor.result || ''))
      leitor.onerror = () => falhar(leitor.error)
      leitor.readAsText(arquivo)
    })
  }

  async function colarEm(alvo) {
    try {
      const t = await navigator.clipboard.readText()
      if (!t) { toast('A área de transferência está vazia.'); return }
      alvo.value = t
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    }
    catch (e) { toast('O navegador não deixou ler a área de transferência. Toque e segure na caixa e escolha Colar.') }
  }

  // ---------------------------------------------------------------- guardar no navegador
  function ler(chave) { try { return JSON.parse(localStorage.getItem(chave) || 'null') } catch (e) { return null } }
  function gravar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); return true } catch (e) { return false } }
  // O estado de trabalho (a build aberta agora), que volta sozinho ao abrir a página.
  function salvar() {
    gravar(CHAVE, {
      texto: $('entrada').value, cfg: S.compactarCfg(est.cfg), aba: est.aba, sub: est.sub,
      buildAtual: est.buildAtual, versaoAtual: est.versaoAtual, limpo: !!est.modelo && !sujo(),
    })
  }
  let avisouSaves = false
  function salvarBuilds() {
    if (!gravar(CHAVE_BUILDS, est.builds)) {
      if (!avisouSaves) toast('O navegador não deixou guardar os saves (pode ter ficado sem espaço). Baixe um backup em Saves e apague versões antigas.')
      avisouSaves = true
      return false
    }
    avisouSaves = false
    return true
  }
  function assinaturaAtual() { return JSON.stringify([$('entrada').value, S.compactarCfg(est.cfg)]) }
  // Mudou desde a última versão salva (ou nunca foi salva)?
  function sujo() { return !!est.modelo && assinaturaAtual() !== est.assinaturaSalva }
  let avisouArmazenamento = false
  function salvarMeus() {
    banco.definirMeus(est.meus)
    if (!gravar(CHAVE_MEUS, est.meus) && !avisouArmazenamento) {
      avisouArmazenamento = true
      toast('Este navegador não deixou salvar. Use "Baixar backup" em Meus personagens para não perder nada.')
    }
  }

  // ---------------------------------------------------------------- estado e contas
  function desligarSave() { est.buildAtual = null; est.versaoAtual = null; est.assinaturaSalva = null; est.nomeNovo = ''; est.rotulo = '' }

  function processarTexto() {
    const texto = $('entrada').value
    if (!texto.trim()) { est.modelo = est.cfg = est.res = null; desligarSave(); montarTudo(); salvar(); return }
    const novo = W.analisar(texto)
    const ant = est.modelo
    // A mesma build (mesmo mundo e mesma origem) colada de novo, por exemplo depois de jogar mais um pouco
    // no Interactive: mantém as escolhas e continua ligada à build salva, para virar a próxima versão.
    const mesmaBuild = ant && ant.mundo === novo.mundo && ((ant.origem && ant.origem.raw) === (novo.origem && novo.origem.raw))
    if (!mesmaBuild) desligarSave()
    est.cfg = W.configPadrao(novo, banco, mesmaBuild ? est.cfg : null)
    est.modelo = novo
    reconstruir()
  }
  function calcularAgora() {
    if (est.cfg) for (const k of ['bonusChallenge', 'powerTripDobra']) if (est.prefs[k] !== undefined) est.cfg.opcoes[k] = est.prefs[k]
    est.res = est.modelo && est.cfg ? W.calcular(est.modelo, est.cfg, banco) : null
  }
  function mudarPref(chave, valor) {
    est.prefs[chave] = valor
    gravar(CHAVE_PREFS, est.prefs)
    recalcular()
    montarMissoes()
  }
  // reconstruir: refaz todas as telas (depois de colar outra build ou trocar algo que muda os campos).
  function reconstruir() { calcularAgora(); montarTudo(); salvar() }
  // recalcular: refaz só as partes que mudam com a conta, sem tirar o foco do campo em que se digita.
  function recalcular() { calcularAgora(); atualizar(); salvar() }
  const recalcularDepois = debounce(recalcular, 160)

  function pessoasDaBuild() {
    const cfg = est.cfg
    return cfg ? [cfg.c1, ...(cfg.casal && cfg.so ? [cfg.so] : []), ...cfg.companions] : []
  }
  function pessoaPorChave(k) {
    const cfg = est.cfg
    if (!cfg) return null
    if (k === 'c1') return cfg.c1
    if (k === 'so') return cfg.casal ? cfg.so : null
    return cfg.companions.find(c => c.id === k) || null
  }
  const ehContractor = chave => chave === 'c1' || chave === 'so'
  const mexidas = p => !!((p.tagsMais || []).length + (p.tagsMenos || []).length + (p.arqMais || []).length + (p.arqMenos || []).length)

  // Depois de criar, editar, importar ou apagar em Meus personagens: as pessoas da build são achadas de novo.
  function aposMudarMeus() {
    if (est.modelo) { est.cfg = W.configPadrao(est.modelo, banco, est.cfg); reconstruir() }
    else { montarMeus(); atualizarContadores() }
  }

  // ---------------------------------------------------------------- abas
  function irPara(aba, rolar = true) {
    if (!ABAS.includes(aba)) aba = 'build'
    if (aba === 'resultado' && largo.matches) aba = 'build'
    est.aba = aba
    document.body.dataset.aba = aba
    for (const b of document.querySelectorAll('#abas [role=tab]')) {
      const sel = b.dataset.aba === aba
      b.setAttribute('aria-selected', sel ? 'true' : 'false')
      b.tabIndex = sel ? 0 : -1
      if (sel && b.scrollIntoView && b.offsetParent) b.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
    if (aba === 'meus') montarMeus()
    if (rolar) window.scrollTo(0, 0)
    salvar()
  }
  function irParaSub(sub) {
    if (!['resumo', 'texto', 'linhas'].includes(sub)) sub = 'resumo'
    est.sub = sub
    $('resultado').dataset.sub = sub
    for (const b of document.querySelectorAll('.subabas [data-sub]')) b.setAttribute('aria-selected', b.dataset.sub === sub ? 'true' : 'false')
  }

  // ---------------------------------------------------------------- montar e atualizar as telas
  function montarTudo() {
    montarBuild()
    montarPessoas()
    montarRetinue()
    montarRegras()
    montarMissoes()
    montarSaves()
    if (est.aba === 'meus' || !$('painelMeus').childNodes.length) montarMeus()
    atualizar()
  }
  function atualizar() {
    $('chkCasal').checked = !!(est.cfg && est.cfg.casal)
    atualizarResultado()
    atualizarPessoas()
    atualizarRetinue()
    montarHeritage()
    montarChallenges()
    atualizarMissoes()
    atualizarContadores()
    atualizarEstadoSave()
  }

  function atualizarContadores() {
    const poe = (id, n, erro) => {
      const e = $(id)
      e.hidden = !n
      e.textContent = n ? String(n) : ''
      e.className = `contador${erro ? ' erro' : ''}`
    }
    const res = est.res
    poe('contPessoas', res ? pessoasDaBuild().length : 0)
    poe('contHeritage', res ? res.heritage.length : 0)
    poe('contChallenges', res ? res.challenges.lista.length : 0)
    poe('contMissoes', res ? res.missoes.lista.length : 0)
    poe('contRetinue', res ? res.sequito.ativos : 0)
    poe('contSaves', est.builds.length)
    poe('contResultado', res ? res.avisos.filter(a => a.nivel === 'erro').length : 0, true)
    poe('contMeus', est.meus.length)
  }

  // ---------------------------------------------------------------- aba Build
  function resumoOrigem(p) {
    if (!p) return '—'
    const base = p.tipoOrigem === 'Drop-In' ? 'Drop-In' : `${p.tipoOrigem} T${tierTxt(p.tier)}`
    const extra = p.perk ? `, Waifu Perk ${p.perk.titulo} (T${tierTxt(p.perk.tier)})` : (p.swap ? `, Power Swap para ${p.swap.nome} (T${tierTxt(p.swap.tier)})` : '')
    return `${p.nome} · ${base}${extra}`
  }

  // Campo do nome do contractor, que fica no lugar de "You" (contractor 1) ou "Your SO" (contractor 2) no texto.
  function campoApelido(p, chave) {
    const padrao = W.quemDaLinha(p.nome) || (chave === 'c1' ? 'You' : 'Your SO')
    const exemplo = `${chave === 'c1' ? 'Kael' : 'Alphin'} as ${W.personagemDoNome(p.nome)}`
    const rotulo = chave === 'so' ? 'Nome do contractor 2 (SO)' : (est.cfg.casal ? 'Nome do contractor 1' : 'Nome do contractor')
    return h('div', { class: 'campos' },
      h('label', { class: 'campo largo' }, rotulo,
        caixaTexto(p.apelido, v => { p.apelido = v; recalcularDepois() }, { maxlength: '60', placeholder: padrao, 'data-apelido': chave, 'aria-describedby': `apelido-${chave}` }),
        h('span', { class: 'nota', style: 'margin:0', id: `apelido-${chave}` }, `Fica no lugar de "${padrao}" no texto, como em "${exemplo}". Vazio, continua "${padrao}".`)))
  }

  function montarBuild() {
    const box = $('painelBuild')
    box.replaceChildren()
    const md = est.modelo
    if (!md) {
      box.append(cardVazio('Cole uma build na caixa acima, ou toque em "Usar o exemplo" para ver a do Rimuru com a Elysia.'))
      return
    }
    const cfg = est.cfg
    const dl = h('dl', { class: 'lido' })
    const item = (rot, ...val) => dl.append(h('dt', null, rot), h('dd', null, ...val))
    item('Mundo', md.mundo || '—')
    item('Budget', md.budget != null ? fmt(md.budget) : 'não achei a linha "Starting budget"')
    if (md.intensidade != null) item('Intensity', fmt(md.intensidade))
    item('Conta', cfg.casal ? "Couple's Account: dois contractors" : 'um contractor')
    item(cfg.casal ? 'Contractor 1' : 'Contractor', resumoOrigem(cfg.c1))
    if (cfg.casal) item('Contractor 2 (SO)', resumoOrigem(cfg.so))
    item('Heritage', md.heritage.length ? md.heritage.map(L => L.titulo).join(', ') : 'nenhuma')
    item('Defenses', md.defenses.length ? md.defenses.map(L => `${L.titulo}${L.qtd > 1 ? ` x${L.qtd}` : ''}`).join(', ') : 'nenhuma')
    item('Companions', cfg.companions.length ? cfg.companions.map(c => `${c.nome} (T${tierTxt(c.tier)})`).join(', ') : 'nenhum')
    if (est.res) {
      const rc = est.res.challenges
      item('Challenges', rc.lista.length ? rc.lista.map(a => `${a.titulo}${a.valor ? ` (+${fmt(a.valor)})` : ''}`).join(', ') : 'nenhum')
      const rm = est.res.missoes
      item('Missões', rm.lista.length ? `${rm.lista.length} ${rm.lista.length === 1 ? 'missão' : 'missões'}, +${fmt(rm.total)} em créditos` : 'nenhuma')
    }
    box.append(h('div', { class: 'card' },
      h('div', { class: 'card-topo' }, h('h2', null, 'O que a página leu')),
      h('div', { class: 'estado-save', id: 'estadoBuild' }),
      dl,
      h('div', { class: 'botoes' },
        botao('Conferir pessoas e tags', () => irPara('pessoas'), ''),
        md.heritage.length ? botao('Ver heritage', () => irPara('heritage')) : null,
        est.res && est.res.sequito.membros.length ? botao('Ver a retinue', () => irPara('retinue')) : null,
        est.res && est.res.challenges.lista.length ? botao('Ver challenges', () => irPara('challenges')) : null,
        botao('Ver resultado', () => irPara('resultado'), 'sec so-estreito'))))

    if (md.mods.length) {
      const card = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, 'Specific credit modifiers'), h('small', null, 'desmarque o que a ferramenta já corrige')))
      for (const L of md.mods) {
        const k = W.chaveMod(L)
        card.append(h('label', { class: 'opcao' },
          h('input', { type: 'checkbox', checked: cfg.mods[k] !== false, onchange: (e) => { cfg.mods[k] = e.target.checked; recalcular() } }),
          h('span', null, `${L.desc} [${L.valor >= 0 ? '+' : ''}${fmt(L.valor)}]`)))
      }
      if (cfg.casal) card.append(nota('O reembolso do SO feito à mão sai sozinho: a linha "only the more expensive origin" já faz essa conta.'))
      box.append(card)
    }
  }

  // ---------------------------------------------------------------- aba Pessoas e tags
  function montarPessoas() {
    const box = $('painelPessoas')
    box.replaceChildren()
    if (!est.modelo) { box.append(cardVazio('Cole uma build na aba Build primeiro.')); return }
    const cfg = est.cfg
    box.append(h('div', { class: 'card' },
      h('div', { class: 'legenda-chips', style: 'margin-top:0' },
        h('span', null, h('span', { class: 'chip conta' }, 'Stress ', h('span', { class: 'val' }, '+2')), ' dá desconto nesta build'),
        h('span', null, h('span', { class: 'chip fora' }, 'Body'), ' a build não compra essa Defense'),
        h('span', null, h('span', { class: 'chip mao' }, 'tracejada'), ' marcada por você'),
        h('span', null, h('span', { class: 'chip tirada' }, 'riscada'), ' tirada por você')),
      h('details', { class: 'mais-campos', style: 'margin-bottom:0' },
        h('summary', null, 'Por que só algumas tags dão desconto?'),
        nota('O Defense Rebate é um desconto no preço de uma Defense que a build compra. Se a build não compra Body Defense, a tag Body não tem o que descontar: ela fica guardada, e passa a valer se você comprar a Defense.'),
        nota('Toque numa tag para tirar ou pôr de volta, e use "+ tag" para marcar outra. Tag marcada à mão que mexe na conta aparece nos Avisos com a condição dela, para você conferir se o personagem cumpre. Para mudar as tags de vez, salve o personagem em Meus personagens.'))))
    box.append(h('div', { class: 'secao' },
      h('h2', null, cfg.casal ? 'Os dois contractors' : 'O contractor'),
      h('p', null, cfg.casal ? "Couple's Account: cada um tem origem, arquétipo e heritage próprios, e as tags dos dois contam nos Defense Rebates." : 'A origem da build. As tags dela contam nos Defense Rebates.')))
    const g = h('div', { class: 'grade-2' }, cardPessoa(cfg.c1, 'c1'))
    if (cfg.casal) g.append(cardPessoa(cfg.so, 'so'))
    box.append(g)
    box.append(h('div', { class: 'secao' },
      h('h2', null, `Companions (${cfg.companions.length})`),
      h('p', null, cfg.companions.length ? 'Quem foi comprado ou capturado. As tags delas também dão Defense Rebates.' : 'A build não tem companions comprados nem capturados.')))
    if (cfg.companions.length) box.append(h('div', { class: 'grade-2' }, cfg.companions.map(c => cardPessoa(c, c.id))))
    box.append(h('div', { id: 'quadroRebates' }))
  }

  function trocarSO(valor) {
    const so = W.pessoaSO(est.modelo, banco, valor === 'manual' ? null : parseInt(valor, 10))
    so.escolhaManual = valor === 'manual'
    so.nomeLinha = so.linha != null ? W.semPrefixo(est.modelo.linhas[so.linha].nome) : null
    est.cfg.so = so
    W.refazerCompanions(est.cfg, est.modelo, banco, est.cfg.companions)
    reconstruir()
  }

  function cardPessoa(p, chave) {
    const md = est.modelo
    const card = h('div', { class: 'card pessoa', 'data-pessoa': chave })
    if (chave === 'c1') {
      card.append(h('div', { class: 'card-topo' }, h('h3', null, est.cfg.casal ? 'Contractor 1' : 'Contractor'), h('small', null, 'a origem da build')))
      card.append(h('p', { class: 'fixo' }, md.origem ? resumoOrigem(p) : h('span', { class: 'vazio' }, 'Não achei a linha da origem na build.')))
      card.append(campoApelido(p, chave))
      card.append(h('details', { class: 'mais-campos', open: est.abrirNome || false, ontoggle: (e) => { est.abrirNome = e.target.open } },
        h('summary', null, 'Mudar o nome do personagem no texto'),
        h('div', { class: 'campos' }, campo('Nome do personagem (nas marcas {…} da heritage e no resumo)', caixaTexto(p.nome, v => { p.nome = v; recalcularDepois() }), 'largo'))))
    }
    else if (chave === 'so') {
      card.append(h('div', { class: 'card-topo' }, h('h3', null, 'Contractor 2 · SO'), h('small', null, 'quem divide a conta')))
      card.append(h('p', { class: 'fixo' }, `${resumoOrigem(p)} · origem de ${fmt(p.custoOrigem)}`))
      card.append(campoApelido(p, chave))
      // Os campos da origem do SO quase nunca mudam: ficam fechados, menos quando o SO não foi achado.
      const abrir = est.abrirSO != null ? est.abrirSO : p.linha == null
      const det = h('details', { class: 'mais-campos', open: abrir, ontoggle: (e) => { est.abrirSO = e.target.open } },
        h('summary', null, p.linha == null ? 'Preencher a origem do SO' : 'Mudar quem é o SO ou a origem dele'))
      const fontes = W.fontesSO(md).map(L => [String(L.i), L.tipo === 'origemSO' ? `${L.nome} (linha de origem)` : `${L.nome} (T${tierTxt(L.tier)}) [${L.metodo}], em Companions bought`])
      fontes.push(['manual', 'Não está na build: preencher à mão'])
      det.append(h('div', { class: 'campos' }, campo('Quem é o SO na build', lista(fontes, p.linha == null ? 'manual' : String(p.linha), trocarSO), 'largo')))
      card.append(det)
      const g = h('div', { class: 'campos' })
      g.append(campo('Nome', caixaTexto(p.nome, v => { p.nome = v; recalcularDepois() })))
      g.append(campo('Mundo (obra)', caixaTexto(p.mundo, v => { p.mundo = v; recalcularDepois() })))
      g.append(campo('Origem', lista(W.TIPOS_ORIGEM.map(t => [t, t]), p.tipoOrigem, (v) => { p.tipoOrigem = v; p.custoOrigem = W.custoOrigemPadrao(v, p.tier); reconstruir() })))
      g.append(campo('Tier', lista(tiers, String(p.tier), (v) => { p.tier = parseInt(v, 10); p.custoOrigem = W.custoOrigemPadrao(p.tipoOrigem, p.tier); reconstruir() })))
      g.append(campo('Preço da origem do SO', caixaNumero(p.custoOrigem, v => { p.custoOrigem = v; recalcularDepois() })))
      if (p.fonte === 'comprado') g.append(campo('O Interactive cobrou', caixaNumero(p.cobrado, v => { p.cobrado = v; recalcularDepois() })))
      if (p.perk) g.append(campo(`Waifu Perk ${p.perk.titulo} (T${tierTxt(p.perk.tier)}): custo`, caixaNumero(p.perk.custo, v => { p.perk.custo = v; recalcularDepois() })))
      if (p.swap) g.append(campo(`Power Swap para ${p.swap.nome} (T${tierTxt(p.swap.tier)}): custo`, caixaNumero(p.swap.custo, v => { p.swap.custo = v; recalcularDepois() })))
      det.append(g)
    }
    else {
      card.append(h('div', { class: 'card-topo' }, h('h3', null, p.nome), h('small', null, `T${tierTxt(p.tier)} · ${p.metodo}${p.mundo ? ` · ${p.mundo}` : ''}`)))
    }
    card.append(h('div', { 'data-dyn': 'personagem' }))
    if (ehContractor(chave)) card.append(h('div', { class: 'linha-tags', 'data-dyn': 'arq' }))
    card.append(h('div', { class: 'linha-tags', 'data-dyn': 'tags' }))
    card.append(h('div', { class: 'calc', 'data-dyn': 'calc' }))
    return card
  }

  function atualizarPessoas() {
    if (!est.modelo || !est.res) return
    for (const card of document.querySelectorAll('#painelPessoas [data-pessoa]')) {
      const chave = card.dataset.pessoa
      const p = pessoaPorChave(chave)
      if (!p) continue
      card.querySelector('[data-dyn=personagem]').replaceChildren(...blocoPersonagem(p, chave))
      const arq = card.querySelector('[data-dyn=arq]')
      if (arq) arq.replaceChildren(...blocoArquetipos(p, chave))
      card.querySelector('[data-dyn=tags]').replaceChildren(...blocoTags(p, chave))
      card.querySelector('[data-dyn=calc]').textContent = textoCalc(p, chave)
    }
    const q = $('quadroRebates')
    if (q) q.replaceChildren(quadroRebates())
    if (est.focar) {
      const alvo = document.querySelector(`[data-pessoa="${est.focar}"] .seletor input`)
      est.focar = null
      if (alvo && largo.matches) alvo.focus()
    }
  }

  function nomeParaBusca(p) { return p.swap ? p.swap.nome : W.personagemDoNome(p.nome) }

  function blocoPersonagem(p, chave) {
    const c = p.personagem != null ? banco.personagem(p.personagem) : null
    const aberto = est.seletor[chave] != null
    const linha = h('div', { class: 'personagem' })
    if (c) {
      linha.append(h('div', { class: 'quem' }, h('b', null, c.nome), h('span', null, descPersonagem(c))),
        h('span', { class: `selo${c.meu ? ' meu' : ''}` }, c.meu ? 'Meus personagens' : 'banco do Interactive'))
    }
    else {
      linha.append(h('div', { class: 'quem' }, h('b', null, 'Nenhum personagem'),
        h('span', null, p.personagemManual ? 'você escolheu marcar as tags à mão' : (banco.semDados ? 'o banco do Interactive não carregou' : `não achei "${nomeParaBusca(p)}" no banco nem em Meus personagens`))),
      h('span', { class: 'selo ruim' }, 'tags à mão'))
    }
    linha.append(botao(aberto ? 'Fechar' : 'Trocar', () => {
      if (aberto) delete est.seletor[chave]
      else { est.seletor[chave] = ''; est.focar = chave }
      atualizarPessoas()
    }, 'leve', { 'aria-expanded': aberto ? 'true' : 'false' }))
    const nos = [h('div', { class: 'rotulo-campo' }, 'Personagem (de onde vêm as tags)'), linha]
    if (aberto) nos.push(seletorPersonagem(p, chave))
    const acoes = []
    if (c && c.meu) {
      if (mexidas(p)) acoes.push(botao('Gravar estas tags no personagem', () => gravarNoMeu(p, c)))
      acoes.push(botao('Editar em Meus personagens', () => abrirEditor(c.registro, chave), 'leve'))
    }
    else if (!c) acoes.push(botao(`Criar ${nomeParaBusca(p)} em Meus personagens`, () => abrirEditor(null, chave, W.registroDePessoa(p, banco))))
    else if (mexidas(p)) acoes.push(botao('Salvar como meu personagem', () => abrirEditor(null, chave, W.registroDePessoa(p, banco))))
    if (mexidas(p)) acoes.push(botao('Desfazer o que mudei', () => { W.semMexidas(p); recalcular() }, 'leve'))
    if (acoes.length) nos.push(h('div', { class: 'botoes', style: 'margin-top:8px' }, acoes))
    return nos
  }

  function seletorPersonagem(p, chave) {
    const busca = h('input', { type: 'search', value: est.seletor[chave] || '', placeholder: 'Procurar pelo nome', 'aria-label': 'Procurar personagem no banco e em Meus personagens' })
    const res = h('div', { class: 'resultados' })
    const preencher = () => {
      est.seletor[chave] = busca.value
      const t = busca.value.trim()
      const achados = t ? banco.procurar(t, 30) : (p.candidatos || []).map(id => banco.personagem(id)).filter(Boolean)
      res.replaceChildren(...achados.map(c => h('button', { type: 'button', onclick: () => escolherPersonagem(p, chave, c.id) },
        h('span', null, h('b', null, c.nome), ' ', h('small', null, descPersonagem(c))),
        c.meu ? h('span', { class: 'selo meu' }, 'meu') : h('small', null, c.defesas.map(nomeTag).join(', ')))))
      if (!achados.length) res.append(nota(t ? 'Nada com esse nome.' : 'Digite um nome para procurar.'))
    }
    busca.addEventListener('input', debounce(preencher, 180))
    preencher()
    return h('div', { class: 'seletor' }, busca, res,
      h('div', { class: 'botoes' },
        botao('Nenhum: só as tags que eu marcar', () => escolherPersonagem(p, chave, null), 'leve'),
        botao('Criar um personagem novo', () => abrirEditor(null, chave, registroDaLinha(p)))))
  }

  function escolherPersonagem(p, chave, id) {
    p.personagem = id
    p.personagemManual = true
    W.semMexidas(p)
    if (id != null && !(p.candidatos || []).includes(id)) p.candidatos = [id, ...(p.candidatos || [])].slice(0, 40)
    delete est.seletor[chave]
    recalcular()
  }

  // Personagem novo com o nome, o mundo e o tier da linha da build, sem tags.
  function registroDaLinha(p) {
    return { ...registroVazio(), nome: nomeParaBusca(p), mundo: p.mundo || '', tier: (p.swap && p.swap.tier) || p.tier || 1 }
  }

  function gravarNoMeu(p, c) {
    const r = est.meus.find(x => x.id === c.id)
    if (!r) return
    r.defesas = (p.tagsDef || []).slice()
    r.arquetipos = (p.arquetipos || []).filter(a => !(p.arqAuto || []).includes(a))
    W.semMexidas(p)
    salvarMeus()
    toast(`Tags gravadas em ${r.nome}. Vale para todas as builds que usam esse personagem.`)
    aposMudarMeus()
  }

  // Quanto o arquétipo deu de desconto para a pessoa nesta build.
  function descontoArquetipo(chave, a) {
    return (est.res.heritage || []).filter(x => x.arquetipo === a)
      .flatMap(x => x.copias.filter(c => c.comprador === chave)).reduce((s, c) => s + (c.desconto || 0), 0)
  }

  function blocoArquetipos(p, chave) {
    const res = est.res
    const ativos = p.arquetipos || []
    const base = p.arqBase || []
    const todos = [...new Set([...base, ...(p.arqMais || []), ...(res.arvores || [])])]
    const chips = h('div', { class: 'chips' })
    for (const a of todos) {
      const on = ativos.includes(a)
      const daBase = base.includes(a)
      const auto = (p.arqAuto || []).includes(a)
      const mao = (p.arqMais || []).includes(a)
      const v = on ? descontoArquetipo(chave, a) : 0
      const cls = ['chip', on && v > 0 ? 'conta' : '', !on && daBase ? 'tirada' : '', !on && !daBase ? 'desligado' : '', mao ? 'mao' : ''].filter(Boolean).join(' ')
      let titulo
      if (!on && daBase) titulo = `${a}: arquétipo do personagem que você tirou nesta build. Toque para pôr de volta.`
      else if (!on) titulo = `${a}: a build tem heritage desta árvore. Toque para dizer que ${p.nome} combina com ela (fica marcado à mão).`
      else titulo = `${a}: ${auto ? 'o Interactive deu este desconto na build' : (mao ? 'marcado à mão' : 'tag do personagem')}.${v > 0 ? ` Nesta build desconta ${fmt(v)}.` : ''} Toque para tirar.`
      chips.append(h('button', { type: 'button', class: cls, 'aria-pressed': on ? 'true' : 'false', title: titulo, onclick: () => { W.alternarTag(p, a, 'arq'); recalcular() } },
        a, v > 0 ? h('span', { class: 'val' }, `−${fmt(v)}`) : null, auto ? h('span', { class: 'marca' }, 'da build') : (mao ? h('span', { class: 'marca' }, 'à mão') : null)))
    }
    const outros = W.ARQUETIPOS.filter(a => !todos.includes(a))
    if (outros.length) chips.append(lista([['', '+ arquétipo'], ...outros.map(a => [a, a])], '', (v) => { if (v) { W.alternarTag(p, v, 'arq'); recalcular() } }, { class: 'mais-tag', 'aria-label': 'Marcar outro arquétipo' }))
    if (!todos.length && !outros.length) chips.append(h('span', { class: 'nota' }, 'nenhum'))
    return [h('div', { class: 'rotulo' }, h('b', null, 'Arquétipo'), 'dá o desconto de arquétipo nas heritages da mesma árvore'), chips]
  }

  function motivoSemRebate(p, chave) {
    const res = est.res
    if (res.rebatesDesligados) return 'Defense Rebates desligados nesta build.'
    if (chave === 'so' && !est.cfg.opcoes.soRebates) return 'As tags do SO não contam: a opção está desligada em Regras.'
    if (ehContractor(chave)) {
      if (!p.swap && ['Drop-In', 'Walk-In', 'Extra'].includes(p.tipoOrigem)) return `${p.tipoOrigem} sem Power Swap não dá Defense Rebates: não pagou para ser quem é.`
      return null
    }
    if (p.vendido) return 'Vendida: não conta nos Defense Rebates.'
    if (p.papel === 'Dead') return 'Morta: enquanto estiver morta, não dá Defense Rebates.'
    if (W.FORA_DOS_REBATES.includes(p.papel)) return `${p.papel}: não conta nos Defense Rebates.`
    return null
  }
  function tetoDaPessoa(p, chave) {
    if (ehContractor(chave)) return W.tetoRebate(p)
    return W.precoTier((p.perk && p.perk.tier) || (p.swap && p.swap.tier) || p.tier)
  }
  function rebateDe(p, t) {
    const d = est.res.rebates.comSO.porDefesa[W.TAG_DEFESA[t]]
    const q = d && d.quem.find(x => x.id === p.id)
    return q ? q.valor : 0
  }

  function blocoTags(p, chave) {
    const res = est.res
    const qtd = res.defesasQtd || {}
    const naBuild = t => (qtd[W.TAG_DEFESA[t]] || 0) > 0
    const ativos = p.tagsDef || []
    const tiradas = p.tagsMenos || []
    const motivo = motivoSemRebate(p, chave)
    const chips = h('div', { class: 'chips' })
    const ordenadas = [...ativos].sort((a, b) => (naBuild(b) - naBuild(a)) || ORDEM.indexOf(a) - ORDEM.indexOf(b))
    for (const t of ordenadas) {
      const nb = naBuild(t)
      const v = nb ? rebateDe(p, t) : 0
      const mao = (p.tagsMais || []).includes(t)
      const preco = banco.precoDefesaCompleto(W.TAG_DEFESA[t])
      const cls = ['chip', nb ? (v > 0 ? 'conta' : 'conta zero') : 'fora', mao ? 'mao' : ''].filter(Boolean).join(' ')
      let situacao
      if (!nb) situacao = 'A build não compra esta Defense, então ela não dá desconto agora.'
      else if (v > 0) situacao = `Nesta build dá +${fmt(v)}.`
      else situacao = motivo || 'Está na build, mas não sobrou desconto: o teto da Defense ou o da pessoa já foi usado.'
      chips.append(h('button', {
        type: 'button', class: cls, 'aria-pressed': 'true',
        title: `${W.TAG_DEFESA[t]}${preco != null ? ` (${fmt(preco)} por compra)` : ''}. Condição: a pessoa ${W.CONDICAO_DEFESA[t]}. ${situacao}${mao ? ' Marcada à mão.' : ''} Toque para tirar.`,
        onclick: () => { W.alternarTag(p, t); recalcular() },
      }, nomeTag(t), nb ? h('span', { class: 'val' }, `+${fmt(v)}`) : null, mao ? h('span', { class: 'marca' }, 'à mão') : null))
    }
    for (const t of tiradas) {
      chips.append(h('button', { type: 'button', class: 'chip tirada', 'aria-pressed': 'false', title: `${W.TAG_DEFESA[t]}: tag do personagem que você tirou nesta build. Toque para pôr de volta.`, onclick: () => { W.alternarTag(p, t); recalcular() } }, nomeTag(t)))
    }
    const faltam = ORDEM.filter(t => !ativos.includes(t) && !tiradas.includes(t))
    if (faltam.length) {
      chips.append(lista([['', '+ tag'], ...faltam.map(t => [t, `${nomeTag(t)}${naBuild(t) ? ' (na build)' : ''}: a pessoa ${W.CONDICAO_DEFESA[t]}`])], '',
        (v) => { if (v) { W.alternarTag(p, v); recalcular() } }, { class: 'mais-tag', 'aria-label': 'Marcar outra tag de Defense' }))
    }
    if (!ativos.length && !tiradas.length) chips.prepend(h('span', { class: 'nota', style: 'margin:0' }, 'nenhuma'))
    const nos = [h('div', { class: 'rotulo' }, h('b', null, 'Tags de Defense'), ativos.length ? `${ativos.length} ${ativos.length === 1 ? 'tag' : 'tags'}, ${ativos.filter(naBuild).length} na build` : ''), chips]
    if (motivo) nos.push(nota(motivo))
    return nos
  }

  function textoCalc(p, chave) {
    const res = est.res
    const cfg = est.cfg
    const partes = []
    if (ehContractor(chave)) {
      const a = res.arquetipos[chave]
      if (chave === 'so' && !cfg.opcoes.soArquetipo) partes.push('O SO não ganha desconto de arquétipo (desligado em Regras).')
      else if (a) {
        if (!a.pool) partes.push(['Drop-In', 'Walk-In', 'Extra'].includes(p.tipoOrigem) ? `Sem desconto de arquétipo: ${p.tipoOrigem} sem Power Swap não paga para ser quem é.` : 'Sem desconto de arquétipo.')
        else partes.push(`Desconto de arquétipo: +${fmt(a.total)} de ${fmt(a.pool)} possíveis (preço do T${tierTxt(W.tier1a(p))})${a.usados.length ? `, em ${a.usados.join(', ')}` : ''}.`)
      }
    }
    if (!motivoSemRebate(p, chave)) {
      const dados = Object.entries(res.rebates.comSO.porDefesa).flatMap(([nome, d]) => d.quem.filter(q => q.id === p.id).map(q => `${W.curtoDefesa(nome)} +${fmt(q.valor)}`))
      const teto = tetoDaPessoa(p, chave)
      partes.push(dados.length ? `Defense Rebates: ${dados.join(', ')} (teto desta pessoa: ${fmt(teto)}).` : 'Não dá Defense Rebates nesta build.')
    }
    if (chave === 'so') {
      const o = res.origens
      partes.push(`Origem: ${cfg.c1.nome} ${fmt(o.c1Total)} × ${p.nome} ${fmt(o.soTotal)}${cfg.opcoes.origemMaisCara ? ` → paga só ${fmt(Math.max(o.c1Total, o.soTotal))}` : ' → paga as duas'}.`)
    }
    return partes.join(' ')
  }

  function quadroRebates() {
    const res = est.res
    const qtd = res.defesasQtd || {}
    const pessoas = pessoasDaBuild()
    const naBuild = []
    const fora = []
    for (const t of ORDEM) {
      const nome = W.TAG_DEFESA[t]
      const q = qtd[nome] || 0
      const quem = pessoas.filter(p => (p.tagsDef || []).includes(t))
      if (q) naBuild.push({ t, nome, q, quem, d: res.rebates.comSO.porDefesa[nome] })
      else if (quem.length) fora.push({ t, quem })
    }
    const card = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, 'Defense Rebates: quem dá desconto em quê'), h('small', null, 'só as Defenses que a build compra')))
    if (res.rebatesDesligados) card.append(h('p', { class: 'aviso aviso' }, 'Defense Rebates desligados nesta build.'))
    if (!naBuild.length) card.append(h('p', { class: 'vazio', style: 'margin:0' }, 'A build não compra nenhuma Defense, então nenhuma tag dá desconto.'))
    else {
      const corpo = h('tbody')
      for (const L of naBuild) {
        const preco = banco.precoDefesaCompleto(L.nome)
        const quem = L.quem.map((p) => {
          const v = L.d && L.d.quem.find(x => x.id === p.id)
          return `${p.nome} +${fmt(v ? v.valor : 0)}`
        }).join(', ') || 'ninguém tem a tag'
        corpo.append(h('tr', null,
          h('td', null, h('b', null, `${W.curtoDefesa(L.nome)} ${L.q >= 2 ? `x${L.q}` : 'x1'}`), h('div', { class: 'nota', style: 'margin:0' }, `a pessoa ${W.CONDICAO_DEFESA[L.t]}`)),
          h('td', { class: 'n', 'data-rot': 'Preço' }, preco != null ? `${fmt(preco)}/compra` : '?'),
          h('td', { 'data-rot': 'Quem dá' }, quem),
          h('td', { class: 'n', 'data-rot': 'Desconto' }, preco != null ? `+${fmt(L.d ? L.d.desconto : 0)} de até ${fmt(preco * Math.min(2, L.q))}` : '?')))
      }
      card.append(h('table', { class: 'tabela' },
        h('thead', null, h('tr', null, h('th', null, 'Defense na build'), h('th', { class: 'n' }, 'Preço'), h('th', null, 'Quem dá'), h('th', { class: 'n' }, 'Desconto'))),
        corpo))
    }
    if (fora.length) {
      card.append(h('p', { class: 'nota', style: 'margin-top:10px' }, h('b', null, 'Tags sem efeito agora'), ' (a build não compra essas Defenses): ',
        fora.map(L => `${nomeTag(L.t)} (${L.quem.map(p => p.nome).join(', ')})`).join(' · '), '.'))
    }
    card.append(h('ul', { class: 'regras nota', style: 'margin-top:10px' },
      h('li', null, 'Cada pessoa com a tag dá até 40% do preço de uma compra daquela Defense.'),
      h('li', null, 'Tudo o que uma pessoa dá, somado, não passa do preço do tier dela no passo 1a (com Power Swap ou Waifu Perk).'),
      h('li', null, 'O desconto de uma Defense vai até o preço das compras feitas, no máximo duas (resistência e imunidade).'),
      h('li', null, 'Não contam: Walk-In, Drop-In e Extra sem Power Swap, companions vendidas e Exile.')))
    return card
  }

  // ---------------------------------------------------------------- aba Heritage
  function montarHeritage() {
    const box = $('painelHeritage')
    box.replaceChildren()
    if (!est.modelo || !est.res) { box.append(cardVazio('Cole uma build na aba Build primeiro.')); return }
    const res = est.res
    const cfg = est.cfg
    if (!res.heritage.length) { box.append(cardVazio('A build não tem heritage.')); return }
    const nomeA = cfg.c1.nome || 'Contractor 1'
    const nomeB = (cfg.so && cfg.so.nome) || 'SO'
    const card = h('div', { class: 'card' }, h('div', { class: 'card-topo' },
      h('h2', null, cfg.casal ? 'De quem é cada perk' : 'Heritage'),
      h('small', null, cfg.casal ? 'cada um compra a sua; a heritage que o outro já tem sai pela metade' : 'o desconto de arquétipo de cada perk')))
    for (const her of res.heritage) {
      const item = h('div', { class: 'her' })
      item.append(h('div', null, h('b', null, her.titulo), her.escolha ? h('span', { class: 'nota' }, ` ${her.escolha}`) : null,
        h('div', { class: 'nota', style: 'margin:0' }, `Árvore: ${her.arvore || 'não achei'}`)))
      item.append(h('div', { class: 'preco' }, h('b', null, fmt(her.custo)), h('div', { class: 'nota', style: 'margin:0' }, 'preço')))
      if (cfg.casal) {
        const opcoes = [['c1', nomeA], ['so', nomeB], ['ambos-c1', `Os dois (${nomeA} compra primeiro)`], ['ambos-so', `Os dois (${nomeB} compra primeiro)`]]
        item.append(h('div', { class: 'dono' }, h('span', { class: 'nota', style: 'margin:0' }, 'De quem é'),
          lista(opcoes, cfg.donos[her.chave] || 'c1', (v) => { cfg.donos[her.chave] = v; recalcular() }, { 'aria-label': `De quem é ${her.titulo}` })))
      }
      item.append(h('div', { class: 'copias' }, her.copias.map(c => h('div', null,
        cfg.casal ? `${c.nome}: ` : '',
        c.desconto ? `arquétipo −${fmt(c.desconto)}` : 'sem desconto de arquétipo',
        c.metade ? `, metade −${fmt(c.meia)}` : '',
        ' → paga ', h('b', null, fmt(c.paga))))))
      card.append(item)
    }
    if (cfg.casal && cfg.arvoreInferida) card.append(nota(`O Interactive deu o desconto de arquétipo na árvore ${cfg.arvoreInferida}, por isso ela começou com ${cfg.c1.nome}.`))
    card.append(nota('O arquétipo de cada pessoa fica na aba Pessoas e tags.'))
    box.append(card)
  }

  // ---------------------------------------------------------------- aba Challenges
  const mesmoTitulo = (a, b) => W.normalizar(a) === W.normalizar(b)
  function requisitos(c) {
    const partes = []
    if (/chargen only/i.test(c.special || '')) partes.push('só na criação')
    if (c.minDR) partes.push(`DR ${c.minDR} ou mais`)
    if (c.semDR11) partes.push('não no DR 11')
    if ((c.blacklist || []).length) partes.push(`não combina com ${c.blacklist.join(', ')}`)
    if ((c.whitelist || []).length) partes.push(`pede ${c.whitelist.join(', ')}`)
    return partes.length ? `Requisitos: ${partes.join('; ')}.` : ''
  }

  function montarChallenges() {
    const box = $('painelChallenges')
    box.replaceChildren()
    if (!est.modelo || !est.res) { box.append(cardVazio('Cole uma build na aba Build primeiro.')); return }
    const cfg = est.cfg
    const op = cfg.opcoes
    const cc = cfg.challenges
    const rc = est.res.challenges
    const budget = est.modelo.budget

    const base = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, 'Bônus dos challenges'), h('small', null, 'a escolha vale para todas as builds')))
    base.append(nota('Alguns challenges dão uma porcentagem do budget do mundo. O Interactive só soma esse bônus com Legacy Difficulty; aqui ele entra na linha do próprio challenge, pela base que você escolher.'))
    const escolha = (valor, titulo, explicacao) => h('label', { class: `escolha${op.bonusChallenge === valor ? ' on' : ''}` },
      h('input', { type: 'radio', name: 'bonusChallenge', value: valor, checked: op.bonusChallenge === valor, onchange: () => mudarPref('bonusChallenge', valor) }),
      h('span', null, h('b', null, titulo), h('small', null, explicacao)))
    base.append(h('div', { class: 'escolhas', role: 'radiogroup', 'aria-label': 'Base do bônus dos challenges' },
      escolha('intensity', 'Com base na Intensity (budget da build)', budget != null ? `A porcentagem sai sobre o Starting budget da build, que já vem com a Intensity: ${fmt(budget)}.` : 'A build não tem a linha "Starting budget".'),
      escolha('legacy', 'Valores legados', rc.dr ? `O número do card do Interactive: a porcentagem do budget do DR ${rc.dr} na Intensity 1, ${fmt(W.budgetLegado(rc.dr))}.` : 'O número do card do Interactive: a porcentagem do budget do DR na Intensity 1. Escolha o DR abaixo.'),
      escolha('nenhum', 'Não somar', 'Como o Interactive sem Legacy Difficulty: o challenge fica "free", sem créditos.')))
    const dobrado = rc.base != null ? ` (${fmt(rc.base * 2)} em vez de ${fmt(rc.base)})` : ''
    base.append(h('label', { class: 'opcao' },
      h('input', { type: 'checkbox', checked: !!op.powerTripDobra, onchange: e => mudarPref('powerTripDobra', e.target.checked) }),
      h('span', null, 'O Power Trip dobra o budget antes dos outros bônus',
        h('small', null, `O Power Trip dá "+100% ao starting budget". Ligado, os outros challenges saem sobre o budget já dobrado${dobrado}. Desligado, cada um sai sobre o budget original, como o card do Interactive mostra.`))))
    const opcoesDR = [['', rc.drBuild ? `DR ${rc.drBuild} (achado pelo budget)` : 'Não achei pelo budget: escolha']]
    for (let d = 1; d <= 11; d++) opcoesDR.push([String(d), `DR ${d}${d <= 10 ? `, base legada ${fmt(W.budgetLegado(d))}` : ', sem budget'}`])
    base.append(h('div', { class: 'campos', style: 'margin:10px 0 0' },
      campo('DR do mundo de partida (para os valores legados)', lista(opcoesDR, cc.dr ? String(cc.dr) : '', (v) => { cc.dr = v ? parseInt(v, 10) : null; recalcular() }))))
    box.append(base)

    const naBuild = h('div', { class: 'card' }, h('div', { class: 'card-topo' },
      h('h2', null, `Nesta build (${rc.lista.length})`), rc.total ? h('small', null, `bônus somado: +${fmt(rc.total)}`) : null))
    if (!rc.lista.length) naBuild.append(h('p', { class: 'vazio', style: 'margin:0' }, 'A build não tem challenges. Ponha um na lista abaixo.'))
    for (const a of rc.lista) {
      const info = banco.challenge(a.titulo)
      const origem = { texto: 'no texto', adicionado: 'posto aqui', missao: 'veio de Mission Rewards' }[a.origem]
      const desligado = cc.semBonus.some(t => mesmoTitulo(t, a.titulo))
      const acoes = []
      if (a.bonus) {
        acoes.push(h('label', { class: 'check' }, h('input', {
          type: 'checkbox', checked: !desligado,
          onchange: (e) => { cc.semBonus = cc.semBonus.filter(t => !mesmoTitulo(t, a.titulo)); if (!e.target.checked) cc.semBonus.push(a.titulo); recalcular() },
        }), 'Somar o bônus'))
      }
      if (a.aplicado) acoes.push(h('span', { class: 'nota', style: 'margin:0' }, `${fmt(a.bonus * 100)}% de ${fmt(a.base)}`))
      if (a.origem === 'adicionado') acoes.push(botao('Tirar da build', () => { cc.adicionados = cc.adicionados.filter(t => !mesmoTitulo(t, a.titulo)); recalcular() }, 'leve'))
      naBuild.append(h('div', { class: 'chal' },
        h('div', null, h('b', null, a.titulo), ' ', h('span', { class: `selo${a.origem === 'adicionado' ? ' meu' : ''}` }, origem),
          a.bonus ? h('span', { class: 'nota' }, ` · ${fmt(a.bonus * 100)}% do budget`) : null),
        h('div', { class: `valor${a.valor ? '' : ' zero'}` }, a.valor ? `+${fmt(a.valor)}` : (a.bonus ? '+0' : 'sem bônus')),
        h('div', { class: 'det' }, info ? [info.desc || '', ' ', requisitos(info)] : 'Challenge que a ferramenta não conhece: fica como está no texto.'),
        acoes.length ? h('div', { class: 'acoes' }, acoes) : null))
    }
    box.append(naBuild)

    const ativos = new Set(rc.lista.map(a => W.normalizar(a.titulo)))
    const outros = banco.challenges().filter(c => !ativos.has(W.normalizar(c.titulo)))
    const previa = (c) => {
      if (op.bonusChallenge === 'nenhum' || !(c.bonus > 0)) return ''
      const b = mesmoTitulo(c.titulo, 'Power Trip') ? rc.base : rc.baseOutros
      return b != null ? `+${fmt(Math.round(b * c.bonus * 100) / 100)}` : '?'
    }
    const itemOutro = c => h('div', { class: 'chal' },
      h('div', null, h('b', null, c.titulo), c.bonus > 0 ? h('span', { class: 'nota' }, ` · ${fmt(c.bonus * 100)}% do budget`) : null),
      h('div', { class: `valor${previa(c) ? '' : ' zero'}` }, previa(c) || (c.bonus > 0 ? '' : 'sem bônus')),
      h('div', { class: 'det' }, c.desc || '', ' ', requisitos(c)),
      h('div', { class: 'acoes' }, botao('Pôr na build', () => { cc.adicionados.push(c.titulo); recalcular() }, 'sec')))
    const comBonus = outros.filter(c => c.bonus > 0)
    const semBonus = outros.filter(c => !(c.bonus > 0))
    const card3 = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, 'Pôr outro challenge'), h('small', null, 'a linha entra no bloco Challenges do texto')))
    if (comBonus.length) card3.append(h('h3', { style: 'margin:4px 0 2px' }, 'Com bônus de créditos'), ...comBonus.map(itemOutro))
    if (semBonus.length) {
      card3.append(h('details', { class: 'mais-campos', style: 'margin:14px 0 0' },
        h('summary', null, `Sem bônus de créditos (${semBonus.length})`), ...semBonus.map(itemOutro)))
    }
    if (!outros.length) card3.append(h('p', { class: 'vazio', style: 'margin:0' }, 'Todos os challenges já estão na build.'))
    box.append(card3)
  }

  // ---------------------------------------------------------------- aba Missões
  const assinatura = ms => JSON.stringify((ms || []).map(m => [m.titulo, m.local, (m.recompensas || []).map(r => [r.tipo, r.valor])]))
  const copiaMissoes = ms => JSON.parse(JSON.stringify(ms || []))

  function montarMissoes() {
    const box = $('painelMissoes')
    box.replaceChildren()
    if (!est.modelo || !est.res) { box.append(cardVazio('Cole uma build na aba Build primeiro.')); return }
    const cfg = est.cfg
    const convertidas = new Set(est.res.challenges.convertidas)
    const card = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, 'Mission Rewards'), h('small', null, 'recompensas de missão')))
    card.append(nota('Só as recompensas em Credits entram no saldo. Tickets, perks e companions ficam escritos no texto: o que eles dão já está comprado na build.'))
    card.append(h('div', { class: 'total-linha', id: 'totalMissoes' }))
    cfg.missoes.forEach((m, i) => {
      if (convertidas.has(m)) {
        card.append(h('div', { class: 'missao' }, h('b', null, `${m.titulo}${m.local ? ` in ${m.local}` : ''}`),
          nota(`É o bônus do challenge ${m.titulo}. Ele saiu daqui e foi para a linha do challenge, na aba Challenges.`)))
        return
      }
      card.append(cardMissao(m, i))
    })
    if (!cfg.missoes.length) card.append(h('p', { class: 'vazio' }, 'A build não tem missões. Ponha uma abaixo.'))
    card.append(h('div', { class: 'botoes' },
      botao('Nova missão', () => {
        cfg.missoes.push({ titulo: '', local: '', recompensas: [{ tipo: 'Credits', valor: '' }] })
        est.focarMissao = cfg.missoes.length - 1
        recalcular()
        montarMissoes()
      }, ''),
      assinatura(cfg.missoes) !== assinatura(est.modelo.missoes) ? botao('Voltar às missões do texto', () => { cfg.missoes = copiaMissoes(est.modelo.missoes); recalcular(); montarMissoes() }, 'leve') : null))
    box.append(card)
    atualizarMissoes()
    if (est.focarMissao != null) {
      const alvo = box.querySelectorAll('.missao input[type=text]')[est.focarMissao * 2] || box.querySelector('.missao:last-of-type input')
      est.focarMissao = null
      if (alvo) alvo.focus()
    }
  }

  function cardMissao(m, i) {
    const cfg = est.cfg
    const caixa = h('div', { class: 'missao' })
    caixa.append(h('div', { class: 'topo-missao' },
      campo('Missão', caixaTexto(m.titulo, (v) => { m.titulo = v; recalcularDepois() }, { placeholder: 'Nome da missão' })),
      h('span', { class: 'in' }, 'in'),
      campo('Onde', caixaTexto(m.local, (v) => { m.local = v; recalcularDepois() }, { placeholder: 'Mundo ou lugar' }))))
    m.recompensas.forEach((r, j) => {
      const tipos = TIPOS_RECOMPENSA.includes(r.tipo) ? TIPOS_RECOMPENSA : [r.tipo, ...TIPOS_RECOMPENSA]
      caixa.append(h('div', { class: 'recompensa' },
        lista(tipos.map(t => [t, t]), r.tipo, (v) => { r.tipo = v; recalcular() }, { 'aria-label': 'Tipo da recompensa' }),
        caixaTexto(r.valor, (v) => { r.valor = v; recalcularDepois() }, { placeholder: 'créditos, ou o que ganhou', 'aria-label': 'Valor da recompensa' }),
        botao('×', () => { m.recompensas.splice(j, 1); recalcular(); montarMissoes() }, 'leve', { 'aria-label': 'Tirar esta recompensa', title: 'Tirar esta recompensa' })))
    })
    caixa.append(h('div', { class: 'botoes', style: 'margin-top:10px' },
      botao('+ recompensa', () => { m.recompensas.push({ tipo: 'Credits', valor: '' }); recalcular(); montarMissoes() }, 'sec'),
      botao('Tirar a missão', () => { cfg.missoes.splice(i, 1); recalcular(); montarMissoes() }, 'perigo')))
    return caixa
  }

  function atualizarMissoes() {
    const el = $('totalMissoes')
    if (!el || !est.res) return
    const rm = est.res.missoes
    const sinal = n => `${n >= 0 ? '+' : ''}${fmt(n)}`
    const partes = [h('span', null, 'Créditos de missão'), h('b', null, sinal(rm.total))]
    if (est.modelo.missoesCab) partes.push(h('span', { class: 'nota', style: 'margin:0' }, Math.abs(rm.total - rm.totalTexto) > 0.01 ? `o texto dizia ${sinal(rm.totalTexto)}` : 'igual ao texto'))
    el.replaceChildren(...partes)
  }

  // ---------------------------------------------------------------- aba Retinue
  const infoMetodo = m => W.METODOS_SEQUITO[m] || { nome: m, desc: 'Marca que esta página não conhece: fica como está no texto.' }
  const infoPapel = p => (p === 'vendido' ? W.VENDIDO_SEQUITO : (W.PAPEIS_SEQUITO[p] || { nome: p, desc: 'Situação que esta página não conhece: fica como está no texto.' }))

  function montarRetinue() {
    const box = $('painelRetinue')
    box.replaceChildren()
    if (!est.modelo || !est.res) { box.append(cardVazio('Cole uma build na aba Build primeiro.')); return }
    const busca = h('input', { type: 'search', value: est.buscaSequito, placeholder: 'Procurar pelo nome ou pelo mundo', 'aria-label': 'Procurar na retinue', style: 'margin-bottom:4px' })
    busca.addEventListener('input', debounce(() => { est.buscaSequito = busca.value; atualizarRetinue() }, 150))
    box.append(h('div', { class: 'card' },
      h('div', { class: 'card-topo' }, h('h2', null, 'Retinue'), h('small', null, 'lida de Companions bought e Companions captured')),
      h('div', { id: 'resumoSequito' }),
      h('div', { class: 'filtros', id: 'filtrosSequito', role: 'group', 'aria-label': 'Filtrar a retinue' }),
      busca,
      h('div', { id: 'listaSequito' })))
    box.append(h('details', { class: 'card', open: true },
      h('summary', { style: 'cursor:pointer;font-weight:700;font-size:16px' }, 'O que cada marca quer dizer'),
      h('div', { id: 'legendaSequito' })))
  }

  function atualizarRetinue() {
    const lista = $('listaSequito')
    if (!lista || !est.res) return
    const sq = est.res.sequito
    const conta = (n, um, varios) => (n ? h('span', null, h('b', null, String(n)), ` ${n === 1 ? um : varios}`) : null)
    $('resumoSequito').replaceChildren(h('div', { class: 'resumo-sequito' },
      h('span', null, h('b', null, String(sq.ativos)), ' no séquito agora'),
      conta(sq.porPapel.Dead, 'morto', 'mortos'), conta(sq.porPapel.vendido, 'vendido', 'vendidos'),
      conta(sq.porPapel['Traded Away'], 'trocado', 'trocados'), conta(sq.porPapel.Exile, 'em Exile', 'em Exile')),
    sq.so ? nota(`${sq.so} é o contractor 2 da Couple's Account: fica na aba Pessoas e tags, não aqui.`) : '')
    const filtros = [['todos', `Todos (${sq.membros.length})`], ['ativos', `No séquito agora (${sq.ativos})`]]
    for (const [m, n] of Object.entries(sq.porMetodo)) filtros.push([`m:${m}`, `${infoMetodo(m).nome} (${n})`])
    for (const [p, n] of Object.entries(sq.porPapel)) if (p !== 'Companion') filtros.push([`p:${p}`, `${infoPapel(p).nome} (${n})`])
    if (!filtros.some(([k]) => k === est.filtroSequito)) est.filtroSequito = 'todos'
    $('filtrosSequito').replaceChildren(...(sq.membros.length ? filtros : []).map(([k, t]) => h('button', {
      type: 'button', 'aria-pressed': est.filtroSequito === k ? 'true' : 'false', onclick: () => { est.filtroSequito = k; atualizarRetinue() },
    }, t)))
    const q = W.normalizar(est.buscaSequito)
    const f = est.filtroSequito
    const passa = (x) => {
      if (f === 'ativos' && !x.ativo) return false
      if (f.startsWith('m:') && x.metodo !== f.slice(2)) return false
      if (f.startsWith('p:')) { const p = f.slice(2); if (p === 'vendido' ? !x.vendido : (x.vendido || x.papel !== p)) return false }
      return !q || W.normalizar(`${x.nome} ${x.mundo}`).includes(q)
    }
    const itens = sq.membros.filter(passa)
    lista.replaceChildren(...itens.map(itemSequito))
    if (!sq.membros.length) lista.append(h('p', { class: 'vazio', style: 'margin:0' }, 'A build não tem ninguém em Companions bought nem em Companions captured.'))
    else if (!itens.length) lista.append(nota('Ninguém com esse filtro.'))

    const dl = (titulo, mapa, contagem) => [h('h3', { style: 'margin:14px 0 0' }, titulo), h('dl', { class: 'legenda-sequito', style: 'margin:0' },
      Object.entries(mapa).flatMap(([k, v]) => [h('dt', null, v.nome, contagem[k] ? h('span', { class: 'nota' }, ` · ${contagem[k]} nesta build`) : null), h('dd', null, v.desc)]))]
    $('legendaSequito').replaceChildren(
      ...dl('Como entrou', W.METODOS_SEQUITO, sq.porMetodo),
      ...dl('Situação', { ...W.PAPEIS_SEQUITO, vendido: W.VENDIDO_SEQUITO }, sq.porPapel),
      nota('Na build, a forma de entrar fica entre colchetes, como [buy] e [yoink], e a situação entre chaves, como {Familiar}. Quem está em Companions captured entrou por captura.'))
  }

  function itemSequito(x) {
    const m = infoMetodo(x.metodo)
    const p = infoPapel(x.vendido ? 'vendido' : x.papel)
    const extras = []
    if (x.swap) extras.push(`Power Swap para ${x.swap.nome} (T${tierTxt(x.swap.tier)})`)
    if (x.perk) extras.push(`Waifu Perk ${x.perk.titulo} (T${tierTxt(x.perk.tier)})`)
    let rebate = ''
    if (!x.ativo) rebate = `${p.nome}: não dá Defense Rebates.`
    else if (x.rebates.length) rebate = `Defense Rebates: ${x.rebates.map(r => `${r.defesa} +${fmt(r.valor)}`).join(', ')}.`
    const det = [...extras, rebate].filter(Boolean).join(' · ')
    return h('div', { class: `membro${x.ativo ? '' : ' fora'}` },
      h('div', null, h('b', null, x.nome), ' ', h('span', { class: 'nota' }, x.mundo)),
      h('div', { class: 'tier' }, `T${tierTxt(x.tier)}`),
      h('div', { class: 'marcas', style: 'grid-column:1 / -1' },
        h('span', { class: 'selo metodo', title: m.desc }, m.nome),
        x.vendido || x.papel !== 'Companion' ? h('span', { class: `selo papel${x.ativo ? '' : ' ruim2'}`, title: p.desc }, p.nome) : null,
        x.id ? botao('Ver as tags', () => verTags(x.id), 'leve', { style: 'min-height:28px;padding:2px 10px;font-size:12.5px' }) : null),
      det ? h('div', { class: 'det' }, det) : null)
  }

  function verTags(id) {
    irPara('pessoas', false)
    const c = document.querySelector(`[data-pessoa="${id}"]`)
    if (c && c.scrollIntoView) {
      c.scrollIntoView({ block: 'start' })
      window.scrollBy(0, -($('topo').offsetHeight + 60))
    }
  }

  // ---------------------------------------------------------------- aba Saves
  const buildPorId = id => est.builds.find(b => b.id === id) || null
  function nomesContractors() {
    if (!est.cfg) return ''
    return est.cfg.casal && est.cfg.so ? `${est.cfg.c1.nome} & ${est.cfg.so.nome}` : est.cfg.c1.nome
  }
  const mundoCurto = m => String(m || '').replace(/\s*\[.*$/, '').trim()
  function nomePadrao() { return [nomesContractors(), mundoCurto(est.modelo && est.modelo.mundo)].filter(Boolean).join(' — ') || 'Build sem nome' }
  function resumoAtual() { return { mundo: est.modelo.mundo || '', saldo: est.res ? est.res.saldoFinal : null, contractors: nomesContractors() } }
  const nomeVersao = v => (v ? (v.rotulo || S.dataBonita(v.salvaEm)) : '')

  function salvarVersao(comoNova) {
    if (!est.modelo) { toast('Cole uma build na aba Build primeiro.'); return }
    let b = !comoNova && est.buildAtual ? buildPorId(est.buildAtual) : null
    if (b && !sujo()) { toast(`Nada mudou desde a versão ${nomeVersao(b.versoes.find(x => x.id === est.versaoAtual)) || 'salva'}.`); return }
    const agora = new Date().toISOString()
    if (!b) {
      let nome = est.nomeNovo.trim() || nomePadrao()
      if (comoNova) {
        const atual = est.buildAtual && buildPorId(est.buildAtual)
        const pedido = window.prompt('Nome da build nova', atual ? `${atual.nome} (outra linha)` : nome)
        if (pedido == null) return
        nome = pedido.trim() || nome
      }
      b = { id: S.novoId('b'), nome, criadaEm: agora, versoes: [] }
      est.builds.push(b)
    }
    const rotulo = est.rotulo.trim() || S.sugerirRotulo(b) || `versão ${b.versoes.length + 1}`
    const v = { id: S.novoId('v'), rotulo, salvaEm: agora, texto: $('entrada').value, cfg: S.compactarCfg(est.cfg), resumo: resumoAtual() }
    b.versoes.push(v)
    est.buildAtual = b.id
    est.versaoAtual = v.id
    est.assinaturaSalva = assinaturaAtual()
    est.rotulo = ''
    est.nomeNovo = ''
    const ok = salvarBuilds()
    salvar()
    montarSaves()
    atualizarEstadoSave()
    atualizarContadores()
    if (ok) toast(`Salvo em ${b.nome}: ${rotulo}.`)
  }

  function abrirVersao(b, v) {
    if (sujo() && !window.confirm('A build aberta tem mudanças que não foram salvas. Abrir outra mesmo assim? Essas mudanças se perdem.')) return false
    $('entrada').value = v.texto
    est.modelo = W.analisar(v.texto)
    try { est.cfg = W.configPadrao(est.modelo, banco, v.cfg) }
    catch (e) {
      est.cfg = W.configPadrao(est.modelo, banco, null)
      toast('As escolhas guardadas nessa versão não puderam ser lidas: ela abriu com as escolhas padrão.')
    }
    est.buildAtual = b.id
    est.versaoAtual = v.id
    est.nomeNovo = ''
    est.rotulo = ''
    reconstruir()
    est.assinaturaSalva = assinaturaAtual()
    salvar()
    atualizarEstadoSave()
    montarSaves()
    irPara('build')
    toast(`Aberta: ${b.nome}, ${nomeVersao(v)}.`)
    return true
  }

  // Texto corrigido de uma versão guardada, sem mexer na build aberta.
  function textoCorrigidoDe(v) {
    try {
      const md = W.analisar(v.texto)
      const cfg = W.configPadrao(md, banco, v.cfg)
      for (const k of ['bonusChallenge', 'powerTripDobra']) if (est.prefs[k] !== undefined) cfg.opcoes[k] = est.prefs[k]
      return W.calcular(md, cfg, banco).texto
    }
    catch (e) { return v.texto }
  }

  function baixarArquivo(nome, conteudo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/plain;charset=utf-8' }))
    const a = h('a', { href: url, download: nome })
    document.body.append(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)
  }
  function baixarVersao(b, v) { baixarArquivo(S.nomeArquivo(b, v), S.arquivoVersao(b, v, textoCorrigidoDe(v))); toast(`Baixado: ${S.nomeArquivo(b, v)}`) }
  // A build aberta como está agora, salva ou não.
  function baixarAtual() {
    if (!est.modelo) { toast('Cole uma build primeiro.'); return }
    const b0 = est.buildAtual ? buildPorId(est.buildAtual) : null
    const v0 = b0 && !sujo() ? b0.versoes.find(x => x.id === est.versaoAtual) : null
    if (b0 && v0) { baixarVersao(b0, v0); return }
    const b = b0 ? { ...b0, versoes: [] } : { id: S.novoId('b'), nome: est.nomeNovo.trim() || nomePadrao(), criadaEm: new Date().toISOString(), versoes: [] }
    const v = { id: S.novoId('v'), rotulo: est.rotulo.trim() || 'não salva', salvaEm: new Date().toISOString(), texto: $('entrada').value, cfg: S.compactarCfg(est.cfg), resumo: resumoAtual() }
    baixarArquivo(S.nomeArquivo(b, v), S.arquivoVersao(b, v, est.res ? est.res.texto : v.texto))
    toast(`Baixado: ${S.nomeArquivo(b, v)}. Ele ainda não está entre as builds salvas aqui.`)
  }
  function baixarBackupTudo() {
    const nome = `caderno-do-contractor backup ${new Date().toISOString().slice(0, 10)}.txt`
    baixarArquivo(nome, S.arquivoBackup(est.builds, { meus: est.meus, prefs: est.prefs }))
    toast(`Baixado: ${nome}`)
  }

  function renomearBuild(b) {
    const n = window.prompt('Nome da build', b.nome)
    if (n == null || !n.trim()) return
    b.nome = n.trim().slice(0, 120)
    salvarBuilds()
    montarSaves()
    atualizarEstadoSave()
  }
  function renomearVersao(b, v) {
    const n = window.prompt('Nome desta versão', v.rotulo)
    if (n == null) return
    v.rotulo = n.trim().slice(0, 120)
    salvarBuilds()
    montarSaves()
    atualizarEstadoSave()
  }
  function excluirVersao(b, v) {
    if (!window.confirm(`Excluir a versão ${nomeVersao(v)} de ${b.nome}?`)) return
    b.versoes = b.versoes.filter(x => x.id !== v.id)
    if (est.versaoAtual === v.id) { est.versaoAtual = null; est.assinaturaSalva = null }
    if (!b.versoes.length) {
      est.builds = est.builds.filter(x => x.id !== b.id)
      if (est.buildAtual === b.id) desligarSave()
    }
    salvarBuilds()
    salvar()
    montarSaves()
    atualizar()
  }
  function excluirBuild(b) {
    if (!window.confirm(`Excluir ${b.nome} e ${b.versoes.length === 1 ? 'a versão dela' : `as ${b.versoes.length} versões dela`}? Não tem como desfazer: baixe antes, se quiser guardar.`)) return
    est.builds = est.builds.filter(x => x.id !== b.id)
    if (est.buildAtual === b.id) desligarSave()
    salvarBuilds()
    salvar()
    montarSaves()
    atualizar()
  }

  async function carregarDeArquivo(arquivo) {
    let texto
    try { texto = await lerArquivoTexto(arquivo) }
    catch (e) { toast(`Não consegui ler ${arquivo.name}.`); return }
    carregarTexto(texto, arquivo.name)
  }
  function carregarTexto(texto, nome) {
    const lido = S.lerArquivo(texto)
    if (['versao', 'build', 'backup'].includes(lido.tipo)) {
      const m = S.mesclarBuilds(est.builds, lido.builds)
      est.builds = m.lista
      salvarBuilds()
      const partes = []
      if (m.buildsNovas) partes.push(`${m.buildsNovas} ${m.buildsNovas === 1 ? 'build nova' : 'builds novas'}`)
      if (m.versoesNovas) partes.push(`${m.versoesNovas} ${m.versoesNovas === 1 ? 'versão' : 'versões'}`)
      let mudouMeus = false
      if (lido.tipo === 'backup') {
        if (lido.meus && lido.meus.length) {
          const mm = W.mesclarMeus(est.meus, lido.meus.map(W.registroDeObjeto).filter(Boolean))
          est.meus = mm.lista
          salvarMeus()
          mudouMeus = mm.adicionados + mm.atualizados > 0
          if (mm.adicionados) partes.push(`${mm.adicionados} em Meus personagens`)
        }
        if (lido.prefs) { est.prefs = { ...lido.prefs, ...est.prefs }; gravar(CHAVE_PREFS, est.prefs) }
      }
      montarSaves()
      atualizarContadores()
      if (mudouMeus) aposMudarMeus()
      if (lido.tipo === 'versao' && lido.builds.length) {
        const b = buildPorId(lido.builds[0].id)
        const v = b && b.versoes.find(x => x.id === lido.builds[0].versoes[0].id)
        if (b && v && abrirVersao(b, v)) return
      }
      toast(partes.length ? `Carregado de ${nome}: ${partes.join(', ')}.` : `Tudo o que tem em ${nome} já estava salvo aqui.`)
      return
    }
    if (lido.tipo === 'texto-build') {
      if (sujo() && !window.confirm('A build aberta tem mudanças que não foram salvas. Trocar pelo texto desse arquivo mesmo assim?')) return
      $('entrada').value = lido.texto
      est.modelo = null
      est.cfg = null
      processarTexto()
      irPara('build')
      toast(`Texto de build carregado de ${nome}. Para guardar, use Salvar.`)
      return
    }
    if (lido.tipo === 'personagens') { importarTexto(lido.texto); return }
    if (lido.tipo === 'interactive') { toast('Esse é um save do próprio Interactive. Abra no Interactive, use Copy Text of Build e cole o texto aqui.'); return }
    if (lido.tipo === 'erro') { toast(lido.erro); return }
    toast('Não reconheci esse arquivo. Use um .txt baixado por esta página, ou um com o texto do Copy Text of Build.')
  }

  function linhaEstado(pend) {
    if (!est.modelo) return []
    const b = est.buildAtual ? buildPorId(est.buildAtual) : null
    const v = b ? b.versoes.find(x => x.id === est.versaoAtual) : null
    return [
      b ? h('span', null, 'Build salva: ', h('b', null, b.nome), v ? ` · versão ${nomeVersao(v)}` : '') : h('span', null, 'Esta build ainda não foi salva.'),
      h('span', { class: `selo ${pend ? 'ruim2' : 'bom'}` }, pend ? (b ? 'mudou desde que foi salva' : 'não salva') : 'tudo salvo'),
      pend ? botao(b ? 'Salvar versão nova' : 'Salvar', () => salvarVersao(false), '', { style: 'min-height:32px;padding:4px 12px' }) : null,
    ].filter(Boolean)
  }
  function atualizarEstadoSave() {
    const pend = sujo()
    const bt = $('btnSalvarTopo')
    bt.classList.toggle('pendente', pend)
    bt.title = pend ? 'Há mudanças sem salvar: salvar uma versão desta build' : 'Salvar uma versão desta build (aba Saves)'
    for (const id of ['estadoBuild', 'estadoSaves']) { const el = $(id); if (el) el.replaceChildren(...linhaEstado(pend)) }
  }

  function montarSaves() {
    const box = $('painelSaves')
    box.replaceChildren()
    const aberta = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, 'Build aberta'), h('small', null, 'salve uma versão sempre que avançar no Interactive')))
    if (!est.modelo) aberta.append(h('p', { class: 'vazio', style: 'margin:0' }, 'Cole uma build na aba Build, ou abra uma das salvas abaixo.'))
    else {
      const b = est.buildAtual ? buildPorId(est.buildAtual) : null
      aberta.append(h('div', { class: 'estado-save', id: 'estadoSaves' }))
      const nome = b
        ? h('input', { type: 'text', value: b.nome, maxlength: '120', onchange: (e) => { const n = e.target.value.trim(); if (n) { b.nome = n; salvarBuilds(); montarSaves(); atualizarEstadoSave() } else e.target.value = b.nome } })
        : caixaTexto(est.nomeNovo || nomePadrao(), (v) => { est.nomeNovo = v }, { maxlength: '120' })
      const sug = b ? S.sugerirRotulo(b) : ''
      aberta.append(h('div', { class: 'campos' },
        campo('Nome da build', nome, 'largo'),
        campo('Nome desta versão', caixaTexto(est.rotulo, (v) => { est.rotulo = v }, { maxlength: '120', placeholder: sug ? `${sug} (sugerido)` : 'ex.: +16, depois do 4º PvP' }))))
      aberta.append(h('div', { class: 'botoes', style: 'margin-top:0' },
        botao(b ? 'Salvar versão nova' : 'Salvar', () => salvarVersao(false), ''),
        b ? botao('Salvar como build nova', () => salvarVersao(true), 'sec') : null,
        botao('Baixar esta versão (.txt)', baixarAtual, 'leve')))
      aberta.append(nota('Cada versão guarda o texto colado e tudo o que você marcou aqui: tags, donos de heritage, challenges e missões. Colar de novo a mesma build (mesmo mundo e mesma origem) continua nesta build salva, pronta para a próxima versão.'))
    }
    box.append(aberta)

    const lista = est.builds.slice().sort((x, y) => S.ultima(y).salvaEm.localeCompare(S.ultima(x).salvaEm))
    const salvas = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, `Builds salvas (${lista.length})`), h('small', null, 'neste navegador')))
    if (!lista.length) salvas.append(h('p', { class: 'vazio', style: 'margin:0' }, 'Nenhuma ainda. Cole uma build e toque em Salvar, ou carregue um arquivo abaixo.'))
    for (const b of lista) salvas.append(itemBuildSalva(b))
    box.append(salvas)

    const entradaArquivo = h('input', {
      type: 'file', accept: '.txt,.json,text/plain,application/json', multiple: true, hidden: true,
      onchange: async (e) => { for (const f of [...e.target.files]) await carregarDeArquivo(f); e.target.value = '' },
    })
    const zona = h('div', { class: 'soltar' }, 'Ou solte aqui um ou mais arquivos .txt.')
    zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('em-cima') })
    zona.addEventListener('dragleave', () => zona.classList.remove('em-cima'))
    zona.addEventListener('drop', async (e) => {
      e.preventDefault()
      zona.classList.remove('em-cima')
      for (const f of [...((e.dataTransfer && e.dataTransfer.files) || [])]) await carregarDeArquivo(f)
    })
    const versoes = est.builds.reduce((a, b) => a + b.versoes.length, 0)
    const kb = Math.round(JSON.stringify(est.builds).length / 1024)
    box.append(h('div', { class: 'card' },
      h('div', { class: 'card-topo' }, h('h2', null, 'Arquivos'), h('small', null, 'para guardar fora do navegador ou levar para outro aparelho')),
      h('div', { class: 'botoes', style: 'margin:0 0 10px' },
        botao('Carregar arquivo .txt', () => entradaArquivo.click(), ''),
        botao('Baixar backup de tudo (.txt)', baixarBackupTudo, 'sec', { disabled: !est.builds.length && !est.meus.length }),
        entradaArquivo),
      zona,
      nota('Carregar aceita os arquivos que esta página baixa (uma versão, todas as versões de uma build ou o backup de tudo) e também um .txt com o texto do Copy Text of Build. Nada do que já está salvo é apagado.'),
      nota(`Neste navegador: ${est.builds.length} ${est.builds.length === 1 ? 'build' : 'builds'}, ${versoes} ${versoes === 1 ? 'versão' : 'versões'}, ${kb} KB. Limpar os dados do navegador apaga os saves; baixe um backup de vez em quando.`)))
    atualizarEstadoSave()
  }

  function itemBuildSalva(b) {
    const u = S.ultima(b)
    const aberta = b.id === est.buildAtual
    const info = [mundoCurto(u.resumo.mundo), `${b.versoes.length} ${b.versoes.length === 1 ? 'versão' : 'versões'}`, `última: ${nomeVersao(u)}, ${S.dataBonita(u.salvaEm)}`, u.resumo.saldo != null ? `saldo ${fmt(u.resumo.saldo)}` : ''].filter(Boolean).join(' · ')
    const expandida = !!est.versoesAbertas[b.id]
    const item = h('div', { class: `build-salva${aberta ? ' aberta' : ''}` },
      h('div', { class: 'cab' }, h('b', null, b.nome), h('span', { class: 'nota', style: 'margin:0' }, info)),
      h('div', { class: 'botoes' },
        botao('Abrir a última', () => abrirVersao(b, u), 'sec'),
        botao(`${expandida ? 'Fechar' : 'Ver'} versões (${b.versoes.length})`, () => { est.versoesAbertas[b.id] = !expandida; montarSaves() }, 'leve', { 'aria-expanded': expandida ? 'true' : 'false' }),
        botao('Baixar todas (.txt)', () => { baixarArquivo(S.nomeArquivo(b, null), S.arquivoBuild(b)); toast(`Baixado: ${S.nomeArquivo(b, null)}`) }, 'leve'),
        botao('Renomear', () => renomearBuild(b), 'leve'),
        botao('Excluir', () => excluirBuild(b), 'perigo')))
    if (expandida) {
      item.append(h('div', { class: 'versoes' }, b.versoes.slice().reverse().map(v => h('div', { class: `versao${v.id === est.versaoAtual ? ' atual' : ''}` },
        h('div', null, v.rotulo || '(sem nome)', ' ', h('span', { class: 'nota', style: 'margin:0' }, `${S.dataBonita(v.salvaEm)}${v.resumo.saldo != null ? ` · saldo ${fmt(v.resumo.saldo)}` : ''}${v.id === est.versaoAtual ? ' · aberta' : ''}`)),
        h('div', { class: 'acoes' },
          botao('Abrir', () => abrirVersao(b, v), 'sec'),
          botao('Baixar .txt', () => baixarVersao(b, v), 'leve'),
          botao('Renomear', () => renomearVersao(b, v), 'leve'),
          botao('Excluir', () => excluirVersao(b, v), 'perigo'))))))
    }
    return item
  }

  // ---------------------------------------------------------------- aba Meus personagens
  function registroVazio() {
    return { id: W.novoIdMeu(), nome: '', mundo: '', sub: '', tier: 1, defesas: [], arquetipos: [], base: null, fonte: 'novo', uidInteractive: null, nota: '' }
  }
  function copiaDoBanco(c) {
    return { ...registroVazio(), nome: c.nome, mundo: c.mundo, sub: c.sub, tier: c.tier || 1, defesas: c.defesas.slice(), arquetipos: c.arquetipos.slice(), base: c.idx, fonte: 'banco' }
  }

  function abrirEditor(registro, voltarPara, prefill) {
    const r = registro ? JSON.parse(JSON.stringify(registro)) : (prefill || registroVazio())
    est.editor = { r, novo: !est.meus.some(x => x.id === r.id), voltarPara: voltarPara || null }
    est.painelMeus = null
    irPara('meus')
  }
  function fecharEditor() {
    const volta = est.editor && est.editor.voltarPara
    est.editor = null
    if (volta) irPara('pessoas'); else montarMeus()
  }
  function salvarEditor() {
    const ed = est.editor
    const r = ed.r
    r.nome = String(r.nome || '').trim()
    r.mundo = String(r.mundo || '').trim()
    r.sub = String(r.sub || '').trim()
    if (!r.nome) { toast('Dê um nome ao personagem: é por ele que a build acha as tags.'); return }
    const igual = est.meus.find(x => x.id !== r.id && W.normalizar(x.nome) === W.normalizar(r.nome) && W.normalizar(x.mundo) === W.normalizar(r.mundo))
    if (igual && !window.confirm(`Já existe ${r.nome} (${r.mundo || 'sem mundo'}) em Meus personagens. Salvar outro com o mesmo nome?`)) return
    r.defesas = ORDEM.filter(t => r.defesas.includes(t))
    const i = est.meus.findIndex(x => x.id === r.id)
    if (i >= 0) est.meus[i] = r; else est.meus.push(r)
    salvarMeus()
    const volta = ed.voltarPara
    est.editor = null
    if (volta) {
      const p = pessoaPorChave(volta)
      if (p) { p.personagem = r.id; p.personagemManual = true; W.semMexidas(p) }
    }
    toast(`${r.nome} salvo em Meus personagens.`)
    aposMudarMeus()
    if (volta) irPara('pessoas'); else montarMeus()
  }
  function excluirMeu(id) {
    const r = est.meus.find(x => x.id === id)
    if (!r) return
    if (!window.confirm(`Excluir ${r.nome} de Meus personagens? Quem usa esse personagem numa build volta ao banco do Interactive.`)) return
    est.meus = est.meus.filter(x => x.id !== id)
    if (est.editor && est.editor.r.id === id) est.editor = null
    salvarMeus()
    toast(`${r.nome} excluído.`)
    aposMudarMeus()
    montarMeus()
  }

  function importarTexto(texto) {
    const lido = W.lerImportacao(texto)
    if (lido.erro) { toast(lido.erro); return }
    if (!lido.registros.length) { toast('Nenhum personagem com nome nesse texto.'); return }
    const m = W.mesclarMeus(est.meus, lido.registros)
    est.meus = m.lista
    salvarMeus()
    est.painelMeus = null
    const partes = [`${m.adicionados} ${m.adicionados === 1 ? 'novo' : 'novos'}`, `${m.atualizados} ${m.atualizados === 1 ? 'atualizado' : 'atualizados'}`]
    if (lido.ignorados) partes.push(`${lido.ignorados} sem nome ficaram de fora`)
    toast(`Importado: ${partes.join(', ')}.`)
    aposMudarMeus()
    montarMeus()
  }

  function hoje() { return new Date().toISOString().slice(0, 10) }
  function baixarBackup() {
    const url = URL.createObjectURL(new Blob([W.backupMeus(est.meus)], { type: 'application/json' }))
    const a = h('a', { href: url, download: `meus-personagens-waifu-catalog-${hoje()}.json` })
    document.body.append(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1000)
    toast('Backup baixado. Em outro aparelho: Meus personagens → Importar → Carregar arquivo.')
  }
  async function copiarBackup() {
    toast(await copiarTexto(W.backupMeus(est.meus)) ? 'Backup copiado. Cole em Meus personagens → Importar, no outro aparelho.' : 'Não consegui copiar. Use "Baixar backup".')
  }

  function montarMeus() {
    const box = $('painelMeus')
    box.replaceChildren()
    box.append(h('div', { class: 'secao' }, h('h2', null, 'Meus personagens'),
      h('p', null, 'Personagens que não estão no banco do Interactive, ou cópias com as tags do seu jeito. Quando a build cita um deles pelo nome, as tags vêm daqui. Ficam salvos neste navegador.')))
    const alternarPainel = qual => { est.painelMeus = est.painelMeus === qual ? null : qual; montarMeus() }
    box.append(h('div', { class: 'botoes', style: 'margin:0 0 14px' },
      botao('Novo personagem', () => abrirEditor(null), ''),
      botao('Copiar um do banco', () => alternarPainel('copiar'), 'sec', { 'aria-expanded': est.painelMeus === 'copiar' ? 'true' : 'false' }),
      botao('Importar', () => alternarPainel('importar'), 'sec', { 'aria-expanded': est.painelMeus === 'importar' ? 'true' : 'false' }),
      botao('Baixar backup', baixarBackup, 'leve', { disabled: !est.meus.length }),
      botao('Copiar backup', copiarBackup, 'leve', { disabled: !est.meus.length })))
    if (est.editor) box.append(cardEditor())
    if (est.painelMeus === 'importar') box.append(cardImportar())
    if (est.painelMeus === 'copiar') box.append(cardCopiarBanco())
    box.append(cardListaMeus())
  }

  function cardEditor() {
    const ed = est.editor
    const r = ed.r
    const quem = ed.voltarPara && pessoaPorChave(ed.voltarPara)
    const card = h('div', { class: 'card editor', id: 'editorMeu' }, h('div', { class: 'card-topo' },
      h('h2', null, ed.novo ? 'Novo personagem' : `Editar: ${r.nome}`),
      quem ? h('small', null, `vai ser usado para ${quem.nome} nesta build`) : null))
    const g = h('div', { class: 'campos' })
    g.append(campo('Nome (como na build)', caixaTexto(r.nome, v => { r.nome = v }, { maxlength: '120', placeholder: 'ex.: Tayzzyronth' })))
    g.append(campo('Obra (mundo)', caixaTexto(r.mundo, v => { r.mundo = v }, { maxlength: '120', placeholder: 'ex.: Honkai: Star Rail' })))
    g.append(campo('Subtítulo (opcional)', caixaTexto(r.sub, v => { r.sub = v }, { maxlength: '120', placeholder: 'ex.: Fire Moth' })))
    g.append(campo('Tier', lista(tiers, String(r.tier || 1), (v) => { r.tier = parseInt(v, 10) })))
    card.append(g)
    const b = r.base != null ? banco.personagem(r.base) : null
    if (b) {
      card.append(nota(`Cópia de ${b.nome} (${descPersonagem(b)}). No banco: ${b.defesas.map(nomeTag).join(', ') || 'nenhuma tag de Defense'}${b.arquetipos.length ? `; arquétipo ${b.arquetipos.join(', ')}` : ''}.`))
      card.append(h('div', { class: 'botoes', style: 'margin-top:6px' }, botao('Voltar às tags do banco', () => { r.defesas = b.defesas.slice(); r.arquetipos = b.arquetipos.slice(); montarMeus() }, 'leve')))
    }
    const caixaArq = h('div', { class: 'chips' })
    const pintarArq = () => caixaArq.replaceChildren(...W.ARQUETIPOS.map(a => h('button', {
      type: 'button', class: `chip${r.arquetipos.includes(a) ? ' conta' : ' desligado'}`, 'aria-pressed': r.arquetipos.includes(a) ? 'true' : 'false',
      onclick: () => { const i = r.arquetipos.indexOf(a); if (i >= 0) r.arquetipos.splice(i, 1); else r.arquetipos.push(a); pintarArq() },
    }, a)))
    pintarArq()
    card.append(h('div', { class: 'linha-tags' }, h('div', { class: 'rotulo' }, h('b', null, 'Arquétipos'), 'só contam se ele for contractor: dão o desconto de arquétipo na heritage da mesma árvore'), caixaArq))
    const caixaDef = h('div', { class: 'lista-def' })
    for (const t of ORDEM) {
      const preco = banco.precoDefesaCompleto(W.TAG_DEFESA[t])
      const rot = h('label', { class: r.defesas.includes(t) ? 'on' : null },
        h('input', { type: 'checkbox', checked: r.defesas.includes(t), onchange: (e) => {
          const i = r.defesas.indexOf(t)
          if (e.target.checked && i < 0) r.defesas.push(t)
          if (!e.target.checked && i >= 0) r.defesas.splice(i, 1)
          rot.classList.toggle('on', e.target.checked)
        } }),
        h('span', null, h('b', null, nomeTag(t)), preco != null ? h('span', { class: 'nota' }, ` · ${fmt(preco)}/compra`) : null, h('small', null, `a pessoa ${W.CONDICAO_DEFESA[t]}`)))
      caixaDef.append(rot)
    }
    card.append(h('div', { class: 'linha-tags' }, h('div', { class: 'rotulo' }, h('b', null, 'Tags de Defense'), 'marque só as condições que o personagem cumpre no cânone'), caixaDef))
    const caixaNota = h('textarea', { rows: '2', maxlength: '500', oninput: (e) => { r.nota = e.target.value } })
    caixaNota.value = r.nota || ''
    card.append(h('div', { class: 'campos', style: 'margin-top:14px' }, campo('Nota (opcional, só para você)', caixaNota, 'largo')))
    card.append(h('div', { class: 'botoes' },
      botao('Salvar', salvarEditor, ''),
      botao('Cancelar', fecharEditor, 'leve'),
      !ed.novo ? botao('Excluir', () => excluirMeu(r.id), 'perigo') : null))
    return card
  }

  function cardImportar() {
    const area = h('textarea', { rows: '6', spellcheck: 'false', placeholder: 'Cole aqui o que o Export copiou (começa com [ ). Também aceita um backup desta ferramenta.' })
    const arquivo = h('input', { type: 'file', accept: '.json,.txt,application/json,text/plain', hidden: true, onchange: async (e) => { const f = e.target.files[0]; if (f) importarTexto(await lerArquivoTexto(f)) } })
    return h('div', { class: 'card' },
      h('div', { class: 'card-topo' }, h('h2', null, 'Importar do Interactive'), h('small', null, 'ou um backup desta ferramenta')),
      h('ol', { class: 'passos' },
        h('li', null, 'No Interactive, abra a página ', h('b', null, 'Companions'), ' e toque na engrenagem ⚙ ao lado de ', h('b', null, 'Add Character'), '.'),
        h('li', null, 'Em ', h('b', null, 'Search Settings'), ', toque em ', h('b', null, 'Import / Export'), ' e depois em ', h('b', null, 'Export'), '. Isso copia os seus personagens locais.'),
        h('li', null, 'Cole abaixo e toque em ', h('b', null, 'Importar'), '. Quem já estiver aqui é atualizado, sem duplicar.')),
      area,
      h('div', { class: 'botoes' },
        botao('Importar', () => importarTexto(area.value), ''),
        botao('Colar', () => colarEm(area), 'sec'),
        botao('Carregar arquivo', () => arquivo.click(), 'leve'),
        arquivo),
      nota('Entram o nome, a obra, o tier e as tags de Defense e de arquétipo. A imagem e as outras tags ficam no Interactive.'))
  }

  function cardCopiarBanco() {
    const card = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, 'Copiar um personagem do banco'), h('small', null, 'a cópia é sua: mude as tags, o tier, o que quiser')))
    if (banco.semDados) { card.append(h('p', { class: 'vazio', style: 'margin:0' }, 'O banco do Interactive não carregou.')); return card }
    const busca = h('input', { type: 'search', value: est.buscaCopiar, placeholder: 'Nome no banco do Interactive (ex.: Elysia)', 'aria-label': 'Procurar no banco do Interactive' })
    const res = h('div', { class: 'resultados' })
    const preencher = () => {
      est.buscaCopiar = busca.value
      const t = busca.value.trim()
      const achados = t ? banco.procurar(t, 30, true) : []
      res.replaceChildren(...achados.map(c => h('button', { type: 'button', onclick: () => abrirEditor(null, null, copiaDoBanco(c)) },
        h('span', null, h('b', null, c.nome), ' ', h('small', null, descPersonagem(c))), h('small', null, c.defesas.map(nomeTag).join(', ')))))
      if (t && !achados.length) res.append(nota('Nada com esse nome no banco.'))
    }
    busca.addEventListener('input', debounce(preencher, 180))
    preencher()
    card.append(busca, res)
    return card
  }

  function cardListaMeus() {
    const card = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, `Salvos (${est.meus.length})`)))
    if (!est.meus.length) {
      card.append(h('p', { class: 'vazio', style: 'margin:0' }, 'Nenhum ainda. Crie um, copie um do banco ou importe os seus do Interactive.'))
      return card
    }
    const caixa = h('div')
    const usados = new Set(pessoasDaBuild().map(p => p.personagem).filter(id => typeof id === 'string'))
    const pintar = () => {
      const f = W.normalizar(est.filtroMeus)
      const itens = est.meus.filter(r => !f || W.normalizar(`${r.nome} ${r.mundo} ${r.sub}`).includes(f)).sort((a, b) => a.nome.localeCompare(b.nome))
      caixa.replaceChildren(...itens.map(r => h('div', { class: 'meu-item' },
        h('div', null, h('b', null, r.nome), ' ', h('span', { class: 'nota' }, `${r.mundo || 'sem mundo'}${r.sub ? ` · ${r.sub}` : ''} · T${tierTxt(r.tier)}`),
          usados.has(r.id) ? [' ', h('span', { class: 'selo bom' }, 'nesta build')] : null,
          r.fonte === 'interactive' ? [' ', h('span', { class: 'selo' }, 'do Interactive')] : (r.base != null ? [' ', h('span', { class: 'selo' }, 'cópia do banco')] : null),
          r.nota ? h('div', { class: 'nota', style: 'margin:2px 0 0' }, r.nota) : null),
        h('div', { class: 'acoes' }, botao('Editar', () => abrirEditor(r), 'leve'), botao('Excluir', () => excluirMeu(r.id), 'perigo')),
        h('div', { class: 'chips' },
          r.arquetipos.map(a => h('span', { class: 'chip' }, a)),
          ORDEM.filter(t => r.defesas.includes(t)).map(t => h('span', { class: 'chip conta' }, nomeTag(t))),
          !r.arquetipos.length && !r.defesas.length ? h('span', { class: 'nota', style: 'margin:0' }, 'sem tags') : null))))
      if (!itens.length) caixa.append(nota('Nenhum com esse nome.'))
    }
    if (est.meus.length > 6) {
      const filtro = h('input', { type: 'search', value: est.filtroMeus, placeholder: 'Filtrar pelo nome ou pela obra', 'aria-label': 'Filtrar Meus personagens', style: 'margin-bottom:10px' })
      filtro.addEventListener('input', debounce(() => { est.filtroMeus = filtro.value; pintar() }, 150))
      card.append(filtro)
    }
    pintar()
    card.append(caixa)
    return card
  }

  // ---------------------------------------------------------------- aba Regras
  function montarRegras() {
    const box = $('painelRegras')
    box.replaceChildren()
    const cfg = est.cfg
    const card1 = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, 'Escolhas de regra'), h('small', null, 'onde as regras deixam dúvida; valem para a build aberta')))
    if (!cfg) card1.append(h('p', { class: 'vazio', style: 'margin:0' }, 'Cole uma build primeiro.'))
    else {
      const op = cfg.opcoes
      const opcao = (chave, titulo, explicacao, soCasal) => {
        if (soCasal && !cfg.casal) return null
        return h('label', { class: 'opcao' },
          h('input', { type: 'checkbox', checked: !!op[chave], onchange: (e) => { op[chave] = e.target.checked; reconstruir() } }),
          h('span', null, titulo, h('small', null, explicacao)))
      }
      card1.append(...[
        opcao('origemMaisCara', 'Só a origem mais cara é paga', "Regra da Couple's Account: a origem mais barata dos dois sai de graça.", true),
        opcao('perkContaNaOrigem', 'Waifu Perk e Power Swap da origem entram no preço da origem', 'Ligado: Rimuru T7 + Reaping the Harvest conta como uma origem de 500. Desligado: a origem vale só o tier de base, e a Waifu Perk é paga à parte.', true),
        opcao('soArquetipo', 'O SO ganha desconto de arquétipo', 'Pelo tier da origem dele, nas heritages que combinam com ele.', true),
        opcao('soRebates', 'As tags do SO contam nos Defense Rebates', 'O Interactive não conta o SO (o preço dele lá fica zerado). Ligado, o SO entra como a origem do contractor 1.', true),
        opcao('brindes2aCopia', 'Na 2ª cópia de uma heritage, somar os brindes de novo', 'Os Talents e Defenses grátis da heritage entram outra vez; o que passar do limite volta como desconto de repetido, como no Interactive.', true),
        opcao('resumoNoFim', 'Escrever no fim do texto quem é cada contractor', 'Um bloco curto com a origem, o arquétipo e as heritages de cada um, para a LLM não confundir.', true),
        opcao('manterDiferencas', 'Manter as diferenças que o texto não explica', 'Quando uma linha não fecha a conta (custo escondido ou edição à mão), mantém a diferença em vez de refazer o saldo.', false),
      ].filter(Boolean))
      if (!cfg.casal) card1.append(nota("As outras opções aparecem quando a build tem Couple's Account."))
    }
    const card2 = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, 'O que a ferramenta faz')), h('ul', { class: 'regras' },
      h('li', null, 'Refaz o saldo de cada linha pelo custo escrito nela e aponta onde a conta não fecha.'),
      h('li', null, "Na Couple's Account: tira o SO de Companions bought e põe a origem dele junto da sua; só a mais cara das duas origens é paga."),
      h('li', null, 'Separa o desconto de arquétipo por contractor: cada um desconta, com teto de 80% em cada perk, o preço do próprio tier no passo 1a (com Waifu Perk ou Power Swap), só nas árvores que combinam com ele.'),
      h('li', null, 'Heritage que os dois compram: o segundo paga metade do preço que sobra depois dos descontos dele, sem o teto de 80%.'),
      h('li', null, 'Defense Rebates: cada pessoa com a tag dá até 40% de uma compra da Defense, até o preço do tier dela no total, na mesma ordem do Interactive. Só contam as Defenses que a build compra.'),
      h('li', null, 'As tags vêm do banco do Interactive ou de Meus personagens. As que você marca ou tira à mão valem só para a build aberta, e as que mudam a conta aparecem nos Avisos.'),
      h('li', null, 'Challenges: o bônus em créditos entra na linha do challenge, sobre o budget da build (com a Intensity) ou pelos valores legados, como você escolher na aba Challenges. Bônus lançado à mão em Mission Rewards ("Power Trip in Challenges") vai para a linha do challenge, sem contar duas vezes.'),
      h('li', null, 'Mission Rewards: soma as recompensas em Credits e escreve uma missão e uma recompensa por linha.'),
      h('li', null, 'Retinue: lê como cada membro entrou ([buy], [yoink], [used], captura…) e a situação dele ({Familiar}, {Dead}, --SOLD…). Quem está morto, vendido, trocado ou em Exile não dá Defense Rebates.'),
      h('li', null, 'Saves: guarda versões de cada build neste navegador e em arquivos .txt, que dá para carregar de novo aqui.'),
      h('li', null, 'Template Stacking e Waifu Perks são por pessoa e ficam como estão; o resto vale para os dois.')))
    const dados = banco.semDados
      ? h('p', { class: 'aviso erro' }, 'Não achei os dados do Interactive. As árvores de heritage e as tags dos personagens terão de ser marcadas à mão (ou vir de Meus personagens).')
      : h('p', { style: 'margin:0' }, `Dados do Interactive de ${banco.geradoEm}: ${banco.totalPersonagens.toLocaleString('pt-BR')} personagens, preços de heritage, Talents e Defenses.`)
    const card3 = h('div', { class: 'card' }, h('div', { class: 'card-topo' }, h('h2', null, 'Dados')), dados, h('ul', { class: 'regras nota', style: 'margin-top:8px' },
      h('li', null, 'Para atualizar quando o Interactive mudar, rode ferramentas/atualizar-dados.bat no PC (precisa do Node.js). Ele baixa os dados e refaz esta página.'),
      h('li', null, 'Personagens que você criou no Interactive ficam só no navegador de lá: traga com Meus personagens → Importar.'),
      h('li', null, 'A build aberta, os Saves e Meus personagens ficam só neste navegador. Para levar a outro aparelho, use o backup de tudo, na aba Saves.'),
      h('li', null, 'Regras resumidas do repositório coletania-fanfics-markin (pasta waifu-catalog/referencia). Dados e fórmulas do Interactive (waifu-catalog.neocities.org).')))
    box.append(card1, card2, card3)
  }

  // ---------------------------------------------------------------- resultado
  function atualizarResultado() {
    const res = est.res
    const sf = $('saldoFinal')
    const sa = $('saldoAntes')
    if (!est.modelo || !res) {
      sf.textContent = '—'
      sf.className = ''
      sa.textContent = ''
      $('blocoAvisos').replaceChildren()
      $('blocoMudancas').replaceChildren(h('p', { class: 'vazio', style: 'margin:0' }, 'Cole uma build na aba Build. O resultado aparece aqui.'))
      $('blocoConferencia').replaceChildren()
      $('saida').value = ''
      $('saidaLinhas').replaceChildren()
      return
    }
    sf.textContent = fmt(res.saldoFinal)
    sf.className = res.saldoFinal < 0 ? 'negativo' : ''
    sa.textContent = res.saldoOriginal != null && Math.abs(res.saldoOriginal - res.saldoFinal) > 0.001 ? `(antes ${fmt(res.saldoOriginal)})` : ''
    const ordem = { erro: 0, aviso: 1, info: 2 }
    const avisos = res.avisos.slice().sort((a, b) => ordem[a.nivel] - ordem[b.nivel])
    $('blocoAvisos').replaceChildren(...(avisos.length ? [h('h3', null, 'Avisos'), ...avisos.map(a => h('p', { class: `aviso ${a.nivel}` }, a.texto))] : []))
    $('blocoMudancas').replaceChildren(h('h3', null, 'O que mudou'),
      res.mudancas.length ? h('ul', { class: 'lista' }, res.mudancas.map(m => h('li', null, m))) : h('p', { class: 'vazio', style: 'margin:0' }, 'Nada: a build já estava certa.'))
    const conf = h('div', null, h('h3', null, 'Conferência dos descontos'), nota('O que o Interactive escreveu e o que a conta dá.'))
    for (const c of res.conferencia) {
      if (!c.texto && !c.recalculado) continue
      const igual = Math.abs(c.texto - c.recalculado) < 0.001
      let usar
      if (igual) usar = h('span', { class: 'selo bom' }, 'bate')
      else if (c.travado) usar = h('span', { class: 'nota', style: 'margin:0' }, "Usa o recalculado (sempre, na Couple's Account).")
      else usar = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: c.usado, onchange: (e) => { est.cfg.usar[c.chave] = e.target.checked; recalcular() } }), 'Usar o recalculado')
      conf.append(h('div', { class: 'conf' },
        h('b', null, c.rotulo),
        h('span', { class: 'num' }, h('small', null, 'texto '), `+${fmt(c.texto)}`),
        h('span', { class: 'num' }, h('small', null, 'conta '), `+${fmt(c.recalculado)}`),
        c.detalhe ? h('span', { class: 'det' }, c.detalhe) : null,
        h('span', { class: 'usar' }, usar)))
    }
    $('blocoConferencia').replaceChildren(conf)
    $('saida').value = res.texto
    $('saidaLinhas').replaceChildren(...res.linhasTela.map(l => h('div', { class: l.estado, title: l.antes ? `Antes: ${l.antes}` : null }, l.texto || ' ')))
  }

  async function copiarResultado() {
    const texto = est.res ? est.res.texto : ''
    if (!texto) { toast('Nada para copiar: cole uma build primeiro.'); return }
    toast(await copiarTexto(texto) ? 'Texto corrigido copiado. É só colar na LLM.' : 'Não consegui copiar. Abra "Texto corrigido" e copie à mão.')
  }

  // ---------------------------------------------------------------- início
  function iniciar() {
    const prefs = ler(CHAVE_PREFS)
    est.prefs = prefs && typeof prefs === 'object' ? prefs : {}
    const salvas = ler(CHAVE_BUILDS)
    est.builds = Array.isArray(salvas) ? salvas.map(S.limparBuild).filter(Boolean) : []
    est.meus = (Array.isArray(ler(CHAVE_MEUS)) ? ler(CHAVE_MEUS) : []).map(W.registroDeObjeto).filter(Boolean)
    banco.definirMeus(est.meus)

    $('entrada').addEventListener('input', debounce(processarTexto, 150))
    $('btnColar').addEventListener('click', () => colarEm($('entrada')))
    const podeTrocar = () => !sujo() || !est.buildAtual || window.confirm('A build aberta tem mudanças que não foram salvas. Trocar mesmo assim? Essas mudanças se perdem.')
    $('btnExemplo').addEventListener('click', () => { if (!podeTrocar()) return; $('entrada').value = window.WC_EXEMPLO || ''; est.modelo = null; est.cfg = null; processarTexto() })
    $('btnLimpar').addEventListener('click', () => { if (!podeTrocar()) return; $('entrada').value = ''; est.modelo = null; est.cfg = null; processarTexto(); $('entrada').focus() })
    $('chkCasal').addEventListener('change', (e) => {
      if (!est.modelo) { e.target.checked = false; return }
      est.cfg = W.configPadrao(est.modelo, banco, Object.assign({}, est.cfg, { casalForcado: e.target.checked }))
      reconstruir()
    })
    $('btnCopiar').addEventListener('click', copiarResultado)
    $('btnCopiar2').addEventListener('click', copiarResultado)
    $('btnSalvarTopo').addEventListener('click', () => salvarVersao(false))
    for (const b of document.querySelectorAll('#abas [role=tab]')) b.addEventListener('click', () => irPara(b.dataset.aba))
    for (const b of document.querySelectorAll('.subabas [data-sub]')) b.addEventListener('click', () => { irParaSub(b.dataset.sub); salvar() })
    $('abas').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const visiveis = [...document.querySelectorAll('#abas [role=tab]')].filter(b => b.offsetParent !== null)
      const i = visiveis.indexOf(document.activeElement)
      if (i < 0) return
      const prox = visiveis[(i + (e.key === 'ArrowRight' ? 1 : -1) + visiveis.length) % visiveis.length]
      prox.focus()
      irPara(prox.dataset.aba, false)
      e.preventDefault()
    })
    const aoMudarLargura = () => { if (largo.matches && est.aba === 'resultado') irPara('build', false) }
    if (largo.addEventListener) largo.addEventListener('change', aoMudarLargura); else largo.addListener(aoMudarLargura)
    const topo = $('topo')
    const medir = () => document.documentElement.style.setProperty('--alt-topo', `${topo.offsetHeight}px`)
    if (window.ResizeObserver) new ResizeObserver(medir).observe(topo)
    window.addEventListener('resize', medir)
    medir()

    const params = new URLSearchParams(location.search)
    const salvo = ler(CHAVE) || ler(CHAVE_V1)
    if (params.has('exemplo')) { $('entrada').value = window.WC_EXEMPLO || ''; processarTexto() }
    else if (salvo && salvo.texto) {
      $('entrada').value = salvo.texto
      est.modelo = W.analisar(salvo.texto)
      try { est.cfg = W.configPadrao(est.modelo, banco, salvo.cfg || null) }
      catch (e) { est.cfg = W.configPadrao(est.modelo, banco, null) }
      // A build aberta continua ligada à build salva de onde veio.
      if (salvo.buildAtual && buildPorId(salvo.buildAtual)) { est.buildAtual = salvo.buildAtual; est.versaoAtual = salvo.versaoAtual || null }
      reconstruir()
      if (salvo.limpo && est.buildAtual) { est.assinaturaSalva = assinaturaAtual(); atualizarEstadoSave(); salvar() }
    }
    else montarTudo()
    irParaSub(params.get('sub') || (salvo && salvo.sub) || 'resumo')
    irPara(params.get('aba') || (salvo && salvo.aba) || 'build', false)
  }

  iniciar()
})()
