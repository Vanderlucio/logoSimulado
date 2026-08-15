# 🏭 Simulador Completo Siemens LOGO! (0BA7 / 0BA8 / LOGO! 8.x)

Simulador de CLP Siemens LOGO! de alta performance desenvolvido em **Node.js**, com implementação do protocolo **ISO-on-TCP (RFC 1006 / S7Comm)** na porta **102** e mapeamento integral da memória VM (**DB1**).

---

## 🌟 Características Principais

- **Compatibilidade Total**: Funciona nativamente com NodeS7, Node-RED (`node-red-contrib-s7`), Snap7 (Python/C++), Kepware, ScadaBR, WinCC e aplicações industriais de balança.
- **Mapa de Memória VM Completo**: Emulação exata de todas as áreas do Siemens LOGO! (I, AI, Q, AQ, M, AM, NI, NAI, NQ, NAQ).
- **Interface CLI Interativa**: Console com cores ANSI, atalhos rápidos de 1 tecla (`1`, `0`, `t`, `s`), tabelas de status e comandos de visualização.
- **Gerador de Sinais Dinâmicos**: Permite simular oscilação senoidal em variáveis analógicas (`wave`) e sinais de clock/encoder (`pulse`).
- **Cenários Prontos**: Configurações imediatas para testes de Balança Martinrea, Esteira Industrial, Tanque de Nível e Limpeza.
- **Persistência de Estado**: Salva e restaura snapshots da memória VM em arquivos JSON.
- **Zero Dependências Externas**: Criado com os módulos nativos do Node.js (`net`, `fs`, `readline`).

---

## 📊 Mapa de Memória VM (DB1)

| Bloco | Faixa VM (DB1) | Tipo | Exemplo de Endereço | Descrição |
|---|---|---|---|---|
| **I** | `1024 - 1031` | Bit / Byte | `DB1,X1024.0` ou `I1` | 64 Entradas Digitais |
| **AI** | `1032 - 1063` | Word (16-bit) | `DB1,WORD1032` ou `AI1` | 16 Entradas Analógicas |
| **Q** | `1064 - 1071` | Bit / Byte | `DB1,X1064.0` ou `Q1` | 64 Saídas Digitais |
| **AQ** | `1072 - 1103` | Word (16-bit) | `DB1,WORD1072` ou `AQ1` | 16 Saídas Analógicas |
| **M** | `1104 - 1117` | Bit / Byte | `DB1,X1104.0` ou `M1` | 112 Flags Digitais |
| **AM** | `1118 - 1245` | Word (16-bit) | `DB1,WORD1118` ou `AM1` | 64 Flags Analógicas |
| **NI** | `1246 - 1261` | Bit / Byte | `DB1,X1246.0` ou `NI1` | 128 Entradas de Rede (Trava) |
| **NAI** | `1262 - 1389` | Word (16-bit) | `DB1,WORD1262` ou `NAI1` | 64 Entradas de Rede Analógicas |
| **NQ** | `1390 - 1405` | Bit / Byte | `DB1,X1390.0` ou `NQ1` | 128 Saídas de Rede |
| **NAQ** | `1406 - 1469` | Word (16-bit) | `DB1,WORD1406` ou `NAQ1` | 32 Saídas de Rede Analógicas |

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

## ⌨️ Comandos Rápidos

| Comando | Descrição |
|---|---|
| `1` | Fecha a porta (`I0.1 = true`) |
| `0` | Abre a porta (`I0.1 = false`) |
| `t` | Inverte estado da trava (`DB1,X1246.0`) |
| `s` | Exibe o painel de status |
| `set <tag> <val>` | Altera o valor de qualquer variável (ex: `set AI1 500`) |
| `toggle <tag>` | Inverte o estado de um bit (ex: `toggle Q1`) |
| `get <tag>` | Consulta o valor de uma tag (ex: `get AI1`) |
| `view <bloco>` | Exibe a tabela de um bloco (ex: `view AI`, `view Q`, `view all`) |
| `wave <tag> [min] [max] [ms]` | Inicia gerador de onda senoidal |
| `pulse <tag> [ms]` | Inicia gerador de pulsos/clock |
| `scenario <nome>` | Aplica cenário (`balanca`, `esteira`, `tanque`, `limpo`) |
| `save [arquivo]` | Salva snapshot da memória em JSON |
| `load [arquivo]` | Carrega snapshot da memória de JSON |
| `reset` | Zera toda a memória VM |

👉 Para o guia completo e detalhado de comandos, consulte o [COMANDOS.md](file:///c:/logoSimulado/COMANDOS.md).
