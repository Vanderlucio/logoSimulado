# 📖 Manual Completo de Comandos do Simulador Siemens LOGO!

Este documento contém o guia completo e detalhado de todos os comandos do **Simulador de CLP Siemens LOGO! (0BA7 / 0BA8 / 8.x)**, com suporte nativo ao protocolo **ISO-on-TCP (S7Comm, Porta 102)** e emulação integral de toda a memória VM (**DB1**).

---

## 📑 Sumário

- [1. Visão Geral do Mapa de Memória VM](#1-visão-geral-do-mapa-de-memória-vm)
- [2. Comandos de Manipulação de Entradas, Saídas e Memórias](#2-comandos-de-manipulação-de-entradas-saídas-e-memórias)
- [3. Comandos de Visualização e Monitoramento](#3-comandos-de-visualização-e-monitoramento)
- [4. Geradores de Sinais e Simulação Dinâmica](#4-geradores-de-sinais-e-simulação-dinâmica)
- [5. Persistência de Estado (Salvar e Carregar)](#5-persistência-de-estado-salvar-e-carregar)
- [6. Guia de Endereçamento e Notações Suportadas](#6-guia-de-endereçamento-e-notações-suportadas)
- [7. Integração com Node-RED, NodeS7 e SCADA](#7-integração-com-node-red-nodes7-e-scada)

---

## 1. Visão Geral do Mapa de Memória VM

O simulador emula com 100% de exatidão todo o mapa de memória VM (**DB1**) do Siemens LOGO!:

| Bloco LOGO! | Faixa VM (DB1) | Tipo de Dados | Exemplo S7 / Node-RED | Descrição |
|---|---|---|---|---|
| **I** | `1024 - 1031` (8 bytes) | Bit / Byte / Word | `DB1,X1024.0` ou `I1` ou `I0.0` | Entradas digitais físicas (I1 a I64) |
| **AI** | `1032 - 1063` (32 bytes) | Word (16-bit Int) | `DB1,WORD1032` ou `AI1` | Entradas analógicas (AI1 a AI16) |
| **Q** | `1064 - 1071` (8 bytes) | Bit / Byte / Word | `DB1,X1064.0` ou `Q1` ou `Q0.0` | Saídas digitais físicas (Q1 a Q64) |
| **AQ** | `1072 - 1103` (32 bytes) | Word (16-bit Int) | `DB1,WORD1072` ou `AQ1` | Saídas analógicas (AQ1 a AQ16) |
| **M** | `1104 - 1117` (14 bytes) | Bit / Byte / Word | `DB1,X1104.0` ou `M1` ou `M0.0` | Flags / Marcadores de memória (M1 a M112) |
| **AM** | `1118 - 1245` (128 bytes) | Word (16-bit Int) | `DB1,WORD1118` ou `AM1` | Flags analógicas de memória (AM1 a AM64) |
| **NI** | `1246 - 1261` (16 bytes) | Bit / Byte / Word | `DB1,X1246.0` ou `NI1` | Entradas digitais de rede (NI1 a NI128) |
| **NAI** | `1262 - 1389` (128 bytes) | Word (16-bit Int) | `DB1,WORD1262` ou `NAI1` | Entradas analógicas de rede (NAI1 a NAI64) |
| **NQ** | `1390 - 1405` (16 bytes) | Bit / Byte / Word | `DB1,X1390.0` ou `NQ1` | Saídas digitais de rede (NQ1 a NQ128) |
| **NAQ** | `1406 - 1469` (64 bytes) | Word (16-bit Int) | `DB1,WORD1406` ou `NAQ1` | Saídas analógicas de rede (NAQ1 a NAQ32) |

---

## 2. Comandos de Manipulação de Entradas, Saídas e Memórias

### `set <tag> <valor>` ou `write <tag> <valor>`
Define o valor de qualquer variável digital (booleana), analógica (16-bit Word), byte, dword ou ponto flutuante.

#### Exemplos Práticos:
```bash
# ── Entradas Digitais (I) ───────────────────────────────────
LOGO-CLP > set I1 1              # Liga entrada digital I1 (DB1,X1024.0)
LOGO-CLP > set I1 0              # Desliga entrada digital I1
LOGO-CLP > set I8 1              # Liga entrada digital I8 (DB1,X1024.7)
LOGO-CLP > set I9 1              # Liga entrada digital I9 (DB1,X1025.0)

# ── Entradas Analógicas (AI) ────────────────────────────────
LOGO-CLP > set AI1 500           # Define AI1 = 500 (DB1,WORD1032)
LOGO-CLP > set AI2 1000          # Define AI2 = 1000 (DB1,WORD1034)

# ── Saídas Digitais (Q) ─────────────────────────────────────
LOGO-CLP > set Q1 1              # Liga saída digital Q1 (DB1,X1064.0)
LOGO-CLP > set Q1 0              # Desliga saída Q1
LOGO-CLP > set Q4 1              # Liga saída digital Q4 (DB1,X1064.3)

# ── Saídas Analógicas (AQ) ──────────────────────────────────
LOGO-CLP > set AQ1 750           # Define AQ1 = 750 (DB1,WORD1072)
LOGO-CLP > set AQ2 300           # Define AQ2 = 300 (DB1,WORD1074)

# ── Flags / Marcadores Digitais (M) ─────────────────────────
LOGO-CLP > set M1 1              # Liga flag digital M1 (DB1,X1104.0)
LOGO-CLP > set M8 1              # Liga flag digital M8 (DB1,X1104.7)
LOGO-CLP > set M9 1              # Liga flag digital M9 (DB1,X1105.0)

# ── Flags Analógicas (AM) ───────────────────────────────────
LOGO-CLP > set AM1 250           # Define flag analógica AM1 = 250 (DB1,WORD1118)
LOGO-CLP > set AM2 820           # Define flag analógica AM2 = 820 (DB1,WORD1120)

# ── Entradas de Rede Digitais (NI) ──────────────────────────
LOGO-CLP > set NI1 1             # Liga Network Input NI1 (DB1,X1246.0)
LOGO-CLP > set NI2 0             # Desliga Network Input NI2

# ── Entradas de Rede Analógicas (NAI) ───────────────────────
LOGO-CLP > set NAI1 150          # Define NAI1 = 150 (DB1,WORD1262)

# ── Saídas de Rede Digitais (NQ) ────────────────────────────
LOGO-CLP > set NQ1 1             # Liga Network Output NQ1 (DB1,X1390.0)

# ── Saídas de Rede Analógicas (NAQ) ─────────────────────────
LOGO-CLP > set NAQ1 80           # Define NAQ1 = 80 (DB1,WORD1406)

# ── Endereçamento Direto S7 / DB1 ───────────────────────────
LOGO-CLP > set DB1,X1024.0 1     # Seta bit 0 do byte 1024
LOGO-CLP > set DB1,WORD1032 3000 # Seta Word no byte 1032
LOGO-CLP > set DB1,BYTE1024 255  # Seta o byte 1024 completo (I1 a I8 = 1)
```

---

### `toggle <tag>` ou `t <tag>`
Inverte o estado lógico de qualquer variável booleana (`0 -> 1` ou `1 -> 0`).

#### Exemplos:
```bash
LOGO-CLP > toggle I1             # Inverte entrada digital I1
LOGO-CLP > toggle Q1             # Inverte saída digital Q1
LOGO-CLP > toggle M1             # Inverte flag M1
LOGO-CLP > toggle NI1            # Inverte entrada de rede NI1
LOGO-CLP > toggle NQ1            # Inverte saída de rede NQ1
LOGO-CLP > t DB1,X1024.0         # Inverte por endereço absoluto
```

---

### `get <tag>` ou `read <tag>`
Lê o valor atual de qualquer variável ou endereço de memória.

#### Exemplos:
```bash
LOGO-CLP > get I1                # Lê entrada digital I1
LOGO-CLP > get AI1               # Lê entrada analógica AI1
LOGO-CLP > get Q1                # Lê saída digital Q1
LOGO-CLP > get AQ1               # Lê saída analógica AQ1
LOGO-CLP > get M1                # Lê flag digital M1
LOGO-CLP > get AM1               # Lê flag analógica AM1
LOGO-CLP > get NI1               # Lê entrada de rede NI1
LOGO-CLP > get NAI1              # Lê entrada de rede analógica NAI1
LOGO-CLP > get DB1,WORD1032      # Lê pelo endereço absoluto S7
```

---

## 3. Comandos de Visualização e Monitoramento

### `status` ou `s`
Exibe o painel consolidado com o status de todas as entradas, saídas, analógicas, flags e memórias do CLP.

```bash
LOGO-CLP > status
```

---

### `view <bloco>` ou `bloco <nome>`
Exibe a tabela detalhada com endereços S7, bytes, bits, tipos e valores atuais dos elementos do bloco.

#### Opções de Blocos:
- `view I`   : Entradas Digitais (I1..I64)
- `view AI`  : Entradas Analógicas (AI1..AI16)
- `view Q`   : Saídas Digitais (Q1..Q64)
- `view AQ`  : Saídas Analógicas (AQ1..AQ16)
- `view M`   : Flags Digitais (M1..M112)
- `view AM`  : Flags Analógicas (AM1..AM64)
- `view NI`  : Entradas de Rede Digitais (NI1..NI128)
- `view NAI` : Entradas de Rede Analógicas (NAI1..NAI64)
- `view NQ`  : Saídas de Rede Digitais (NQ1..NQ128)
- `view NAQ` : Saídas de Rede Analógicas (NAQ1..NAQ32)
- `view all` : Exibe todos os blocos em sequência

#### Exemplos:
```bash
LOGO-CLP > view I
LOGO-CLP > view AI
LOGO-CLP > view Q
LOGO-CLP > view all
```

---

### `watch <tag1,tag2,...>`
Inicia o modo de monitoramento dinâmico em tempo real na linha do console. Atualiza a cada 500ms. Para sair, basta pressionar `Enter` ou digitar qualquer comando.

#### Exemplos:
```bash
LOGO-CLP > watch I1,I2,Q1,Q2,AI1,AQ1,M1
LOGO-CLP > watch AI1,AI2,AQ1,AM1
```

---

### `dump [inicio] [tamanho]` ou `hex [inicio] [tamanho]`
Gera um Hex Dump formatado com endereço hexadecimal, decimal e caracteres ASCII dos bytes da memória VM.

#### Exemplos:
```bash
LOGO-CLP > dump                  # Exibe 64 bytes a partir do byte 1024
LOGO-CLP > dump 1024 32          # Exibe os 32 bytes das entradas I e analógicas AI
LOGO-CLP > dump 1064 32          # Exibe as saídas Q e saídas analógicas AQ
```

---

## 4. Geradores de Sinais e Simulação Dinâmica

Permite criar testes contínuos para simular sensores de processo, oscilações analógicas ou sinais de pulso/clock periódicos.

### `wave <tag> [min] [max] [periodo_ms]` ou `onda <tag> ...`
Gera uma onda senoidal contínua e suave em uma variável analógica.

#### Parâmetros:
- `<tag>`: Tag analógica (ex: `AI1`, `AQ1`, `AM1`, `NAI1`, `NAQ1`, `DB1,WORD1032`)
- `[min]`: Valor mínimo (padrão: `0`)
- `[max]`: Valor máximo (padrão: `1000`)
- `[periodo_ms]`: Período do ciclo em milissegundos (padrão: `5000` = 5s)

#### Exemplos:
```bash
LOGO-CLP > wave AI1 0 1000 5000        # Oscila AI1 entre 0 e 1000 a cada 5 segundos
LOGO-CLP > wave AI2 100 500 2000       # Oscila AI2 entre 100 e 500 a cada 2 segundos
```

---

### `pulse <tag> [intervalo_ms]` ou `clock <tag> ...`
Gera um sinal de clock/pulso liga e desliga periódico em uma tag digital.

#### Parâmetros:
- `<tag>`: Tag digital (ex: `I1`, `Q1`, `M1`, `NI1`, `DB1,X1024.0`)
- `[intervalo_ms]`: Intervalo de alternância em milissegundos (padrão: `1000` = 1s)

#### Exemplos:
```bash
LOGO-CLP > pulse I1 500          # Alterna I1 a cada 500ms (simulação de encoder/sensor)
LOGO-CLP > pulse M1 1000         # Alterna M1 a cada 1 segundo (clock de sistema)
```

---

### `listsim`
Lista todos os geradores dinâmicos ativos com seus respectivos IDs.

```bash
LOGO-CLP > listsim
```

---

### `stopsim <id | all>` ou `stop <id | all>`
Para uma simulação específica ou todas.

```bash
LOGO-CLP > stopsim 1
LOGO-CLP > stopsim all
```

---

## 5. Persistência de Estado (Salvar e Carregar)

### `save [caminho_arquivo]`
Salva um snapshot de toda a memória VM (2048 bytes) em arquivo JSON.

```bash
LOGO-CLP > save                        # Salva em snapshot_logo.json
LOGO-CLP > save minha_maquina.json     # Salva em arquivo personalizado
```

---

### `load [caminho_arquivo]`
Restaura o estado da memória VM a partir de um arquivo de snapshot salvo anteriormente.

```bash
LOGO-CLP > load                        # Restaura de snapshot_logo.json
LOGO-CLP > load minha_maquina.json     # Restaura arquivo personalizado
```

---

### `reset` ou `zerar`
Zera todos os 2048 bytes da memória VM do CLP.

```bash
LOGO-CLP > reset
```

---

## 6. Guia de Endereçamento e Notações Suportadas

### 1. Notação Amigável do LOGO!:
- **Digitais**: `I1` a `I64`, `Q1` a `Q64`, `M1` a `M112`, `NI1` a `NI128`, `NQ1` a `NQ128`
- **Analógicas**: `AI1` a `AI16`, `AQ1` a `AQ16`, `AM1` a `AM64`, `NAI1` a `NAI64`, `NAQ1` a `NAQ32`

### 2. Notação Standard S7:
- **Entradas**: `I0.0` a `I7.7` *(mapeadas para VM 1024 a 1031)*
- **Saídas**: `Q0.0` a `Q7.7` *(mapeadas para VM 1064 a 1071)*
- **Flags**: `M0.0` a `M13.7` *(mapeadas para VM 1104 a 1117)*

### 3. Notação DB1 (Node-RED, NodeS7, Snap7):
- **Bits**: `DB1,X1024.0`, `DB1.DBX1024.0`, `DB1,X1064.0`, `DB1,X1104.0`, `DB1,X1246.0`
- **Bytes**: `DB1,BYTE1024`, `DB1,B1024`, `DB1.DBB1024`
- **Words**: `DB1,WORD1032`, `DB1,W1032`, `DB1,INT1032`, `DB1.DBW1032`
- **DWords**: `DB1,DWORD1032`, `DB1,D1032`, `DB1,DINT1032`
- **Reais (Float)**: `DB1,REAL1032`

---

## 7. Integração com Node-RED, NodeS7 e SCADA

### Parâmetros de Conexão:
- **Protocolo**: ISO-on-TCP (RFC 1006 / S7Comm)
- **IP do Servidor**: `127.0.0.1` (ou IP local da rede)
- **Porta**: `102`
- **Rack**: `0` | **Slot**: `1` (ou `2`)
- **DB Padrão**: `DB1`

---

## 🚀 Como Iniciar

```bash
# Iniciar o simulador
npm start
# ou
node simulador_logo.js

# Rodar os testes de validação
npm test
```
