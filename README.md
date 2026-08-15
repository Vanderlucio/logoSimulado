# 🏭 Simulador Completo Siemens LOGO! (0BA7 / 0BA8 / LOGO! 8.x)

Simulador de CLP Siemens LOGO! de alta performance e fidelidade industrial desenvolvido em **Node.js**, com implementação nativa do protocolo **ISO-on-TCP (RFC 1006 / S7Comm)** na porta **102** e mapeamento integral de toda a memória de variáveis (**VM / DB1**).

---

## 📥 Como Baixar, Instalar e Executar (Passo a Passo)

Siga o passo a passo abaixo para clonar o repositório, preparar o ambiente e rodar o simulador:

### 1. Pré-requisitos
Antes de começar, certifique-se de ter instalado em seu computador:
- **Git**: [https://git-scm.com](https://git-scm.com) (para baixar o projeto)
- **Node.js** (versão 18 ou superior): [https://nodejs.org](https://nodejs.org)

Para verificar se já estão instalados, abra o terminal e digite:
```bash
git --version
node -v
npm -v
```

---

### 2. Clonar o Repositório com Git
Abra o seu terminal (Prompt de Comando, PowerShell ou Terminal Linux/Mac) e execute o comando de clone:
```bash
git clone https://github.com/Vanderlucio/logoSimulado.git
```

---

### 3. Acessar a Pasta do Projeto
> ⚠️ **MUITO IMPORTANTE**: O seu terminal **DEVE estar aberto dentro da pasta do projeto** para executar qualquer comando.
```bash
cd logoSimulado
```

---

### 4. Instalar os Módulos do Projeto
Dentro da pasta `logoSimulado`, execute o comando:
```bash
npm install
```

---

### 5. Iniciar o Servidor Simulador (Terminal 1)
Inicie o simulador CLP na porta padrão 102:
```bash
npm start
# ou
node simulador_logo.js
```
O console exibirá o painel de status e ficará escutando as conexões de clientes como Node-RED, NodeS7, IHM, etc.

---

### 6. Enviar Comandos Remotamente (Terminal 2)
Abra um **segundo terminal**, entre na pasta do projeto (`cd logoSimulado`) e envie comandos via `comando.js`:

```bash
# Definir valores de entradas, saídas e analógicas
node comando.js set I1 1              # Liga entrada digital I1
node comando.js set I2 0              # Desliga entrada digital I2
node comando.js set AI1 750           # Seta entrada analógica AI1 = 750
node comando.js set Q1 1              # Aciona saída digital Q1
node comando.js set AQ1 500           # Seta saída analógica AQ1 = 500
node comando.js set M1 1              # Seta flag digital M1
node comando.js set NI1 1             # Seta entrada de rede NI1

# Inverter (toggle) estado lógico
node comando.js toggle I1
node comando.js toggle Q1

# Consultar valores atuais lidos do CLP
node comando.js get AI1
node comando.js get I1
node comando.js get Q1

# Ver o painel completo de status remoto do CLP
node comando.js status

# Abrir o console interativo remoto:
npm run cli
# ou
node comando.js
```

---

## 🚀 Visão Geral e Propósito

Este simulador foi projetado para permitir o desenvolvimento, homologação e testes de integração com CLPs Siemens LOGO! sem a necessidade do hardware físico presente na bancada. Ele atua como um servidor TCP ISO-on-TCP idêntico a um CLP real (modelos **LOGO! 0BA7**, **LOGO! 0BA8**, **LOGO! 8.1/8.2/8.3/8.4**), respondendo fielmente às requisições de leitura e escrita de sistemas como:

- **Node-RED** (`node-red-contrib-s7`, `node-red-contrib-s7comm`)
- **NodeS7** (biblioteca Node.js para comunicação Siemens S7)
- **Snap7** (Python `python-snap7`, C++, C#, Pascal)
- **Sistemas SCADA / IHM** (WinCC, ScadaBR, Elipse E3, Ignition, Kepware OPC Server)
- **Aplicações customizadas de automação industrial**

---

## 🛠️ Tecnologias e Arquitetura Técnica

O simulador foi construído com foco em máxima performance, baixa latência e **zero dependências externas** (utilizando exclusivamente módulos nativos da plataforma Node.js):

### 1. Pilha de Protocolos Industriais Implementada:
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    S7Comm (Siemens S7 Protocol)                         │
│  - Setup Communication (0xF0) | Negociação de PDU (960 Bytes)           │
│  - Read Variable (0x04)       | Bits, Bytes, Words, DWords              │
│  - Write Variable (0x05)      | Bits com máscara, Bytes, Inteiros       │
├─────────────────────────────────────────────────────────────────────────┤
│                    COTP (ISO 8073 - Connection-Oriented Transport)      │
│  - CR (Connection Request 0xE0) -> CC (Connection Confirm 0xD0)         │
│  - DT (Data Transfer 0xF0 com EOT 0x80)                                 │
│  - Negociação de TSAPs (Local: 0x0100 / Remoto: 0x0200 / Rack 0 Slot 1)│
├─────────────────────────────────────────────────────────────────────────┤
│                    TPKT (RFC 1006 - ISO Transport Services on top of TCP)│
│  - Versão 3, Reservado 0, Packet Length em 2 Bytes Big-Endian           │
├─────────────────────────────────────────────────────────────────────────┤
│                    TCP / IP (Sockets de Rede - Porta 102)               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Módulos e Recursos Utilizados:
- **`node:net`**: Gerenciamento assíncrono de múltiplos sockets TCP de clientes concorrentes.
- **`node:buffer`**: Manipulação binária de alta velocidade em formato **Big-Endian**, simulando fielmente a ordem de bytes dos processadores industriais da Siemens.
- **`node:readline`**: Interface interativa de linha de comando (CLI) não bloqueante para controle em tempo real.
- **`node:fs`**: Serialização e persistência de snapshots da memória VM em formato JSON com timestamping.

---

## 🧠 Como Funciona o Mapeamento da Memória VM (DB1)

O Siemens LOGO! utiliza uma área de memória unificada chamada **Variable Memory (VM)**, que é acessada externamente via protocolo S7 através do bloco de dados **DB1**.

O simulador aloca um buffer de **2048 bytes** e implementa o mapa exato da Siemens:

| Bloco | Faixa VM (DB1) | Tipo de Dados | Exemplo S7 / Node-RED | Descrição |
|---|---|---|---|---|
| **I** | `1024 - 1031` (8 bytes) | Bit / Byte / Word | `DB1,X1024.0` ou `I1` ou `I0.0` | **64 Entradas Digitais** (I1 a I64) |
| **AI** | `1032 - 1063` (32 bytes) | Word (16-bit Int) | `DB1,WORD1032` ou `AI1` | **16 Entradas Analógicas** (AI1 a AI16) |
| **Q** | `1064 - 1071` (8 bytes) | Bit / Byte / Word | `DB1,X1064.0` ou `Q1` ou `Q0.0` | **64 Saídas Digitais** (Q1 a Q64) |
| **AQ** | `1072 - 1103` (32 bytes) | Word (16-bit Int) | `DB1,WORD1072` ou `AQ1` | **16 Saídas Analógicas** (AQ1 a AQ16) |
| **M** | `1104 - 1117` (14 bytes) | Bit / Byte / Word | `DB1,X1104.0` ou `M1` ou `M0.0` | **112 Flags / Merkers Digitais** (M1 a M112) |
| **AM** | `1118 - 1245` (128 bytes) | Word (16-bit Int) | `DB1,WORD1118` ou `AM1` | **64 Flags Analógicas** (AM1 a AM64) |
| **NI** | `1246 - 1261` (16 bytes) | Bit / Byte / Word | `DB1,X1246.0` ou `NI1` | **128 Entradas Digitais de Rede** (NI1 a NI128) |
| **NAI** | `1262 - 1389` (128 bytes) | Word (16-bit Int) | `DB1,WORD1262` ou `NAI1` | **64 Entradas Analógicas de Rede** (NAI1 a NAI64) |
| **NQ** | `1390 - 1405` (16 bytes) | Bit / Byte / Word | `DB1,X1390.0` ou `NQ1` | **128 Saídas Digitais de Rede** (NQ1 a NQ128) |
| **NAQ** | `1406 - 1469` (64 bytes) | Word (16-bit Int) | `DB1,WORD1406` ou `NAQ1` | **32 Saídas Analógicas de Rede** (NAQ1 a NAQ32) |

---

## 🔌 Integração Prática com Node-RED

Para conectar o **Node-RED** ao simulador:

1. Instale o pacote: `node-red-contrib-s7`
2. No nó de configuração **S7 Endpoint**, configure:
   - **PLC Type**: `LOGO! 0BA7/0BA8` (ou `S7-300`)
   - **IP**: `127.0.0.1` (ou o IP do computador na rede local)
   - **Port**: `102`
   - **Rack**: `0`
   - **Slot**: `1` (ou TSAPs Local `01.00` e Remoto `02.00`)
3. Na lista de variáveis, adicione as tags desejadas utilizando a notação DB1:
   - `DB1,X1024.0` (Entrada I1)
   - `DB1,X1024.1` (Entrada I2)
   - `DB1,WORD1032` (Entrada Analógica AI1)
   - `DB1,X1064.0` (Saída Q1)
   - `DB1,WORD1072` (Saída Analógica AQ1)
   - `DB1,X1246.0` (Entrada de Rede NI1)

---

## 🧪 Testes Automatizados

No terminal dentro da pasta do projeto, execute as suites de testes:

```bash
# Teste de validação geral do protocolo S7:
npm test
# ou
node teste_cliente_logo.js

# Teste exaustivo de todas as entradas, saídas e memórias:
node teste_completo_io.js
```

---

## ⌨️ Resumo de Comandos

| Comando | Descrição | Exemplo |
|---|---|---|
| `set <tag> <val>` | Grava valor digital, analógico ou por endereço DB1 | `set I1 1`, `set AI1 500`, `set Q1 1` |
| `toggle <tag>` | Inverte o estado de um bit digital (0 -> 1 -> 0) | `toggle I1`, `toggle Q1`, `toggle NI1` |
| `get <tag>` | Lê o valor atual de qualquer variável ou byte/word | `get AI1`, `get Q1`, `get DB1,WORD1032` |
| `status` ou `s` | Exibe o painel consolidado com cores de todas as memórias | `status` |
| `view <bloco>` | Exibe tabela detalhada de um bloco de memória | `view I`, `view AI`, `view Q`, `view all` |
| `wave <tag> [min] [max] [ms]` | Inicia gerador dinâmico de onda senoidal | `wave AI1 0 1000 5000` |
| `pulse <tag> [ms]` | Inicia gerador contínuo de pulsos de clock | `pulse I1 1000` |
| `dump [inicio] [tam]` | Exibe Hex Dump dos bytes da memória VM | `dump 1024 32` |
| `watch <tags>` | Monitoramento dinâmico em tempo real | `watch I1,I2,AI1,Q1` |
| `save [arquivo]` | Salva snapshot da memória em JSON | `save snapshot_logo.json` |
| `load [arquivo]` | Carrega snapshot da memória a partir de JSON | `load snapshot_logo.json` |
| `reset` | Zera todos os 2048 bytes da memória VM | `reset` |

👉 Para a referência completa e detalhada de sintaxe, consulte o [COMANDOS.md](file:///c:/logoSimulado/COMANDOS.md).

---

## 👨‍💻 Desenvolvedor e Autoria

Este simulador foi idealizado, projetado e **desenvolvido por Vanderlucio Lopes**, com o objetivo de fornecer uma solução robusta, profissional e de alta fidelidade para o ecossistema de automação industrial Siemens, Node-RED e sistemas SCADA.
