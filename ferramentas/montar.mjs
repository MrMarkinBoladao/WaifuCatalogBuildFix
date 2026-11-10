// Junta fonte/pagina.html, o CSS, os scripts e os dados num arquivo só: WaifuCatalogBuildFix.html.
// Um arquivo só abre em qualquer lugar: no PC com dois cliques, e no celular pelo app de arquivos ou do Drive,
// onde uma página não consegue carregar outros arquivos da mesma pasta.
//
// Uso: node montar.mjs   (o atualizar-dados.mjs já roda isto no fim)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.join(AQUI, '..')
const FONTE = path.join(RAIZ, 'fonte')
export const SAIDA = path.join(RAIZ, 'WaifuCatalogBuildFix.html')

// Dentro de <script>, "</script" e "<!--" confundem o leitor de HTML. Em JS, "<\/" e "<\!" valem o mesmo.
const seguroJs = s => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')

export function montar() {
  const ler = rel => fs.readFileSync(path.resolve(FONTE, rel), 'utf8')
  let html = ler('pagina.html')
  html = html.replace(/<!-- Página-fonte:[^>]*-->/, '<!-- Gerado por ferramentas/montar.mjs a partir da pasta fonte/. Não edite este arquivo: edite fonte/ e rode o montar. -->')
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, rel) => `<style>\n${ler(rel).replace(/<\/(style)/gi, '<\\/$1')}</style>`)
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, rel) => `<script>\n${seguroJs(ler(rel)).trimEnd()}\n</script>`)
  if (/<script src=|<link rel="stylesheet"/.test(html)) throw new Error('Sobrou um arquivo sem juntar na página.')
  return html
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = montar()
  fs.writeFileSync(SAIDA, html, 'utf8')
  const gravado = fs.readFileSync(SAIDA, 'utf8')
  if (gravado !== html) { console.error('ERRO: o arquivo gravado saiu diferente. Rode de novo.'); process.exit(1) }
  console.log(`Pronto: ${SAIDA} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`)
}
