/*
 * idiomas.js — os idiomas do Caderno do Contractor: Português (Brasil) e English (United States).
 *
 * Os textos ficam em português no código, dentro de tr('...'). Em inglês, tr() procura a tradução em EN
 * (fonte/traducao-en.js); o que não tiver tradução sai em português. Partes que mudam vão entre chaves:
 * tr('Sobram {n} créditos', { n: 12 }). O idioma escolhido fica salvo no navegador.
 *
 * Funciona no navegador (window.WCIdioma) e no Node (globalThis.WCIdioma). Sem idioma escolhido, é português.
 */
(function (raiz) {
  'use strict'
  const CHAVE = 'wcfix:idioma'
  const IDIOMAS = [
    { codigo: 'pt-BR', nome: 'Português (Brasil)', curto: 'PT', bandeira: 'br' },
    { codigo: 'en-US', nome: 'English (United States)', curto: 'EN', bandeira: 'us' },
  ]
  let atual = 'pt-BR'
  const ouvintes = []

  function preencher(texto, campos) {
    if (!campos) return texto
    return String(texto).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(campos, k) && campos[k] != null ? String(campos[k]) : m))
  }
  function traducoes() { return (atual === 'en-US' && raiz.WC_TRADUCAO_EN) || null }
  function t(texto, campos) {
    const tab = traducoes()
    const base = tab && Object.prototype.hasOwnProperty.call(tab, texto) ? tab[texto] : texto
    return preencher(base, campos)
  }
  function valido(codigo) { return IDIOMAS.some(i => i.codigo === codigo) }

  // O idioma do navegador, na primeira visita: português para quem usa português, inglês para os outros.
  function doNavegador() {
    const nav = raiz.navigator
    const lista = (nav && (nav.languages && nav.languages.length ? nav.languages : [nav.language])) || []
    return lista.some(l => /^pt\b/i.test(String(l || ''))) ? 'pt-BR' : 'en-US'
  }
  function iniciar() {
    let salvo = null
    try { salvo = raiz.localStorage && raiz.localStorage.getItem(CHAVE) } catch (e) { salvo = null }
    atual = valido(salvo) ? salvo : (raiz.navigator ? doNavegador() : 'pt-BR')
    return atual
  }
  function definir(codigo, guardar = true) {
    if (!valido(codigo)) return atual
    atual = codigo
    if (guardar) { try { raiz.localStorage && raiz.localStorage.setItem(CHAVE, codigo) } catch (e) { /* sem armazenamento: vale só agora */ } }
    for (const f of ouvintes) f(codigo)
    return atual
  }

  // Data e hora curtas no jeito de cada idioma: 10/11/2026 14:32 ou 11/10/2026 2:32 PM.
  function dataHora(iso) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const z = n => String(n).padStart(2, '0')
    if (atual === 'en-US') {
      const h = d.getHours() % 12 || 12
      return `${z(d.getMonth() + 1)}/${z(d.getDate())}/${d.getFullYear()} ${h}:${z(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`
    }
    return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`
  }

  // As bandeiras, em SVG: emoji de bandeira não aparece no Windows. Os cantos redondos vêm do CSS (.bandeira),
  // para o SVG não precisar de id e poder aparecer mais de uma vez na página.
  const BANDEIRAS = {
    br: '<svg viewBox="0 0 20 14" aria-hidden="true" focusable="false"><rect width="20" height="14" fill="#009c3b"/><path d="M10 1.6 18.2 7 10 12.4 1.8 7Z" fill="#ffdf00"/><circle cx="10" cy="7" r="3.3" fill="#002776"/><path d="M6.9 6.2c2.2-.5 4.5-.2 6.3 1" fill="none" stroke="#fff" stroke-width=".6"/></svg>',
    us: '<svg viewBox="0 0 20 14" aria-hidden="true" focusable="false"><rect width="20" height="14" fill="#fff"/><path d="M0 0h20v1.08H0zm0 2.15h20v1.08H0zm0 2.16h20v1.08H0zm0 2.15h20v1.08H0zm0 2.16h20v1.07H0zm0 2.15h20v1.08H0zm0 2.15h20V14H0z" fill="#b22234"/><rect width="8.6" height="7.54" fill="#3c3b6e"/><g fill="#fff"><circle cx="1.4" cy="1.2" r=".45"/><circle cx="3.3" cy="1.2" r=".45"/><circle cx="5.2" cy="1.2" r=".45"/><circle cx="7.1" cy="1.2" r=".45"/><circle cx="2.35" cy="2.55" r=".45"/><circle cx="4.25" cy="2.55" r=".45"/><circle cx="6.15" cy="2.55" r=".45"/><circle cx="1.4" cy="3.9" r=".45"/><circle cx="3.3" cy="3.9" r=".45"/><circle cx="5.2" cy="3.9" r=".45"/><circle cx="7.1" cy="3.9" r=".45"/><circle cx="2.35" cy="5.25" r=".45"/><circle cx="4.25" cy="5.25" r=".45"/><circle cx="6.15" cy="5.25" r=".45"/><circle cx="1.4" cy="6.6" r=".45"/><circle cx="3.3" cy="6.6" r=".45"/><circle cx="5.2" cy="6.6" r=".45"/><circle cx="7.1" cy="6.6" r=".45"/></g></svg>',
  }

  raiz.WCIdioma = {
    IDIOMAS, BANDEIRAS, t, preencher, iniciar, definir, dataHora,
    atual() { return atual },
    ingles() { return atual === 'en-US' },
    aoMudar(f) { ouvintes.push(f) },
  }
})(typeof window !== 'undefined' ? window : globalThis)
