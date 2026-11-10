# Suporte DRX (Danger Rating X Start) - Caderno do Contractor

## O que é DRX Start?

DRX (Danger Rating X) é um modo especial de início do Waifu Catalog onde, em vez de um budget único, você recebe orçamentos separados para diferentes categorias de perks.

## Como Funciona

Quando você cola uma build com "DRX start" nas opções de Intensity, o Caderno do Contractor automaticamente:

### 1. Detecta o Modo DRX
A ferramenta identifica automaticamente builds DRX pela presença de "DRX start" nas opções de Intensity.

### 2. Orçamentos Por Categoria

Você recebe créditos separados para cada categoria:

- **Heritage**: 400 créditos
- **Catch-a-Ride** (Rides): 545 créditos  
- **Demiplanes & Dungeons** (Home Perks): 500 créditos
- **Outros perks oficiais**: 600 créditos
  - Inclui: Bindings, Lures, Other Controls, Talents, Defenses, Misc Perks, Generic Waifu Perks, Waifu Perks

### 3. Acompanhamento de Gastos

A ferramenta calcula automaticamente quanto você gastou em cada categoria e avisa se ultrapassar algum orçamento.

**Exemplos de avisos:**
- ✓ `Heritage: gastou 350 de 400 disponíveis.` (OK)
- ✗ `Other perks: gastou 650 de 600 disponíveis. Você excedeu o orçamento DRX em 50.` (Erro)

### 4. Leftover Credits

Créditos que sobrarem podem ser usados após 7 dias (168 horas) na narrativa:

**Antes dos 7 dias:**
```
DRX leftover credits: 295 créditos ficaram sobrando, mas só podem ser 
usados depois de 7 dias (168 horas) na narrativa. Marque a opção 
"7 dias passaram" para liberá-los.
```

**Depois dos 7 dias:**
```
DRX leftover credits: 295 créditos disponíveis (7 dias passaram na narrativa).
```

## Como Usar

### Aba Build
1. Cole sua build DRX do Interactive (Copy Text of Build)
2. A ferramenta detecta automaticamente o modo DRX
3. Um aviso informa que é uma build DRX

### Aba Resultado → Resumo
Você verá:
- Avisos sobre orçamentos excedidos (se houver)
- Informações sobre leftover credits
- Todos os outros avisos normais da ferramenta

### Aba Regras
Quando uma build DRX está aberta, aparecem opções adicionais:

#### Opções DRX

**☐ 7 dias passaram na narrativa**
- Marca quando 168 horas in-game se passaram
- Libera os leftover credits para uso
- Deixe desmarcado durante os primeiros 7 dias

**☐ Esta build está em Chargen (modo criação de personagem)**
- Sistema anti-erros que evita opções pós-Chargen
- Útil para garantir que você não usa perks/options inválidos durante a criação
- Desligue após começar a jogar

## Regras Especiais DRX

### O que DRX start dá:

1. Um companion de Tier χ/X ou Ψ/Y (com Couple's Account automático)
2. Qualquer Origin gratuita (Substitute e Possess limitados a T6 ou menos)
3. Uma binding básica
4. Lures básicos ilimitados
5. Todos os Talents básicos e ambas as compras de todas as Defenses
6. Os orçamentos por categoria mencionados acima

### Importante:

- **Preços travados**: Capturas e vendas usam valores de Intensity 10.0
- **Yoink gratuito**: Se começar no mundo do seu companion
- **Waifu Perks limitados**: Não podem elevar seu tier acima de 6 durante Chargen
- **Sem Defense Rebates**: O Interactive não calcula Defense Rebates em modo DRX, então a ferramenta também não

## Exemplo de Build DRX

```
Starting World: SCP Foundation
Starting budget 2045
Intensity [4]
Couple's Account (Cooperative) -180
DRX start 0

You as Rimuru Tempest (Possess) of T7 -100 [1765]
Your SO as Elysia (Possess) of T9 -500 [1265]

Heritage:
Dragon Heart[Water] -60 [1205]       // 60 do orçamento de Heritage (400)
Power Overwhelming -50 [1155]          // 110/400 usado

Rides:
Pocket Bus -50 [1105]                  // 50 do orçamento de Rides (545)

Home Perks:
Pocket Space -100 [1005]               // 100 do orçamento de Home (500)

Bindings:
Binding Stamp I -200 [805]             // 200 do orçamento de Outros (600)
```

**Resultado:**
- Heritage: 110/400 ✓
- Rides: 50/545 ✓
- Home: 100/500 ✓
- Outros: 200/600 ✓
- **Leftover: (400-110) + (545-50) + (500-100) + (600-200) = 1585 créditos** 
  (disponíveis após 7 dias)

## Perguntas Frequentes

**P: A ferramenta substitui o Interactive para builds DRX?**
R: Não. Use o Interactive normalmente para montar a build. A ferramenta ajuda a conferir os orçamentos e corrigir o texto para LLMs.

**P: Como sei se ultrapassei um orçamento?**
R: A ferramenta mostra avisos vermelhos de erro quando qualquer categoria excede seu limite.

**P: Os leftover credits contam no saldo final?**
R: Não durante os primeiros 7 dias. Depois disso, eles são adicionados ao seu budget disponível.

**P: Posso mover créditos entre categorias?**
R: Não. Cada categoria tem seu orçamento fixo e separado.

**P: O que acontece se eu desmarcar "DRX start"?**
R: A ferramenta trata a build como normal e não aplica as regras DRX.

## Notas Técnicas

- A detecção é case-insensitive: "DRX start", "drx start", "DRX Start" funcionam
- Os gastos são calculados pela seção onde o item aparece no texto
- Itens com custo negativo (descontos, devoluções) não afetam os orçamentos DRX
- A ferramenta só conta o custo base, sem descontos de arquétipo ou repetidos

---

**Versão:** 2026-11-10  
**Arquivo:** `WaifuCatalogBuildFix.html`
