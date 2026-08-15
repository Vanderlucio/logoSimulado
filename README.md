# 🏭 Simulador Completo Siemens LOGO! (0BA7 / 0BA8 / LOGO! 8.x)

Simulador de CLP Siemens LOGO! de alta performance desenvolvido em **Node.js**, com implementação integral do protocolo **ISO-on-TCP (RFC 1006 / S7Comm)** na porta **102** e mapeamento universal da memória VM (**DB1**).

---

## 🌟 Características Principais

- **Simulação Completa de I/O e Memória**: Controle total sobre todas as entradas digitais (I), entradas analógicas (AI), saídas digitais (Q), saídas analógicas (AQ), flags de memória (M), flags analógicas (AM) e dados de rede (NI, NAI, NQ, NAQ).
- **Compatibilidade Total S7**: Funciona nativamente com NodeS7, Node-RED (`node-red-contrib-s7`), Snap7 (Python/C++), Kepware, ScadaBR, WinCC e softwares industriais.
- **Interface CLI Interativa**: Console com cores ANSI, tabelas de status, consultas rápidas e comandos intuitivos (`set`, `get`, `toggle`, `status`, `view`).
- **Geradores de Sinais Dinâmicos**: Permite simular oscilação senoidal em variáveis analógicas (`wave`) e sinais periódicos de pulso/clock (`pulse`).
- **Persistência de Estado**: Salva e restaura snapshots de toda a memória VM (2048 bytes) em arquivos JSON.
- **Zero Dependências Externas**: Criado 100% com módulos nativos do Node.js (`net`, `fs`, `readline`).

---

## 📊 Mapa de Memória VM (DB1)

| Bloco | Faixa VM (DB1) | Tipo | Exemplo de Endereço | Descrição |
|---|---|---|---|---|
| **I** | `1024 - 1031` | Bit / Byte | `DB1,X1024.0` ou `I1` | 64 Entradas Digitais (I1 a I64) |
| **AI** | `1032 - 1063` | Word (16-bit) | `DB1,WORD1032` ou `AI1` | 16 Entradas Analógicas (AI1 a AI16) |
| **Q** | `1064 - 1071` | Bit / Byte | `DB1,X1064.0` ou `Q1` | 64 Saídas Digitais (Q1 a Q64) |
| **AQ** | `1072 - 1103` | Word (16-bit) | `DB1,WORD1072` ou `AQ1` | 16 Saídas Analógicas (AQ1 a AQ16) |
| **M** | `1104 - 1117` | Bit / Byte | `DB1,X1104.0` ou `M1` | 112 Flags Digitais (M1 a M112) |
| **AM** | `1118 - 1245` | Word (16-bit) | `DB1,WORD1118` ou `AM1` | 64 Flags Analógicas (AM1 a AM64) |
| **NI** | `1246 - 1261` | Bit / Byte | `DB1,X1246.0` ou `NI1` | 128 Entradas Digitais de Rede |
| **NAI** | `1262 - 1389` | Word (16-bit) | `DB1,WORD1262` ou `NAI1` | 64 Entradas Analógicas de Rede |
| **NQ** | `1390 - 1405` | Bit / Byte | `DB1,X1390.0` ou `NQ1` | 128 Saídas Digitais de Rede |
| **NAQ** | `1406 - 1469` | Word (16-bit) | `DB1,WORD1406` ou `NAQ1` | 32 Saídas Analógicas de Rede |

---

## 🚀 Como Executar

### 1. Iniciar o Simulador
```bash
npm start
# ou
node simulador_logo.js
```

### 2. Rodar os Testes Automatizados
```bash
npm test
# ou
node teste_cliente_logo.js
```

---

## ⌨️ Comandos Principais no Console

| Comando | Descrição | Exemplo |
|---|---|---|
| `set <tag> <val>` | Define o valor de uma variável digital ou analógica | `set I1 1` ou `set AI1 500` |
| `toggle <tag>` | Inverte o estado de uma variável booleana | `toggle Q1` ou `toggle M1` |
| `get <tag>` | Lê o valor atual de qualquer variável | `get AI1` ou `get Q1` |
| `status` ou `s` | Exibe o painel geral de todas as memórias e I/O | `status` |
| `view <bloco>` | Exibe a tabela completa de um bloco específico | `view I`, `view AI`, `view Q`, `view all` |
| `wave <tag> [min] [max] [ms]` | Inicia gerador de onda senoidal analógica | `wave AI1 0 1000 5000` |
| `pulse <tag> [ms]` | Inicia gerador de pulsos/clock digital | `pulse I1 500` |
| `save [arquivo]` | Salva snapshot da memória em JSON | `save` |
| `load [arquivo]` | Carrega snapshot da memória de JSON | `load` |
| `reset` | Zera toda a memória VM (todos os 2048 bytes = 0) | `reset` |

👉 Para o manual completo com todos os comandos e exemplos, consulte o [COMANDOS.md](file:///c:/logoSimulado/COMANDOS.md).
