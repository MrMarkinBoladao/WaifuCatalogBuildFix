// Atualiza dados/interactive-dados.js a partir do Interactive (https://waifu-catalog.neocities.org).
//
// Uso: node atualizar-dados.mjs            -> baixa os arquivos do site
//      node atualizar-dados.mjs <pasta>    -> usa index.js, characters.js e userCharacters.js já baixados
//
// Se o Interactive não mudou desde a última vez, não grava nada: o GitHub Actions roda isto toda semana
// (.github/workflows/atualizar-dados.yml) e só faz commit quando um arquivo muda.
//
// Só precisa do Node.js. O leitor de JavaScript (acorn, licença MIT) vem junto, na pasta vendor/,
// porque o npm não grava direito dentro do Google Drive.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as acorn from './vendor/acorn.mjs'
import * as walk from './vendor/acorn-walk.mjs'
import { montar, SAIDA as PAGINA } from './montar.mjs'

const SITE = 'https://waifu-catalog.neocities.org/assets/'
const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SAIDA = path.join(AQUI, '..', 'dados', 'interactive-dados.js')

async function lerArquivo(nome, pastaLocal) {
  if (pastaLocal) return fs.readFileSync(path.join(pastaLocal, nome), 'utf8')
  const resp = await fetch(SITE + nome)
  if (!resp.ok) throw new Error(`Não consegui baixar ${nome}: HTTP ${resp.status}`)
  return await resp.text()
}

// Converte um nó literal do acorn em valor JS. Devolve undefined para o que não é literal.
function literal(no) {
  if (!no) return undefined
  switch (no.type) {
    case 'Literal': return no.value
    case 'TemplateLiteral': return no.expressions.length ? undefined : no.quasis.map(q => q.value.cooked).join('')
    case 'UnaryExpression':
      if (no.operator === '-' && no.argument.type === 'Literal') return -no.argument.value
      if (no.operator === '!' && no.argument.type === 'Literal') return !no.argument.value
      return undefined
    case 'ArrayExpression': return no.elements.map(literal)
    case 'ObjectExpression': {
      const o = {}
      for (const p of no.properties) {
        if (p.type !== 'Property') continue
        const k = p.key.type === 'Identifier' ? p.key.name : p.key.value
        if (k === 'desc' || k === 'types' || k === 'additionalDesc') continue
        o[k] = literal(p.value)
      }
      return o
    }
    default: return undefined
  }
}

function brindes(f) {
  // { talentPerks: [{title, count}], defensePerks: [...] } -> { t: {nome: qtd}, d: {nome: qtd} }
  if (!f || typeof f !== 'object') return undefined
  const r = {}
  for (const [chave, sigla] of [['talentPerks', 't'], ['defensePerks', 'd']]) {
    if (!Array.isArray(f[chave])) continue
    for (const b of f[chave]) {
      if (!b || typeof b.title !== 'string') continue
      r[sigla] ??= {}
      r[sigla][b.title] = (r[sigla][b.title] || 0) + (b.count || 1)
    }
  }
  return Object.keys(r).length ? r : undefined
}

function extrairPerks(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
  const perks = []
  walk.full(ast, (no) => {
    if (no.type !== 'ObjectExpression') return
    const o = literal(no)
    if (typeof o.title === 'string' && typeof o.category === 'string') perks.push(o)
  })
  const heritages = []
  const vistos = new Set()
  for (const p of perks.filter(p => p.category === 'Heritage')) {
    const chave = `${p.title}|${p.tree}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    const h = { n: p.title, arvore: p.tree, c: typeof p.cost === 'number' ? p.cost : 0 }
    if (p.costT) h.img = p.costT
    if (p.dlc) h.dlc = 1
    const f = brindes(p.freebies)
    if (f) h.brindes = f
    if (p.typeFreebies && typeof p.typeFreebies === 'object') {
      const tf = {}
      for (const [tipo, fb] of Object.entries(p.typeFreebies)) {
        const b = brindes(fb)
        if (b) tf[tipo] = b
      }
      if (Object.keys(tf).length) h.brindesPorTipo = tf
    }
    heritages.push(h)
  }
  const precos = cat => Object.fromEntries(perks.filter(p => p.category === cat && typeof p.cost === 'number').map(p => [p.title, p.cost]))
  return { heritages, talents: precos('Talent'), defenses: precos('Defense'), perks: catalogo(perks) }
}

// Os outros perks, só com o que as contas usam: a família e o requisito de cada binding (para achar a
// binding básica do DRX start), os Talents e Defenses que cada um dá de graça, se é DLC e se é só na criação.
const CATEGORIAS_CATALOGO = new Set(['Binding', 'Lure', 'Lure Expansion', 'Other Control', 'Other Controls', 'Talent', 'Defense', 'Misc', 'Misc Perk', 'Generic', 'Home', 'RidePerk'])
function catalogo(perks) {
  const lista = []
  const vistos = new Set()
  for (const p of perks) {
    if (!CATEGORIAS_CATALOGO.has(p.category) || typeof p.title !== 'string') continue
    const chave = `${p.category}|${p.title}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    const r = { n: p.title, cat: p.category, c: typeof p.cost === 'number' ? p.cost : 0 }
    if (typeof p.type === 'string') r.tipo = p.type
    if (Array.isArray(p.whitelist) && p.whitelist.length) r.req = p.whitelist.filter(x => typeof x === 'string')
    if (p.dlc) r.dlc = 1
    if (p.chargen === true || /chargen only/i.test(String(p.special || ''))) r.cg = 1
    const b = brindes(p.freebies)
    if (b) r.b = b
    lista.push(r)
  }
  return lista
}

// A lista da página Challenges: o array que tem Power Trip e Two Dime. Só os campos que a conta usa.
function extrairChallenges(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
  const titulo = o => literal((o.properties.find(p => p.type === 'Property' && (p.key.name || p.key.value) === 'title') || {}).value)
  let lista = null
  walk.full(ast, (no) => {
    if (lista || no.type !== 'ArrayExpression') return
    const objs = no.elements.filter(e => e && e.type === 'ObjectExpression')
    if (objs.some(o => titulo(o) === 'Power Trip') && objs.some(o => titulo(o) === 'Two Dime')) lista = objs
  })
  if (!lista) return []
  return lista.map((o) => {
    const c = literal(o)
    const r = { titulo: c.title }
    if (typeof c.bonus === 'number') r.bonus = c.bonus
    if (typeof c.special === 'string') r.special = c.special
    for (const k of ['blacklist', 'whitelist']) if (Array.isArray(c[k])) r[k] = c[k].filter(x => typeof x === 'string')
    if (typeof c.needed === 'number') r.needed = c.needed
    const b = brindes(c.freebies)
    if (b) r.brindes = b
    return r
  }).filter(c => typeof c.titulo === 'string')
}

function extrairPersonagens(src) {
  // O arquivo é "const a=JSON.parse(`[...]`);export{a as default}".
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' })
  let json
  walk.full(ast, (no) => {
    if (json || no.type !== 'CallExpression') return
    const arg = no.arguments[0]
    if (no.callee.type === 'MemberExpression' && no.callee.object.name === 'JSON' && arg?.type === 'TemplateLiteral') json = arg.quasis.map(q => q.value.cooked).join('')
  })
  if (!json) throw new Error('Não achei a lista de personagens no arquivo.')
  return JSON.parse(json)
}

// Os dados já gravados em dados/interactive-dados.js, sem a data (null se o arquivo não existe ou não abre).
function dadosAtuaisSemData() {
  try {
    const m = fs.readFileSync(SAIDA, 'utf8').match(/^window\.WC_DADOS = (\{.*\});\s*$/m)
    if (!m) return null
    const d = JSON.parse(m[1])
    delete d.geradoEm
    return JSON.stringify(d)
  } catch (e) {
    return null
  }
}
function semData(dados) {
  const d = { ...dados }
  delete d.geradoEm
  return JSON.stringify(d)
}

// Grava só se o conteúdo mudou. Devolve true quando gravou.
function gravarSeMudou(arquivo, texto) {
  if (fs.existsSync(arquivo) && fs.readFileSync(arquivo, 'utf8') === texto) return false
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.writeFileSync(arquivo, texto, 'utf8')
  return true
}

// Só as tags que a ferramenta usa: as 17 de Defense (Defense Rebates) e as que batem com árvores de heritage.
const TAGS_UTEIS = new Set(['st', 'hr', 'hz', 'mt', 'cl', 'ml', 'ps', 'bj', 'dr', 'id', 'pl', 'ur', 'cr', 'sc', 'di', 'fm', 'tm', 'dg', 'th', 'ot', 'pp', 'pi', 'cu', 'mm'])

async function main() {
  const pastaLocal = process.argv[2]
  console.log(pastaLocal ? `Lendo os arquivos de ${pastaLocal}…` : 'Baixando os arquivos do Interactive…')
  const [indexJs, oficiais, deUsuarios] = await Promise.all([
    lerArquivo('index.js', pastaLocal),
    lerArquivo('characters.js', pastaLocal),
    lerArquivo('userCharacters.js', pastaLocal),
  ])
  const { heritages, talents, defenses, perks } = extrairPerks(indexJs)
  if (heritages.length < 50 || Object.keys(defenses).length < 10) throw new Error('Poucos perks encontrados: o formato do Interactive deve ter mudado.')
  if (perks.filter(p => p.cat === 'Binding').length < 10) console.log('Aviso: achei poucas bindings; a página usa a lista de bindings básicas que vem nela.')
  const challenges = extrairChallenges(indexJs)
  if (challenges.length < 10) console.log('Aviso: não achei a lista de challenges; a página usa a lista que vem nela.')

  const mundos = []
  const idxMundo = new Map()
  const personagens = []
  for (const lista of [extrairPersonagens(oficiais), extrairPersonagens(deUsuarios)]) {
    for (const c of lista) {
      if (typeof c.n !== 'string') continue
      const w = c.w || ''
      if (!idxMundo.has(w)) { idxMundo.set(w, mundos.length); mundos.push(w) }
      const tags = (c.b || []).map(t => (t === 'Phoenix' || t === 'phoenix') ? 'ph' : t).filter(t => TAGS_UTEIS.has(t) || t === 'ph')
      personagens.push([c.n, idxMundo.get(w), c.d || '', c.t ?? 0, [...new Set(tags)].join(' ')])
    }
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const dados = { geradoEm: hoje, fonte: 'https://waifu-catalog.neocities.org', heritages, talents, defenses, perks, challenges: challenges.length >= 10 ? challenges : undefined, mundos, personagens }
  console.log(`Lidos: ${heritages.length} perks de heritage, ${perks.length} outros perks, ${Object.keys(talents).length} talents, ${Object.keys(defenses).length} defenses, ${challenges.length} challenges, ${personagens.length} personagens.`)
  if (dadosAtuaisSemData() === semData(dados)) {
    console.log('Nada novo no Interactive: os dados continuam os mesmos.')
  } else {
    const texto = `// Gerado por ferramentas/atualizar-dados.mjs em ${hoje}, a partir do Interactive (${dados.fonte}).\n`
      + '// Não edite à mão: rode ferramentas/atualizar-dados.bat para refazer.\n'
      + `window.WC_DADOS = ${JSON.stringify(dados)};\n`
    gravarSeMudou(SAIDA, texto)
    console.log(`Dados novos gravados: ${SAIDA} (${(texto.length / 1024 / 1024).toFixed(1)} MB)`)
  }
  // A página leva os dados dentro dela: refaz se algo mudou (dados novos ou arquivos de fonte/).
  if (gravarSeMudou(PAGINA, montar())) console.log(`Página refeita: ${PAGINA}`)
  else console.log('A página já estava em dia.')
}

main().catch((e) => { console.error(`ERRO: ${e.message}`); process.exit(1) })
