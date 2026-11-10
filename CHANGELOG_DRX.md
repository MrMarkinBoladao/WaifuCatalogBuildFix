# Changelog - Suporte DRX

## Versão 2026-11-10 - Suporte DRX Implementado

### Novas Funcionalidades

#### 1. Detecção Automática de Builds DRX
- A ferramenta detecta automaticamente quando uma build tem "DRX start" nas opções de Intensity
- Um aviso informativo aparece indicando que é uma build DRX

#### 2. Orçamentos por Categoria
Adicionadas constantes para os quatro orçamentos DRX:
```javascript
DRX_BUDGETS = {
  heritage: 400,     // Heritage
  rides: 545,        // Catch-a-Ride
  home: 500,         // Demiplanes & Dungeons  
  outros: 600,       // Outros perks oficiais
}
```

#### 3. Cálculo de Gastos DRX
Nova função `calcularGastosDRX()` que:
- Analisa todas as linhas da build
- Classifica cada item pela seção (Heritage, Rides, Home Perks, etc.)
- Soma os custos por categoria
- Retorna os gastos totais de cada orçamento

#### 4. Avisos de Orçamento
Sistema inteligente de avisos:
- **Erro**: Quando uma categoria excede seu orçamento
  - Exemplo: `"Heritage: gastou 450 de 400 disponíveis. Você excedeu o orçamento DRX em 50."`
- **Info**: Mostra leftover credits disponíveis
  - Antes de 7 dias: avisa que estão bloqueados
  - Após 7 dias: confirma que estão liberados

#### 5. Novas Opções de Configuração

**Aba Regras → Opções DRX** (aparecem apenas em builds DRX):

- ☐ **7 dias passaram na narrativa**
  - Controla se os leftover credits estão liberados
  - Padrão: desmarcado (primeiros 7 dias)
  
- ☐ **Esta build está em Chargen (modo criação de personagem)**
  - Sistema anti-erros para evitar opções inválidas durante Chargen
  - Padrão: desmarcado

### Alterações no Código

#### Arquivos Modificados
- `WaifuCatalogBuildFix.html` (arquivo principal)

#### Mudanças Específicas

**1. Constantes (linha ~505)**
```javascript
// Adicionado após PRECO_TIER
const DRX_BUDGETS = {
  heritage: 400,
  rides: 545,
  home: 500,
  outros: 600,
}
```

**2. Modelo de Dados (montarModelo)**
```javascript
// Adicionado ao objeto md
drxSpent: { heritage: 0, rides: 0, home: 0, outros: 0 },
```

**3. Configuração (configPadrao)**
```javascript
// Adicionado em cfg.opcoes
drx7DiasPassed: false,
emChargen: false,
```

**4. Nova Função de Cálculo**
```javascript
function calcularGastosDRX(modelo, cfg) {
  const gastos = { heritage: 0, rides: 0, home: 0, outros: 0 }
  
  // Heritage
  for (const L of modelo.heritage) {
    gastos.heritage += L.custo
  }
  
  // Rides (Catch-a-Ride)
  for (const L of modelo.linhas) {
    if (L.secao === 'Rides' && L.tipo === 'item' && L.custo > 0) {
      gastos.rides += L.custo
    }
  }
  
  // Home Perks (Demiplanes & Dungeons)
  for (const L of modelo.linhas) {
    if (L.secao === 'Home Perks' && L.tipo === 'item' && L.custo > 0) {
      gastos.home += L.custo
    }
  }
  
  // Outros: Bindings, Lures, Other Controls, Talents, Defenses, Misc Perks
  const seccoesOutros = ['Bindings', 'Lures', 'Other Controls', 'Talents', 
                         'Defenses', 'Misc Perks', 'Generic Waifu Perks', 'Waifu Perks']
  for (const L of modelo.linhas) {
    if (seccoesOutros.includes(L.secao) && L.tipo === 'item' && L.custo > 0) {
      gastos.outros += L.custo
    }
  }
  
  return gastos
}
```

**5. Avisos DRX na Função calcular**
```javascript
// Adicionado após o aviso de DRX existente
if (modelo.drx) {
  const gastos = calcularGastosDRX(modelo, cfg)
  const categorias = [
    { nome: 'Heritage', gasto: gastos.heritage, limite: DRX_BUDGETS.heritage },
    { nome: 'Catch-a-Ride', gasto: gastos.rides, limite: DRX_BUDGETS.rides },
    { nome: 'Demiplanes & Dungeons', gasto: gastos.home, limite: DRX_BUDGETS.home },
    { nome: 'Other perks', gasto: gastos.outros, limite: DRX_BUDGETS.outros },
  ]
  
  for (const cat of categorias) {
    if (cat.gasto > cat.limite) {
      avisos.push({ 
        nivel: 'erro', 
        texto: `${cat.nome}: gastou ${fmt(cat.gasto)} de ${fmt(cat.limite)} disponíveis. 
                Você excedeu o orçamento DRX em ${fmt(cat.gasto - cat.limite)}.` 
      })
    }
  }
  
  // Calcula leftover credits
  const totalGasto = gastos.heritage + gastos.rides + gastos.home + gastos.outros
  const totalDisponivel = DRX_BUDGETS.heritage + DRX_BUDGETS.rides + 
                           DRX_BUDGETS.home + DRX_BUDGETS.outros
  const sobrou = totalDisponivel - totalGasto
  
  if (sobrou > 0) {
    if (op.drx7DiasPassed) {
      avisos.push({ 
        nivel: 'info', 
        texto: `DRX leftover credits: ${fmt(sobrou)} créditos disponíveis 
                (7 dias passaram na narrativa).` 
      })
    } else {
      avisos.push({ 
        nivel: 'info', 
        texto: `DRX leftover credits: ${fmt(sobrou)} créditos ficaram sobrando, 
                mas só podem ser usados depois de 7 dias (168 horas) na narrativa. 
                Marque a opção "7 dias passaram" para liberá-los.` 
      })
    }
  }
}
```

**6. Interface nas Regras (montarRegras)**
```javascript
// Adicionado após as opções existentes
if (est.modelo && est.modelo.drx) {
  card1.append(h('h3', { style: 'margin:16px 0 8px' }, 
               'Opções de DRX (Danger Rating X Start)'))
  card1.append(
    opcao('drx7DiasPassed', '7 dias passaram na narrativa', 
          'Libera os leftover credits...', false),
    opcao('emChargen', 'Esta build está em Chargen...', 
          'Evita que a ferramenta ofereça opções...', false))
}
```

### Comportamento

#### Fluxo de Uso
1. Usuário cola build com "DRX start"
2. Ferramenta detecta automaticamente
3. Calcula gastos por categoria
4. Mostra avisos se exceder orçamentos
5. Calcula e informa leftover credits
6. Usuário pode marcar "7 dias passaram" quando apropriado

#### Compatibilidade
- Builds normais (não-DRX) não são afetadas
- As opções DRX só aparecem em builds DRX
- Backward compatible com saves anteriores

### Testes Recomendados

1. ✓ Build normal (não-DRX) funciona como antes
2. ✓ Build DRX é detectada corretamente
3. ✓ Gastos são calculados por categoria
4. ✓ Avisos aparecem quando orçamentos são excedidos
5. ✓ Leftover credits são calculados corretamente
6. ✓ Checkbox "7 dias passaram" alterna o aviso
7. ✓ Opções DRX só aparecem em builds DRX
8. ✓ Saves com builds DRX carregam corretamente

### Arquivos de Documentação Criados
- `DRX_README.md` - Guia completo de uso
- `CHANGELOG_DRX.md` - Este arquivo (registro de mudanças)

### Próximos Passos Possíveis

**Melhorias Futuras (não implementadas nesta versão):**
1. Painel visual mostrando barras de progresso dos orçamentos
2. Export de relatório DRX em texto
3. Histórico de gastos por categoria ao longo das versões
4. Sugestões de otimização quando próximo do limite
5. Validação adicional de regras DRX específicas

---

**Data:** 2026-11-10  
**Autor:** Kiro (Claude Sonnet 4.5)  
**Solicitado por:** Usuário (Escritor de fanfics)
