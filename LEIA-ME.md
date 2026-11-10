# Caderno do Contractor — Waifu Catalog

**Use online:** https://mrmarkinboladao.github.io/WaifuCatalogBuildFix/

*[English version: README.md](README.md)*

O Caderno lê o **Copy Text of Build** do [Waifu Catalog Interactive](https://waifu-catalog.neocities.org), refaz as contas, mostra a retinue e guarda as versões da build enquanto você joga.

Também dá para usar sem internet: baixe `WaifuCatalogBuildFix.html` e abra com dois cliques (Chrome, Edge ou Opera). Não precisa instalar nada. A página é um arquivo só, com os dados dentro, então também funciona copiada para outro lugar ou aberta no celular.

## Idioma

- A página está em **Português (Brasil)** e **English (United States)**. Troque pela bandeira no canto do topo.
- A escolha fica salva no navegador. Na primeira visita, a página segue o idioma do navegador: português para quem usa português, inglês para os outros.
- O **texto corrigido**, que vai para a LLM, sai sempre em inglês, como o do Interactive.

## As abas

- **Build:** cole o texto do **Copy Text of Build** do Interactive (Alt+S). Embaixo aparece o que a página leu, se a build já foi salva, e os "Specific credit modifiers" que dá para desligar.
- **Saves:** as builds salvas, com todas as versões, e os arquivos .txt para baixar e carregar.
- **Pessoas e tags:** os contractors e as companions, cada um com o personagem de onde vêm as tags, o arquétipo e as tags de Defense. Em cada contractor, o campo **Nome do contractor** põe o nome que você escolher no lugar de "You" e "Your SO" em todo o texto (`Alex as Natsu Dragneel (Possess) of T7`). Vazio, fica "You" e "Your SO".
- **Retinue:** o séquito, com como cada membro entrou e a situação dele.
- **Heritage:** de quem é cada perk e quanto cada um paga. Na Couple's Account, dá para escolher "Os dois".
- **Challenges:** o bônus em créditos de cada challenge, e a lista para pôr outros na build.
- **Missões:** as recompensas de Mission Rewards, para editar, tirar ou pôr missões.
- **Resultado:** o que mudou, os avisos, a conferência dos descontos e o texto corrigido. No PC fica sempre à direita; no celular é uma aba.
- **Meus personagens:** personagens que não estão no banco do Interactive, ou cópias com as tags do seu jeito.
- **Regras:** as escolhas de regra da build aberta e de onde vêm os dados.

O saldo final e os botões **Salvar** e **Copiar texto** ficam sempre no topo. Um ponto no **Salvar** quer dizer que a build mudou desde a última versão salva.

## Chargen encerrado

- A caixa **Chargen encerrado**, ao lado de "Tratar como Couple's Account", vale para qualquer build. Marque quando a build sair da criação.
- Ao marcar, a página guarda uma **foto** da build como está. Dali em diante, o que muda é comparado com ela.
- **Anti-erro:** com o chargen encerrado, os challenges que só valem no chargen saem da lista "Pôr outro challenge". Se aparecer na build algo que só vale no chargen depois da foto (opção de Intensity, origem nova, Memoria, Yoink, Worlds Apart, challenge "Chargen only", DRX start), sai um aviso.
- Precisa de algo do chargen? Desmarque, mexa e marque de novo. A foto continua a mesma; para trocar pela build de agora, use **Refazer a foto** em "O que a página leu".
- Colar a mesma build de novo (mesmo mundo e mesma origem) mantém o chargen encerrado e a foto.
- Se o chargen já passou faz tempo: cole o texto da build como estava no fim do chargen, marque **Chargen encerrado** e depois cole o texto de agora.

## DRX start

- A build com a linha `DRX start 10` no bloco Intensity (ou no bloco Mode, com Legacy Difficulty) é reconhecida sozinha.
- O `Starting budget` do texto é só o número da tabela e sai. No lugar dele entram as verbas da criação: **Heritage 400**, **Catch-a-Ride 545**, **Demiplanes & Dungeons 500** e **600 para os outros perks oficiais** (inclusive as expansões de Binding e de Lure).
- **De graça:** a origem, a binding básica (a raiz de uma árvore: Shroud of Power, Seal of Approval e Mystic Tattoo, Hypnosis App…), os Lures básicos (Sticky Fingers, Faerie Feast, Potpourri, Alluring Whisper, Love Spot), os 16 Talents básicos, as duas compras de todas as Defenses e a companion de tier X ou Y (vale Power Swap para X ou Y, Heavenbuilt Proto e Piece of Silver).
- **Em qual verba cai cada compra:** Heritage, Rides e Home Perks têm verba própria, que cobre DLC também. A heritage conta o desconto de arquétipo. O resto sai da verba de 600, que é só para perks oficiais.
- **DLC de outros blocos** (Talents, Misc Perks, Generic Waifu Perks…): por padrão, sai do desconto de Talents e Defenses repetidos, e o que sobra dele não vira crédito. Na aba Regras dá para trocar: a DLC entra na verba de 600, e os repetidos não contam.
- A aba Build mostra cada verba com uma barra, o que entrou nela, quanto sobra e o que saiu de graça. O Resumo do Resultado mostra a versão curta. No texto corrigido, um bloco no fim diz o mesmo para a LLM.
- **Confere:** Possess e Substitute até T6; Waifu Perk e Power Swap seus até T6; a companion de tier X ou Y; outras companions na criação (nenhuma verba cobre); verba que passou; Cash Still Rules, Wage Slave, Couple's Account e With A Little Help From My Friends, que não combinam; o Yoink de graça quando a build começa no mundo da companion. A Intensity fica travada em 10, e não há Defense Rebates nem bônus de challenge (o DR 11 não tem budget).
- **As sobras:** com o chargen aberto, o saldo final é o que sobra das verbas. Com o **Chargen encerrado**, as verbas ficam como estavam na foto, o que foi comprado depois sai da conta normal, e as sobras ficam travadas: o saldo final mostra só o que dá para usar, e o topo mostra quanto está travado. Quando passarem os 7 dias (168 horas) na história, marque **Os 7 dias depois do chargen já passaram**, no card do DRX start.
- A companion do DRX start divide a Couple's Account com você. Para dividir a heritage entre os dois, marque "Tratar como Couple's Account": ela vira o contractor 2, sem origem a pagar, e continua em "Companions bought".

## Saves

- **Salvar** guarda uma versão da build aberta: o texto colado e tudo o que você marcou na página (tags, donos de heritage, challenges, missões). A primeira vez cria a build salva, com o nome dos contractors e do mundo; mude o nome na aba Saves.
- **Para acompanhar enquanto joga:** jogue no Interactive, copie o Copy Text of Build e cole na aba Build. Se for a mesma build (mesmo mundo e mesma origem), as suas escolhas continuam e o Salvar vira a próxima versão dela.
- **Nome da versão:** escreva o que quiser ("+16", "depois do 4º PvP"). Se a última versão começa com um número, como "+15", a página sugere "+16". Sem nome, fica "versão N".
- **Builds salvas:** abrir a última versão ou qualquer outra, renomear, excluir, e baixar uma versão ou todas.
- **Salvar como build nova:** começa outra build a partir da aberta, para seguir por outro caminho sem mexer na original.
- **Arquivos .txt:** o arquivo de uma versão tem o texto corrigido (dá para colar numa LLM) e, no fim, os dados para carregar de novo. O nome segue o estilo dos saves do Interactive: `save_Natsu e Usagi +15 - Fairy Tail.txt`.
- **Carregar arquivo** aceita os .txt que a página baixa (uma versão, todas as versões de uma build ou o backup de tudo) e também um .txt com o texto do Copy Text of Build. Dá para soltar o arquivo em cima da caixa tracejada. Nada do que já está salvo é apagado. Os saves do próprio Interactive (o JSON de lá) não abrem aqui: abra no Interactive e use o Copy Text of Build.
- **Backup de tudo:** um .txt com todas as builds, Meus personagens e as preferências. Os saves ficam só neste navegador; baixe um backup de vez em quando, e use ele para levar tudo a outro aparelho.
- **O site e o arquivo baixado guardam separado:** o navegador trata cada endereço como um lugar diferente. Para levar os saves do arquivo `WaifuCatalogBuildFix.html` para o site (ou o contrário), baixe o backup de tudo num e carregue no outro.

## Retinue

- Cada membro de `Companions bought` e `Companions captured` aparece com **como entrou** e a **situação**, e o que dá de Defense Rebate. Os filtros mostram só um grupo, e a busca acha pelo nome ou pelo mundo.
- **Como entrou** (a marca entre colchetes, `[buy]`; quem está em Companions captured entrou por captura): comprado, capturado, Yoink, usado (Slightly Used), sem binding (unbound), tirado de outro contractor (steal ou PvP).
- **Situação** (a marca entre chaves, `{Familiar}`): Companion, Follower, Familiar, Devotee, filho (Offspring), morto (Dead), trocado (Traded Away), Exile, e vendido (`--SOLD`).
- A aba explica cada marca. Quem está morto, vendido, trocado ou em Exile não dá Defense Rebates. Para os mortos, é a regra de perder alguém do séquito; o Interactive ainda conta, e a diferença aparece nos Avisos.
- Na Couple's Account, o SO fica na aba Pessoas e tags, como contractor 2.

## Tags de Defense

- Cada pessoa mostra todas as tags de Defense que tem. As que estão destacadas, com o valor verde (`Stress +2`), dão desconto nesta build. As outras são de Defenses que a build não compra, e só passariam a valer se a build comprasse.
- Toque numa tag para tirar ou pôr de volta. Use **+ tag** para marcar outra; cada opção mostra a condição do desconto.
- Tag ou arquétipo marcado à mão que muda a conta aparece nos **Avisos**, com a condição, para você conferir no cânone.
- A tabela **Defense Rebates: quem dá desconto em quê**, no fim da aba, mostra quem dá quanto em cada Defense da build.

## Meus personagens

- **Novo personagem:** nome (como aparece na build), obra, tier, arquétipos e tags de Defense, com a condição de cada uma.
- **Copiar um do banco:** procura um personagem do Interactive e cria uma cópia sua para editar. A cópia passa na frente do original.
- **Importar:** traz os personagens que você criou no Interactive. Lá, abra **Companions**, toque na engrenagem ⚙ ao lado de **Add Character**, depois em **Import / Export** e em **Export**. Cole aqui. Importar de novo atualiza, sem duplicar.
- **Baixar backup / Copiar backup:** Meus personagens ficam salvos só neste navegador. O backup serve para levar a outro aparelho ou navegador (Importar → Carregar arquivo).
- Quando a build cita um personagem pelo nome, a ferramenta procura primeiro em Meus personagens, depois no banco. Editar um personagem muda todas as builds que usam ele.
- Na aba Pessoas e tags, quem não foi achado ganha o botão **Criar … em Meus personagens**, que já vem com o nome, a obra e o tier da build.

## Challenges

- Os challenges da build são reconhecidos no bloco `Challenges` do texto. Os que dão créditos (Power Trip 100%, Good Luck Smiles on the Daring 50%, Glass Cannon 80%, No Continues 80%, Forgetful Hopper 60%, Lost Goods 40%, Frog in a Well 20%, Rebellious Brats 10%) ganham o bônus na própria linha: `Power Trip (challenge bonus: 100% of 500) +500 [1000]`.
- **Base do bônus** (vale para todas as builds):
  - **Com base na Intensity** (padrão): a porcentagem sai sobre o `Starting budget` da build, que já vem com a Intensity.
  - **Valores legados:** sai sobre o budget do DR na Intensity 1 (2500 no DR 10), o número que o card do Interactive mostra. O DR é achado pelo budget; se não for, escolha na aba.
  - **Não somar:** como o Interactive sem Legacy Difficulty.
- **O Power Trip dobra o budget antes dos outros bônus** (ligado): com Power Trip e No Continues num budget de 500, o No Continues dá 80% de 1.000. Desligado, cada bônus sai sobre o budget original.
- **Pôr outro challenge:** a linha entra no bloco `Challenges` (que nasce antes da Intensity, se não existir). Cada challenge mostra os requisitos, e os que não batem com a build (DR mínimo, DR 11, conflitos, Glass Cannon com Defenses) aparecem nos Avisos.
- Bônus que você tinha lançado à mão em Mission Rewards, como `Power Trip in Challenges`, sai de lá e vai para a linha do challenge, sem contar duas vezes.

## Missões

- A aba lê o bloco `Mission Rewards` (o Interactive às vezes cola uma missão na outra, na mesma linha) e escreve de novo com uma missão e uma recompensa por linha.
- Só as recompensas `Credits` entram no saldo. Tickets, perks e companions ficam escritos no texto.
- Dá para mudar valores, tirar missões e pôr missões novas. "Voltar às missões do texto" desfaz tudo. Se você colar a mesma build com as missões mudadas no Interactive, valem as do texto novo.

## O que é corrigido

- O saldo de cada linha, pelo custo escrito nela. Linha que não fecha aparece nos Avisos.
- A Intensity (1 + a soma das cláusulas; no DRX start, travada em 10) e o DR que o budget indica.
- **DRX start:** as verbas no lugar do Starting budget, o que sai de graça e as sobras (veja a seção DRX start).
- **Couple's Account:**
  - o SO sai de "Companions bought" e vira a origem do contractor 2, no mesmo formato da linha do contractor 1, sem o "from";
  - o resumo do fim diz o mundo de cada contractor, tirado da build ou do personagem do banco. Se o resumo estiver desligado, o "from" continua na linha do SO;
  - só a mais cara das duas origens é paga;
  - cada um tem o próprio desconto de arquétipo: o preço do tier no passo 1a (com Waifu Perk ou Power Swap), com teto de 80% em cada perk, só nas árvores que combinam com ele;
  - heritage que os dois compram: o segundo paga metade do que sobra depois dos descontos dele, sem o teto de 80%;
  - as tags do SO entram nos Defense Rebates;
  - o "Specific credit modifiers" de reembolso do SO, feito à mão, sai (a ferramenta já faz essa conta).
- **Defense Rebates:** cada pessoa com a tag dá até 40% de uma compra da Defense, e tudo o que ela dá, somado, não passa do preço do tier dela. Walk-In, Drop-In e Extra sem Power Swap, companions vendidas e Exile não contam.
- **Conferência dos descontos:** compara o que o Interactive escreveu (arquétipo, Talents e Defenses repetidos, Defense Rebates) com a conta refeita. Fora da Couple's Account, a conta refeita entra sozinha quando você mexe em tags ou usa Meus personagens; senão, marque "Usar o recalculado".

## Escolhas de regra (aba Regras)

Onde as regras deixam dúvida, a ferramenta escolhe um lado e deixa você trocar:

- **Waifu Perk e Power Swap da origem entram no preço da origem** (ligado). Assim, no exemplo, Natsu T7 (100) com Power Swap para Acnologia T8 (mais 100) conta como uma origem de 200. Desligado, o Power Swap é pago à parte, e o exemplo fica 100 créditos mais caro.
- **O SO ganha desconto de arquétipo** (ligado) e **as tags do SO contam nos Defense Rebates** (ligado). O Interactive não conta o SO em nenhum dos dois.
- **Somar os brindes da 2ª cópia de heritage** (desligado). Ligado, os Talents e Defenses grátis entram de novo, e o que passar do limite volta como desconto de repetido.
- **DRX start, DLC de blocos sem verba própria** (só em build DRX): do desconto de repetidos (padrão) ou da verba de 600, sem repetidos.

## Arquivos

- `WaifuCatalogBuildFix.html`: a página, gerada a partir da pasta `fonte/`. Não edite à mão.
- `fonte/`: as partes da página. `pagina.html` (estrutura), `estilo.css` (visual), `interface.js` (telas), `motor.js` (contas), `saves.js` (saves e arquivos .txt), `exemplo.js` (a build de exemplo: Natsu Dragneel com a Tsukino Usagi), `idiomas.js` (troca de idioma e bandeiras) e `traducao-en.js` (os textos em inglês).
- `dados/interactive-dados.js`: preços de heritage, Talents e Defenses, a lista de challenges e as tags de 38 mil personagens, tirados do Interactive.
- `.github/workflows/atualizar-dados.yml`: toda segunda-feira, o GitHub Actions baixa os dados do Interactive. Se nada mudou, não faz nada; se mudou, roda os testes, grava os dados novos e publica o site de novo, sem tirar o site do ar.
- `.github/workflows/site.yml`: publica o site no GitHub Pages a cada mudança na `main`, depois dos testes.
- `ferramentas/atualizar-dados.bat`: o mesmo que o workflow, no PC (precisa do [Node.js](https://nodejs.org)). Serve para uma cópia baixada; se nada mudou no Interactive, não grava nada.
- `ferramentas/montar.mjs`: junta `fonte/` e os dados em `WaifuCatalogBuildFix.html` (`node montar.mjs`, dentro de `ferramentas`).
- `ferramentas/testes.mjs`: testes das contas e de Meus personagens (`node testes.mjs`, dentro de `ferramentas`). Também confere se a página está em dia com `fonte/`. Não edite `WaifuCatalogBuildFix.html` à mão: edite `fonte/` e rode `node montar.mjs`.
- `ferramentas/traducoes.mjs`: lista os textos sem tradução em inglês (`node traducoes.mjs`). Os textos ficam em português no código, dentro de `tr('...')`, e a tradução fica em `fonte/traducao-en.js`, com o texto em português como chave. O `montar.mjs` avisa quando falta alguma.

---

Ferramenta de fã, sem ligação oficial com o Waifu Catalog. Dados e fórmulas do [Waifu Catalog Interactive](https://waifu-catalog.neocities.org).

Feito com ❤️ por [MrMarkinBoladao](https://github.com/MrMarkinBoladao).
