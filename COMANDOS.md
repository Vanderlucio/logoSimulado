# 📖 Manual Completo de Comandos do Simulador Siemens LOGO!

Este documento contém o guia detalhado e a referência de todos os comandos do **Simulador de CLP Siemens LOGO! (0BA7 / 0BA8 / 8.x)** com suporte ao protocolo **ISO-on-TCP (S7Comm, Porta 102)** e emulação integral do mapa de memória VM.

---

## 📑 Sumário

- [1. Visão Geral do Mapa de Memória VM](#1-visão-geral-do-mapa-de-memória-vm)
- [2. Atalhos Rápidos de 1 Tecla](#2-atalhos-rápidos-de-1-tecla)
- [3. Comandos de Manipulação de Variáveis](#3-comandos-de-manipulação-de-variáveis)
- [4. Comandos de Visualização e Monitoramento](#4-comandos-de-visualização-e-monitoramento)
- [5. Geradores de Sinais e Simulação Dinâmica](#5-geradores-de-sinais-e-simulação-dinâmica)
- [6. Cenários Industriais Automáticos](#6-cenários-industriais-automáticos)
- [7. Persistência de Estado (Salvar e Carregar)](#7-persistência-de-estado-salvar-e-carregar)
- [8. Guia de Endereçamento e Notações Suportadas](#8-guia-de-endereçamento-e-notações-suportadas)
- [9. Integração com Node-RED, NodeS7 e SCADA](#9-integração-com-node-red-nodes7-e-scada)

---

## 1. Visão Geral do Mapa de Memória VM

O simulador emula com 100% de exatidão o mapa de memória VM (**DB1**) do Siemens LOGO! conforme especificação da Siemens e Node-RED:

| Bloco LOGO! | Faixa VM (DB1) | Tipo de Dados | Exemplo S7 / Node-RED | Descrição |
|---|---|---|---|---|
| **I** | `1024 - 1031` (8 bytes) | Bit / Byte / Word | `DB1,X1024.0` ou `I1` ou `I0.0` | Entradas digitais físicas (I1 a I64) |
| **AI** | `1032 - 1063` (32 bytes) | Word (16-bit Int) | `DB1,WORD1032` ou `AI1` | Entradas analógicas (AI1 a AI16) |
| **Q** | `1064 - 1071` (8 bytes) | Bit / Byte / Word | `DB1,X1064.0` ou `Q1` ou `Q0.0` | Saídas digitais físicas (Q1 a Q64) |
| **AQ** | `1072 - 1103` (32 bytes) | Word (16-bit Int) | `DB1,WORD1072` ou `AQ1` | Saídas analógicas (AQ1 a AQ16) |
| **M** | `1104 - 1117` (14 bytes) | Bit / Byte / Word | `DB1,X1104.0` ou `M1` ou `M0.0` | Flags / Marcadores de memória (M1 a M112) |
| **AM** | `1118 - 1245` (128 bytes) | Word (16-bit Int) | `DB1,WORD1118` ou `AM1` | Flags analógicas de memória (AM1 a AM64) |
| **NI** | `1246 - 1261` (16 bytes) | Bit / Byte / Word | `DB1,X1246.0` ou `NI1` | Entradas digitais de rede (NI1 a NI128) *(ex: Trava)* |
| **NAI** | `1262 - 1389` (128 bytes) | Word (16-bit Int) | `DB1,WORD1262` ou `NAI1` | Entradas analógicas de rede (NAI1 a NAI64) |
| **NQ** | `1390 - 1405` (16 bytes) | Bit / Byte / Word | `DB1,X1390.0` ou `NQ1` | Saídas digitais de rede (NQ1 a NQ128) |
| **NAQ** | `1406 - 1469` (64 bytes) | Word (16-bit Int) | `DB1,WORD1406` ou `NAQ1` | Saídas analógicas de rede (NAQ1 a NAQ32) |

---

## 2. Atalhos Rápidos de 1 Tecla

Digite a tecla correspondente no terminal e pressione `Enter`:

| Tecla | Ação | Efeito no Simulador |
|---|---|---|
| `1` | **Fechar Porta** | Define `I0.1 = true` (Entrada I2 ligada) |
| `0` | **Abrir Porta** | Define `I0.1 = false` (Entrada I2 desligada) |
| `t` | **Toggle Trava** | Inverte o estado de `DB1,X1246.0` (NI1) |
| `s` | **Status Geral** | Exibe o painel de status de todos os blocos ativos |
| `?` | **Ajuda** | Mostra o resumo rápido de comandos no console |
| `q` | **Sair** | Encerra o simulador |

---

## 3. Comandos de Manipulação de Variáveis

### `set <tag> <valor>` ou `write <tag> <valor>`
Define o valor de uma tag digital (booleana), analógica (16-bit) ou de ponto flutuante.

#### Exemplos:
```bash
# Entradas Digitais (I)
LOGO-CLP > set I1 1              # Liga entrada digital 1 (DB1,X1024.0)
LOGO-CLP > set I1 0              # Desliga entrada digital 1
LOGO-CLP > set I0.1 1            # Fecha a porta (notação S7 direta)

# Entradas Analógicas (AI)
LOGO-CLP > set AI1 2540          # Define AI1 com 2540 (peso na balança)
LOGO-CLP > set AI2 750           # Define AI2 com 750

# Saídas Digitais (Q)
LOGO-CLP > set Q1 1              # Aciona saída digital Q1
LOGO-CLP > set Q2 0              # Desliga saída Q2

# Saídas Analógicas (AQ)
LOGO-CLP > set AQ1 1000          # Define saída analógica AQ1 = 1000

# Flags de Memória (M e AM)
LOGO-CLP > set M1 1              # Seta flag digital M1
LOGO-CLP > set AM1 500           # Seta flag analógica AM1 = 500

# Entradas de Rede (NI e NAI)
LOGO-CLP > set NI1 1             # Aciona Trava / Network Input 1 (DB1,X1246.0)
LOGO-CLP > set NAI1 150          # Define entrada analógica de rede NAI1 = 150

# Escrita Direta por Endereço S7 / DB1
LOGO-CLP > set DB1,X1024.0 1     # Seta bit 0 do byte 1024
LOGO-CLP > set DB1,WORD1032 3000 # Seta Word no byte 1032
LOGO-CLP > set DB1,BYTE1024 255  # Seta todos os 8 bits de entrada (I1..I8) em nível alto
```

---

### `toggle <tag>` ou `t <tag>`
Inverte o estado lógico de uma variável digital (`true` vira `false`, `false` vira `true`).

#### Exemplos:
```bash
LOGO-CLP > toggle I1             # Inverte entrada I1
LOGO-CLP > toggle NI1            # Inverte trava NI1
LOGO-CLP > toggle Q1             # Inverte saída Q1
LOGO-CLP > toggle M5             # Inverte flag M5
LOGO-CLP > t DB1,X1246.0         # Inverte pelo endereço absoluto
```

---

### `get <tag>` ou `read <tag>`
Lê o valor atual de qualquer tag ou endereço de memória.

#### Exemplos:
```bash
LOGO-CLP > get AI1               # Lê entrada analógica AI1
# Resposta: AI1 [DB1,WORD1032] = 2540

LOGO-CLP > get I1                # Lê entrada digital I1
# Resposta: I1 [DB1,X1024.0 / I0.0] = ● ON (1)

LOGO-CLP > get DB1,WORD1032      # Lê pelo endereço absoluto
LOGO-CLP > get I0.1              # Lê status da porta
```

---

## 4. Comandos de Visualização e Monitoramento

### `status` ou `s`
Exibe uma tabela consolidada e com cores ANSI de todos os blocos ativos do LOGO!, incluindo entradas digitais, analógicas, saídas, flags, rede e simulações ativas.

```bash
LOGO-CLP > status
```

---

### `view <bloco>` ou `bloco <nome>`
Exibe a tabela detalhada com endereços absolutos, bytes, bits, tipos e valores atuais dos elementos do bloco.

#### Opções de Blocos:
- `view I` : Entradas Digitais (I1..I64)
- `view AI`: Entradas Analógicas (AI1..AI16)
- `view Q` : Saídas Digitais (Q1..Q64)
- `view AQ`: Saídas Analógicas (AQ1..AQ16)
- `view M` : Flags Digitais (M1..M112)
- `view AM`: Flags Analógicas (AM1..AM64)
- `view NI`: Entradas de Rede Digitais (NI1..NI128)
- `view NAI`: Entradas de Rede Analógicas (NAI1..NAI64)
- `view NQ`: Saídas de Rede Digitais (NQ1..NQ128)
- `view NAQ`: Saídas de Rede Analógicas (NAQ1..NAQ32)
- `view all`: Exibe todos os blocos em sequência

#### Exemplo:
```bash
LOGO-CLP > view AI
```

---

### `watch <tag1,tag2,...>`
Inicia o modo de monitoramento dinâmico em tempo real na linha do console. Atualiza a cada 500ms. Para sair, basta pressionar `Enter` ou digitar qualquer comando.

#### Exemplos:
```bash
LOGO-CLP > watch I1,I2,AI1,DB1,X1246.0
LOGO-CLP > watch AI1,AI2,AQ1
```

---

### `dump [inicio] [tamanho]` ou `hex [inicio] [tamanho]`
Gera um Hex Dump formatado com endereço hexadecimal, decimal e caracteres ASCII dos bytes da memória VM.

#### Exemplos:
```bash
LOGO-CLP > dump                  # Exibe 64 bytes a partir do byte 1024
LOGO-CLP > dump 1024 32          # Exibe os 32 bytes das entradas I e analógicas AI
LOGO-CLP > dump 1246 16          # Exibe os bytes de entradas de rede NI
```

---

## 5. Geradores de Sinais e Simulação Dinâmica

Permite criar testes contínuos sem necessidade de intervenção manual, simulando processos industriais reais (sensores, peças passando, oscilação de temperatura/pressão).

### `wave <tag> [min] [max] [periodo_ms]` ou `onda <tag> ...`
Inicia um gerador de onda senoidal suave em uma entrada ou saída analógica.

#### Parâmetros:
- `<tag>`: Tag analógica (ex: `AI1`, `AQ1`, `AM1`, `NAI1`, `NAQ1`, `DB1,WORD1032`)
- `[min]`: Valor mínimo (padrão: `0`)
- `[max]`: Valor máximo (padrão: `1000`)
- `[periodo_ms]`: Tempo de um ciclo completo em milissegundos (padrão: `5000` = 5s)

#### Exemplos:
```bash
LOGO-CLP > wave AI1 0 1000 5000        # Oscila AI1 entre 0 e 1000 a cada 5 segundos
LOGO-CLP > wave AI1 2000 3500 10000    # Simula oscilação de peso na balança
LOGO-CLP > wave NAI1 100 800 3000      # Simula sinal analógico de rede
```

---

### `pulse <tag> [intervalo_ms]` ou `clock <tag> ...`
Gera um sinal de clock/pulso liga e desliga periódico em uma tag digital.

#### Parâmetros:
- `<tag>`: Tag digital (ex: `I1`, `Q1`, `M1`, `NI1`, `DB1,X1024.0`)
- `[intervalo_ms]`: Intervalo de alternância em milissegundos (padrão: `1000` = 1s)

#### Exemplos:
```bash
LOGO-CLP > pulse I1 500          # Pulsa I1 a cada 500ms (sensor de esteira / encoder)
LOGO-CLP > pulse NI1 2000        # Alterna trava de rede a cada 2s
```

---

### `listsim`
Lista todas as simulações e geradores dinâmicos ativos com seus respectivos IDs.

```bash
LOGO-CLP > listsim
```

---

### `stopsim <id | all>` ou `stop <id | all>`
Para uma simulação específica pelo ID ou todas de uma só vez.

#### Exemplos:
```bash
LOGO-CLP > stopsim 1             # Para a simulação #1
LOGO-CLP > stopsim all           # Para todas as simulações ativas
```

---

## 6. Cenários Industriais Automáticos

Aplica configurações instantâneas para simular diferentes tipos de máquinas ou processos industriais:

### `scenario <nome>` ou `cenario <nome>`

| Cenário | Comando | Configuração Aplicada |
|---|---|---|
| **Balança Martinrea** | `scenario balanca` | Porta Fechada (`I0.1 = true`), Trava Bloqueada (`DB1,X1246.0 = false`), Peso Inicial `AI1 = 2540` |
| **Esteira Industrial** | `scenario esteira` | Sensor Peça (`I1 = true`), Emergência OK (`I2 = true`), Motor Ligado (`Q1 = true`), RPM `AI1 = 1750`, Inversor `AQ1 = 800` |
| **Tanque de Nível** | `scenario tanque` | Válvula Enchimento (`Q1 = true`), Dreno Fechado (`Q2 = false`), Onda senoidal dinâmica em `AI1` (200L a 950L) |
| **Zerar Memória** | `scenario limpo` ou `reset` | Zera todos os 2048 bytes da memória VM |

#### Exemplo:
```bash
LOGO-CLP > scenario balanca
LOGO-CLP > scenario esteira
LOGO-CLP > scenario tanque
LOGO-CLP > reset
```

---

## 7. Persistência de Estado (Salvar e Carregar)

### `save [caminho_arquivo]`
Salva uma cópia exata de toda a memória VM (2048 bytes) em um arquivo JSON com timestamp.

```bash
LOGO-CLP > save                        # Salva em snapshot_logo.json
LOGO-CLP > save balanca_calibrada.json # Salva em arquivo personalizado
```

---

### `load [caminho_arquivo]`
Restaura o estado da memória VM a partir de um arquivo de snapshot salvo anteriormente.

```bash
LOGO-CLP > load                        # Restaura de snapshot_logo.json
LOGO-CLP > load balanca_calibrada.json # Restaura arquivo personalizado
```

---

## 8. Guia de Endereçamento e Notações Suportadas

O parser do simulador é universal e aceita qualquer uma das seguintes notações:

### 1. Notação Amigável do LOGO!:
- **Digitais**: `I1` a `I64`, `Q1` a `Q64`, `M1` a `M112`, `NI1` a `NI128`, `NQ1` a `NQ128`
- **Analógicas**: `AI1` a `AI16`, `AQ1` a `AQ16`, `AM1` a `AM64`, `NAI1` a `NAI64`, `NAQ1` a `NAQ32`

### 2. Notação Standard S7:
- **Entradas**: `I0.0` a `I7.7` *(mapeadas para VM 1024 a 1031)*
- **Saídas**: `Q0.0` a `Q7.7` *(mapeadas para VM 1064 a 1071)*
- **Flags**: `M0.0` a `M13.7` *(mapeadas para VM 1104 a 1117)*

### 3. Notação DB1 (Node-RED, NodeS7, Snap7):
- **Bits**: `DB1,X1024.0`, `DB1.DBX1024.0`, `DB1,X1246.0`
- **Bytes**: `DB1,BYTE1024`, `DB1,B1024`, `DB1.DBB1024`
- **Words**: `DB1,WORD1032`, `DB1,W1032`, `DB1,INT1032`, `DB1.DBW1032`
- **DWords**: `DB1,DWORD1032`, `DB1,D1032`, `DB1,DINT1032`, `DB1.DBD1032`
- **Reais (Float)**: `DB1,REAL1032`

---

## 9. Integração com Node-RED, NodeS7 e SCADA

### Configuração de Conexão S7:
- **Protocolo**: ISO-on-TCP (RFC 1006 / S7Comm)
- **IP do Servidor**: `127.0.0.1` (ou o IP da máquina na rede)
- **Porta**: `102`
- **Rack**: `0`
- **Slot**: `1` (ou `2`)
- **TSAP Local / Remoto**: `01.00` / `02.00` (ou padrão S7-300/LOGO!)

### Exemplo de Configuração no `NodeS7`:
```javascript
import nodes7 from 'nodes7';
const s7 = new nodes7();

const variables = {
    portaFechada: 'DB1,X1024.1', // ou I0.1
    trava:        'DB1,X1246.0', // NI1
    pesoBalanca:  'DB1,WORD1032',// AI1
    saidaMotor:   'DB1,X1064.0'  // Q1
};

s7.initiateConnection({ port: 102, host: '127.0.0.1', rack: 0, slot: 1 }, (err) => {
    if (err) return console.error('Erro na conexão:', err);
    console.log('Conectado ao Simulador Siemens LOGO!');

    s7.setTranslationCB((tag) => variables[tag]);
    s7.addItems(Object.keys(variables));

    s7.readAllItems((err, values) => {
        console.log('Valores lidos:', values);
    });
});
```

---

## 🚀 Como Iniciar

Para rodar o simulador completo:
```bash
npm start
# ou
node simulador_logo.js
```

Para rodar a suite de testes automatizados:
```bash
npm test
# ou
node teste_cliente_logo.js
```
