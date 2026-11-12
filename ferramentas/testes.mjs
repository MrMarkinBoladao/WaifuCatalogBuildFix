// Testes do motor: node testes.mjs [pasta-com-builds]
// Roda a build de exemplo (Couple's Account) e, se receber uma pasta, confere as contas de cada build .md dela.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.join(AQUI, '..')
globalThis.window = globalThis
vm.runInThisContext(fs.readFileSync(path.join(RAIZ, 'dados', 'interactive-dados.js'), 'utf8'))
vm.runInThisContext(fs.readFileSync(path.join(RAIZ, 'fonte', 'motor.js'), 'utf8'))
vm.runInThisContext(fs.readFileSync(path.join(RAIZ, 'fonte', 'saves.js'), 'utf8'))
vm.runInThisContext(fs.readFileSync(path.join(RAIZ, 'fonte', 'exemplo.js'), 'utf8'))
const { WCFix, WCSaves, WC_DADOS, WC_EXEMPLO } = globalThis
const banco = WCFix.criarBanco(WC_DADOS)

let falhas = 0
function confere(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado)
  if (!ok) falhas++
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome}: ${JSON.stringify(obtido)}${ok ? '' : `  (esperado ${JSON.stringify(esperado)})`}`)
}
// Saldo do exemplo: 227 da Couple's Account + 480 do Good Luck Smiles on the Daring.
const SALDO = 707
const SALDO_SEM_BONUS = 227
const USAGI = 'Tsukino Usagi/Sailor Moon (anime)'
function rodar(texto, ajuste) {
  const modelo = WCFix.analisar(texto)
  const cfg = WCFix.configPadrao(modelo, banco)
  if (ajuste) ajuste(cfg, modelo)
  return { modelo, cfg, r: WCFix.calcular(modelo, cfg, banco) }
}

// 1. A build de exemplo (fonte/exemplo.js)
{
  const { modelo, cfg, r } = rodar(WC_EXEMPLO)
  console.log('\n=== Exemplo: Natsu Dragneel (Power Swap para Acnologia) + Tsukino Usagi (SO) ===')
  confere('Couple\'s Account detectada', modelo.casal, true)
  confere('erros de saldo no texto original', modelo.conferenciaSaldos.erros.length, 0)
  confere('contractor 1', [cfg.c1.nome, cfg.c1.tipoOrigem, cfg.c1.tier, WCFix.tier1a(cfg.c1)], ['Natsu Dragneel', 'Possess', 7, 8])
  confere('SO', [cfg.so.nome, cfg.so.tier, cfg.so.custoOrigem, cfg.so.cobrado], [USAGI, 9, 500, 500])
  confere('árvore que o Interactive descontou', cfg.arvoreInferida, 'Dragon')
  confere('donos', r.heritage.map(h => `${h.titulo}:${h.dono}`), ['Dragon Heart:c1', 'Power Overwhelming:c1', 'Mahou Henshin:so'])
  confere('arquétipo Natsu (T8 pelo Power Swap)', r.arquetipos.c1.total, 88)
  confere('arquétipo Usagi', r.arquetipos.so.total, 64)
  confere('reembolso da origem', r.origens.reembolso, 200)
  confere('rebates sem o SO (o Interactive deu +24)', r.rebates.semSO.total, 24)
  confere('rebates com o SO', r.rebates.comSO.total, 45)
  // 227 da Couple's Account + 480 do Good Luck Smiles on the Daring (50% do budget de 960).
  confere('bônus do Good Luck Smiles on the Daring', r.challenges.lista.map(a => [a.titulo, a.valor]), [['Strict Travel Mode', 0], ['Good Luck Smiles on the Daring', 480]])
  confere('saldo final', r.saldoFinal, SALDO)
  console.log('\n--- texto corrigido ---\n' + r.texto + '\n--- mudanças ---\n' + r.mudancas.join('\n') + '\n--- avisos ---\n' + r.avisos.map(a => `[${a.nivel}] ${a.texto}`).join('\n'))

  // Mesma build, os dois com Dragon Heart: Usagi paga metade do que sobra depois do desconto dela.
  const k = WCFix.chaveHeritage(modelo, modelo.heritage[0])
  const r2 = rodar(WC_EXEMPLO, (c) => { c.donos[k] = 'ambos-c1'; c.so.arqMais = ['Dragon'] }).r
  console.log('\n=== Os dois com Dragon Heart (Usagi também Dragon) ===')
  confere('cópias da Dragon Heart', r2.heritage[0].copias.map(c => [c.nome, c.metade, c.desconto, c.paga]), [['Natsu Dragneel', false, 48, 12], [USAGI, true, 48, 6]])
  confere('saldo final', r2.saldoFinal, SALDO - 6)

  // Sem a regra "só a origem mais cara", as duas origens são pagas: os 200 do Natsu não voltam.
  const r3 = rodar(WC_EXEMPLO, (c) => { c.opcoes.origemMaisCara = false }).r
  confere('sem "só a origem mais cara"', r3.saldoFinal, SALDO - 200)
  // Power Swap fora da conta da origem: a origem do Natsu vale 100 (T7), e o Power Swap (100) é pago à parte.
  const r4 = rodar(WC_EXEMPLO, (c) => { c.opcoes.perkContaNaOrigem = false }).r
  confere('Power Swap fora do preço da origem', [r4.origens.reembolso, r4.saldoFinal], [100, SALDO - 100])
  // Idempotência: colar o texto corrigido de novo avisa.
  const r5 = rodar(r.texto).r
  confere('texto já corrigido é detectado', r5.avisos.some(a => a.nivel === 'erro' && a.texto.includes('já passou')), true)

  // Tags mexidas à mão: só a diferença fica guardada, e a que muda a conta gera aviso.
  console.log('\n=== Tags à mão ===')
  confere('tags do Natsu no banco (as da Acnologia, pelo Power Swap)', cfg.c1.tagsBase, ['hr', 'hz', 'cl', 'dr', 'sc', 'tm'])
  confere('tags da Usagi no banco', cfg.so.tagsBase, ['cl', 'id', 'ur', 'sc', 'di', 'fm', 'tm'])
  const r6 = rodar(WC_EXEMPLO, (c) => { WCFix.alternarTag(c.so, 'hz') }).r
  confere('Usagi + Environmental à mão: rebates 45 → 50', r6.rebates.comSO.total, 50)
  confere('aviso da tag à mão', r6.avisos.some(a => a.nivel === 'aviso' && a.texto.includes(`${USAGI}, Environmental +10`)), true)
  const r7 = rodar(WC_EXEMPLO, (c) => { WCFix.alternarTag(c.so, 'sc') }).r
  confere('tag à mão fora da build (Information já é dela: tirar) não muda a conta', r7.saldoFinal, SALDO)
  const r8 = rodar(WC_EXEMPLO, (c) => { WCFix.alternarTag(c.c1, 'hz') }).r
  confere('Natsu sem Environmental: rebates 45 → 35', r8.rebates.comSO.total, 35)
  const r9 = rodar(WC_EXEMPLO, (c) => { WCFix.alternarTag(c.c1, 'Dragon', 'arq') }).r
  confere('Natsu sem o arquétipo Dragon: perde os +88', r9.arquetipos.c1.total, 0)

  // Configuração salva pela versão 1 (lista inteira de tags) vira diferença.
  const v1 = JSON.parse(JSON.stringify(cfg))
  for (const p of [v1.c1, v1.so]) { for (const k of ['tagsMais', 'tagsMenos', 'arqMais', 'arqMenos', 'personagemManual', 'tagsBase', 'arqBase']) delete p[k] }
  v1.c1.tagsDef = v1.c1.tagsDef.filter(t => t !== 'hz')
  v1.c1.arquetipos = []
  const migrado = WCFix.configPadrao(modelo, banco, v1)
  confere('versão 1 → tags tiradas', [migrado.c1.tagsMenos, migrado.c1.arqMenos], [['hz'], ['Dragon']])

  // Challenges: as três bases do bônus, o bônus desligado e um challenge posto pela ferramenta.
  console.log('\n=== Challenges ===')
  confere('DR achado pelo budget 960 na Intensity 5', r.challenges.drBuild, 10)
  confere('linha do Good Luck no texto', r.texto.includes('Good Luck Smiles on the Daring (challenge bonus: 50% of 960) +480 [1440]'), true)
  const rLeg = rodar(WC_EXEMPLO, (c) => { c.opcoes.bonusChallenge = 'legacy' }).r
  confere('valores legados: 50% de 2500 (DR 10 na Intensity 1)', [rLeg.challenges.lista[1].valor, rLeg.saldoFinal], [1250, SALDO_SEM_BONUS + 1250])
  const rNada = rodar(WC_EXEMPLO, (c) => { c.opcoes.bonusChallenge = 'nenhum' }).r
  confere(`sem bônus de challenge: volta aos ${SALDO_SEM_BONUS}`, rNada.saldoFinal, SALDO_SEM_BONUS)
  const rSem = rodar(WC_EXEMPLO, (c) => { c.challenges.semBonus = ['Good Luck Smiles on the Daring'] }).r
  confere('bônus desligado só no Good Luck', rSem.saldoFinal, SALDO_SEM_BONUS)
  const rPT = rodar(WC_EXEMPLO, (c) => { c.challenges.adicionados = ['Power Trip'] }).r
  confere('Power Trip posto pela ferramenta: +960, e o Good Luck sai sobre 1920', rPT.challenges.lista.map(a => [a.titulo, a.origem, a.valor]),
    [['Strict Travel Mode', 'texto', 0], ['Good Luck Smiles on the Daring', 'texto', 960], ['Power Trip', 'adicionado', 960]])
  confere('linha nova do Power Trip no bloco Challenges', /Good Luck Smiles on the Daring \(challenge bonus: 50% of 1920\) \+960 \[1920\]\nPower Trip \(challenge bonus: 100% of 960\) \+960 \[2880\]/.test(rPT.texto), true)
  const rPT2 = rodar(WC_EXEMPLO, (c) => { c.challenges.adicionados = ['Power Trip']; c.opcoes.powerTripDobra = false }).r
  confere('sem o Power Trip dobrar a base: Good Luck volta a 480', rPT2.challenges.lista[1].valor, 480)
  const rGC = rodar(WC_EXEMPLO, (c) => { c.challenges.adicionados = ['Glass Cannon', 'Insider information'] }).r
  confere('avisos de requisito: Glass Cannon com Defenses e Insider sem Worthy Opponent', [rGC.avisos.some(a => a.texto.startsWith('Glass Cannon tira')), rGC.avisos.some(a => a.texto.startsWith('Insider information pede Worthy Opponent'))], [true, true])
  const semBloco = WC_EXEMPLO.replace(/Challenges\nStrict Travel Mode free \[960\]\nGood Luck Smiles on the Daring free \[960\]\n\n/, '')
  confere('o exemplo sem o bloco Challenges', semBloco.includes('Strict Travel Mode'), false)
  const rBloco = rodar(semBloco, (c) => { c.challenges.adicionados = ['No Continues'] }).r
  confere('build sem Challenges: o bloco nasce antes da Intensity', /Starting budget 960\n\nChallenges\nNo Continues \(challenge bonus: 80% of 960\) \+768 \[1728\]\n\nIntensity \[5\]/.test(rBloco.texto), true)
}

// 1b. Nome escolhido para cada contractor no lugar de "You" e "Your SO", e o mundo de cada um no resumo.
{
  console.log('\n=== Nomes dos contractors ===')
  const r = rodar(WC_EXEMPLO).r
  confere('sem nome escolhido: continua "You" e "Your SO", sem o "from" na linha do SO',
    [r.texto.includes('\nYou as Natsu Dragneel (Possess) of T7 -100 ['), r.texto.includes(`\nYour SO as ${USAGI} (Possess) of T9 -500 [`)], [true, true])
  // Com Power Swap, o mundo do contractor 1 fica de fora do resumo: o Natsu já não é quem era no mundo dele.
  confere('resumo com o mundo do SO (o contractor 1 tem Power Swap)', [
    r.texto.includes('\nContractor 1: Natsu Dragneel — Possess of T7 (Power Swap to Acnologia, T8) — '),
    r.texto.includes(`\nContractor 2 (SO): ${USAGI} (Sailor Moon) — Possess of T9 — `)], [true, true])
  const { cfg, r: rn } = rodar(WC_EXEMPLO, (c) => { c.c1.apelido = 'Alex'; c.so.apelido = ' Sam ' })
  confere('origens com os nomes', [rn.texto.includes('\nAlex as Natsu Dragneel (Possess) of T7 -100 ['), rn.texto.includes(`\nSam as ${USAGI} (Possess) of T9 -500 [`)], [true, true])
  confere('"You as" sai do texto todo (Template Stacking também)', [rn.texto.includes('You as'), rn.texto.includes('\nTemplate Stacking I x2 [Alex as Natsu Dragneel has Erza Scarlet')], [false, true])
  confere('resumo com nome e mundo', [
    rn.texto.includes('\nContractor 1: Alex as Natsu Dragneel — '),
    rn.texto.includes(`\nContractor 2 (SO): Sam as ${USAGI} (Sailor Moon) — `)], [true, true])
  confere('o nome não mexe no saldo', rn.saldoFinal, SALDO)
  const reaberto = WCFix.configPadrao(WCFix.analisar(WC_EXEMPLO), banco, JSON.parse(JSON.stringify(WCSaves.compactarCfg(cfg))))
  confere('os nomes voltam com a build salva', [reaberto.c1.apelido, reaberto.so.apelido], ['Alex', ' Sam '])
  const semResumo = rodar(WC_EXEMPLO, (c) => { c.opcoes.resumoNoFim = false }).r
  confere('sem o resumo no fim, o mundo do SO fica na linha dele', semResumo.texto.includes(`\nYour SO as ${USAGI} (Possess) of T9 from Sailor Moon -500 [`), true)

  // "Your SO as" do Interactive, nas marcas entre colchetes e em Companions bought.
  const soEntreColchetes = `Starting World: Teste
Starting budget 1000

Intensity [1]
Couple's Account (Cooperative) 0

You as Gray Fullbuster (Possess) of T6 -50 [950]

Misc Perks
Paper Trail x2 [You as Gray Fullbuster, Your SO as Juvia Lockser] -2 [948]

Companions bought -50 [898]
Your SO as Juvia Lockser(T6)[unbound] from Fairy Tail`
  const rk = rodar(soEntreColchetes, (c) => { c.c1.apelido = 'Alex'; c.so.apelido = 'Sam' }).r
  confere('"Your SO as" vira o nome da SO em toda a build', [
    rk.texto.includes('\nPaper Trail x2 [Alex as Gray Fullbuster, Sam as Juvia Lockser] -2 ['),
    rk.texto.includes('\nSam as Juvia Lockser (Possess) of T6 -50 ['), /You as|Your SO/.test(rk.texto)], [true, true, false])

  // Nomes escritos à mão na build ("Alex as Gray Fullbuster"): o SO deixa de ganhar "Your SO:" na frente.
  const amao = `Starting World: Teste
Starting budget 1000

Intensity [1]
Couple's Account (Cooperative) 0

Alex as Gray Fullbuster (Possess) of T6 from Fairy Tail -50 [950]
Sam as Rei Ayanami (Possess) of T6 from Neon Genesis Evangelion -0 [950]`
  const { cfg: ca, r: ra } = rodar(amao)
  confere('nomes à mão: as linhas ficam como estão, sem "Your SO:"', [
    ra.texto.includes('\nAlex as Gray Fullbuster (Possess) of T6 from Fairy Tail -50 ['),
    ra.texto.includes('\nSam as Rei Ayanami (Possess) of T6 -50 ['), ra.texto.includes('Your SO')], [true, true, false])
  confere('nomes à mão: o resumo usa o mundo escrito na build', ra.texto.includes('\nContractor 1: Alex as Gray Fullbuster (Fairy Tail) — ') && ra.texto.includes('\nContractor 2 (SO): Sam as Rei Ayanami (Neon Genesis Evangelion) — '), true)
  confere('nomes à mão: o nome da linha é o padrão do campo', [WCFix.quemDaLinha(ca.c1.nome), WCFix.quemDaLinha(ca.so.nome)], ['Alex', 'Sam'])
  const ra2 = rodar(amao, (c) => { c.c1.apelido = 'Max' }).r
  confere('nome escolhido troca o nome escrito à mão', [ra2.texto.includes('\nMax as Gray Fullbuster (Possess) of T6 from Fairy Tail -50 ['), ra2.texto.includes('\nContractor 1: Max as Gray Fullbuster (Fairy Tail) — ')], [true, true])

  // Um contractor só, e origens sem "You as".
  confere('um contractor só', rodar('Starting World: Teste\nStarting budget 960\n\nYou as Kafka (Possess) of T8 -200 [760]', (c) => { c.c1.apelido = 'Alex' }).r.texto.includes('\nAlex as Kafka (Possess) of T8 -200 [760]'), true)
  confere('Drop-In ganha o nome na frente', rodar('Starting World: Teste\nStarting budget 960\n\nDropped-In free [960]', (c) => { c.c1.apelido = 'Alex' }).r.texto.includes('\nAlex: Dropped-In free [960]'), true)
}

// 2. Mission Rewards: ler, refazer e mexer.
{
  console.log('\n=== Mission Rewards ===')
  const colado = `Starting World: Teste
Starting budget 960

You as Kafka (Possess) of T8 -200 [760]

Mission Rewards +130 [890]:
Grand Mission in Konoha
  Credits [100];  TX Tickets [2];Side Job in Konoha
  Credits [30];`
  const { modelo: mm, cfg: cm, r: rm } = rodar(colado)
  confere('missões coladas na mesma linha são separadas', mm.missoes, [
    { titulo: 'Grand Mission', local: 'Konoha', recompensas: [{ tipo: 'Credits', valor: '100' }, { tipo: 'TX Tickets', valor: '2' }] },
    { titulo: 'Side Job', local: 'Konoha', recompensas: [{ tipo: 'Credits', valor: '30' }] }])
  confere('texto refeito: uma missão e uma recompensa por linha', rm.texto.endsWith('Mission Rewards +130 [890]:\nGrand Mission in Konoha\n  Credits [100];\n  TX Tickets [2];\nSide Job in Konoha\n  Credits [30];'), true)
  confere('saldo igual', rm.saldoFinal, 890)
  const rm2 = rodar(colado, (c) => { c.missoes[1].recompensas[0].valor = '50'; c.missoes.push({ titulo: 'Bounty', local: 'Mondstadt', recompensas: [{ tipo: 'Credits', valor: '25' }] }) }).r
  confere('missão mexida e nova: +130 → +175', [rm2.missoes.total, rm2.saldoFinal], [175, 935])
  const rm3 = rodar(colado, (c) => { c.missoes = [] }).r
  confere('sem missões, o bloco sai', [rm3.texto.includes('Mission Rewards'), rm3.saldoFinal], [false, 760])
  const nova = rodar(`Starting World: Teste\nStarting budget 960\n\nYou as Kafka (Possess) of T8 -200 [760]`, (c) => { c.missoes = [{ titulo: 'Grand Mission', local: 'Konoha', recompensas: [{ tipo: 'Credits', valor: '100' }] }] }).r
  confere('build sem missões ganha o bloco no fim', nova.texto.endsWith('\n\nMission Rewards +100 [860]:\nGrand Mission in Konoha\n  Credits [100];'), true)
  // Mesma build colada de novo: as missões mexidas ficam; se o texto das missões mudar, vale o texto.
  cm.missoes[0].recompensas[0].valor = '120'
  const mesma = WCFix.configPadrao(WCFix.analisar(colado), banco, JSON.parse(JSON.stringify(cm)))
  confere('missão mexida sobrevive a colar a mesma build', mesma.missoes[0].recompensas[0].valor, '120')
  const outra = WCFix.configPadrao(WCFix.analisar(colado.replace('[30]', '[40]')), banco, JSON.parse(JSON.stringify(cm)))
  confere('texto das missões mudou: vale o texto novo', [outra.missoes[0].recompensas[0].valor, outra.missoes[1].recompensas[0].valor], ['100', '40'])
}

// 2b. Retinue: como cada um entrou e a situação; quem morreu sai dos Defense Rebates.
{
  console.log('\n=== Retinue ===')
  const sequito = `Starting World: Teste
Starting budget 1000

Defenses
Stress -5 [995]

Companions bought -40 [955]
Ana(T5)[buy] from Mundo A
Bia(T5)[yoink] from Mundo A
Cris(T4)[used]{Familiar} from Mundo B
Duda(T4)[unbound] from Mundo B
Eva(T5)[steal]{Dead} from Mundo C
Fe(T3)[buy]{Traded Away} from Mundo C

Companions captured +30; sold +10 [995]
Gabi(T5){Devotee} from Mundo D
Hana(T5) from Mundo D --SOLD
Iris(T3){Offspring} from Mundo D`
  const { r: rs } = rodar(sequito, (c) => {
    // Ninguém com personagem do banco; só a Eva, morta, com Stress à mão.
    for (const p of c.companions) { p.personagem = null; p.personagemManual = true }
    c.companions.find(p => p.nome === 'Eva').tagsMais = ['cl']
  })
  const sq = rs.sequito
  confere('membros', sq.membros.map(x => `${x.nome}:${x.metodo}:${x.vendido ? 'vendido' : x.papel}`), [
    'Ana:buy:Companion', 'Bia:yoink:Companion', 'Cris:used:Familiar', 'Duda:unbound:Companion', 'Eva:steal:Dead', 'Fe:buy:Traded Away',
    'Gabi:capture:Devotee', 'Hana:capture:vendido', 'Iris:capture:Offspring'])
  confere('contagem por forma de entrar', sq.porMetodo, { buy: 2, yoink: 1, used: 1, unbound: 1, steal: 1, capture: 3 })
  confere('no séquito agora (sem morta, trocada e vendida)', sq.ativos, 6)
  confere('morta não dá Defense Rebate', [rs.rebates.comSO.total, rs.avisos.some(a => a.texto.startsWith('Quem está morto não dá Defense Rebates: Eva (-2)'))], [0, true])
  confere('toda forma de entrar e toda situação têm descrição', [Object.values(WCFix.METODOS_SEQUITO).every(m => m.desc), Object.values(WCFix.PAPEIS_SEQUITO).every(p => p.desc)], [true, true])
  const { cfg: cc, r: rc } = rodar(WC_EXEMPLO)
  confere('na Couple\'s Account, o SO não aparece na retinue (só a Erza)', rc.sequito.membros.map(x => x.nome), ['Erza Scarlet'])
  confere('e a retinue sabe quem é o SO', rc.sequito.so, cc.so.nome)
}

// 2c. Saves: arquivo .txt de ida e volta, junção de builds e reconhecimento de arquivos.
{
  console.log('\n=== Saves ===')
  const { modelo, cfg, r } = rodar(WC_EXEMPLO)
  const compacto = WCSaves.compactarCfg(cfg)
  confere('cfg compacto não guarda o que a página recalcula', ['candidatos', 'tagsBase', 'tagsDef', 'arquetipos'].some(k => k in compacto.c1), false)
  const reaberto = WCFix.calcular(modelo, WCFix.configPadrao(modelo, banco, JSON.parse(JSON.stringify(compacto))), banco)
  confere('cfg compacto reabre com o mesmo saldo', reaberto.saldoFinal, r.saldoFinal)
  const versao = { id: 'v:teste1', rotulo: '+15', salvaEm: '2026-11-09T21:40:00.000Z', texto: WC_EXEMPLO, cfg: compacto, resumo: { mundo: modelo.mundo, saldo: r.saldoFinal, contractors: `Natsu Dragneel & ${USAGI}` } }
  const build = { id: 'b:teste1', nome: 'Natsu e Usagi', criadaEm: versao.salvaEm, versoes: [versao] }
  confere('nome do arquivo no estilo do Interactive', WCSaves.nomeArquivo(build, versao), 'save_Natsu e Usagi +15 - Fairy Tail.txt')
  confere('nome sem caracteres proibidos', WCSaves.nomeArquivo({ ...build, nome: 'A/B: C?' }, { ...versao, rotulo: 'x*y' }), 'save_A-B- C- x-y - Fairy Tail.txt')
  const arq = WCSaves.arquivoVersao(build, versao, r.texto)
  confere('arquivo traz o texto corrigido para ler', arq.includes(`${WCSaves.MARCA_TEXTO}\n${r.texto.split('\n')[0]}`), true)
  const lido = WCSaves.lerArquivo(arq)
  confere('arquivo de versão volta igual', [lido.tipo, lido.builds.length, lido.builds[0].id, lido.builds[0].versoes[0].texto === WC_EXEMPLO, lido.builds[0].versoes[0].rotulo], ['versao', 1, 'b:teste1', true, '+15'])
  const versao2 = { ...versao, id: 'v:teste2', rotulo: '+16', salvaEm: '2026-11-10T10:00:00.000Z' }
  const m1 = WCSaves.mesclarBuilds([build], lido.builds)
  const m2 = WCSaves.mesclarBuilds(m1.lista, [{ ...build, versoes: [versao2] }])
  confere('juntar: a mesma versão não duplica; a nova entra', [m1.versoesNovas, m1.lista[0].versoes.length, m2.versoesNovas, m2.lista[0].versoes.map(v => v.rotulo)], [0, 1, 1, ['+15', '+16']])
  confere('próximo rótulo: +16 → +17', WCSaves.sugerirRotulo(m2.lista[0]), '+17')
  confere('sem número, sem sugestão', WCSaves.sugerirRotulo({ versoes: [{ rotulo: 'depois do PvP' }] }), '')
  const bk = WCSaves.lerArquivo(WCSaves.arquivoBackup(m2.lista, { meus: [{ id: 'm:x', nome: 'Tay', defesas: ['ps'] }], prefs: { bonusChallenge: 'legacy' } }))
  confere('backup traz builds, Meus personagens e preferências', [bk.tipo, bk.builds[0].versoes.length, bk.meus.length, bk.prefs.bonusChallenge], ['backup', 2, 1, 'legacy'])
  confere('arquivo de todas as versões', WCSaves.lerArquivo(WCSaves.arquivoBuild(m2.lista[0])).tipo, 'build')
  confere('save do Interactive é reconhecido', WCSaves.lerArquivo('{"baseBudget":2500,"startingWorld":{"worldName":"SCP","rating":10},"companions":[]}').tipo, 'interactive')
  confere('texto do Copy Text of Build', WCSaves.lerArquivo(WC_EXEMPLO).tipo, 'texto-build')
  confere('backup de Meus personagens vai para lá', WCSaves.lerArquivo(WCFix.backupMeus([])).tipo, 'personagens')
  confere('dados estragados dão erro legível', WCSaves.lerArquivo(`${WCSaves.MARCA_DADOS}\n{"formato":"caderno-contractor",`).tipo, 'erro')
  confere('arquivo qualquer não é reconhecido', WCSaves.lerArquivo('lista de compras').tipo, 'desconhecido')
  const malicioso = WCSaves.lerArquivo(`${WCSaves.MARCA_DADOS}\n{"formato":"caderno-contractor","tipo":"build","builds":[{"id":"b:m","nome":"x","versoes":[{"id":"v:m","texto":"Starting budget 1","cfg":{"__proto__":{"poluido":true},"opcoes":{}}}]}]}`)
  confere('__proto__ de arquivo não passa', [Object.prototype.hasOwnProperty.call(malicioso.builds[0].versoes[0].cfg, '__proto__'), ({}).poluido], [false, undefined])
}

// 3. Meus personagens: importar do Interactive, achar na build, copiar do banco e editar.
{
  console.log('\n=== Meus personagens ===')
  const exportInteractive = JSON.stringify([
    { uid: 12345678, name: 'Tayzzyronth', world: 'Honkai: Star Rail', sub: '', tier: 6, image: 'https://exemplo/tay.png', tags: ['F', 'ps', 'fm', 'dg', 'Magical Girl'], nickname: 'eu' },
    { name: '', world: 'x', tier: 1, tags: [] },
  ], null, 2)
  const imp = WCFix.lerImportacao(exportInteractive)
  confere('import do Interactive: lidos e ignorados', [imp.formato, imp.registros.length, imp.ignorados], ['interactive', 1, 1])
  const tay = imp.registros[0]
  confere('import: tags viram Defenses e arquétipos', [tay.nome, tay.mundo, tay.tier, tay.defesas, tay.arquetipos, tay.uidInteractive], ['Tayzzyronth', 'Honkai: Star Rail', 6, ['ps', 'fm'], ['Dragon', 'Mahoushoujo'], '12345678'])
  const m1 = WCFix.mesclarMeus([], imp.registros)
  const m2 = WCFix.mesclarMeus(m1.lista, WCFix.lerImportacao(exportInteractive).registros)
  confere('importar duas vezes não duplica', [m2.lista.length, m2.adicionados, m2.atualizados], [1, 0, 1])
  const volta = WCFix.lerImportacao(WCFix.backupMeus(m2.lista))
  confere('backup ida e volta mantém o id', [volta.formato, volta.registros[0].id === m2.lista[0].id, volta.registros[0].defesas], ['backup', true, ['ps', 'fm']])
  confere('JSON inválido dá erro legível', typeof WCFix.lerImportacao('isso não é json').erro, 'string')

  const build = `Starting World: Honkai: Star Rail
Starting budget 1000

Defenses
Mind -25 [975]
Destiny -50 [925]

Companions bought -50 [875]
Tayzzyronth(T6)[bound] from Honkai: Star Rail`
  const semMeus = rodar(build).r
  confere('sem Meus personagens: Tayzzyronth não é achado', semMeus.avisos.some(a => a.texto.includes('Não achei Tayzzyronth')), true)
  banco.definirMeus(m2.lista)
  const { cfg: cfgM, r: comMeus } = rodar(build)
  confere('com Meus personagens: Tayzzyronth vem de lá', [String(cfgM.companions[0].personagem).startsWith('m:'), cfgM.companions[0].tagsDef], [true, ['ps', 'fm']])
  confere('rebates de Tayzzyronth (Mind 10 + Destiny 20)', comMeus.rebates.comSO.total, 30)
  confere('aviso de tags vindas de Meus personagens', comMeus.avisos.some(a => a.nivel === 'info' && a.texto.includes('Tayzzyronth')), true)

  // Cópia de um personagem do banco, com tags trocadas, passa na frente do original.
  const usagiBanco = banco.buscar(USAGI, 'Sailor Moon', 9)[0]
  const copia = { ...WCFix.registroDeObjeto({ nome: USAGI, mundo: 'Sailor Moon', sub: usagiBanco.sub || '', tier: 9, defesas: ['cl', 'hz'], arquetipos: ['Mahoushoujo'] }), base: usagiBanco.idx, fonte: 'banco' }
  banco.definirMeus([...m2.lista, copia])
  const { cfg: cfgC, r: rC } = rodar(WC_EXEMPLO)
  confere('cópia editada da Usagi é a escolhida (tags na ordem do Interactive)', [cfgC.so.personagem === copia.id, cfgC.so.tagsDef], [true, ['hz', 'cl']])
  confere('cópia só com Stress e Environmental: rebates 45 → 30, sem aviso de tag à mão', [rC.rebates.comSO.total, rC.avisos.some(a => a.texto.includes('marcadas à mão'))], [30, false])
  // Personagem apagado de Meus personagens: a pessoa volta para o banco.
  banco.definirMeus(m2.lista)
  const { cfg: cfgD } = rodar(WC_EXEMPLO, null)
  confere('cópia apagada: volta a Usagi do banco', cfgD.so.personagem, usagiBanco.idx)
  const cfgVelha = WCFix.configPadrao(WCFix.analisar(WC_EXEMPLO), banco, cfgC)
  confere('config que apontava para a cópia apagada também volta ao banco', cfgVelha.so.personagem, usagiBanco.idx)
  banco.definirMeus([])
}

// 3b. Bônus de challenge lançado à mão em Mission Rewards, e linha que não fecha a conta.
{
  console.log('\n=== Bônus lançado como missão e diferença mantida ===')
  // Power Trip (+100% do budget) e No Continues (80% do budget dobrado) escritos como missões.
  const comoMissao = `Starting World: Teste
Starting budget 500

You as Kafka (Possess) of T8 -200 [300]

Mission Rewards +1300 [1600]:
Power Trip in Challenges
  Credits [500];
No Continues in Challenges
  Credits [800];`
  const rm = rodar(comoMissao).r
  confere('Power Trip 500 e No Continues 800 (80% do budget dobrado)', rm.challenges.lista.filter(a => a.aplicado).map(a => [a.titulo, a.valor]), [['Power Trip', 500], ['No Continues', 800]])
  confere('saem de Mission Rewards e o saldo continua 1600', [rm.challenges.convertidas.length, rm.texto.includes('Mission Rewards'), rm.saldoFinal], [2, false, 1600])
  // Uma linha com 130 a menos do que o custo escrito (custo escondido ou edição à mão).
  const naoFecha = `Starting World: Teste
Starting budget 1000

You as Kafka (Possess) of T8 -200 [800]

Misc Perks
Exit Stage Left -5 [665]`
  const { modelo: mf, r: rf } = rodar(naoFecha)
  confere('a linha que não fecha é achada; o saldo é refeito', [mf.conferenciaSaldos.erros.length, rf.saldoFinal], [1, 795])
  const rf2 = rodar(naoFecha, (c) => { c.opcoes.manterDiferencas = true }).r
  confere('mantendo a diferença, o saldo perde os 130 que o texto não explica', rf2.saldoFinal, 795 - 130)
}

// 4. Builds de uma pasta (opcional): o leitor tem de fechar a conta de cada uma.
const pastaBuilds = process.argv[2]
if (pastaBuilds && fs.existsSync(pastaBuilds)) {
  console.log(`\n=== Builds de ${pastaBuilds} ===`)
  for (const arq of fs.readdirSync(pastaBuilds).filter(f => f.endsWith('.md'))) {
    const md = fs.readFileSync(path.join(pastaBuilds, arq), 'utf8')
    const m = md.match(/## Texto da build\s*```(?:text)?\n([\s\S]*?)```/)
    if (!m) { console.log(`--   ${arq}: sem bloco de texto`); continue }
    const { modelo, cfg, r } = rodar(m[1])
    const erros = modelo.conferenciaSaldos.erros
    if (erros.length) falhas++
    const resumo = `casal=${modelo.casal} heritage=${modelo.heritage.length} defenses=${modelo.defenses.length} saldo ${WCFix.fmt(modelo.conferenciaSaldos.saldoFinalMostrado)} → ${WCFix.fmt(r.saldoFinal)}`
    console.log(`${erros.length ? 'FALHA' : 'ok  '} ${arq}: ${resumo}${erros.length ? '\n      não fecha: ' + erros.map(e => `${e.linha.raw.trim()} (esperado ${e.esperado})`).join('\n      ') : ''}`)
    const conf = r.conferencia.filter(c => Math.abs(c.texto - c.recalculado) > 0.01).map(c => `${c.rotulo} ${c.texto}→${c.recalculado}`)
    if (conf.length) console.log(`      conferência: ${conf.join(' | ')}`)
    const comBonus = r.challenges.lista.filter(a => a.aplicado)
    if (comBonus.length) console.log(`      challenges: ${comBonus.map(a => `${a.titulo} +${a.valor}`).join(', ')}${r.challenges.convertidas.length ? ` (tirados de Mission Rewards: ${r.challenges.convertidas.map(x => x.titulo).join(', ')})` : ''}`)
    if (modelo.casal) {
      console.log(`      SO=${cfg.so.nome} (T${cfg.so.tier}, cobrado ${cfg.so.cobrado}); rebates sem o SO ${r.rebates.semSO.total} (texto ${modelo.rebates ? modelo.rebates.valor : 0})`)
      // Sem as tags do SO, os Defense Rebates têm de dar o mesmo número do Interactive.
      confere(`${arq}: rebates sem o SO = os do Interactive`, r.rebates.semSO.total, modelo.rebates ? modelo.rebates.valor : 0)
    }
  }
}

// 5. Crédito é sempre inteiro: um bônus de 50% sobre budget ímpar não pode deixar ,5 no texto nem no saldo.
{
  console.log('\n=== Crédito inteiro (bônus de 50% sobre budget ímpar) ===')
  // Como o Interactive escreve: o challenge entra "free" e o bônus é a ferramenta que calcula.
  const doInteractive = [
    'Starting World: SCP [When The Day Breaks - Scenario]',
    'Starting budget 1135',
    '',
    'Challenges',
    'Good Luck Smiles on the Daring free [1702.5]',
    '',
    'Intensity [4]',
    'Emília Rossi as Amaterasu (Possess) of T10 -1000 [702.5]',
    '',
    'Home Perks',
    'Pocket Space -5 [697.5]',
    '',
    'Misc Perks',
    'Memoria -5 [692.5]',
  ].join('\n')
  const { r } = rodar(doInteractive)
  confere('nenhum ,5 no texto corrigido', r.texto.split('\n').filter(l => /\d\.\d/.test(l)), [])
  confere('bônus do challenge inteiro', r.challenges.lista.map(a => [a.titulo, a.valor]), [['Good Luck Smiles on the Daring', 568]])
  confere('saldo final inteiro', Number.isInteger(r.saldoFinal), true)
  confere('saldo final', r.saldoFinal, 693)
  // Idempotente: colar o texto já inteiro de novo não muda o saldo nem a build.
  const deNovo = rodar(r.texto)
  confere('texto inteiro colado de novo mantém o saldo', deNovo.r.saldoFinal, 693)
  confere('texto inteiro colado de novo não muda nada', deNovo.r.mudancas, [])
  // Build que já veio com ,5 escrito (saída de uma versão antiga): os números saem inteiros.
  const comMeio = doInteractive.replace('Good Luck Smiles on the Daring free [1702.5]', 'Good Luck Smiles on the Daring (challenge bonus: 50% of 1135) +567.5 [1702.5]')
  const velho = rodar(comMeio)
  confere('texto antigo com ,5 sai inteiro', velho.r.texto.split('\n').filter(l => /\d\.\d/.test(l)), [])
  confere('texto antigo com ,5 mantém o saldo', velho.r.saldoFinal, 693)
}

// 6. A página montada tem de estar em dia com a pasta fonte/.
{
  const { montar, SAIDA } = await import('./montar.mjs')
  const emDia = fs.existsSync(SAIDA) && fs.readFileSync(SAIDA, 'utf8') === montar()
  confere('\nWaifuCatalogBuildFix.html em dia com fonte/ (senão: node montar.mjs)', emDia, true)
}

console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.')
process.exit(falhas ? 1 : 0)
