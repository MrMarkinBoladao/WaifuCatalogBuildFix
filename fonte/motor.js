/*
 * motor.js — as contas do Caderno do Contractor (Waifu Catalog), com foco na Couple's Account (Cooperative).
 *
 * Lê o "Copy Text of Build" do Interactive, refaz as contas e devolve o texto corrigido.
 * Funciona no navegador (window.WCFix) e no Node (globalThis.WCFix). Não tem dependências.
 *
 * Regras usadas (resumo do repositório coletania-fanfics-markin, pasta waifu-catalog/referencia):
 *  - Couple's Account: só se paga a mais cara das duas origens; heritage é comprada por pessoa,
 *    e cada um compra pela metade (depois de todos os descontos, sem o teto de 80%) a heritage
 *    que o outro já tem; Template Stacking e Waifu Perks são por pessoa; o resto vale para os dois.
 *  - Desconto de arquétipo: o preço do tier da pessoa no passo 1a (com Waifu Perk ou Power Swap),
 *    com teto de 80% em cada perk, só nas árvores que combinam com a pessoa.
 *  - Defense Rebates: cada pessoa com a tag dá até 40% de uma compra da Defense, até o preço do
 *    tier dela no total; a conta segue a do Interactive (mesma ordem e mesmos tetos).
 *  - Talents e Defenses repetidos: a cópia a mais devolve o preço de lista, como no Interactive.
 *  - DRX start (Danger Rating X), pelas regras do Interactive: em vez do budget, quatro verbas (Heritage 400,
 *    Catch-a-Ride 545, Demiplanes & Dungeons 500, outros perks oficiais 600); origem, uma binding básica, os Lures
 *    básicos, os Talents básicos, as duas compras de cada Defense e a companion de tier X ou Y saem de graça. O que
 *    sobra vai para a conta normal e só pode ser usado 7 dias depois do fim da criação.
 *  - Criação (chargen): quando ela fecha, a página guarda uma foto da build. Dali em diante, o que muda é comparado
 *    com a foto: o que só vale na criação vira aviso, e o que foi devolvido segue a regra de reembolso.
 *
 * Tags de cada pessoa: vêm do personagem escolhido (banco do Interactive ou "Meus personagens"),
 * mais as marcadas à mão na build, menos as tiradas à mão. A conta guarda só a diferença, então
 * editar um personagem de "Meus personagens" muda todas as builds que usam ele.
 */
(function (raiz) {
  'use strict'

  // ------------------------------------------------------------------ constantes

  const PRECO_TIER = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]

  const TAG_DEFESA = {
    st: 'Body Defense', hr: 'Wild Defense', hz: 'Environmental Defense', mt: 'Creature Defense',
    cl: 'Stress Defense', ml: 'Addiction Defense', ps: 'Mind Defense', bj: 'Possession Defense',
    dr: 'Drain Defense', id: 'Fatality Defense', pl: 'Polymorph Defense', ur: 'Wyldscape Defense',
    cr: 'Corruption Defense', sc: 'Information Defense', di: 'Trace Defense', fm: 'Destiny Defense',
    tm: 'Paradox Defense',
  }
  const DEFESA_TAG = Object.fromEntries(Object.entries(TAG_DEFESA).map(([k, v]) => [v, k]))
  const ORDEM_DEFESA = Object.keys(TAG_DEFESA)

  // Tags de personagem do Interactive que batem com uma árvore de heritage.
  const TAG_ARQUETIPO = { dg: 'Dragon', th: 'Transhuman', ot: 'Outsider', pp: 'Psychopomp', pi: 'Pirate', cu: 'Cultivator', mm: 'Mahoushoujo', ph: 'Phoenix' }

  const ARQUETIPOS = ['Dragon', 'Transhuman', 'Phoenix', 'Theos', 'Outsider', 'Pirate', 'Psychopomp', 'Wendigo', 'Mastermind',
    'Infernal', 'Mahoushoujo', 'Transmigrator', 'Celestial', 'Protean', 'Cultivator', 'Therianthrope', 'Lilitu', 'Undead', 'Lunarian', 'Machina']

  // Condição de cada Defense para o Defense Rebate, traduzida do campo "special" de cada Defense no Interactive.
  // Sujeito: "a pessoa".
  const CONDICAO_DEFESA = {
    st: 'é conhecida por trabalhar com doenças, remédios químicos ou venenos',
    hr: 'vem de um clima hostil',
    hz: 'consegue ignorar ambientes perigosos',
    mt: 'é conhecida por domar monstros ou por ter jeito com bichos',
    cl: 'é conhecida por manter a cabeça fria ou por ter muita força de vontade',
    ml: 'é conhecida por ter um vício material',
    ps: 'é conhecida como telepata ou manipuladora de mentes',
    bj: 'é conhecida por tomar o corpo dos outros',
    dr: 'drena ou se alimenta de vida, mana ou almas',
    id: 'é conhecida por causar morte instantânea ou por não morrer mesmo quando é morta',
    pl: 'é conhecida por transformar os outros',
    ur: 'vem de uma região onde a realidade local é instável',
    cr: 'é conhecida por trazer à força o lado sombrio dos outros',
    sc: 'é conhecida por saber ler ou sentir as pessoas',
    di: 'é conhecida por usar adivinhação ou outra visão à distância que não seja tecnológica',
    fm: 'é conhecida por manipular o destino ou a sorte',
    tm: 'é conhecida por manipular o tempo',
  }

  // Challenges do Interactive (página Challenges, novembro de 2026). bonus: fração do budget do mundo que o
  // desafio dá. minDR / semDR11 / blacklist / whitelist: requisitos. desc: resumo do repositório, em português.
  // O arquivo de dados pode trazer uma lista mais nova; esta vale quando ele não tem.
  const CHALLENGES_PADRAO = [
    { titulo: 'Two Dime', minDR: 4, desc: 'Budget de 20 créditos; empréstimo só depois de 3 capturas.' },
    { titulo: 'Freedom Anomaly', desc: 'Num mundo de nome censurado, nenhuma binding funciona, só a captura por confissão.' },
    { titulo: 'Waifu Manager', minDR: 7, desc: 'Poder pessoal travado no tier 4; a captura paga 80% em vez de 60%.' },
    { titulo: 'Strict Travel Mode', desc: 'Fora do Exit Stage Left, só viaja para mundos já visitados.' },
    { titulo: 'Wild GIRLFRIEND appeared!', desc: 'A binding só pega em quem foi derrotado e está inconsciente.' },
    { titulo: '100,000 years of cultivation', desc: '100.000 anos numa bolha de tempo antes do primeiro mundo, sem companions; dá Pocket Space, Pocket Apartment x2, Everlasting e Stress x2.' },
    { titulo: 'Russian roulette', desc: 'A cada captura ou compra, um sexto do séquito tem 1 chance em 6 de se soltar.' },
    { titulo: 'Power Trip', bonus: 1, semDR11: true, blacklist: ['Wage Slave', 'Black-mark', 'Fight For Your Right', 'One In Ten'], desc: 'Só cliente: não vende capturas e, fora as companions, não compra nem devolve nada depois da criação.' },
    { titulo: 'Good Luck Smiles on the Daring', bonus: 0.5, semDR11: true, desc: 'O mundo de partida é sorteado.' },
    { titulo: 'Skyblock', semDR11: true, blacklist: ['Wage Slave', 'Cash Still Rules', 'Calming Up'], desc: 'Começa num bloco de terra no céu de um mundo vazio, com 0 créditos.' },
    { titulo: 'Glass Cannon', bonus: 0.8, minDR: 6, semDR11: true, desc: 'Nenhuma Defense da Company.' },
    { titulo: 'Natural Progression', desc: 'Todo poder e perk comprado começa do zero e cresce com tempo e esforço.' },
    { titulo: 'Lost Goods', bonus: 0.4, desc: 'Chega ao mundo sem memória nenhuma, sem volta.' },
    { titulo: 'Frog in a Well', bonus: 0.2, desc: 'O mundo de partida é o único visitado.' },
    { titulo: 'No Continues', bonus: 0.8, desc: 'Morreu, acabou: sem ressurreição e sem o prazo do R.I.P.' },
    { titulo: 'Forgetful Hopper', bonus: 0.6, desc: 'A cada mundo novo, esquece o mundo, o séquito e os poderes, e recupera aos poucos.' },
    { titulo: 'Worthy Opponent', desc: 'Em cada mundo, um inimigo tão forte quanto o contractor, ou mais.' },
    { titulo: 'Insider information', whitelist: ['Worthy Opponent'], desc: 'O inimigo sabe do contrato e conhece a Company.' },
    { titulo: 'Time Bomb Situation', whitelist: ['Worthy Opponent'], desc: 'Prazo para derrotar o inimigo; se falhar, o mundo é apagado.' },
    { titulo: 'Eternal Rivalry', desc: 'Um contractor rival, com placar por rodada.' },
    { titulo: 'Random Encounters', desc: 'Muito mais encontros com contractors inimigos.' },
    { titulo: 'Rebellious Brats', bonus: 0.1, desc: 'Os filhos tentam matar o contractor, e os descendentes são imunes às bindings.' },
    { titulo: 'Small Team', desc: 'Séquito de até 5 membros; o resto vira Exile.' },
    { titulo: 'Angry Kaiju from Outer Dimension', desc: 'Kaiju atacam a cada mundo novo.' },
  ]

  // Séquito (Retinue): como cada membro entrou (a marca entre colchetes em "Companions bought";
  // "Companions captured" não tem marca e é captura) e a situação dele (a marca entre chaves).
  const METODOS_SEQUITO = {
    buy: { nome: 'Comprado', desc: 'Comprado na Company: um clone feito sob encomenda, que chega preso por um Seal of Approval.' },
    capture: { nome: 'Capturado', desc: 'Capturado no mundo por uma binding, um lure ou controle mental. Rende o valor de captura.' },
    yoink: { nome: 'Yoink', desc: 'A pessoa original do mundo de partida, trazida até você pelo Yoink. Custa 20% a mais e só vale na criação.' },
    used: { nome: 'Usado', desc: 'Slightly Used: já foi de outro contractor. Sai 30% mais barato e chega sem as Defenses, os Talents e as bindings do dono anterior.' },
    unbound: { nome: 'Sem binding', desc: 'Entrou no séquito sem binding: o SO da Couple\'s Account, quem se soltou na Russian roulette ou quem veio de graça por um challenge.' },
    steal: { nome: 'Tirado de outro contractor', desc: 'Capturado do séquito de outro contractor, no PvP ou em outra situação. Não paga captura, mas pode ser vendido pelo valor normal.' },
    pvp: { nome: 'Tirado no PvP', desc: 'Capturado do séquito de outro contractor no PvP. Não paga captura, mas pode ser vendido pelo valor normal.' },
    you: { nome: 'Você', desc: 'A sua própria ficha, quando o Interactive põe o contractor na lista do séquito.' },
  }
  const PAPEIS_SEQUITO = {
    Companion: { nome: 'Companion', desc: 'Membro do harém, com todos os efeitos da binding.' },
    Follower: { nome: 'Follower', desc: 'Membro fora do harém: equipe de apoio, bicho de estimação, filho adotado. A binding não traz o interesse romântico.' },
    Familiar: { nome: 'Familiar', desc: 'Minion, summon, bicho ou montaria pessoal. A binding não traz o interesse romântico e sexual.' },
    Devotee: { nome: 'Devotee', desc: 'Dedicado a uma Dungeon ou a outro produto da Company: enquanto se dedica, dá Devotion Points pelo preço do tier dele.' },
    Offspring: { nome: 'Filho (Offspring)', desc: 'Descendente seu ou do séquito: faz parte dele desde o nascimento e não paga captura nem venda.' },
    Dead: { nome: 'Morto', desc: 'Morreu e não está ativo. Enquanto estiver morto, não dá Defense Rebate: perder alguém do séquito tira o desconto dele.' },
    'Traded Away': { nome: 'Trocado (Traded Away)', desc: 'Passou para outro dono numa troca. Não conta mais no séquito nem nos Defense Rebates.' },
    Exile: { nome: 'Exile', desc: 'Passou do limite do Small Team: não recebe nem dá benefícios do catálogo, como Defenses, Talents e Defense Rebates.' },
  }
  const VENDIDO_SEQUITO = { nome: 'Vendido', desc: 'Vendido de volta à Company por créditos (--SOLD na build). Não conta mais no séquito nem nos Defense Rebates.' }
  const FORA_DOS_REBATES = ['Exile', 'Traded Away', 'Dead']

  // DRX start (Danger Rating X), pelas "Danger Rating X Build Rules" do Interactive: a criação não tem budget comum,
  // e sim estas verbas. O que sobra delas vai para a conta normal e só pode ser usado 7 dias (168 horas) depois.
  const VERBAS_DRX = [
    { chave: 'heritage', nome: 'Heritage', ingles: 'Heritage', total: 400 },
    { chave: 'rides', nome: 'Catch-a-Ride', ingles: 'Catch-a-Ride', total: 545 },
    { chave: 'casa', nome: 'Demiplanes & Dungeons', ingles: 'Demiplanes & Dungeons', total: 500 },
    { chave: 'outros', nome: 'Outros perks oficiais', ingles: 'Other official perks', total: 600 },
  ]
  const TOTAL_DRX = VERBAS_DRX.reduce((a, v) => a + v.total, 0)
  // Blocos do texto que têm verba própria. O resto (Bindings, Lures, Talents, Misc Perks…) sai da verba de 600.
  const VERBA_DO_BLOCO = { Heritage: 'heritage', Rides: 'rides', 'Home Perks': 'casa' }
  // De graça no DRX start: os Talents básicos (os 16 primeiros do Interactive) e os Lures básicos (os cinco Sensory
  // Lures do documento). A lista de bindings básicas vale quando o arquivo de dados não tem a dele.
  const TALENTS_BASICOS = ['Body Tune-Up', 'Everlasting', 'Athletic', 'Martial', 'Wild', 'Science', 'Engineering', 'Aesthetic',
    'Communication', 'Performance', 'Soul', 'Blessed', 'Land', 'Psychic', 'Covert', 'Administrative']
  const LURES_BASICOS = ['Sticky Fingers', 'Faerie Feast', 'Potpourri', 'Alluring Whisper', 'Love Spot']
  const BINDINGS_BASICAS = ['Company Stamp', 'Seal of Approval', 'Mystic Tattoo', 'Tempest Jewelry', 'Shroud of Power', 'Hypnosis App', 'Tantric Arts', 'Alterzelu Symbiote']
  // Opções de Intensity que o Interactive não deixa junto do DRX start.
  const NAO_COMBINA_DRX = ["Couple's Account (Cooperative)", 'Cash Still Rules', 'Wage Slave', 'With A Little Help From My Friends (Cooperative)', 'With A Little Help From My Friends(Cooperative)']
  // Perks que só se compram na criação, quando o arquivo de dados não diz.
  const SO_NA_CRIACAO = ['Memoria', 'Yoink', 'Worlds Apart']
  // Reembolso depois da criação (Services: Refund): origem e Heritage não voltam; Rides e companions voltam inteiras
  // em até duas semanas; o resto volta por 80% do preço pago.
  const SEM_REEMBOLSO = ['Heritage']
  const REEMBOLSO_POR_PRAZO = ['Rides']

  // Nome completo da tag (como o Interactive escreve) -> sigla. Serve para importar personagens.
  const TAG_POR_NOME = Object.fromEntries([
    ...Object.entries(TAG_DEFESA).map(([k, v]) => [v.toLowerCase(), k]),
    ['dragon', 'dg'], ['transhuman', 'th'], ['outsider', 'ot'], ['psychopomp', 'pp'], ['pirate', 'pi'],
    ['cultivator', 'cu'], ['magical girl', 'mm'], ['phoenix', 'ph'],
  ])

  // Preços do Interactive (novembro de 2026), usados quando o arquivo de dados não carrega.
  const PRECO_DEFESA_PADRAO = {
    'Body Defense': 5, 'Wild Defense': 5, 'Environmental Defense': 25, 'Creature Defense': 10, 'Stress Defense': 5,
    'Addiction Defense': 10, 'Mind Defense': 25, 'Possession Defense': 10, 'Drain Defense': 25, 'Fatality Defense': 50,
    'Polymorph Defense': 50, 'Wyldscape Defense': 50, 'Corruption Defense': 50, 'Information Defense': 25,
    'Trace Defense': 50, 'Destiny Defense': 50, 'Paradox Defense': 50,
  }
  const PRECO_TALENT_PADRAO = {
    'Body Tune-Up': 5, 'Everlasting Talent': 10, 'Athletic Talent': 5, 'Martial Talent': 10, 'Wild Talent': 5,
    'Science Talent': 20, 'Engineering Talent': 30, 'Aesthetic Talent': 10, 'Communication Talent': 10,
    'Performance Talent': 10, 'Soul Talent': 10, 'Blessed Talent': 30, 'Land Talent': 30, 'Psychic Talent': 20,
    'Covert Talent': 10, 'Administrative Talent': 10, 'Talent Sharing': 10, 'Inexhaustible': 140,
    'Added Potential': 5, 'Template Stacking I': 20, 'Template Stacking II': 20,
  }

  const TIPOS_ORIGEM = ['Possess', 'Substitute', 'Extra', 'Walk-In', 'Drop-In']

  const CABECALHOS = new Set(['Patron', 'Challenges', 'Orbs', 'Mode', 'Heritage', 'Bindings', 'Lures', 'Other Controls',
    'Rides', 'Home Perks', 'Talents', 'Defenses', 'Misc Perks', 'Generic Waifu Perks', 'Waifu Perks'])

  const TT = '(\\d+|[XYZ])'
  const RX = {
    mundo: /^Starting World:\s*(.*)$/,
    budget: /^Starting budget\s+(-?\d+(?:\.\d+)?)$/,
    emprestimo: /^Took a loan for\s+(-?\d+(?:\.\d+)?)\s+credits$/,
    intensidade: /^Intensity\s*\[(-?\d+(?:\.\d+)?)\]$/,
    opcaoInt: /^(.*\S)\s+(-?\d+(?:\.\d+)?)$/,
    saldo: /^(.*?)\s*\[(-?\d+(?:\.\d+)?)\](:?)$/,
    valor: /^(.*?)\s+(free|[-+]?\d+(?:\.\d+)?)$/,
    capturados: /^Companions captured\s+([-+]?\d+(?:\.\d+)?);\s*sold\s+([-+]?\d+(?:\.\d+)?)$/,
    walkIn: new RegExp(`^Walked-In as (.*) of T${TT}(?: from (.*))?$`),
    extra: /^['’]?Extra['’]? with (-?\d+(?:\.\d+)?) additional cost$/,
    substitute: new RegExp(`^(.*) \\(Substitute\\) of T${TT}(?: from (.*))?$`),
    possess: new RegExp(`^(.*) \\(Possess\\) of T${TT}(?: from (.*))?$`),
    powerSwap: new RegExp(`^Power Swap to (.*)\\(T${TT}\\)(?: \\[[^\\]]*\\])?$`),
    waifuPerk: new RegExp(`^Waifu Perk (.*)\\(T${TT}\\)(?: \\[[^\\]]*\\])?$`),
    membro: new RegExp(`^(.*?)\\(T${TT}\\)\\[([^\\]]*)\\](?:\\{([^}]*)\\})?\\s+from\\b\\s?(.*)$`),
    capturado: new RegExp(`^(.*?)\\(T${TT}\\)(?:\\{([^}]*)\\})?\\s+from\\b\\s?(.*)$`),
    mod: /^(.*?)\s*\[([-+]?\d+(?:\.\d+)?)\]$/,
    casal: /^Couple.s Account \(Cooperative\)$/i,
    marcaFerramenta: /^Couple.s Account: (?:only the more expensive origin|half price)|^Couple.s Account \(Cooperative\) — contractors|^Your SO\b.*(?:\((?:Possess|Substitute)\) of T|Walked-In as|'Extra' with|Dropped-In)|\(challenge bonus: /,
    recompensa: /^[ \t]*([^[\];\n]+?)[ \t]*\[([^\]\n]*)\];/,
  }

  // ------------------------------------------------------------------ utilidades

  function num(s) { return parseFloat(String(s).replace(',', '.')) }
  function arred(n) { return Math.round(n * 100) / 100 }
  function fmt(n) { const r = arred(Number(n) || 0); return Object.is(r, -0) ? '0' : String(r) }
  function comSinal(n) { return (n >= 0 ? '+' : '') + fmt(n) }
  function oitenta(custo) { return Math.ceil(custo * 8 / 10 - 1e-9) }
  function tierNum(t) {
    if (t == null) return 0
    const s = String(t).trim().toUpperCase()
    if (s === 'X') return 11
    if (s === 'Y') return 12
    if (s === 'Z') return 13
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? n : 0
  }
  function tierTxt(n) { return ({ 11: 'X', 12: 'Y', 13: 'Z' })[n] || String(n || 0) }
  function precoTier(n) { return PRECO_TIER[n] || 0 }
  function normalizar(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`´]/g, "'")
      .toLowerCase().replace(/\s+/g, ' ').trim()
  }
  function arquetipoDaArvore(arvore) { return arvore === 'Dragon (Old)' ? 'Dragon' : (arvore || null) }
  function curtoDefesa(nome) { return String(nome || '').replace(/ Defense$/, '') }
  function semPrefixo(nome) { return String(nome || '').replace(/^You as\s+/i, '').replace(/^Your SO(?:\s+as\b|\s*:)?\s*/i, '').trim() }
  // "Marcos as Tatsumi" -> "Tatsumi": o nome que se procura no banco de personagens.
  function personagemDoNome(nome) {
    const s = semPrefixo(nome)
    const m = s.match(/^(.+?) as (.+)$/)
    return m ? m[2].trim() : s
  }
  // O nome que você escolheu para o contractor ("Kael"). No texto, ele fica no lugar de "You" e "Your SO".
  function apelidoDe(p) { return String((p && p.apelido) || '').replace(/\s+/g, ' ').trim() }
  // Quem a linha de origem diz que é: "Marcos as Tatsumi" -> "Marcos"; sem " as ", vazio.
  function quemDaLinha(nome) { const m = String(nome || '').match(/^(.+?) as (.+)$/); return m ? m[1].trim() : '' }
  // "Kael as Rimuru Tempest" quando há nome escolhido; sem ele, o nome como está.
  function nomeComApelido(p) { const ap = apelidoDe(p); return ap ? `${ap} as ${personagemDoNome(p.nome)}` : p.nome }

  // ------------------------------------------------------------------ leitura do texto

  function separarCabecaItem(resto) {
    let s = resto.trim()
    let dono = null
    const md = s.match(/^(.*?)\s*\{([^{}]*)\}$/)
    if (md) { s = md[1]; dono = md[2] }
    let complexo = ''
    if (s.endsWith(']')) {
      let prof = 0
      for (let k = s.length - 1; k >= 0; k--) {
        if (s[k] === ']') prof++
        else if (s[k] === '[') {
          prof--
          if (prof === 0) { complexo = s.slice(k); s = s.slice(0, k).trimEnd(); break }
        }
      }
    }
    let qtd = 1
    const mq = s.match(/^(.*?)\s+x(\d+)$/)
    if (mq) { s = mq[1]; qtd = parseInt(mq[2], 10) }
    let dlc = false
    if (s.endsWith('ᵈˡᶜ')) { dlc = true; s = s.slice(0, -3).trimEnd() }
    return { titulo: s.trim(), dlc, qtd, complexo, donoMarcado: dono }
  }

  function montarItem(it, dono) {
    const qtd = it.qtd > 1 ? ` x${it.qtd} ` : ''
    const marca = dono ? ` {${dono}}` : ''
    const custo = it.custo ? (it.custo > 0 ? `-${fmt(it.custo)}` : `+${fmt(-it.custo)}`) : 'free'
    return `${it.titulo}${it.dlc ? 'ᵈˡᶜ' : ''}${qtd}${it.complexo}${marca} ${custo}`.replace(/ {3,}/g, '  ')
  }

  function lerCauda(s) {
    let perk = null; let swap = null; let vendido = false
    let m = s.match(new RegExp(`^(.*?)\\s*with Specific Waifu Perk (.*) \\[T${TT}\\]$`))
    if (m) { s = m[1]; perk = { titulo: m[2].trim(), tier: tierNum(m[3]) } }
    m = s.match(new RegExp(`^(.*?)\\s*Power Swapped to (.*) of \\[T${TT}\\]$`))
    if (m) { s = m[1]; swap = { nome: m[2].trim(), tier: tierNum(m[3]) } }
    m = s.match(/^(.*?)\s*--SOLD$/)
    if (m) { s = m[1]; vendido = true }
    return { mundo: s.trim(), perk, swap, vendido }
  }

  function analisar(texto) {
    const brutas = String(texto || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n')
    while (brutas.length && !brutas[brutas.length - 1].trim()) brutas.pop()
    while (brutas.length && !brutas[0].trim()) brutas.shift()
    const linhas = []
    let secao = null
    let modo = null
    for (let i = 0; i < brutas.length; i++) {
      const raw = brutas[i].replace(/\s+$/, '')
      const t = raw.trim()
      const L = { i, raw, tipo: 'texto', secao: null, delta: null, saldo: null }
      linhas.push(L)
      if (!t) {
        L.tipo = 'vazio'
        if (modo !== 'missoes') { modo = null; secao = null }
        continue
      }
      if (modo === 'missoes') {
        // O resumo da Couple's Account que esta ferramenta escreve no fim não é missão.
        if (/^Couple.s Account \(Cooperative\) — contractors/.test(t)) { modo = null; L.marca = true; continue }
        L.tipo = 'missao'
        continue
      }
      let m
      if ((m = t.match(RX.mundo))) { L.tipo = 'mundo'; L.valor = m[1]; secao = modo = null; continue }
      if ((m = t.match(RX.budget))) { L.tipo = 'budget'; L.valor = num(m[1]); secao = modo = null; continue }
      if ((m = t.match(RX.emprestimo))) { L.tipo = 'emprestimo'; L.valor = num(m[1]); L.delta = L.valor; secao = modo = null; continue }
      if ((m = t.match(RX.intensidade))) { L.tipo = 'intensidade'; L.valor = num(m[1]); secao = 'Intensity'; modo = 'intensidade'; L.secao = secao; continue }
      if (CABECALHOS.has(t)) { L.tipo = 'cabecalho'; L.nome = t; secao = t; modo = null; L.secao = t; continue }
      if (modo === 'mods' && !/^Mission Rewards\b/.test(t) && (m = t.match(RX.mod))) {
        L.tipo = 'mod'; L.desc = m[1]; L.valor = num(m[2]); L.secao = 'mods'; continue
      }
      const s = t.match(RX.saldo)
      if (!s) {
        if (modo === 'intensidade' && (m = t.match(RX.opcaoInt))) {
          L.tipo = 'opcaoInt'; L.nome = m[1]; L.valor = num(m[2]); L.secao = 'Intensity'; continue
        }
        if (modo === 'comprados' && (m = t.match(RX.membro))) {
          Object.assign(L, lerCauda(m[5]), { tipo: 'comprado', secao: 'comprados', nome: m[1].trim(), tier: tierNum(m[2]), metodo: m[3], papel: m[4] || '' })
          continue
        }
        if (modo === 'capturados' && (m = t.match(RX.capturado))) {
          Object.assign(L, lerCauda(m[4]), { tipo: 'capturado', secao: 'capturados', nome: m[1].trim(), tier: tierNum(m[2]), metodo: 'capture', papel: m[3] || '' })
          continue
        }
        if (RX.marcaFerramenta.test(t)) L.marca = true
        continue
      }
      // Daqui para baixo, a linha termina com [saldo].
      if (modo === 'intensidade') { modo = null; secao = null }
      L.cabeca = s[1]; L.saldo = num(s[2]); L.doisPontos = s[3] === ':'
      if ((m = L.cabeca.match(RX.capturados))) {
        L.tipo = 'capturadosCab'; L.captura = num(m[1]); L.venda = num(m[2]); L.delta = L.captura + L.venda
        secao = 'capturados'; modo = 'capturados'; continue
      }
      const v = L.cabeca.match(RX.valor)
      if (!v) continue
      const resto = v[1].trim()
      const tok = v[2]
      const n = tok === 'free' ? 0 : num(tok)
      const sinal = tok[0] === '-' ? -1 : (tok[0] === '+' ? 1 : 0)
      L.resto = resto
      if (RX.marcaFerramenta.test(resto) || RX.marcaFerramenta.test(t)) L.marca = true
      switch (resto) {
        case 'Discounted because of your archetype': L.tipo = 'descArquetipo'; L.valor = Math.abs(n); L.delta = L.valor; continue
        case 'Discounted for duplicate talents': L.tipo = 'descTalents'; L.valor = Math.abs(n); L.delta = L.valor; continue
        case 'Discounted for duplicate defenses': L.tipo = 'descDefenses'; L.valor = Math.abs(n); L.delta = L.valor; continue
        case 'Defenses discounted for retinue members': L.tipo = 'rebates'; L.valor = Math.abs(n); L.delta = L.valor; continue
        case 'Companions bought': L.tipo = 'compradosCab'; L.valor = Math.abs(n); L.delta = -L.valor; secao = 'comprados'; modo = 'comprados'; continue
        case 'Specific credit modifiers': L.tipo = 'modsCab'; L.valor = n; L.delta = n; secao = 'mods'; modo = 'mods'; continue
        case 'Mission Rewards': L.tipo = 'missoesCab'; L.valor = n; L.delta = n; secao = 'missoes'; modo = 'missoes'; continue
      }
      if (/^Discounted because of your archetype\b/.test(resto)) { L.tipo = 'descArquetipo'; L.valor = Math.abs(n); L.delta = L.valor; L.marca = true; continue }
      // Origem
      let origem = null
      if (resto === 'Dropped-In') origem = { tipoOrigem: 'Drop-In', nome: '', tier: 0 }
      else if ((m = resto.match(RX.walkIn))) origem = { tipoOrigem: 'Walk-In', nome: m[1], tier: tierNum(m[2]), mundo: m[3] || '' }
      else if ((m = resto.match(RX.extra))) origem = { tipoOrigem: 'Extra', nome: '', tier: 0 }
      else if ((m = resto.match(RX.substitute))) origem = { tipoOrigem: 'Substitute', nome: m[1], tier: tierNum(m[2]), mundo: m[3] || '' }
      else if ((m = resto.match(RX.possess))) origem = { tipoOrigem: 'Possess', nome: m[1], tier: tierNum(m[2]), mundo: m[3] || '' }
      if (origem) {
        Object.assign(L, origem, { tipo: /^Your SO\b/i.test(origem.nome) ? 'origemSO' : 'origem', custo: Math.abs(n) })
        L.delta = sinal > 0 ? n : -Math.abs(n)
        if (L.tipo === 'origemSO') L.marca = true
        continue
      }
      if ((m = resto.match(RX.powerSwap))) {
        Object.assign(L, { tipo: 'powerSwap', nome: m[1].trim(), tier: tierNum(m[2]) })
        L.custo = sinal > 0 ? -n : Math.abs(n); L.delta = -L.custo; L.sinalAmbiguo = sinal <= 0
        if (/\]$/.test(resto)) L.marca = true
        continue
      }
      if ((m = resto.match(RX.waifuPerk))) {
        Object.assign(L, { tipo: 'waifuPerkOrigem', titulo: m[1].trim(), tier: tierNum(m[2]) })
        L.custo = sinal > 0 ? -n : Math.abs(n); L.delta = -L.custo; L.sinalAmbiguo = sinal <= 0
        if (/\]$/.test(resto)) L.marca = true
        continue
      }
      // Item de um bloco
      Object.assign(L, separarCabecaItem(resto))
      L.tipo = 'item'; L.secao = secao
      L.custo = sinal > 0 ? -n : Math.abs(n)
      L.delta = -L.custo
      if (L.donoMarcado) L.marca = true
    }
    return montarModelo(linhas)
  }

  function montarModelo(linhas) {
    const md = {
      linhas,
      mundo: null, budget: null, emprestimo: 0,
      intensidade: null, opcoesInt: [],
      origem: null, origemSO: null, powerSwap: null, waifuPerk: null, descArquetipo: null, drx: false,
      heritage: [], talents: [], defenses: [],
      descTalents: null, descDefenses: null, rebates: null,
      compradosCab: null, comprados: [], capturadosCab: null, capturados: [],
      modsCab: null, mods: [], missoesCab: null, missoes: [],
      challengesCab: null, challenges: [], legacy: false,
      casal: false, jaCorrigido: false,
    }
    for (const L of linhas) {
      if (L.marca) md.jaCorrigido = true
      switch (L.tipo) {
        case 'mundo': md.mundo = L.valor; break
        case 'budget': if (md.budget == null) md.budget = L.valor; break
        case 'emprestimo': md.emprestimo += L.valor; break
        case 'intensidade': md.intensidade = L.valor; break
        case 'opcaoInt':
          md.opcoesInt.push(L)
          if (RX.casal.test(L.nome.trim())) md.casal = true
          if (/^DRX start$/i.test(L.nome.trim())) md.drx = true
          if (/^Legacy Difficulty$/i.test(L.nome.trim())) md.legacy = true
          break
        case 'cabecalho':
          if (L.nome === 'Challenges' && !md.challengesCab) md.challengesCab = L
          break
        case 'origem':
          // Uma segunda linha de origem é a do SO, escrita à mão ("Karina as Elaina (Possess) of T6 from ...").
          if (!md.origem) md.origem = L
          else if (!md.origemSO) { md.origemSO = L; L.tipo = 'origemSO' }
          break
        case 'origemSO': if (!md.origemSO) md.origemSO = L; break
        case 'powerSwap': if (!md.powerSwap) md.powerSwap = L; break
        case 'waifuPerkOrigem': if (!md.waifuPerk) md.waifuPerk = L; break
        case 'descArquetipo': if (!md.descArquetipo) md.descArquetipo = L; break
        case 'descTalents': md.descTalents = L; break
        case 'descDefenses': md.descDefenses = L; break
        case 'rebates': md.rebates = L; break
        case 'compradosCab': md.compradosCab = L; break
        case 'comprado': md.comprados.push(L); break
        case 'capturadosCab': md.capturadosCab = L; break
        case 'capturado': md.capturados.push(L); break
        case 'modsCab': md.modsCab = L; break
        case 'mod': md.mods.push(L); break
        case 'missoesCab': md.missoesCab = L; break
        case 'item':
          if (L.secao === 'Heritage') md.heritage.push(L)
          else if (L.secao === 'Talents') md.talents.push(L)
          else if (L.secao === 'Defenses') md.defenses.push(L)
          else if (L.secao === 'Challenges') md.challenges.push(L)
          break
      }
    }
    md.missoes = lerMissoes(linhas)
    // Linhas de Mode também contam como Couple's Account no sistema antigo.
    if (!md.casal) md.casal = linhas.some(L => L.tipo === 'item' && L.secao === 'Mode' && RX.casal.test(L.titulo || ''))
    // Waifu Perk e Power Swap saem sem sinal no Interactive; o saldo diz se é custo ou devolução.
    let ant = null
    for (const L of linhas) {
      if (L.tipo === 'budget') { ant = L.valor; continue }
      if (L.tipo === 'emprestimo') { if (ant != null) ant += L.valor; continue }
      if (L.saldo == null || L.delta == null) continue
      if (L.sinalAmbiguo && ant != null) {
        const obs = L.saldo - ant
        if (Math.abs(Math.abs(obs) - Math.abs(L.delta)) < 0.01) { L.delta = arred(obs); L.custo = -L.delta }
      }
      ant = L.saldo
    }
    md.conferenciaSaldos = conferirSaldos(linhas)
    return md
  }

  // Mission Rewards: cada missão é "Título in Local" e, depois, recompensas "  Tipo [valor];".
  // O Interactive não quebra a linha depois do ";", então a missão seguinte pode vir colada.
  function lerMissoes(linhas) {
    const corpo = linhas.filter(L => L.tipo === 'missao').map(L => L.raw).join('\n')
    const missoes = []
    let resto = corpo
    let atual = null
    while (resto.trim()) {
      const r = resto.match(RX.recompensa)
      if (r && atual) {
        atual.recompensas.push({ tipo: r[1].trim(), valor: r[2].trim() })
        resto = resto.slice(r[0].length)
        continue
      }
      const fim = resto.indexOf('\n')
      const cab = (fim < 0 ? resto : resto.slice(0, fim)).trim()
      resto = fim < 0 ? '' : resto.slice(fim + 1)
      if (!cab) continue
      const k = cab.lastIndexOf(' in ')
      atual = { titulo: k > 0 ? cab.slice(0, k).trim() : cab, local: k > 0 ? cab.slice(k + 4).trim() : '', recompensas: [] }
      missoes.push(atual)
    }
    return missoes
  }
  function creditosDaMissao(m) {
    return (m.recompensas || []).reduce((a, r) => a + (/^credits?$/i.test(String(r.tipo).trim()) ? (parseInt(r.valor, 10) || 0) : 0), 0)
  }
  function textoMissoes(missoes) {
    const linhas = []
    for (const m of missoes) {
      linhas.push(m.local ? `${m.titulo} in ${m.local}` : m.titulo)
      for (const r of m.recompensas || []) if (String(r.tipo).trim() || String(r.valor).trim()) linhas.push(`  ${String(r.tipo).trim() || 'Other'} [${String(r.valor).trim()}];`)
    }
    return linhas
  }
  const assinaturaMissoes = missoes => JSON.stringify((missoes || []).map(m => [m.titulo, m.local, (m.recompensas || []).map(r => [r.tipo, r.valor])]))
  const copiarMissoes = missoes => (missoes || []).map(m => ({ titulo: String(m.titulo || ''), local: String(m.local || ''), recompensas: (m.recompensas || []).map(r => ({ tipo: String(r.tipo || ''), valor: String(r.valor ?? '') })) }))

  // Refaz o saldo linha a linha com o custo escrito em cada linha e compara com o que o texto mostra.
  // Em cada linha que não fecha, guarda a diferença (L.diferenca), para quem quiser mantê-la.
  function conferirSaldos(linhas) {
    const erros = []
    let saldo = null
    let mostrado = null
    let saldoFinalMostrado = null
    for (const L of linhas) {
      if (L.tipo === 'budget') { saldo = L.valor; mostrado = L.valor; continue }
      if (L.delta == null) continue
      if (saldo == null) { saldo = 0; mostrado = 0 }
      saldo = arred(saldo + L.delta)
      if (L.tipo === 'emprestimo') { mostrado = arred(mostrado + L.delta); continue }
      if (L.saldo == null) continue
      const esperadoLocal = arred(mostrado + L.delta)
      L.diferenca = 0
      if (Math.abs(esperadoLocal - L.saldo) > 0.01) {
        L.diferenca = arred(L.saldo - esperadoLocal)
        erros.push({ linha: L, esperado: esperadoLocal, mostrado: L.saldo })
      }
      mostrado = L.saldo
      saldoFinalMostrado = L.saldo
    }
    return { erros, saldoRecalculado: saldo, saldoFinalMostrado }
  }

  // ------------------------------------------------------------------ dados do Interactive

  // Personagem do banco do Interactive ou de "Meus personagens", no mesmo formato:
  // { id, idx, nome, mundo, sub, tier, defesas: [siglas de Defense], arquetipos: [árvores], meu, base }.
  // id é o número da linha no banco, ou "m:…" para Meus personagens.
  function personagemDoBanco(dados, idx) {
    const p = dados.personagens[idx]
    if (!p) return null
    const tags = p[4] ? p[4].split(' ') : []
    return {
      id: idx, idx, meu: false, nome: p[0], mundo: dados.mundos[p[1]] || '', sub: p[2] || '', tier: p[3] || 0, tags,
      defesas: tags.filter(t => TAG_DEFESA[t]), arquetipos: [...new Set(tags.map(t => TAG_ARQUETIPO[t]).filter(Boolean))], base: null,
    }
  }

  function personagemMeu(r) {
    return {
      id: r.id, idx: r.id, meu: true, nome: r.nome, mundo: r.mundo || '', sub: r.sub || '', tier: r.tier || 0, tags: [],
      defesas: (r.defesas || []).filter(t => TAG_DEFESA[t]), arquetipos: (r.arquetipos || []).slice(), base: r.base ?? null, registro: r,
    }
  }

  // Pontos de um candidato: mundo igual vale 4, parecido 2, tier igual 1. Meus personagens ganham 3,
  // para passar na frente do banco quando o mundo empata.
  function pontuar(p, mundo, tier) {
    const nm = normalizar(mundo)
    let s = p.meu ? 3 : 0
    if (nm) {
      const a = normalizar(p.mundo); const b = normalizar(p.sub)
      if (a === nm || b === nm) s += 4
      else if (a && (a.includes(nm) || nm.includes(a))) s += 2
    }
    if (tier && p.tier === tier) s += 1
    return s
  }
  function ordenarCandidatos(lista, mundo, tier) {
    const pts = new Map(lista.map(p => [p.id, pontuar(p, mundo, tier)]))
    return lista.sort((x, y) => pts.get(y.id) - pts.get(x.id) || (y.meu - x.meu) || (x.meu ? 0 : x.idx - y.idx))
  }
  // Mesmas regras de nome do banco: igual, com as duas partes trocadas, ou "Nome (…)", "Nome/…", "…/Nome".
  function nomeParecido(nomeK, k) { return nomeK.startsWith(k + ' (') || nomeK.startsWith(k + '/') || nomeK.endsWith('/' + k) }

  function montarBanco(dados) {
    const heritages = new Map()
    const porNome = new Map()
    if (dados) {
      for (const h of dados.heritages || []) {
        const k = normalizar(h.n)
        if (!heritages.has(k)) heritages.set(k, [])
        heritages.get(k).push(h)
      }
      dados.personagens.forEach((p, idx) => {
        const k = normalizar(p[0])
        if (!porNome.has(k)) porNome.set(k, [])
        porNome.get(k).push(idx)
      })
    }
    const talents = (dados && dados.talents) || PRECO_TALENT_PADRAO
    const defenses = (dados && dados.defenses) || PRECO_DEFESA_PADRAO
    const challenges = listaChallenges(dados && dados.challenges)
    const challengePorNome = new Map(challenges.map(c => [normalizar(c.titulo), c]))

    // Meus personagens: índice próprio, refeito a cada definirMeus().
    let meusPorId = new Map()
    let meusPorNome = new Map()
    function definirMeus(registros) {
      meusPorId = new Map()
      meusPorNome = new Map()
      for (const r of registros || []) {
        if (!r || typeof r.id !== 'string' || !String(r.nome || '').trim()) continue
        const p = personagemMeu(r)
        meusPorId.set(p.id, p)
        const k = normalizar(p.nome)
        if (!meusPorNome.has(k)) meusPorNome.set(k, [])
        meusPorNome.get(k).push(p)
      }
    }

    function personagem(id) {
      if (id == null || id === '') return null
      if (typeof id === 'string') {
        if (id.startsWith('m:')) return meusPorId.get(id) || null
        id = parseInt(id, 10)
      }
      return dados && Number.isInteger(id) ? personagemDoBanco(dados, id) : null
    }
    function porNomeExato(mapa, k) {
      let r = mapa.get(k) || []
      if (!r.length) {
        const partes = k.split(' ')
        if (partes.length === 2) r = mapa.get(`${partes[1]} ${partes[0]}`) || []
      }
      return r
    }
    function buscar(nome, mundo, tier) {
      const k = normalizar(semPrefixo(nome))
      if (!k) return []
      let meus = porNomeExato(meusPorNome, k)
      if (!meus.length) meus = [...meusPorId.values()].filter(p => nomeParecido(normalizar(p.nome), k))
      let idxs = porNomeExato(porNome, k)
      if (!idxs.length) {
        idxs = []
        for (const [nomeK, lista] of porNome) {
          if (nomeParecido(nomeK, k)) idxs.push(...lista)
          if (idxs.length > 40) break
        }
      }
      return ordenarCandidatos([...meus, ...idxs.map(personagem).filter(Boolean)], mundo, tier)
    }
    function procurar(texto, limite = 40, soBanco = false) {
      const k = normalizar(texto)
      if (k.length < 2) return []
      const meus = soBanco ? [] : [...meusPorId.values()].filter(p => normalizar(p.nome).includes(k) || normalizar(p.mundo).includes(k))
      const achados = []
      for (const [nomeK, lista] of porNome) {
        if (nomeK.includes(k)) achados.push(...lista)
        if (achados.length >= limite * 3) break
      }
      const doBanco = achados.map(personagem).sort((a, b) => a.nome.length - b.nome.length || a.idx - b.idx)
      return [...meus, ...doBanco].slice(0, limite)
    }
    return {
      semDados: !dados,
      geradoEm: (dados && dados.geradoEm) || '',
      totalPersonagens: dados ? dados.personagens.length : 0,
      personagem,
      buscar,
      procurar,
      definirMeus,
      meus() { return [...meusPorId.values()] },
      challenges() { return challenges },
      challenge(titulo) { return challengePorNome.get(normalizar(titulo)) || null },
      heritage(titulo, custo) {
        const lista = heritages.get(normalizar(titulo)) || []
        if (!lista.length) return null
        return lista.find(h => h.c === custo) || lista.find(h => h.arvore !== 'Dragon (Old)') || lista[0]
      },
      nomeTalent(curto) { return talents[curto] != null ? curto : (talents[`${curto} Talent`] != null ? `${curto} Talent` : null) },
      precoTalent(curto) { const n = this.nomeTalent(curto); return n ? talents[n] : null },
      nomeDefesa(curto) { return defenses[`${curto} Defense`] != null ? `${curto} Defense` : (defenses[curto] != null ? curto : null) },
      precoDefesa(curto) { const n = this.nomeDefesa(curto); return n ? defenses[n] : null },
      precoDefesaCompleto(nome) { return defenses[nome] ?? null },
      precoTalentCompleto(nome) { return talents[nome] ?? null },
    }
  }

  // Junta a lista de challenges do arquivo de dados (a mais nova) com os resumos e requisitos daqui.
  function listaChallenges(doArquivo) {
    if (!Array.isArray(doArquivo) || !doArquivo.length) return CHALLENGES_PADRAO.map(c => ({ ...c }))
    const daqui = new Map(CHALLENGES_PADRAO.map(c => [normalizar(c.titulo), c]))
    return doArquivo.filter(c => c && typeof c.titulo === 'string').map((c) => {
      const p = daqui.get(normalizar(c.titulo)) || {}
      const especial = String(c.special || '')
      const dr = especial.match(/DR\s*(\d+) or higher/i)
      return {
        ...p, ...c,
        bonus: typeof c.bonus === 'number' ? c.bonus : (p.bonus || 0),
        minDR: dr ? parseInt(dr[1], 10) : p.minDR,
        semDR11: /not be taken on DR\s*11/i.test(especial) || !!p.semDR11,
        blacklist: [...new Set([...(c.blacklist || []), ...(p.blacklist || [])])],
        whitelist: c.whitelist || p.whitelist,
      }
    })
  }

  function criarBanco(dados) {
    if (!dados || !Array.isArray(dados.personagens)) return null
    return montarBanco(dados)
  }

  // Sem arquivo de dados: preços padrão de Talents e Defenses, e só Meus personagens para as tags.
  function bancoMinimo() { return montarBanco(null) }

  // ------------------------------------------------------------------ configuração inicial

  function tagsDoPersonagem(p) {
    if (!p) return { tagsDef: [], arquetipos: [] }
    return {
      tagsDef: (p.defesas || p.tags.filter(t => TAG_DEFESA[t])).slice(),
      arquetipos: (p.arquetipos || [...new Set(p.tags.map(t => TAG_ARQUETIPO[t]).filter(Boolean))]).slice(),
    }
  }

  // ------------------------------------------------------------------ tags de cada pessoa

  function semMexidas(p) { p.tagsMais = []; p.tagsMenos = []; p.arqMais = []; p.arqMenos = []; return p }

  // Calcula as tags que valem para a pessoa. arqAuto: arquétipos que vêm da própria build
  // (o que o Interactive descontou na linha "Discounted because of your archetype").
  function resolverPessoa(p, banco, arqAuto) {
    if (!p) return
    const c = p.personagem != null ? banco.personagem(p.personagem) : null
    if (p.personagem != null && !c) { p.personagem = null; p.personagemManual = false }
    const base = tagsDoPersonagem(c)
    p.tagsBase = base.tagsDef
    p.arqBase = [...new Set([...base.arquetipos, ...(arqAuto || [])])]
    p.arqAuto = (arqAuto || []).filter(a => !base.arquetipos.includes(a))
    p.tagsMais = [...new Set(p.tagsMais || [])].filter(t => TAG_DEFESA[t] && !p.tagsBase.includes(t))
    p.tagsMenos = [...new Set(p.tagsMenos || [])].filter(t => p.tagsBase.includes(t))
    p.arqMais = [...new Set(p.arqMais || [])].filter(a => a && !p.arqBase.includes(a))
    p.arqMenos = [...new Set(p.arqMenos || [])].filter(a => p.arqBase.includes(a))
    // Na ordem das tags do Interactive: é ela que decide em qual Defense o teto da pessoa é gasto primeiro.
    p.tagsDef = [...p.tagsBase.filter(t => !p.tagsMenos.includes(t)), ...p.tagsMais].sort((a, b) => ORDEM_DEFESA.indexOf(a) - ORDEM_DEFESA.indexOf(b))
    p.arquetipos = [...p.arqBase.filter(a => !p.arqMenos.includes(a)), ...p.arqMais]
    p.meu = !!(c && c.meu)
  }

  function resolverTudo(cfg, banco) {
    resolverPessoa(cfg.c1, banco, cfg.arvoreInferida ? [cfg.arvoreInferida] : [])
    if (cfg.so) resolverPessoa(cfg.so, banco, [])
    for (const c of cfg.companions || []) resolverPessoa(c, banco, [])
  }

  // Liga ou desliga uma tag de Defense (ou um arquétipo, com tipo 'arq') só nesta build.
  function alternarTag(p, valor, tipo) {
    const [base, mais, menos] = tipo === 'arq' ? ['arqBase', 'arqMais', 'arqMenos'] : ['tagsBase', 'tagsMais', 'tagsMenos']
    p[mais] = p[mais] || []; p[menos] = p[menos] || []
    const daBase = (p[base] || []).includes(valor)
    const lista = daBase ? p[menos] : p[mais]
    const i = lista.indexOf(valor)
    if (i >= 0) lista.splice(i, 1); else lista.push(valor)
  }

  // Leva para a configuração nova o personagem escolhido à mão e as tags mexidas na build.
  function herdarPessoa(p, ant, banco, arqAuto) {
    if (!ant) return
    // Versão 1 não marcava a escolha à mão: um personagem diferente do automático só pode ter sido escolhido.
    const manual = ant.personagemManual || (ant.personagemManual === undefined && ant.personagem !== undefined && ant.personagem !== p.personagem)
    if (manual && (ant.personagem == null || banco.personagem(ant.personagem))) {
      p.personagem = ant.personagem
      p.personagemManual = true
      if (ant.personagem != null && !(p.candidatos || []).includes(ant.personagem)) p.candidatos = [ant.personagem, ...(p.candidatos || [])]
    }
    if (ant.buscaManual) p.buscaManual = ant.buscaManual
    if (p.personagem !== ant.personagem) return
    if (ant.tagsMais || ant.tagsMenos || ant.arqMais || ant.arqMenos) {
      p.tagsMais = (ant.tagsMais || []).slice(); p.tagsMenos = (ant.tagsMenos || []).slice()
      p.arqMais = (ant.arqMais || []).slice(); p.arqMenos = (ant.arqMenos || []).slice()
      return
    }
    // Versão 1 guardava a lista inteira: vira diferença em relação ao personagem.
    const base = tagsDoPersonagem(p.personagem != null ? banco.personagem(p.personagem) : null)
    const arqBase = [...new Set([...base.arquetipos, ...(arqAuto || [])])]
    if (Array.isArray(ant.tagsDef)) {
      p.tagsMais = ant.tagsDef.filter(t => !base.tagsDef.includes(t))
      p.tagsMenos = base.tagsDef.filter(t => !ant.tagsDef.includes(t))
    }
    if (Array.isArray(ant.arquetipos)) {
      p.arqMais = ant.arquetipos.filter(a => !arqBase.includes(a))
      p.arqMenos = arqBase.filter(a => !ant.arquetipos.includes(a))
    }
  }

  function arvoresDaBuild(modelo, banco) {
    const set = []
    for (const L of modelo.heritage) {
      const h = banco.heritage(L.titulo, L.custo)
      const a = h ? arquetipoDaArvore(h.arvore) : null
      if (a && !set.includes(a)) set.push(a)
    }
    return set
  }

  function chaveHeritage(modelo, L) {
    const iguais = modelo.heritage.filter(x => x.titulo === L.titulo && x.complexo === L.complexo)
    return `${L.titulo}|${L.complexo}|${iguais.indexOf(L)}`
  }
  function chaveMod(L) { return `${L.desc}|${L.valor}` }

  function pessoaC1(modelo, banco) {
    const O = modelo.origem
    const ps = modelo.powerSwap
    const wp = modelo.waifuPerk
    const c1 = {
      id: 'c1',
      nome: O ? (semPrefixo(O.nome) || (O.tipoOrigem === 'Drop-In' ? 'Contractor 1' : O.tipoOrigem)) : 'Contractor 1',
      nomeOriginal: O ? O.nome : '',
      apelido: '',
      tipoOrigem: O ? O.tipoOrigem : 'Drop-In',
      tier: O ? O.tier : 0,
      custoOrigem: O ? O.custo : 0,
      swap: ps ? { nome: ps.nome, tier: ps.tier, custo: ps.custo } : null,
      perk: wp ? { titulo: wp.titulo, tier: wp.tier, custo: wp.custo } : null,
      mundo: O ? (O.mundo || '') : '',
      personagem: null, personagemManual: false, candidatos: [], arquetipos: [], tagsDef: [],
    }
    semMexidas(c1)
    const nomeBusca = c1.swap ? c1.swap.nome : personagemDoNome(c1.nome)
    const tierBusca = c1.swap ? c1.swap.tier : c1.tier
    if (O && (c1.swap || ['Possess', 'Substitute', 'Walk-In'].includes(c1.tipoOrigem))) {
      const lista = banco.buscar(nomeBusca, c1.swap ? '' : c1.mundo, tierBusca)
      c1.candidatos = lista.slice(0, 40).map(p => p.id)
      if (lista[0]) c1.personagem = lista[0].id
    }
    return c1
  }

  // Qual árvore o Interactive descontou na linha "Discounted because of your archetype".
  function inferirArvoreDescontada(modelo, banco, c1) {
    const L = modelo.descArquetipo
    if (!L || !L.valor) return null
    const teto = precoTier(c1.swap ? c1.swap.tier : c1.tier) || c1.custoOrigem
    const somas = {}
    for (const H of modelo.heritage) {
      const h = banco.heritage(H.titulo, H.custo)
      if (!h) continue
      const a = h.arvore
      somas[a] = (somas[a] || 0) + H.custo
    }
    const achadas = Object.entries(somas).filter(([, s]) => Math.abs(Math.min(teto, oitenta(s)) - L.valor) < 0.6 || Math.abs(Math.min(teto, s * 0.8) - L.valor) < 0.01)
    return achadas.length ? arquetipoDaArvore(achadas[0][0]) : null
  }

  // Onde o SO pode estar na build: uma segunda linha de origem, ou uma linha de "Companions bought".
  function fontesSO(modelo) {
    return [modelo.origemSO, ...modelo.comprados].filter(Boolean)
  }

  // linhaEscolhida: undefined = achar sozinho; null = preencher à mão; número = índice da linha.
  function pessoaSO(modelo, banco, linhaEscolhida) {
    let L = null
    if (linhaEscolhida === undefined) {
      L = modelo.origemSO || modelo.comprados.find(x => /^Your SO\b/i.test(x.nome)) || modelo.comprados.find(x => x.metodo === 'unbound') || null
    }
    else if (linhaEscolhida != null) {
      const X = modelo.linhas[linhaEscolhida]
      L = X && (X.tipo === 'comprado' || X.tipo === 'origemSO') ? X : null
    }
    const deOrigem = !!L && L.tipo === 'origemSO'
    const so = {
      id: 'so', linha: L ? L.i : null, fonte: L ? (deOrigem ? 'origem' : 'comprado') : 'manual',
      nome: L ? (semPrefixo(L.nome) || 'Your SO') : 'SO',
      apelido: '',
      mundo: L ? (L.mundo || '') : '',
      tipoOrigem: deOrigem ? L.tipoOrigem : 'Possess',
      tier: L ? L.tier : 1,
      swap: L && L.swap ? { nome: L.swap.nome, tier: L.swap.tier, custo: Math.max(0, precoTier(L.swap.tier) - precoTier(L.tier)) } : null,
      perk: L && L.perk ? { titulo: L.perk.titulo, tier: L.perk.tier, custo: Math.max(0, precoTier(L.perk.tier) - precoTier(L.tier)) } : null,
      custoOrigem: 0, cobrado: 0,
      personagem: null, personagemManual: false, candidatos: [], arquetipos: [], tagsDef: [],
    }
    semMexidas(so)
    if (!L || (!deOrigem && so.nome === 'Your SO' && so.tier <= 1)) so.tipoOrigem = 'Drop-In'
    so.custoOrigem = custoOrigemPadrao(so.tipoOrigem, so.tier)
    if (L) {
      if (deOrigem) so.cobrado = L.custo
      else {
        const total = modelo.compradosCab ? modelo.compradosCab.valor : 0
        const extras = (so.swap ? so.swap.custo : 0) + (so.perk ? so.perk.custo : 0)
        so.cobrado = modelo.comprados.length === 1 ? total : Math.min(total, precoTier(so.tier) + extras)
      }
      const nomeBusca = so.swap ? so.swap.nome : personagemDoNome(so.nome)
      const lista = banco.buscar(nomeBusca, so.mundo, so.swap ? so.swap.tier : so.tier)
      so.candidatos = lista.slice(0, 40).map(p => p.id)
      if (lista[0]) so.personagem = lista[0].id
    }
    return so
  }

  function custoOrigemPadrao(tipo, tier) {
    return (tipo === 'Possess' || tipo === 'Substitute') ? precoTier(tier) : 0
  }

  function pessoaCompanion(L, banco) {
    const c = {
      id: `comp:${L.i}`, linha: L.i, nome: L.nome, mundo: L.mundo, tier: L.tier, metodo: L.metodo, papel: L.papel || '', vendido: !!L.vendido,
      swap: L.swap, perk: L.perk, personagem: null, personagemManual: false, candidatos: [], tagsDef: [], arquetipos: [],
    }
    semMexidas(c)
    const nomeBusca = c.swap ? c.swap.nome : personagemDoNome(c.nome)
    const lista = banco.buscar(nomeBusca, c.mundo, c.swap ? c.swap.tier : c.tier)
    c.candidatos = lista.slice(0, 40).map(p => p.id)
    if (lista[0]) c.personagem = lista[0].id
    return c
  }

  // Refaz a lista de companions (fora o SO), mantendo o que foi mexido em cada uma.
  function refazerCompanions(cfg, modelo, banco, antigos) {
    cfg.companions = []
    for (const L of [...modelo.comprados, ...modelo.capturados]) {
      if (cfg.casal && cfg.so && L.i === cfg.so.linha) continue
      const c = pessoaCompanion(L, banco)
      herdarPessoa(c, (antigos || []).find(x => x.nome === c.nome && x.tier === c.tier), banco, [])
      cfg.companions.push(c)
    }
    for (const c of cfg.companions) resolverPessoa(c, banco, [])
  }

  function configPadrao(modelo, banco, anterior) {
    banco = banco || bancoMinimo()
    const cfg = {
      casal: modelo.casal,
      casalForcado: null,
      opcoes: {
        origemMaisCara: true, perkContaNaOrigem: true, soArquetipo: true, soRebates: true, brindes2aCopia: false, resumoNoFim: true,
        // Bônus dos challenges: 'intensity' = % do budget da build; 'legacy' = % do budget do DR na Intensity 1
        // (o número do card do Interactive); 'nenhum' = como o Interactive sem Legacy Difficulty.
        bonusChallenge: 'intensity', powerTripDobra: true,
      },
      c1: pessoaC1(modelo, banco),
      so: null,
      companions: [],
      donos: {},
      mods: {},
      usar: {},
      arvoreInferida: null,
      // Challenges que você pôs na build pela ferramenta, os que ficam sem bônus e o DR escolhido à mão.
      challenges: { adicionados: [], semBonus: [], dr: null },
      // Missões de Mission Rewards. A assinatura diz se as do texto mudaram desde a última edição.
      missoes: copiarMissoes(modelo.missoes),
      assinaturaMissoes: assinaturaMissoes(modelo.missoes),
    }
    if (anterior) {
      cfg.opcoes = Object.assign(cfg.opcoes, anterior.opcoes || {})
      if (anterior.casalForcado != null) { cfg.casalForcado = anterior.casalForcado; cfg.casal = anterior.casalForcado }
      const ch = anterior.challenges || {}
      cfg.challenges = {
        adicionados: (ch.adicionados || []).filter(t => !modelo.challenges.some(L => normalizar(L.titulo) === normalizar(t))),
        semBonus: (ch.semBonus || []).slice(),
        dr: Number.isInteger(ch.dr) ? ch.dr : null,
      }
      if (anterior.assinaturaMissoes === cfg.assinaturaMissoes && Array.isArray(anterior.missoes)) cfg.missoes = copiarMissoes(anterior.missoes)
    }
    // Donos e modificadores do modo anterior só valem se o modo (casal ou não) não mudou.
    const mesmoModo = !!anterior && !!anterior.casal === !!cfg.casal
    const inferida = inferirArvoreDescontada(modelo, banco, cfg.c1)
    cfg.arvoreInferida = inferida
    const a1 = anterior && anterior.c1
    if (a1 && (a1.nomeOriginal === cfg.c1.nomeOriginal || a1.nome === cfg.c1.nome) && a1.tipoOrigem === cfg.c1.tipoOrigem) {
      cfg.c1.nome = a1.nome || cfg.c1.nome
      cfg.c1.apelido = typeof a1.apelido === 'string' ? a1.apelido : ''
      herdarPessoa(cfg.c1, a1, banco, inferida ? [inferida] : [])
    }

    // SO
    let linhaSO
    if (anterior && anterior.so) {
      const ant = anterior.so
      const mesma = ant.linha != null ? fontesSO(modelo).find(x => semPrefixo(x.nome) === ant.nomeLinha) : null
      linhaSO = ant.linha == null ? (ant.escolhaManual ? null : undefined) : (mesma ? mesma.i : undefined)
    }
    cfg.so = pessoaSO(modelo, banco, linhaSO)
    cfg.so.nomeLinha = cfg.so.linha != null ? semPrefixo(modelo.linhas[cfg.so.linha].nome) : null
    const aSO = anterior && anterior.so
    if (aSO && (aSO.nomeLinha === cfg.so.nomeLinha) && (cfg.so.linha != null || aSO.linha == null)) {
      for (const k of ['nome', 'apelido', 'mundo', 'tipoOrigem', 'tier', 'custoOrigem', 'cobrado', 'escolhaManual']) if (aSO[k] !== undefined) cfg.so[k] = aSO[k]
      if (aSO.perk && cfg.so.perk) cfg.so.perk.custo = aSO.perk.custo
      if (aSO.swap && cfg.so.swap) cfg.so.swap.custo = aSO.swap.custo
      herdarPessoa(cfg.so, aSO, banco, [])
    }

    // Companions (fora o SO)
    refazerCompanions(cfg, modelo, banco, anterior ? anterior.companions : null)
    resolverTudo(cfg, banco)

    // Dono de cada perk de heritage
    for (const L of modelo.heritage) {
      const k = chaveHeritage(modelo, L)
      let dono = 'c1'
      if (cfg.casal) {
        const h = banco.heritage(L.titulo, L.custo)
        const a = h ? arquetipoDaArvore(h.arvore) : null
        if (a && a === inferida) dono = 'c1'
        else if (a && cfg.so.arquetipos.includes(a)) dono = 'so'
      }
      cfg.donos[k] = mesmoModo && anterior.donos && anterior.donos[k] ? anterior.donos[k] : dono
    }

    // Specific credit modifiers: o reembolso do SO feito à mão sai, porque a ferramenta já faz a conta.
    for (const L of modelo.mods) {
      const k = chaveMod(L)
      const pareceSO = /\bSO\b|refund|reembols|devolu/i.test(L.desc) || (cfg.so.nome && cfg.so.nome !== 'SO' && normalizar(L.desc).includes(normalizar(cfg.so.nome)))
      cfg.mods[k] = mesmoModo && anterior.mods && anterior.mods[k] !== undefined ? anterior.mods[k] : !(cfg.casal && pareceSO)
    }
    if (mesmoModo && anterior.usar) cfg.usar = Object.assign({}, anterior.usar)
    return cfg
  }

  // ------------------------------------------------------------------ cálculo

  function tier1a(p) { return (p.perk && p.perk.tier) || (p.swap && p.swap.tier) || p.tier || 0 }

  function poolArquetipo(p) {
    if (!p) return 0
    if (!p.swap && ['Drop-In', 'Walk-In', 'Extra'].includes(p.tipoOrigem)) return 0
    return precoTier(tier1a(p))
  }

  function tetoRebate(p) {
    if (!p) return 0
    if (!p.swap && ['Drop-In', 'Walk-In', 'Extra'].includes(p.tipoOrigem)) return 0
    return precoTier(tier1a(p))
  }

  // Desconto de arquétipo por pessoa. "compras" = cópias de heritage, cada uma com o comprador e se é a metade.
  function calcularArquetipos(pessoas, compras) {
    const res = {}
    for (const p of pessoas) {
      const r = { id: p.id, nome: p.nome, pool: p.pool, total: 0, usados: [] }
      let resta = p.pool
      const minhas = compras.filter(c => c.comprador === p.id)
      const ordem = [...minhas.filter(c => !c.metade), ...minhas.filter(c => c.metade)]
      for (const c of ordem) {
        c.desconto = 0
        if (c.arquetipo && p.arquetipos.includes(c.arquetipo) && resta > 0) {
          c.desconto = Math.min(resta, oitenta(c.custo))
          resta -= c.desconto
          r.total += c.desconto
          if (!r.usados.includes(c.arquetipo)) r.usados.push(c.arquetipo)
        }
        if (c.metade) {
          const depois = Math.max(0, c.custo - c.desconto)
          c.paga = Math.ceil(depois / 2 - 1e-9)
          c.meia = depois - c.paga
        }
        else { c.paga = c.custo - c.desconto; c.meia = 0 }
      }
      r.resta = resta
      res[p.id] = r
    }
    return res
  }

  // Defense Rebates, na mesma ordem e com os mesmos tetos do Interactive.
  function calcularRebates(defesas, pessoas, banco) {
    const porDefesa = {}
    for (const [nome, qtd] of Object.entries(defesas)) {
      const preco = banco.precoDefesaCompleto(nome)
      if (preco == null) continue
      porDefesa[nome] = { preco, qtd: qtd >= 2 ? 2 : 1, desconto: 0, quem: [] }
    }
    const lista = pessoas.filter(p => p.teto > 0).map(p => ({ ...p, nDef: p.tags.filter(t => TAG_DEFESA[t]).length }))
    lista.sort((a, b) => b.teto - a.teto || a.nDef - b.nDef)
    for (const p of lista) {
      let resta = p.teto
      for (const tag of p.tags) {
        const nome = TAG_DEFESA[tag]
        const d = nome && porDefesa[nome]
        if (!d) continue
        const u = Math.min(resta, d.preco * 0.4)
        const k = d.preco * d.qtd
        const v = arred(Math.min(u, k - d.desconto))
        if (v > 0) { d.desconto = arred(d.desconto + v); d.quem.push({ id: p.id, nome: p.nome, valor: v }); resta = arred(resta - v) }
      }
    }
    const total = arred(Object.values(porDefesa).reduce((a, d) => a + d.desconto, 0))
    return { total, porDefesa }
  }

  function calcularRepetidos(itensTalents, itensDefenses, banco) {
    let talents = 0; let defenses = 0
    const semPreco = []
    for (const it of itensTalents) {
      if (it.qtd > 1 && !it.complexo) {
        const p = banco.precoTalent(it.titulo)
        if (p == null) semPreco.push(it.titulo); else talents += (it.qtd - 1) * p
      }
    }
    for (const it of itensDefenses) {
      if (it.qtd > 2) {
        const p = banco.precoDefesa(it.titulo)
        if (p == null) semPreco.push(it.titulo); else defenses += (it.qtd - 2) * p
      }
    }
    return { talents, defenses, semPreco }
  }

  // Lista editável de linhas: inserir antes/depois, trocar e remover sem perder a posição original.
  function criarEdicao(modelo, manterDiferencas) {
    const ent = modelo.linhas.map(L => ({
      L, tipo: L.tipo, texto: L.saldo != null ? L.cabeca : L.raw,
      delta: L.delta == null ? null : arred(L.delta + (manterDiferencas && L.diferenca ? L.diferenca : 0)),
      colchete: L.saldo != null, doisPontos: !!L.doisPontos, removida: false,
    }))
    const antes = modelo.linhas.map(() => [])
    const depois = modelo.linhas.map(() => [])
    const fim = []
    return {
      ent,
      nova(texto, delta, tipo = 'nova') { return { L: null, tipo, texto, delta: delta == null ? null : arred(delta), colchete: delta != null, doisPontos: false, removida: false, nova: true } },
      antes(i, ...novas) { antes[i].push(...novas) },
      depois(i, ...novas) { depois[i].push(...novas) },
      fim(...novas) { fim.push(...novas) },
      remover(i) { ent[i].removida = true },
      trocar(i, campos) { Object.assign(ent[i], campos) },
      // comRemovidas: devolve também as linhas tiradas (só para mostrar na tela, nunca no texto copiado).
      lista(comRemovidas) {
        const out = []
        ent.forEach((e, i) => { out.push(...antes[i]); if (!e.removida || comRemovidas) out.push(e); out.push(...depois[i]) })
        out.push(...fim)
        const vazia = e => !e.colchete && !String(e.texto).trim() && !e.removida
        // Sem linha em branco dupla, nem no começo ou no fim.
        const limpa = []
        for (const e of out) {
          if (vazia(e)) {
            const ult = [...limpa].reverse().find(x => !x.removida)
            if (!ult || vazia(ult)) continue
          }
          limpa.push(e)
        }
        while (limpa.length && (vazia(limpa[limpa.length - 1]) || limpa[limpa.length - 1].removida)) {
          if (comRemovidas && limpa[limpa.length - 1].removida) break
          limpa.pop()
        }
        return limpa
      },
    }
  }

  // A linha da origem do SO, no formato da do contractor 1: "Alphin as Elysia (Possess) of T9".
  // O mundo vai para o resumo do fim; comMundo = true quando o resumo está desligado, para ele não se perder.
  function textoOrigemSO(so, comMundo) {
    const mundo = comMundo && so.mundo ? ` from ${so.mundo}` : ''
    const ap = apelidoDe(so)
    // "Karina as Elaina": o nome já vem escrito na build.
    const quem = ap ? nomeComApelido(so) : (quemDaLinha(so.nome) ? so.nome : `Your SO as ${so.nome}`)
    const rotulo = ap || 'Your SO'
    const entre = normalizar(ap) === normalizar(so.nome) ? '' : ` (${so.nome})`
    switch (so.tipoOrigem) {
      case 'Possess': return `${quem} (Possess) of T${tierTxt(so.tier)}${mundo}`
      case 'Substitute': return `${quem} (Substitute) of T${tierTxt(so.tier)}${mundo}`
      case 'Walk-In': return `${rotulo}: Walked-In as ${so.nome} of T${tierTxt(so.tier)}`
      case 'Extra': return `${rotulo}${entre}: 'Extra' with ${fmt(so.custoOrigem)} additional cost`
      default: return `${rotulo}${entre}: Dropped-In`
    }
  }

  // Troca "You" e "Your SO" pelo nome escolhido em toda a build: na origem do contractor 1 e nas
  // marcas entre colchetes ("Template Stacking I [You as Rimuru Tempest has …]").
  function aplicarApelidos(ed, modelo, c1, so) {
    const ap1 = apelidoDe(c1)
    const ap2 = so ? apelidoDe(so) : ''
    if (!ap1 && !ap2) return
    const O = modelo.origem
    ed.ent.forEach((e, i) => {
      if (e.removida || e.tipo === 'missao' || e.tipo === 'vazio' || typeof e.texto !== 'string') return
      let t = e.texto
      if (ap1 && O && i === O.i) {
        const quem = quemDaLinha(O.nome)
        if (quem && t.startsWith(`${quem} as `)) t = `${ap1} as ${t.slice(quem.length + 4)}`
        else if (!quem && (O.tipoOrigem === 'Possess' || O.tipoOrigem === 'Substitute')) t = `${ap1} as ${t}`
        else if (!quem) t = `${ap1}: ${t}`
      }
      else if (ap1) t = t.replace(/(^|\[|,\s*)You as (?=\S)/g, (_, antes) => `${antes}${ap1} as `)
      if (ap2) t = t.replace(/(^|\[|,\s*)Your SO as (?=\S)/g, (_, antes) => `${antes}${ap2} as `)
      if (t !== e.texto) ed.trocar(i, { texto: t })
    })
  }

  // O mundo de onde vem a pessoa: o que está escrito na build, ou o do personagem escolhido no banco.
  // Com Power Swap, o personagem do banco é o do swap, então o mundo dele não serve.
  function mundoDaPessoa(p, banco) {
    if (p.mundo) return p.mundo
    const c = !p.swap && p.personagem != null ? banco.personagem(p.personagem) : null
    return c ? c.mundo || '' : ''
  }

  function descricaoOrigem(p) {
    const base = p.tipoOrigem === 'Drop-In' ? 'Drop-In' : `${p.tipoOrigem} of T${tierTxt(p.tier)}`
    const t1a = tier1a(p)
    if (p.perk && t1a !== p.tier) return `${base} (T${tierTxt(t1a)} with Waifu Perk ${p.perk.titulo})`
    if (p.swap) return `${base} (Power Swap to ${p.swap.nome}, T${tierTxt(p.swap.tier)})`
    return base
  }

  function calcular(modelo, cfgEntrada, bancoEntrada) {
    const banco = bancoEntrada || bancoMinimo()
    const cfg = cfgEntrada
    const casal = !!cfg.casal
    const op = cfg.opcoes || {}
    const avisos = []
    const mudancas = []
    const ed = criarEdicao(modelo, !!op.manterDiferencas)
    resolverTudo(cfg, banco)
    const c1 = cfg.c1
    const so = casal ? cfg.so : null
    const todas = [c1, ...(casal ? [so] : []), ...cfg.companions]
    // Fora da Couple's Account, a conta refeita só entra sozinha quando você mexeu nas tags ou nos arquétipos
    // (ou usa Meus personagens); sem isso, vale o número do Interactive, e a Conferência mostra a diferença.
    const mexeuTags = todas.some(p => (p.tagsMais || []).length || (p.tagsMenos || []).length || p.meu)
    const mexeuArq = todas.slice(0, casal ? 2 : 1).some(p => (p.arqMais || []).length || (p.arqMenos || []).length || (p.meu && (p.arquetipos || []).length))
    const nomeDe = id => (id === 'so' ? (so && so.nome) || 'SO' : c1.nome || 'Contractor 1')

    if (modelo.jaCorrigido) avisos.push({ nivel: 'erro', texto: 'Este texto já passou por esta ferramenta. Cole o texto original do Interactive ("Copy Text of Build"), senão as correções entram duas vezes.' })
    if (banco.semDados) avisos.push({ nivel: 'aviso', texto: 'O arquivo dados/interactive-dados.js não carregou. Sem ele não dá para saber a árvore de cada heritage nem as tags dos personagens: marque as tags à mão.' })
    if (modelo.budget == null) avisos.push({ nivel: 'erro', texto: 'Não achei a linha "Starting budget". Cole o texto inteiro do "Copy Text of Build".' })

    // --- Conferência do texto original
    for (const e of modelo.conferenciaSaldos.erros.slice(0, 8)) {
      const como = op.manterDiferencas
        ? 'A diferença foi mantida no texto corrigido, como você pediu.'
        : 'O texto corrigido refaz o saldo pelo custo escrito na linha. Se a diferença é um custo que o texto não mostra, ligue "Manter as diferenças que o texto não explica".'
      avisos.push({ nivel: 'erro', texto: `A conta não fecha em "${e.linha.raw.trim()}": o saldo devia ser [${fmt(e.esperado)}], mas o texto mostra [${fmt(e.mostrado)}] (diferença de ${comSinal(e.mostrado - e.esperado)}). ${como}` })
    }
    if (modelo.drx) avisos.push({ nivel: 'info', texto: 'Build de DRX start: as verbas do DRX fecham à mão, e o Interactive não dá Defense Rebates nesse modo.' })
    if (modelo.conferenciaSaldos.erros.length > 8) avisos.push({ nivel: 'erro', texto: `Mais ${modelo.conferenciaSaldos.erros.length - 8} linhas com o saldo errado.` })
    if (modelo.intensidade != null && modelo.opcoesInt.length) {
      const soma = 1 + modelo.opcoesInt.reduce((a, L) => a + L.valor, 0)
      if (Math.abs(soma - modelo.intensidade) > 0.01) avisos.push({ nivel: 'erro', texto: `Intensity: o cabeçalho diz [${fmt(modelo.intensidade)}], mas 1 + a soma das cláusulas dá ${fmt(soma)}.` })
    }
    if (modelo.budget != null && (modelo.intensidade != null || modelo.legacy)) {
      const I = intensidadeDoBudget(modelo)
      const dr = drDaBuild(modelo)
      if (dr) avisos.push({ nivel: 'info', texto: `Budget ${fmt(modelo.budget)} na Intensity ${fmt(I)}${modelo.legacy ? ' (Legacy Difficulty usa a linha 1)' : ''}: mundo de DR ${dr}, pela tabela do Interactive.` })
      else if (modelo.budget > 0) avisos.push({ nivel: 'aviso', texto: `O budget ${fmt(modelo.budget)} não bate com nenhum DR na Intensity ${fmt(I)} da tabela do Interactive. Pode ser regra de um Challenge ou do Patron: confira.` })
    }

    // --- Heritage: cópias, donos e árvores
    const compras = []
    const infoHeritage = []
    modelo.heritage.forEach((L) => {
      const h = banco.heritage(L.titulo, L.custo)
      const arquetipo = h ? arquetipoDaArvore(h.arvore) : null
      if (!h && L.custo > 0 && !banco.semDados) avisos.push({ nivel: 'aviso', texto: `Não achei "${L.titulo}" na lista de heritages do Interactive: o desconto de arquétipo não entra nela.` })
      const k = chaveHeritage(modelo, L)
      const dono = casal ? (cfg.donos[k] || 'c1') : 'c1'
      const linha = { L, chave: k, info: h, arquetipo, dono, copias: [] }
      if (dono === 'ambos-c1' || dono === 'ambos-so') {
        const primeiro = dono === 'ambos-c1' ? 'c1' : 'so'
        const segundo = primeiro === 'c1' ? 'so' : 'c1'
        linha.copias.push({ comprador: primeiro, metade: false, custo: L.custo, arquetipo, L })
        linha.copias.push({ comprador: segundo, metade: true, custo: L.custo, arquetipo, L })
      }
      else linha.copias.push({ comprador: dono, metade: false, custo: L.custo, arquetipo, L })
      compras.push(...linha.copias)
      infoHeritage.push(linha)
    })

    // --- Desconto de arquétipo
    const pessoasArq = [{ id: 'c1', nome: c1.nome, pool: poolArquetipo(c1), arquetipos: c1.arquetipos }]
    if (casal) pessoasArq.push({ id: 'so', nome: so.nome, pool: op.soArquetipo ? poolArquetipo(so) : 0, arquetipos: so.arquetipos })
    const arq = calcularArquetipos(pessoasArq, compras)
    const arqTexto = modelo.descArquetipo ? modelo.descArquetipo.valor : 0
    const arqRecalc = arred(Object.values(arq).reduce((a, r) => a + r.total, 0))
    const usarArq = casal ? true : (cfg.usar.arquetipo != null ? !!cfg.usar.arquetipo : mexeuArq)

    if (!casal && modelo.descArquetipo && c1.tipoOrigem === 'Walk-In' && !c1.swap) avisos.push({ nivel: 'aviso', texto: 'O Interactive deu desconto de arquétipo a um Walk-In sem Power Swap. O documento não dá: Walk-In não paga nada para ser quem é.' })

    // Regras de Intensity sobre heritage
    const opcoes = modelo.opcoesInt.map(L => normalizar(L.nome))
    const umaSo = opcoes.includes('only one') || opcoes.includes('only one heritage')
    const banidas = opcoes.includes('heritages banned')
    for (const id of casal ? ['c1', 'so'] : ['c1']) {
      const arvores = [...new Set(compras.filter(c => c.comprador === id && c.arquetipo).map(c => c.arquetipo))]
      if (umaSo && arvores.length > 1) avisos.push({ nivel: 'erro', texto: `${nomeDe(id)} tem perks de ${arvores.length} heritages (${arvores.join(', ')}), mas a build tem Only One: uma heritage por pessoa.` })
      if (banidas && arvores.length) avisos.push({ nivel: 'erro', texto: `${nomeDe(id)} tem heritage, mas a build tem Heritages Banned.` })
    }

    // --- Talents e Defenses (contagem atual, com brindes da 2ª cópia se a opção estiver ligada)
    const talents = modelo.talents.map(L => ({ L, titulo: L.titulo, dlc: L.dlc, qtd: L.qtd, complexo: L.complexo, custo: L.custo, extra: 0, nova: false }))
    const defenses = modelo.defenses.map(L => ({ L, titulo: L.titulo, dlc: L.dlc, qtd: L.qtd, complexo: L.complexo, custo: L.custo, extra: 0, nova: false }))
    const brindesAdicionados = []
    if (casal && op.brindes2aCopia) {
      for (const linha of infoHeritage) {
        if (linha.copias.length < 2 || !linha.info) continue
        const fontes = [linha.info.brindes]
        const tipo = (linha.L.complexo || '').replace(/^\[|\]$/g, '')
        if (linha.info.brindesPorTipo && linha.info.brindesPorTipo[tipo]) fontes.push(linha.info.brindesPorTipo[tipo])
        for (const f of fontes.filter(Boolean)) {
          for (const [nome, q] of Object.entries(f.t || {})) adicionarBrinde(talents, nome.replace(/ Talent$/, ''), q, banco, 'talent', brindesAdicionados, linha.L.titulo)
          for (const [nome, q] of Object.entries(f.d || {})) adicionarBrinde(defenses, nome.replace(/ Defense$/, ''), q, banco, 'defense', brindesAdicionados, linha.L.titulo)
        }
      }
    }
    const rep = calcularRepetidos(talents, defenses, banco)
    for (const t of rep.semPreco) avisos.push({ nivel: 'aviso', texto: `Não sei o preço de "${t}" (repetido): ficou fora da conta de repetidos recalculada.` })
    const mudouContagem = brindesAdicionados.length > 0
    const usarTal = cfg.usar.talents != null ? cfg.usar.talents : mudouContagem
    const usarDef = cfg.usar.defenses != null ? cfg.usar.defenses : mudouContagem
    const talTexto = modelo.descTalents ? modelo.descTalents.valor : 0
    const defTexto = modelo.descDefenses ? modelo.descDefenses.valor : 0

    // --- Defense Rebates
    const defesasBuild = {}
    for (const d of defenses) {
      const nome = banco.nomeDefesa(d.titulo)
      if (nome) defesasBuild[nome] = (defesasBuild[nome] || 0) + d.qtd
    }
    const rebatesDesligados = opcoes.includes('defense rebates disabled') || modelo.drx
    const pessoasRebate = []
    const pessoaRebate = (p, nome) => ({ id: p.id, nome, teto: tetoRebate(p), tags: p.tagsDef || [] })
    pessoasRebate.push(pessoaRebate(c1, c1.nome))
    const pessoasSemSO = []
    const pessoaCompanionRebate = c => ({ id: c.id, nome: c.nome, teto: precoTier((c.perk && c.perk.tier) || (c.swap && c.swap.tier) || c.tier), tags: c.tagsDef || [] })
    for (const c of cfg.companions) {
      if (c.vendido || FORA_DOS_REBATES.includes(c.papel)) continue
      pessoasSemSO.push(pessoaCompanionRebate(c))
    }
    pessoasRebate.push(...pessoasSemSO)
    const rebSemSO = rebatesDesligados ? { total: 0, porDefesa: {} } : calcularRebates(defesasBuild, pessoasRebate, banco)
    let rebCom = rebSemSO
    const comSO = casal && op.soRebates && !rebatesDesligados
    if (comSO) rebCom = calcularRebates(defesasBuild, [...pessoasRebate, pessoaRebate(so, so.nome)], banco)
    // Quem morreu sai dos Defense Rebates (perder alguém do séquito tira o desconto dele); o Interactive ainda conta.
    const mortos = cfg.companions.filter(c => !c.vendido && c.papel === 'Dead')
    if (mortos.length && !rebatesDesligados) {
      const comMortos = calcularRebates(defesasBuild, [...pessoasRebate, ...(comSO ? [pessoaRebate(so, so.nome)] : []), ...mortos.map(pessoaCompanionRebate)], banco)
      const dif = arred(comMortos.total - rebCom.total)
      if (dif > 0.01) avisos.push({ nivel: 'info', texto: `Quem está morto não dá Defense Rebates: ${mortos.map(c => c.nome).join(', ')} (${comSinal(-dif)}). O Interactive ainda conta.` })
    }
    const rebTexto = modelo.rebates ? modelo.rebates.valor : 0
    const rebRecalc = rebCom.total
    const usarReb = cfg.usar.rebates != null ? cfg.usar.rebates : (casal || mexeuTags)

    const semTags = []
    if (['Possess', 'Substitute'].includes(c1.tipoOrigem) && c1.personagem == null && !(c1.tagsDef || []).length) semTags.push(c1.nome)
    for (const c of cfg.companions) if (!c.vendido && c.personagem == null && !(c.tagsDef || []).length) semTags.push(c.nome)
    if (casal && so.linha != null && so.personagem == null && !(so.tagsDef || []).length && so.tipoOrigem !== 'Drop-In') semTags.push(so.nome)
    if (semTags.length && modelo.defenses.length) avisos.push({ nivel: 'aviso', texto: `Não achei ${semTags.join(', ')} no banco do Interactive nem em Meus personagens. Crie ou importe o personagem em Meus personagens, ou marque as tags de Defense à mão; senão os Defense Rebates dessas pessoas ficam de fora.` })

    // Tags e arquétipos marcados à mão que mudam a conta: para ninguém ganhar desconto sem querer.
    const maoDef = []
    for (const p of todas) {
      for (const t of p.tagsMais || []) {
        const d = rebCom.porDefesa[TAG_DEFESA[t]]
        const q = d && d.quem.find(x => x.id === p.id)
        if (q) maoDef.push(`${p.nome}, ${curtoDefesa(TAG_DEFESA[t])} +${fmt(q.valor)} (a pessoa ${CONDICAO_DEFESA[t]})`)
      }
    }
    if (maoDef.length) avisos.push({ nivel: 'aviso', texto: `Tags de Defense marcadas à mão nesta build: ${maoDef.join('; ')}. Só vale se for verdade no cânone.` })
    const maoArq = []
    for (const [p, id] of [[c1, 'c1'], ...(casal ? [[so, 'so']] : [])]) {
      const usadas = (arq[id] && arq[id].usados) || []
      for (const a of (p.arqMais || []).filter(x => usadas.includes(x))) maoArq.push(`${p.nome} como ${a}`)
    }
    if (maoArq.length) avisos.push({ nivel: 'aviso', texto: `Arquétipo marcado à mão nesta build: ${maoArq.join('; ')}. Dá o desconto de arquétipo nessa árvore; só vale se a origem combina com ela.` })
    const deMeus = todas.filter(p => p.meu && (p.tagsDef || []).some(t => { const d = rebCom.porDefesa[TAG_DEFESA[t]]; return d && d.quem.some(x => x.id === p.id) }))
    if (deMeus.length) avisos.push({ nivel: 'info', texto: `Tags de Meus personagens (marcadas por você) entram nos Defense Rebates: ${deMeus.map(p => p.nome).join(', ')}.` })

    // ============================================================ texto corrigido

    // Âncora: a última linha do grupo da origem (contractor 1 e, se estiver escrita como origem, o SO).
    const grupoOrigem = [modelo.origem, modelo.powerSwap, modelo.waifuPerk, casal && so.fonte === 'origem' ? modelo.linhas[so.linha] : null].filter(Boolean).map(L => L.i)
    let ancora = grupoOrigem.length ? Math.max(...grupoOrigem) : null
    if (ancora == null && modelo.descArquetipo) ancora = modelo.descArquetipo.i - 1
    if (ancora == null) {
      const ult = [...modelo.linhas].reverse().find(L => L.tipo === 'opcaoInt' || L.tipo === 'budget' || L.tipo === 'emprestimo')
      ancora = ult ? ult.i : 0
    }
    const blocoOrigem = []

    // Waifu Perk e Power Swap do contractor 1 com sinal de menos, para não parecer crédito.
    for (const L of [modelo.powerSwap, modelo.waifuPerk].filter(Boolean)) {
      if (L.custo > 0 && !/-\d/.test(L.cabeca.slice(-12))) {
        const base = L.tipo === 'powerSwap' ? `Power Swap to ${L.nome}(T${tierTxt(L.tier)})` : `Waifu Perk ${L.titulo}(T${tierTxt(L.tier)})`
        ed.trocar(L.i, { texto: `${base} -${fmt(L.custo)}` })
      }
    }

    let soTotal = 0; let c1Total = 0; let reembolso = 0
    if (casal) {
      // 1. O SO sai de Companions bought e vira a origem do contractor 2.
      const linhaOrigemSO = ed.nova(`${textoOrigemSO(so, !op.resumoNoFim)} -${fmt(so.custoOrigem || 0)}`, -(so.custoOrigem || 0))
      if (so.fonte === 'comprado' && so.linha != null && modelo.compradosCab) {
        ed.remover(so.linha)
        const restantes = modelo.comprados.filter(L => L.i !== so.linha)
        const novoTotal = Math.max(0, arred(modelo.compradosCab.valor - (so.cobrado || 0)))
        if (!restantes.length) ed.remover(modelo.compradosCab.i)
        else ed.trocar(modelo.compradosCab.i, { texto: `Companions bought -${fmt(novoTotal)}`, delta: -novoTotal })
        mudancas.push(`${so.nome} saiu de "Companions bought" (o Interactive cobrava ${fmt(so.cobrado || 0)}): agora é o contractor 2 da conta, o SO.`)
        blocoOrigem.push(linhaOrigemSO)
      }
      else if (so.fonte === 'origem' && so.linha != null) {
        // O SO já estava escrito como origem: a linha fica no lugar, com o preço cheio da origem dele.
        ed.trocar(so.linha, { texto: linhaOrigemSO.texto, delta: linhaOrigemSO.delta })
        if (Math.abs((so.cobrado || 0) - (so.custoOrigem || 0)) > 0.01) mudancas.push(`A origem de ${so.nome} passa a mostrar o preço cheio (${fmt(so.custoOrigem || 0)}, antes ${fmt(so.cobrado || 0)}); a linha "only the more expensive origin" faz o desconto.`)
      }
      else {
        avisos.push({ nivel: 'aviso', texto: 'Não achei o SO na build. Preencha o contractor 2 à mão (nome, origem, tier e preço da origem).' })
        blocoOrigem.push(linhaOrigemSO)
      }
      if (so.swap) blocoOrigem.push(ed.nova(`Power Swap to ${so.swap.nome}(T${tierTxt(so.swap.tier)}) [${so.nome}] -${fmt(so.swap.custo || 0)}`, -(so.swap.custo || 0)))
      if (so.perk) blocoOrigem.push(ed.nova(`Waifu Perk ${so.perk.titulo}(T${tierTxt(so.perk.tier)}) [${so.nome}] -${fmt(so.perk.custo || 0)}`, -(so.perk.custo || 0)))

      // 2. Só a origem mais cara é paga.
      c1Total = (c1.custoOrigem || 0) + (op.perkContaNaOrigem ? ((c1.swap && c1.swap.custo) || 0) + ((c1.perk && c1.perk.custo) || 0) : 0)
      soTotal = (so.custoOrigem || 0) + (op.perkContaNaOrigem ? ((so.swap && so.swap.custo) || 0) + ((so.perk && so.perk.custo) || 0) : 0)
      if (op.origemMaisCara) {
        reembolso = Math.min(c1Total, soTotal)
        if (reembolso > 0) {
          blocoOrigem.push(ed.nova(`Couple's Account: only the more expensive origin is paid (${c1.nome} ${fmt(c1Total)}, ${so.nome} ${fmt(soTotal)}) +${fmt(reembolso)}`, reembolso))
          mudancas.push(`Só a origem mais cara é paga: ${c1.nome} ${fmt(c1Total)} e ${so.nome} ${fmt(soTotal)}. Volta ${fmt(reembolso)}.`)
        }
      }
    }

    // 3. Desconto de arquétipo
    if (usarArq) {
      if (modelo.descArquetipo) ed.remover(modelo.descArquetipo.i)
      for (const id of casal ? ['c1', 'so'] : ['c1']) {
        const r = arq[id]
        if (!r || r.total <= 0) continue
        const rotulo = casal ? ` [${r.nome}: ${r.usados.join(', ')}]` : ''
        blocoOrigem.push(ed.nova(`Discounted because of your archetype${rotulo} +${fmt(r.total)}`, r.total))
      }
      if (Math.abs(arqRecalc - arqTexto) > 0.01 || casal) {
        const partes = Object.values(arq).filter(r => r.total > 0).map(r => `${r.nome} (${r.usados.join(', ')}) +${fmt(r.total)}`)
        if (casal) mudancas.push(`Desconto de arquétipo separado por contractor: ${partes.join('; ') || 'nenhum'}. O Interactive dava +${fmt(arqTexto)}.`)
        else mudancas.push(`Desconto de arquétipo: +${fmt(arqTexto)} → +${fmt(arqRecalc)}.`)
      }
    }

    // 4. Metade do preço da heritage que o outro já tem
    if (casal) {
      for (const linha of infoHeritage) {
        const meia = linha.copias.find(c => c.metade)
        if (!meia) continue
        const primeiro = linha.copias.find(c => !c.metade)
        if (meia.meia > 0) blocoOrigem.push(ed.nova(`Couple's Account: half price for ${nomeDe(meia.comprador)} on ${linha.L.titulo}${linha.L.complexo}, which ${nomeDe(primeiro.comprador)} already has +${fmt(meia.meia)}`, meia.meia))
        mudancas.push(`${linha.L.titulo}: os dois compram. ${nomeDe(primeiro.comprador)} paga ${fmt(primeiro.paga)}; ${nomeDe(meia.comprador)} paga ${fmt(meia.paga)} (metade de ${fmt(meia.custo - meia.desconto)}, o preço depois do desconto de arquétipo).`)
      }
    }
    if (blocoOrigem.length) ed.depois(ancora, ...blocoOrigem)

    // 5. Heritage: de quem é cada perk
    if (casal) {
      for (const linha of infoHeritage) {
        const L = linha.L
        const [primeira, segunda] = linha.copias
        ed.trocar(L.i, { texto: montarItem(L, nomeDe(primeira.comprador)) })
        if (segunda) ed.depois(L.i, ed.nova(montarItem(L, nomeDe(segunda.comprador)), -L.custo))
      }
    }

    // 6. Brindes da 2ª cópia
    if (brindesAdicionados.length) {
      aplicarBrindes(ed, modelo, talents, 'Talents')
      aplicarBrindes(ed, modelo, defenses, 'Defenses')
      mudancas.push(`Brindes da 2ª cópia de heritage somados: ${brindesAdicionados.map(b => `${b.nome} (${b.de})`).join(', ')}.`)
    }

    // 7. Repetidos
    if (usarTal) trocarLinhaDesconto(ed, modelo, 'descTalents', 'Discounted for duplicate talents', rep.talents, 'Talents', mudancas, talTexto, 'Talents repetidos')
    if (usarDef) trocarLinhaDesconto(ed, modelo, 'descDefenses', 'Discounted for duplicate defenses', rep.defenses, 'Defenses', mudancas, defTexto, 'Defenses repetidas')

    // 8. Defense Rebates
    if (usarReb) {
      if (modelo.rebates) {
        if (rebRecalc > 0) ed.trocar(modelo.rebates.i, { texto: `Defenses discounted for retinue members +${fmt(rebRecalc)}`, delta: rebRecalc })
        else ed.remover(modelo.rebates.i)
      }
      else if (rebRecalc > 0 && modelo.defenses.length) {
        const ult = modelo.defenses[modelo.defenses.length - 1]
        ed.depois(ult.i, ed.nova(`Defenses discounted for retinue members +${fmt(rebRecalc)}`, rebRecalc))
      }
      if (Math.abs(rebRecalc - rebTexto) > 0.01) {
        const doSO = casal && op.soRebates ? diferencaRebates(rebSemSO, rebCom) : ''
        mudancas.push(`Defense Rebates: +${fmt(rebTexto)} → +${fmt(rebRecalc)}${doSO ? ` (${so.nome}: ${doSO})` : ''}.`)
      }
    }

    // 9. Specific credit modifiers
    if (modelo.modsCab) {
      const mantidos = modelo.mods.filter(L => cfg.mods[chaveMod(L)] !== false)
      const tirados = modelo.mods.filter(L => cfg.mods[chaveMod(L)] === false)
      for (const L of tirados) { ed.remover(L.i); mudancas.push(`Saiu de "Specific credit modifiers": "${L.desc}" (${comSinal(L.valor)}). ${casal ? 'A ferramenta já faz essa conta.' : ''}`.trim()) }
      if (!mantidos.length) ed.remover(modelo.modsCab.i)
      else if (tirados.length) {
        const soma = arred(mantidos.reduce((a, L) => a + L.valor, 0))
        ed.trocar(modelo.modsCab.i, { texto: `Specific credit modifiers ${comSinal(soma)}`, delta: soma })
      }
    }

    // 9b. Challenges (bônus na linha de cada desafio) e Mission Rewards
    const resChallenges = aplicarChallenges(ed, modelo, cfg, banco, mudancas, avisos)
    const resMissoes = aplicarMissoes(ed, modelo, cfg, resChallenges.convertidas, mudancas)

    // 9c. O nome escolhido para cada contractor no lugar de "You" e "Your SO"
    aplicarApelidos(ed, modelo, c1, so)

    // 10. Resumo da Couple's Account no fim
    if (casal && op.resumoNoFim) {
      const herDe = id => infoHeritage.filter(l => l.copias.some(c => c.comprador === id)).map(l => `${l.L.titulo}${l.L.complexo}`)
      const arqDe = (p, id) => (arq[id] && arq[id].usados.length ? arq[id].usados : p.arquetipos).join(', ') || 'none'
      const linhaPessoa = (rotulo, p, id) => {
        const mundo = mundoDaPessoa(p, banco)
        return `${rotulo}: ${nomeComApelido(p)}${mundo ? ` (${mundo})` : ''} — ${descricaoOrigem(p)} — archetype: ${arqDe(p, id)} — heritage: ${herDe(id).join(', ') || 'none'}`
      }
      ed.fim(
        ed.nova('', null, 'vazio'),
        ed.nova("Couple's Account (Cooperative) — contractors", null),
        ed.nova(linhaPessoa('Contractor 1', c1, 'c1'), null),
        ed.nova(linhaPessoa('Contractor 2 (SO)', so, 'so'), null),
        ed.nova('Per person: Heritage, Template Stacking and Waifu Perks. Everything else in this build was bought once and works for both.', null),
      )
    }

    // ============================================================ saldos
    const lista = ed.lista()
    let saldo = null
    for (const e of lista) {
      if (e.tipo === 'budget' && e.L) { saldo = e.L.valor; continue }
      if (e.delta == null) continue
      if (saldo == null) saldo = 0
      saldo = arred(saldo + e.delta)
      if (e.colchete) e.saldo = saldo
    }
    const renderizar = e => (e.colchete ? `${e.texto} [${fmt(e.saldo)}]${e.doisPontos ? ':' : ''}` : e.texto)
    const texto = lista.map(renderizar).join('\n')
    // Para a tela: cada linha com o que aconteceu com ela.
    const linhasTela = ed.lista(true).map((e) => {
      if (e.removida) return { texto: e.L ? e.L.raw : e.texto, estado: 'removida' }
      const t = renderizar(e)
      if (e.nova) return { texto: t, estado: 'nova' }
      if (!e.L) return { texto: t, estado: 'igual' }
      if (e.texto !== (e.L.saldo != null ? e.L.cabeca : e.L.raw)) return { texto: t, estado: 'alterada', antes: e.L.raw }
      if (e.colchete && Math.abs((e.saldo ?? 0) - (e.L.saldo ?? 0)) > 0.001) return { texto: t, estado: 'saldo', antes: e.L.raw }
      return { texto: t, estado: 'igual' }
    })
    const saldoFinal = saldo == null ? 0 : saldo
    const saldoOriginal = modelo.conferenciaSaldos.saldoFinalMostrado
    if (saldoOriginal != null && Math.abs(saldoOriginal - saldoFinal) > 0.01) mudancas.push(`Saldo final: ${fmt(saldoOriginal)} → ${fmt(saldoFinal)}.`)
    if (saldoFinal < 0) avisos.push({ nivel: 'erro', texto: `O saldo final ficou negativo (${fmt(saldoFinal)}): com saldo abaixo de zero ele não compra nada e entra em dívida.` })

    const conferencia = [
      { chave: 'arquetipo', rotulo: 'Desconto de arquétipo', texto: arqTexto, recalculado: arqRecalc, usado: usarArq, travado: casal, detalhe: Object.values(arq).map(r => `${r.nome}: teto ${fmt(r.pool)}${r.usados.length ? `, ${r.usados.join(', ')} +${fmt(r.total)}` : ', nada descontado'}`).join(' · ') },
      { chave: 'talents', rotulo: 'Talents repetidos', texto: talTexto, recalculado: rep.talents, usado: usarTal, detalhe: talents.filter(t => t.qtd > 1 && !t.complexo).map(t => `${t.titulo} x${t.qtd}`).join(', ') },
      { chave: 'defenses', rotulo: 'Defenses repetidas', texto: defTexto, recalculado: rep.defenses, usado: usarDef, detalhe: defenses.filter(t => t.qtd > 2).map(t => `${t.titulo} x${t.qtd}`).join(', ') },
      { chave: 'rebates', rotulo: 'Defense Rebates', texto: rebTexto, recalculado: rebRecalc, usado: usarReb, detalhe: rebatesDesligados ? (modelo.drx ? 'desligados no DRX start' : 'desligados por Defense Rebates Disabled') : detalheRebates(rebCom) },
    ]

    return {
      texto, linhasTela, saldoFinal, saldoOriginal, mudancas, avisos, conferencia,
      heritage: infoHeritage.map(l => ({ chave: l.chave, titulo: l.L.titulo, escolha: l.L.complexo, arvore: l.info ? l.info.arvore : null, arquetipo: l.arquetipo, custo: l.L.custo, dono: l.dono, copias: l.copias.map(c => ({ comprador: c.comprador, nome: nomeDe(c.comprador), metade: c.metade, desconto: c.desconto || 0, meia: c.meia || 0, paga: c.paga })) })),
      arquetipos: arq,
      rebates: { semSO: rebSemSO, comSO: rebCom },
      origens: { c1Total, soTotal, reembolso },
      defesasBuild: Object.keys(defesasBuild),
      defesasQtd: defesasBuild,
      rebatesDesligados,
      challenges: resChallenges,
      missoes: resMissoes,
      sequito: montarSequito(modelo, cfg, rebCom),
      arvores: arvoresDaBuild(modelo, banco),
    }
  }

  function adicionarBrinde(lista, curto, q, banco, tipo, registro, de) {
    const nomeBusca = tipo === 'talent' ? banco.nomeTalent(curto) : banco.nomeDefesa(curto)
    let it = lista.find(x => !x.complexo && (tipo === 'talent' ? banco.nomeTalent(x.titulo) : banco.nomeDefesa(x.titulo)) === nomeBusca)
    if (!it) {
      it = { L: null, titulo: curto, dlc: false, qtd: 0, complexo: '', custo: 0, extra: 0, nova: true }
      lista.push(it)
    }
    it.qtd += q
    it.extra += q
    registro.push({ nome: `${curto}${q > 1 ? ` x${q}` : ''}`, de })
  }

  function aplicarBrindes(ed, modelo, lista, secao) {
    const mudados = lista.filter(x => x.extra > 0)
    if (!mudados.length) return
    const doBloco = secao === 'Talents' ? modelo.talents : modelo.defenses
    for (const it of mudados.filter(x => x.L)) ed.trocar(it.L.i, { texto: montarItem(it) })
    const novos = mudados.filter(x => !x.L).map(it => ed.nova(montarItem(it), -it.custo))
    if (!novos.length) return
    if (doBloco.length) { ed.depois(doBloco[doBloco.length - 1].i, ...novos); return }
    // Bloco não existe: cria antes de Misc Perks / companions / fim.
    const alvo = modelo.linhas.find(L => (L.tipo === 'cabecalho' && ['Misc Perks', 'Generic Waifu Perks', 'Waifu Perks'].includes(L.nome)) || ['compradosCab', 'capturadosCab', 'modsCab', 'missoesCab', 'rebates'].includes(L.tipo))
    const bloco = [ed.nova(secao, null), ...novos, ed.nova('', null, 'vazio')]
    if (alvo) ed.antes(alvo.i, ...bloco); else ed.fim(ed.nova('', null, 'vazio'), ...bloco)
  }

  function trocarLinhaDesconto(ed, modelo, campo, rotulo, valor, secao, mudancas, valorTexto, nomeHumano) {
    const L = modelo[campo]
    if (L) {
      if (valor > 0) ed.trocar(L.i, { texto: `${rotulo} +${fmt(valor)}`, delta: valor })
      else ed.remover(L.i)
    }
    else if (valor > 0) {
      const cab = modelo.linhas.find(x => x.tipo === 'cabecalho' && x.nome === secao)
      if (cab) ed.antes(cab.i, ed.nova(`${rotulo} +${fmt(valor)}`, valor))
    }
    if (Math.abs(valor - valorTexto) > 0.01) mudancas.push(`${nomeHumano}: +${fmt(valorTexto)} → +${fmt(valor)}.`)
  }

  function diferencaRebates(sem, com) {
    const partes = []
    for (const [nome, d] of Object.entries(com.porDefesa)) {
      const antes = sem.porDefesa[nome] ? sem.porDefesa[nome].desconto : 0
      if (d.desconto - antes > 0.001) partes.push(`${nome.replace(/ Defense$/, '')} +${fmt(d.desconto - antes)}`)
    }
    return partes.join(', ')
  }

  function detalheRebates(r) {
    return Object.entries(r.porDefesa).filter(([, d]) => d.desconto > 0)
      .map(([nome, d]) => `${nome.replace(/ Defense$/, '')} ${fmt(d.desconto)} (${d.quem.map(q => `${q.nome} ${fmt(q.valor)}`).join(', ')})`).join(' · ') || 'nenhum'
  }

  // A linha da tabela de budget que vale para a build: Legacy Difficulty usa sempre a linha 1.
  function intensidadeDoBudget(modelo) {
    if (modelo.legacy) return 1
    return modelo.intensidade != null ? Math.min(10, Math.max(0, modelo.intensidade)) : 1
  }
  function drDaBuild(modelo) {
    if (modelo.budget == null) return null
    const dr = budgetsPorDR(intensidadeDoBudget(modelo)).findIndex(b => b === modelo.budget)
    return dr > 0 ? dr : null
  }
  // Budget do DR na Intensity 1, a base do bônus que o card do Interactive mostra. DR 11 não tem budget.
  function budgetLegado(dr) { return dr >= 11 ? 0 : (budgetsPorDR(1)[dr] || 0) }

  // Bônus dos challenges, na linha de cada desafio. Devolve a lista com o que entrou.
  function aplicarChallenges(ed, modelo, cfg, banco, mudancas, avisos) {
    const op = cfg.opcoes || {}
    const metodo = op.bonusChallenge || 'intensity'
    const cc = cfg.challenges || { adicionados: [], semBonus: [], dr: null }
    const drBuild = drDaBuild(modelo)
    const dr = cc.dr || drBuild
    const missoes = cfg.missoes || copiarMissoes(modelo.missoes)
    // Bônus lançado à mão como missão ("Power Trip in Challenges"): vira o bônus do próprio challenge.
    const convertidas = metodo === 'nenhum' ? [] : missoes.filter((m) => { const c = banco.challenge(m.titulo); return !!(c && c.bonus > 0 && creditosDaMissao(m) > 0) })
    const ativos = []
    const juntar = (titulo, origem, L) => {
      if (ativos.some(a => normalizar(a.titulo) === normalizar(titulo))) return
      const info = banco.challenge(titulo)
      ativos.push({ titulo: info ? info.titulo : titulo, info, origem, L })
    }
    for (const L of modelo.challenges) juntar(L.titulo, 'texto', L)
    for (const t of cc.adicionados || []) juntar(t, 'adicionado', null)
    for (const m of convertidas) juntar(m.titulo, 'missao', null)

    const semBonus = new Set((cc.semBonus || []).map(normalizar))
    const comBonus = ativos.filter(a => a.info && a.info.bonus > 0 && !semBonus.has(normalizar(a.titulo)))
    const baseLeg = dr ? budgetLegado(dr) : null
    const base0 = metodo === 'legacy' ? baseLeg : modelo.budget
    const pt = comBonus.find(a => normalizar(a.titulo) === 'power trip')
    const dobra = !!(pt && op.powerTripDobra && base0 != null)
    const baseOutros = base0 != null ? arred(base0 * (dobra ? 1 + pt.info.bonus : 1)) : null
    for (const a of ativos) {
      a.bonus = a.info ? (a.info.bonus || 0) : 0
      a.aplicado = metodo !== 'nenhum' && comBonus.includes(a) && base0 != null
      a.base = a === pt ? base0 : baseOutros
      a.valor = a.aplicado ? arred(a.base * a.bonus) : 0
    }
    const deQue = a => (metodo === 'legacy' ? `o budget do DR ${dr} na Intensity 1` : 'o budget da build') + (dobra && a !== pt ? ', dobrado pelo Power Trip' : '')
    const linha = a => (a.aplicado
      ? `${a.titulo} (challenge bonus: ${fmt(a.bonus * 100)}% of ${fmt(a.base)}${metodo === 'legacy' ? ', legacy values' : ''}) +${fmt(a.valor)}`
      : `${a.titulo} free`)

    for (const a of ativos.filter(x => x.origem === 'texto' && x.aplicado)) ed.trocar(a.L.i, { texto: linha(a), delta: a.valor })
    const novos = ativos.filter(x => x.origem !== 'texto')
    if (novos.length) {
      const linhas = novos.map(a => ed.nova(linha(a), a.valor))
      if (modelo.challenges.length) ed.depois(modelo.challenges[modelo.challenges.length - 1].i, ...linhas)
      else if (modelo.challengesCab) ed.depois(modelo.challengesCab.i, ...linhas)
      else {
        const bloco = [ed.nova('Challenges', null), ...linhas, ed.nova('', null, 'vazio')]
        const alvo = modelo.linhas.find(L => L.tipo === 'intensidade') || modelo.linhas.find(L => L.tipo === 'opcaoInt') || modelo.origem
          || modelo.linhas.find(L => L.tipo === 'cabecalho' && L.nome !== 'Patron')
        const budget = modelo.linhas.find(L => L.tipo === 'budget')
        if (alvo) ed.antes(alvo.i, ...bloco)
        else if (budget) ed.depois(budget.i, ed.nova('', null, 'vazio'), ...bloco)
        else ed.fim(...bloco)
      }
    }

    for (const a of ativos) {
      if (a.origem === 'adicionado') mudancas.push(`${a.titulo} entrou em Challenges.`)
      if (a.aplicado) mudancas.push(`${a.titulo}: bônus de ${fmt(a.bonus * 100)}% sobre ${fmt(a.base)} (${deQue(a)}), +${fmt(a.valor)}.`)
    }
    for (const m of convertidas) {
      const a = ativos.find(x => normalizar(x.titulo) === normalizar(m.titulo))
      const antes = creditosDaMissao(m)
      mudancas.push(`${m.titulo} saiu de Mission Rewards (${fmt(antes)}): o bônus agora fica na linha do challenge${a && a.aplicado ? ` (+${fmt(a.valor)})` : ''}.`)
      if (a && a.aplicado && Math.abs(a.valor - antes) > 0.01) avisos.push({ nivel: 'aviso', texto: `${m.titulo}: em Mission Rewards estava ${fmt(antes)}; pela base escolhida na aba Challenges, o bônus é ${fmt(a.valor)}.` })
    }

    // Requisitos de cada desafio, como o Interactive escreve.
    const nomes = new Set([...modelo.opcoesInt.map(L => normalizar(L.nome)), ...modelo.linhas.filter(L => L.tipo === 'item').map(L => normalizar(L.titulo)), ...ativos.map(a => normalizar(a.titulo))])
    for (const a of ativos) {
      const c = a.info
      if (!c) continue
      if (c.minDR && dr && dr < c.minDR) avisos.push({ nivel: 'erro', texto: `${c.titulo} pede mundo de DR ${c.minDR} ou mais, e este é DR ${dr}.` })
      if (c.semDR11 && dr === 11) avisos.push({ nivel: 'erro', texto: `${c.titulo} não pode ser escolhido num mundo de DR 11.` })
      const conflito = (c.blacklist || []).filter(t => nomes.has(normalizar(t)))
      if (conflito.length) avisos.push({ nivel: 'erro', texto: `${c.titulo} não combina com ${conflito.join(', ')}.` })
      const falta = (c.whitelist || []).filter(t => !nomes.has(normalizar(t)))
      if (falta.length) avisos.push({ nivel: 'erro', texto: `${c.titulo} pede ${falta.join(', ')}, que não está na build.` })
      if (normalizar(c.titulo) === 'glass cannon' && modelo.defenses.length) avisos.push({ nivel: 'aviso', texto: 'Glass Cannon tira todas as Defenses da Company, e a build compra Defenses.' })
    }
    if (metodo === 'legacy' && comBonus.length && base0 == null) avisos.push({ nivel: 'aviso', texto: 'Para os valores legados, escolha o DR do mundo na aba Challenges: não achei o DR pelo budget.' })
    if (metodo === 'nenhum' && comBonus.length) avisos.push({ nivel: 'info', texto: `Bônus de challenge desligado (aba Challenges): ${comBonus.map(a => a.titulo).join(', ')} ficam sem créditos, como no Interactive sem Legacy Difficulty.` })

    return {
      metodo, dr, drBuild, base: base0, baseOutros, baseLegado: baseLeg, budget: modelo.budget, dobra,
      total: arred(ativos.reduce((s, a) => s + a.valor, 0)),
      convertidas,
      lista: ativos.map(a => ({ titulo: a.titulo, origem: a.origem, conhecido: !!a.info, bonus: a.bonus, aplicado: a.aplicado, base: a.base, valor: a.valor })),
    }
  }

  // Séquito: cada membro com como entrou, a situação e o que dá de Defense Rebate. O SO da Couple's
  // Account fica de fora: na conta ele é o contractor 2.
  function montarSequito(modelo, cfg, rebates) {
    const soLinha = cfg.casal && cfg.so && cfg.so.fonte === 'comprado' ? cfg.so.linha : null
    const membros = [...modelo.comprados, ...modelo.capturados].filter(L => L.i !== soLinha).map((L) => {
      const metodo = String(L.metodo || '').trim().toLowerCase() || 'buy'
      const papel = String(L.papel || '').trim() || 'Companion'
      const comp = (cfg.companions || []).find(c => c.linha === L.i)
      const id = comp ? comp.id : null
      const deu = id ? Object.entries(rebates.porDefesa).flatMap(([nome, d]) => d.quem.filter(q => q.id === id).map(q => ({ defesa: curtoDefesa(nome), valor: q.valor }))) : []
      return {
        id, linha: L.i, nome: L.nome, tier: L.tier, mundo: L.mundo || '', metodo, papel, vendido: !!L.vendido,
        swap: L.swap || null, perk: L.perk || null, ativo: !L.vendido && !FORA_DOS_REBATES.includes(papel), rebates: deu,
      }
    })
    const contar = f => membros.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m }, {})
    return {
      membros,
      porMetodo: contar(x => x.metodo),
      porPapel: contar(x => (x.vendido ? 'vendido' : x.papel)),
      ativos: membros.filter(x => x.ativo).length,
      so: soLinha != null ? cfg.so.nome : null,
    }
  }

  // Mission Rewards: refaz o bloco com uma missão por linha e soma os créditos.
  function aplicarMissoes(ed, modelo, cfg, convertidas, mudancas) {
    const todas = cfg.missoes || copiarMissoes(modelo.missoes)
    const finais = todas.filter(m => !convertidas.includes(m) && String(m.titulo || '').trim())
    const total = arred(finais.reduce((a, m) => a + creditosDaMissao(m), 0))
    const totalTexto = modelo.missoesCab ? modelo.missoesCab.valor : 0
    const linhas = textoMissoes(finais)
    const originais = modelo.linhas.filter(L => L.tipo === 'missao')
    const igual = linhas.join('\n') === originais.filter(L => L.raw.trim()).map(L => L.raw).join('\n') && Math.abs(total - totalTexto) < 0.01
    if (!igual) {
      if (modelo.missoesCab) {
        for (const L of originais) ed.remover(L.i)
        if (finais.length) {
          ed.trocar(modelo.missoesCab.i, { texto: `Mission Rewards ${comSinal(total)}`, delta: total })
          ed.depois(modelo.missoesCab.i, ...linhas.map(t => ed.nova(t, null)))
        }
        else ed.remover(modelo.missoesCab.i)
      }
      else if (finais.length) {
        const cab = ed.nova(`Mission Rewards ${comSinal(total)}`, total)
        cab.doisPontos = true
        ed.fim(ed.nova('', null, 'vazio'), cab, ...linhas.map(t => ed.nova(t, null)))
      }
    }
    const chave = m => `${normalizar(m.titulo)}|${normalizar(m.local)}`
    const antes = modelo.missoes.filter(m => !convertidas.some(c => chave(c) === chave(m)))
    for (const m of finais) {
      const a = antes.find(x => chave(x) === chave(m))
      if (!a) mudancas.push(`Missão nova em Mission Rewards: ${m.titulo}${m.local ? ` in ${m.local}` : ''} (+${fmt(creditosDaMissao(m))} em créditos).`)
      else if (assinaturaMissoes([a]) !== assinaturaMissoes([m])) mudancas.push(`Recompensas mudadas em ${m.titulo}: ${fmt(creditosDaMissao(a))} → ${fmt(creditosDaMissao(m))} em créditos.`)
    }
    for (const a of antes) if (!finais.some(m => chave(m) === chave(a))) mudancas.push(`Saiu de Mission Rewards: ${a.titulo}${a.local ? ` in ${a.local}` : ''}.`)
    if (Math.abs(total - totalTexto) > 0.01) mudancas.push(`Mission Rewards: ${comSinal(totalTexto)} → ${comSinal(total)}.`)
    else if (!igual && finais.length) mudancas.push('Mission Rewards: uma missão e uma recompensa por linha, para a LLM ler melhor.')
    return { lista: finais, total, totalTexto }
  }

  // Budget inicial do Interactive para cada DR, na Intensity dada.
  function budgetsPorDR(I) {
    const fi = (Math.sqrt(5) + 1) / 2
    const temp = []
    for (let i = 0; i < 9; i++) temp.push((temp[i - 1] || 2500) / fi)
    temp.unshift(2500); temp.push(0); temp.reverse()
    return temp.map(w => Math.round(Math.round(w * (2.5 / (Math.min(10, Math.max(0, I)) + 1.5)) / 5) * 5))
  }

  // ------------------------------------------------------------------ Meus personagens: importar, guardar, backup

  // Registro guardado: { id: 'm:…', nome, mundo, sub, tier, defesas: [siglas], arquetipos: [árvores],
  //   base: linha do banco de onde foi copiado (ou null), fonte: 'novo' | 'banco' | 'interactive', uidInteractive, nota }
  function novoIdMeu() { return `m:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` }

  function siglaDaTag(t) {
    const s = String(t || '').trim()
    if (TAG_DEFESA[s] || TAG_ARQUETIPO[s]) return s
    return TAG_POR_NOME[s.toLowerCase()] || null
  }

  // Aceita um personagem local exportado pelo Interactive ({ name, world, sub, tier, tags, uid })
  // ou um registro do backup desta ferramenta.
  function registroDeObjeto(o) {
    if (!o || typeof o !== 'object') return null
    const nome = String(o.nome ?? o.name ?? o.n ?? '').trim().slice(0, 120)
    if (!nome) return null
    const tierBruto = o.tier ?? o.t
    const tier = typeof tierBruto === 'number' ? tierBruto : tierNum(tierBruto)
    const doInteractive = o.nome == null
    const uid = o.uidInteractive ?? o.uid ?? o.u ?? null
    const r = {
      id: typeof o.id === 'string' && /^m:[\w-]+$/.test(o.id) ? o.id : novoIdMeu(),
      nome,
      mundo: String(o.mundo ?? o.world ?? o.w ?? '').trim().slice(0, 120),
      sub: String(o.sub ?? o.d ?? '').trim().slice(0, 120),
      tier: Math.min(13, Math.max(0, Math.round(Number(tier) || 0))),
      defesas: [], arquetipos: [],
      base: Number.isInteger(o.base) ? o.base : null,
      fonte: ['novo', 'banco', 'interactive'].includes(o.fonte) ? o.fonte : (doInteractive ? 'interactive' : 'novo'),
      uidInteractive: uid == null ? null : String(uid),
      nota: typeof o.nota === 'string' ? o.nota.slice(0, 500) : '',
    }
    if (Array.isArray(o.defesas)) r.defesas = [...new Set(o.defesas.filter(t => TAG_DEFESA[t]))]
    if (Array.isArray(o.arquetipos)) r.arquetipos = [...new Set(o.arquetipos.filter(a => typeof a === 'string' && a.trim()).map(a => a.trim()))]
    let tags = o.tags ?? o.b ?? []
    if (typeof tags === 'string') tags = tags.split(/[,;\s]+/)
    for (const t of Array.isArray(tags) ? tags : []) {
      const s = siglaDaTag(t)
      if (s && TAG_DEFESA[s] && !r.defesas.includes(s)) r.defesas.push(s)
      else if (s && TAG_ARQUETIPO[s] && !r.arquetipos.includes(TAG_ARQUETIPO[s])) r.arquetipos.push(TAG_ARQUETIPO[s])
    }
    return r
  }

  // Lê o que foi colado ou carregado: o Export do Interactive (lista de personagens locais) ou um backup desta ferramenta.
  function lerImportacao(texto) {
    let dados
    try { dados = JSON.parse(String(texto || '').trim()) }
    catch (e) { return { erro: 'Esse texto não é um JSON. Cole tudo o que o Export do Interactive copiou, ou o conteúdo de um backup desta ferramenta.' } }
    let lista
    let formato
    if (Array.isArray(dados)) { lista = dados; formato = 'interactive' }
    else if (dados && Array.isArray(dados.personagens)) { lista = dados.personagens; formato = 'backup' }
    else if (dados && typeof dados === 'object' && (dados.name || dados.nome)) { lista = [dados]; formato = 'interactive' }
    else return { erro: 'Não achei uma lista de personagens nesse texto.' }
    const registros = []
    let ignorados = 0
    for (const o of lista) {
      const r = registroDeObjeto(o)
      if (r) registros.push(r); else ignorados++
    }
    return { registros, ignorados, formato }
  }

  // Junta os importados aos que já existem. O mesmo personagem (mesmo id, mesmo uid do Interactive,
  // ou mesmo nome e mundo) é atualizado, não duplicado.
  function mesclarMeus(atuais, novos) {
    const lista = (atuais || []).map(r => ({ ...r }))
    let adicionados = 0
    let atualizados = 0
    for (const n of novos || []) {
      const i = lista.findIndex(r => r.id === n.id
        || (n.uidInteractive != null && r.uidInteractive === n.uidInteractive)
        || (normalizar(r.nome) === normalizar(n.nome) && normalizar(r.mundo) === normalizar(n.mundo)))
      if (i >= 0) { lista[i] = { ...lista[i], ...n, id: lista[i].id }; atualizados++ }
      else { lista.push(n); adicionados++ }
    }
    return { lista, adicionados, atualizados }
  }

  function backupMeus(lista) {
    return JSON.stringify({ formato: 'wcfix-personagens', versao: 1, personagens: lista || [] }, null, 2)
  }

  // Registro novo a partir de uma pessoa da build, com as tags que valem para ela agora.
  function registroDePessoa(p, banco) {
    const c = p.personagem != null ? banco.personagem(p.personagem) : null
    const tierBuild = (p.swap && p.swap.tier) || p.tier || 0
    return {
      id: novoIdMeu(),
      nome: c ? c.nome : (p.swap ? p.swap.nome : personagemDoNome(p.nome)),
      mundo: c ? c.mundo : (p.mundo || ''),
      sub: c ? c.sub : '',
      tier: c ? (c.tier || tierBuild) : tierBuild,
      defesas: (p.tagsDef || []).slice(),
      // O arquétipo que veio da linha "+N" da build fica na build, não no personagem.
      arquetipos: (p.arquetipos || []).filter(a => !(p.arqAuto || []).includes(a)),
      base: c ? (c.meu ? c.base : c.idx) : null,
      fonte: c && !c.meu ? 'banco' : 'novo',
      uidInteractive: null,
      nota: '',
    }
  }

  raiz.WCFix = {
    analisar, criarBanco, bancoMinimo, configPadrao, calcular,
    pessoaSO, pessoaCompanion, refazerCompanions, fontesSO, tagsDoPersonagem, resolverPessoa, resolverTudo, alternarTag, semMexidas,
    custoOrigemPadrao, chaveHeritage, chaveMod, budgetsPorDR, tier1a, poolArquetipo, tetoRebate, personagemDoNome,
    apelidoDe, quemDaLinha, nomeComApelido,
    novoIdMeu, registroDeObjeto, lerImportacao, mesclarMeus, backupMeus, registroDePessoa,
    lerMissoes, creditosDaMissao, drDaBuild, budgetLegado,
    PRECO_TIER, TAG_DEFESA, DEFESA_TAG, TAG_ARQUETIPO, ARQUETIPOS, TIPOS_ORIGEM, CONDICAO_DEFESA, CHALLENGES_PADRAO,
    METODOS_SEQUITO, PAPEIS_SEQUITO, VENDIDO_SEQUITO, FORA_DOS_REBATES,
    fmt, tierTxt, tierNum, precoTier, normalizar, semPrefixo, curtoDefesa,
  }
})(typeof window !== 'undefined' ? window : globalThis)
