// Os textos da página que precisam de tradução: os tr('...') de fonte/*.js, os data-t de fonte/pagina.html e os
// textos fixos do motor (condições das Defenses, marcas da retinue, resumos dos challenges, nomes das verbas).
// Uso: node traducoes.mjs   -> lista o que falta em fonte/traducao-en.js
//      node traducoes.mjs --todas   -> lista todos os textos
// O montar.mjs avisa quando falta alguma tradução.

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import * as acorn from './vendor/acorn.mjs'
import * as walk from './vendor/acorn-walk.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const FONTE = path.join(AQUI, '..', 'fonte')
const SCRIPTS = ['motor.js', 'saves.js', 'interface.js']

export function chavesUsadas() {
  const chaves = new Set()
  for (const arq of SCRIPTS) {
    const ast = acorn.parse(fs.readFileSync(path.join(FONTE, arq), 'utf8'), { ecmaVersion: 'latest' })
    walk.full(ast, (n) => {
      if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier' || n.callee.name !== 'tr') return
      const a = n.arguments[0]
      if (a && a.type === 'Literal' && typeof a.value === 'string') chaves.add(a.value)
      else if (a && a.type === 'TemplateLiteral' && !a.expressions.length) chaves.add(a.quasis[0].value.cooked)
    })
  }
  const html = fs.readFileSync(path.join(FONTE, 'pagina.html'), 'utf8')
  const desfazer = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
  for (const m of html.matchAll(/\sdata-t(?:-[\w-]+)?=(?:"([^"]*)"|'([^']*)')/g)) chaves.add(desfazer(m[1] ?? m[2]))
  chaves.add('Caderno do Contractor — Waifu Catalog')
  // Textos fixos do motor, traduzidos na hora de mostrar.
  const g = {}
  g.window = g
  vm.runInNewContext(fs.readFileSync(path.join(FONTE, 'motor.js'), 'utf8'), g)
  const W = g.WCFix
  for (const v of Object.values(W.CONDICAO_DEFESA)) chaves.add(v)
  for (const mapa of [W.METODOS_SEQUITO, W.PAPEIS_SEQUITO, { v: W.VENDIDO_SEQUITO }]) for (const x of Object.values(mapa)) { chaves.add(x.nome); chaves.add(x.desc) }
  for (const c of W.CHALLENGES_PADRAO) if (c.desc) chaves.add(c.desc)
  for (const v of W.VERBAS_DRX) chaves.add(v.nome)
  // As marcas dos arquivos .txt (saves.js), traduzidas por uma variável.
  chaves.add('----- Texto corrigido da build -----')
  chaves.add('----- Dados para carregar no Caderno do Contractor (não edite daqui para baixo) -----')
  chaves.delete('')
  return [...chaves]
}

export function lerTraducao() {
  const g = {}
  g.window = g
  vm.runInNewContext(fs.readFileSync(path.join(FONTE, 'traducao-en.js'), 'utf8'), g)
  return g.WC_TRADUCAO_EN || {}
}

export function faltando() {
  const en = lerTraducao()
  return chavesUsadas().filter(k => !Object.prototype.hasOwnProperty.call(en, k))
}
export function sobrando() {
  const usadas = new Set(chavesUsadas())
  return Object.keys(lerTraducao()).filter(k => !usadas.has(k))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lista = process.argv.includes('--todas') ? chavesUsadas() : faltando()
  for (const k of lista) console.log(JSON.stringify(k))
  if (!process.argv.includes('--todas')) {
    const sobra = sobrando()
    console.error(`${lista.length} sem tradução; ${sobra.length} traduções que nada usa.`)
    if (process.argv.includes('--sobrando')) for (const k of sobra) console.error(`sobrando: ${JSON.stringify(k)}`)
  }
}
