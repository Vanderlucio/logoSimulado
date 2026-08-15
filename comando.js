/**
 * =========================================================================================
 * CLIENTE DE CONTROLE E COMANDOS REMOTOS - SIEMENS LOGO! (ISO-on-TCP / S7Comm)
 * =========================================================================================
 *
 * Permite enviar comandos e controlar o CLP simulado a partir de outro terminal ou script.
 * Conecta via protocolo S7 ISO-on-TCP (Porta 102) e manipula a memória VM do LOGO!.
 *
 * MODOS DE USO:
 *   1. Execução de Comando Único (Linha de Comando):
 *        node comando.js set I1 1
 *        node comando.js set AI1 500
 *        node comando.js toggle Q1
 *        node comando.js get AI1
 *        node comando.js status
 *
 *   2. Terminal Interativo Remoto (Console Contínuo):
 *        node comando.js
 * =========================================================================================
 */

'use strict';

import net from 'net';
import readline from 'readline';

const PORT = parseInt(process.env.PORT || '102', 10);
const HOST = process.env.HOST || '127.0.0.1';

// ── Cores ANSI ────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

// ── Mapa de Blocos do LOGO! (DB1) ─────────────────────────────────────
const LOGO_MAP = {
    I:   { name: 'Entradas Digitais',       start: 1024, end: 1031, count: 64,  type: 'bit' },
    AI:  { name: 'Entradas Analógicas',     start: 1032, end: 1063, count: 16,  type: 'word' },
    Q:   { name: 'Saídas Digitais',         start: 1064, end: 1071, count: 64,  type: 'bit' },
    AQ:  { name: 'Saídas Analógicas',        start: 1072, end: 1103, count: 16,  type: 'word' },
    M:   { name: 'Flags Digitais',          start: 1104, end: 1117, count: 112, type: 'bit' },
    AM:  { name: 'Flags Analógicas',        start: 1118, end: 1245, count: 64,  type: 'word' },
    NI:  { name: 'Entradas de Rede',        start: 1246, end: 1261, count: 128, type: 'bit' },
    NAI: { name: 'Entradas de Rede Analógicas', start: 1262, end: 1389, count: 64,  type: 'word' },
    NQ:  { name: 'Saídas de Rede',          start: 1390, end: 1405, count: 128, type: 'bit' },
    NAQ: { name: 'Saídas de Rede Analógicas',    start: 1406, end: 1469, count: 32,  type: 'word' }
};

// ── Parser Inteligente de Endereços ───────────────────────────────────
function parseTag(tagStr) {
    const upper = tagStr.trim().toUpperCase();

    // AI, AQ, AM, NAI, NAQ (Words analógicas)
    let m = upper.match(/^AI(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        return { type: 'word', byteOff: LOGO_MAP.AI.start + (idx - 1) * 2, name: `AI${idx}`, alias: `DB1,WORD${LOGO_MAP.AI.start + (idx - 1) * 2}` };
    }
    m = upper.match(/^AQ(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        return { type: 'word', byteOff: LOGO_MAP.AQ.start + (idx - 1) * 2, name: `AQ${idx}`, alias: `DB1,WORD${LOGO_MAP.AQ.start + (idx - 1) * 2}` };
    }
    m = upper.match(/^AM(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        return { type: 'word', byteOff: LOGO_MAP.AM.start + (idx - 1) * 2, name: `AM${idx}`, alias: `DB1,WORD${LOGO_MAP.AM.start + (idx - 1) * 2}` };
    }
    m = upper.match(/^NAI(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        return { type: 'word', byteOff: LOGO_MAP.NAI.start + (idx - 1) * 2, name: `NAI${idx}`, alias: `DB1,WORD${LOGO_MAP.NAI.start + (idx - 1) * 2}` };
    }
    m = upper.match(/^NAQ(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        return { type: 'word', byteOff: LOGO_MAP.NAQ.start + (idx - 1) * 2, name: `NAQ${idx}`, alias: `DB1,WORD${LOGO_MAP.NAQ.start + (idx - 1) * 2}` };
    }

    // I, Q, M, NI, NQ (Bits digitais)
    m = upper.match(/^I(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10) - 1;
        return { type: 'bit', byteOff: LOGO_MAP.I.start + Math.floor(idx / 8), bitOff: idx % 8, name: `I${idx + 1}`, alias: `DB1,X${LOGO_MAP.I.start + Math.floor(idx / 8)}.${idx % 8}` };
    }
    m = upper.match(/^Q(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10) - 1;
        return { type: 'bit', byteOff: LOGO_MAP.Q.start + Math.floor(idx / 8), bitOff: idx % 8, name: `Q${idx + 1}`, alias: `DB1,X${LOGO_MAP.Q.start + Math.floor(idx / 8)}.${idx % 8}` };
    }
    m = upper.match(/^M(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10) - 1;
        return { type: 'bit', byteOff: LOGO_MAP.M.start + Math.floor(idx / 8), bitOff: idx % 8, name: `M${idx + 1}`, alias: `DB1,X${LOGO_MAP.M.start + Math.floor(idx / 8)}.${idx % 8}` };
    }
    m = upper.match(/^NI(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10) - 1;
        return { type: 'bit', byteOff: LOGO_MAP.NI.start + Math.floor(idx / 8), bitOff: idx % 8, name: `NI${idx + 1}`, alias: `DB1,X${LOGO_MAP.NI.start + Math.floor(idx / 8)}.${idx % 8}` };
    }
    m = upper.match(/^NQ(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10) - 1;
        return { type: 'bit', byteOff: LOGO_MAP.NQ.start + Math.floor(idx / 8), bitOff: idx % 8, name: `NQ${idx + 1}`, alias: `DB1,X${LOGO_MAP.NQ.start + Math.floor(idx / 8)}.${idx % 8}` };
    }

    // Standard S7 (I0.0, Q0.0, M0.0)
    m = upper.match(/^([IQM])(\d+)\.(\d+)$/);
    if (m) {
        const code = m[1];
        const byte = parseInt(m[2], 10);
        const bit = parseInt(m[3], 10);
        let base = 1024;
        if (code === 'Q') base = 1064;
        if (code === 'M') base = 1104;
        return { type: 'bit', byteOff: base + byte, bitOff: bit, name: `${code}${byte}.${bit}`, alias: `DB1,X${base + byte}.${bit}` };
    }

    // Notação DB1 (DB1,X..., DB1,WORD..., DB1,BYTE...)
    m = upper.match(/^DB\d+[,.]?(?:DB)?X(\d+)\.(\d+)$/);
    if (m) {
        return { type: 'bit', byteOff: parseInt(m[1], 10), bitOff: parseInt(m[2], 10), name: `DB1,X${m[1]}.${m[2]}`, alias: `VM Bit ${m[1]}.${m[2]}` };
    }
    m = upper.match(/^DB\d+[,.]?(?:DB)?(?:WORD|W|INT)(\d+)$/);
    if (m) {
        return { type: 'word', byteOff: parseInt(m[1], 10), name: `DB1,WORD${m[1]}`, alias: `VM Word ${m[1]}` };
    }
    m = upper.match(/^DB\d+[,.]?(?:DB)?(?:BYTE|B)(\d+)$/);
    if (m) {
        return { type: 'byte', byteOff: parseInt(m[1], 10), name: `DB1,BYTE${m[1]}`, alias: `VM Byte ${m[1]}` };
    }

    throw new Error(`Endereço "${tagStr}" não reconhecido. Use formatos como I1, AI1, Q1, AQ1, M1, NI1, DB1,X1024.0, DB1,WORD1032, etc.`);
}

// ── Cliente S7 ISO-on-TCP ─────────────────────────────────────────────
class S7Client {
    constructor(host = HOST, port = PORT) {
        this.host = host;
        this.port = port;
        this.socket = null;
        this.pduRef = 1;
    }

    wrapTpktCotpDt(s7Payload) {
        const totalLen = 4 + 3 + s7Payload.length;
        const buf = Buffer.alloc(totalLen);
        buf[0] = 0x03;
        buf[1] = 0x00;
        buf.writeUInt16BE(totalLen, 2);
        buf[4] = 0x02;
        buf[5] = 0xF0;
        buf[6] = 0x80;
        s7Payload.copy(buf, 7);
        return buf;
    }

    sendAndReceive(reqBuf) {
        return new Promise((resolve, reject) => {
            const onData = (chunk) => {
                this.socket.removeListener('data', onData);
                this.socket.removeListener('error', onError);
                resolve(chunk);
            };
            const onError = (err) => {
                this.socket.removeListener('data', onData);
                this.socket.removeListener('error', onError);
                reject(err);
            };
            this.socket.on('data', onData);
            this.socket.on('error', onError);
            this.socket.write(reqBuf);
        });
    }

    async connect() {
        this.socket = new net.Socket();
        await new Promise((resolve, reject) => {
            this.socket.connect(this.port, this.host, () => resolve());
            this.socket.on('error', (err) => {
                reject(new Error(`Não foi possível conectar ao simulador em ${this.host}:${this.port}. Verifique se o simulador está rodando (node simulador_logo.js). Detalhes: ${err.message}`));
            });
        });

        // 1. COTP Connection Request (CR)
        const cotpCr = Buffer.from([
            0x03, 0x00, 0x00, 0x16,
            0x11, 0xE0,
            0x00, 0x00,
            0x00, 0x01,
            0x00,
            0xC0, 0x01, 0x0A,
            0xC1, 0x02, 0x01, 0x00,
            0xC2, 0x02, 0x01, 0x02
        ]);
        const ccResp = await this.sendAndReceive(cotpCr);
        if (ccResp[5] !== 0xD0) throw new Error('Falha no handshake COTP CC');

        // 2. S7 Setup Communication
        const pRef = this.pduRef++;
        const setupReq = Buffer.from([
            0x32, 0x01, 0x00, 0x00,
            (pRef >> 8) & 0xFF, pRef & 0xFF,
            0x00, 0x08,
            0x00, 0x00,
            0xF0, 0x00,
            0x00, 0x04,
            0x00, 0x04,
            0x03, 0xC0
        ]);
        await this.sendAndReceive(this.wrapTpktCotpDt(setupReq));
    }

    async readBit(byteOff, bitOff, dbNum = 1) {
        const pRef = this.pduRef++;
        const bitAddress = (byteOff << 3) | (bitOff & 0x07);
        const req = Buffer.from([
            0x32, 0x01, 0x00, 0x00,
            (pRef >> 8) & 0xFF, pRef & 0xFF,
            0x00, 0x0E,
            0x00, 0x00,
            0x04, 0x01,
            0x12, 0x0A, 0x10,
            0x01, // BIT
            0x00, 0x01,
            (dbNum >> 8) & 0xFF, dbNum & 0xFF,
            0x84, // DB
            (bitAddress >> 16) & 0xFF, (bitAddress >> 8) & 0xFF, bitAddress & 0xFF
        ]);
        const resp = await this.sendAndReceive(this.wrapTpktCotpDt(req));
        const val = resp[resp.length - 1];
        return val === 1;
    }

    async writeBit(byteOff, bitOff, val, dbNum = 1) {
        const pRef = this.pduRef++;
        const bitAddress = (byteOff << 3) | (bitOff & 0x07);
        const req = Buffer.from([
            0x32, 0x01, 0x00, 0x00,
            (pRef >> 8) & 0xFF, pRef & 0xFF,
            0x00, 0x0E,
            0x00, 0x05,
            0x05, 0x01,
            0x12, 0x0A, 0x10,
            0x01,
            0x00, 0x01,
            (dbNum >> 8) & 0xFF, dbNum & 0xFF,
            0x84,
            (bitAddress >> 16) & 0xFF, (bitAddress >> 8) & 0xFF, bitAddress & 0xFF,
            0x00, 0x03, 0x00, 0x01, val ? 0x01 : 0x00
        ]);
        const resp = await this.sendAndReceive(this.wrapTpktCotpDt(req));
        return resp[resp.length - 1] === 0xFF;
    }

    async readWord(byteOff, dbNum = 1) {
        const pRef = this.pduRef++;
        const bitAddress = byteOff << 3;
        const req = Buffer.from([
            0x32, 0x01, 0x00, 0x00,
            (pRef >> 8) & 0xFF, pRef & 0xFF,
            0x00, 0x0E,
            0x00, 0x00,
            0x04, 0x01,
            0x12, 0x0A, 0x10,
            0x04, // WORD
            0x00, 0x02,
            (dbNum >> 8) & 0xFF, dbNum & 0xFF,
            0x84,
            (bitAddress >> 16) & 0xFF, (bitAddress >> 8) & 0xFF, bitAddress & 0xFF
        ]);
        const resp = await this.sendAndReceive(this.wrapTpktCotpDt(req));
        return resp.readInt16BE(resp.length - 2);
    }

    async writeWord(byteOff, val, dbNum = 1) {
        const pRef = this.pduRef++;
        const bitAddress = byteOff << 3;
        const num = Math.round(Number(val));
        const req = Buffer.from([
            0x32, 0x01, 0x00, 0x00,
            (pRef >> 8) & 0xFF, pRef & 0xFF,
            0x00, 0x0E,
            0x00, 0x06,
            0x05, 0x01,
            0x12, 0x0A, 0x10,
            0x04,
            0x00, 0x02,
            (dbNum >> 8) & 0xFF, dbNum & 0xFF,
            0x84,
            (bitAddress >> 16) & 0xFF, (bitAddress >> 8) & 0xFF, bitAddress & 0xFF,
            0x00, 0x04, 0x00, 0x10,
            (num >> 8) & 0xFF, num & 0xFF
        ]);
        const resp = await this.sendAndReceive(this.wrapTpktCotpDt(req));
        return resp[resp.length - 1] === 0xFF;
    }

    async readBytes(byteOff, count, dbNum = 1) {
        const pRef = this.pduRef++;
        const bitAddress = byteOff << 3;
        const req = Buffer.from([
            0x32, 0x01, 0x00, 0x00,
            (pRef >> 8) & 0xFF, pRef & 0xFF,
            0x00, 0x0E,
            0x00, 0x00,
            0x04, 0x01,
            0x12, 0x0A, 0x10,
            0x04,
            (count >> 8) & 0xFF, count & 0xFF,
            (dbNum >> 8) & 0xFF, dbNum & 0xFF,
            0x84,
            (bitAddress >> 16) & 0xFF, (bitAddress >> 8) & 0xFF, bitAddress & 0xFF
        ]);
        const resp = await this.sendAndReceive(this.wrapTpktCotpDt(req));
        return resp.slice(resp.length - count);
    }

    close() {
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
    }
}

// ── Execução de Comandos ──────────────────────────────────────────────

async function executeCommand(client, cmdStr) {
    const raw = cmdStr.trim();
    if (!raw) return;

    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
        case 'set':
        case 'write': {
            if (args.length < 2) {
                console.log(`${C.red}✖ Uso: set <tag> <valor>  (Ex: set I1 1, set AI1 500, set Q1 1)${C.reset}`);
                return;
            }
            const target = parseTag(args[0]);
            let success = false;
            let finalVal = args[1];

            if (target.type === 'bit') {
                const bVal = (args[1] === '1' || args[1] === 'true' || args[1] === 'on' || args[1] === 1);
                success = await client.writeBit(target.byteOff, target.bitOff, bVal);
                finalVal = bVal ? 'ON (1)' : 'OFF (0)';
            } else if (target.type === 'word') {
                const num = parseInt(args[1], 10);
                success = await client.writeWord(target.byteOff, num);
                finalVal = num;
            }

            if (success) {
                console.log(`${C.green}✔ ${target.name} [${target.alias}] definido para: ${C.bold}${finalVal}${C.reset}`);
            } else {
                console.log(`${C.red}✖ Falha ao gravar ${target.name}${C.reset}`);
            }
            break;
        }

        case 'toggle':
        case 't': {
            if (args.length < 1) {
                console.log(`${C.red}✖ Uso: toggle <tag>  (Ex: toggle I1, toggle Q1, toggle NI1)${C.reset}`);
                return;
            }
            const target = parseTag(args[0]);
            if (target.type !== 'bit') {
                console.log(`${C.red}✖ Toggle funciona apenas com variáveis digitais/booleanas.${C.reset}`);
                return;
            }
            const current = await client.readBit(target.byteOff, target.bitOff);
            const nv = !current;
            await client.writeBit(target.byteOff, target.bitOff, nv);
            console.log(`${C.green}🔄 Toggle em ${target.name} [${target.alias}]: agora é ${nv ? C.bold + 'ON (1)' : C.dim + 'OFF (0)'}${C.reset}`);
            break;
        }

        case 'get':
        case 'read': {
            if (args.length < 1) {
                console.log(`${C.red}✖ Uso: get <tag>  (Ex: get I1, get AI1, get Q1, get AQ1)${C.reset}`);
                return;
            }
            const target = parseTag(args[0]);
            if (target.type === 'bit') {
                const v = await client.readBit(target.byteOff, target.bitOff);
                console.log(`🔎 ${C.bold}${target.name}${C.reset} [${target.alias}] = ${v ? C.green + '● ON (1)' : C.dim + '○ OFF (0)'}${C.reset}`);
            } else if (target.type === 'word') {
                const v = await client.readWord(target.byteOff);
                console.log(`🔎 ${C.bold}${target.name}${C.reset} [${target.alias}] = ${C.yellow}${v}${C.reset}`);
            }
            break;
        }

        case 'status':
        case 's': {
            console.log(`\n${C.cyan}${C.bold}╔═══════════════════════════════════════════════════════════════════════════════════════╗${C.reset}`);
            console.log(`${C.cyan}${C.bold}║                 📊 STATUS REMOTO DO CLP SIEMENS LOGO! (VIA S7 ISO-on-TCP)             ║${C.reset}`);
            console.log(`${C.cyan}${C.bold}╚═══════════════════════════════════════════════════════════════════════════════════════╝${C.reset}`);

            // I (Entradas)
            const iBits = [];
            for (let i = 0; i < 8; i++) {
                const v = await client.readBit(1024, i);
                iBits.push(`I${i+1}:${v ? C.green + '● 1' : C.dim + '○ 0'}${C.reset}`);
            }
            console.log(` ${C.bold}▶ ENTRADAS DIGITAIS (I1..I8) [VM 1024]:${C.reset}       ${iBits.join('  ')}`);

            // AI (Analógicas In)
            const aiWords = [];
            for (let i = 0; i < 4; i++) {
                const v = await client.readWord(1032 + i * 2);
                aiWords.push(`AI${i+1}:${C.yellow}${v}${C.reset}`);
            }
            console.log(` ${C.bold}▶ ENTRADAS ANALÓGICAS (AI1..AI4) [VM 1032..]:${C.reset}  ${aiWords.join('   ')}`);

            // Q (Saídas Digitais)
            const qBits = [];
            for (let i = 0; i < 8; i++) {
                const v = await client.readBit(1064, i);
                qBits.push(`Q${i+1}:${v ? C.green + '● 1' : C.dim + '○ 0'}${C.reset}`);
            }
            console.log(` ${C.bold}▶ SAÍDAS DIGITAIS (Q1..Q8) [VM 1064]:${C.reset}         ${qBits.join('  ')}`);

            // AQ (Analógicas Out)
            const aqWords = [];
            for (let i = 0; i < 2; i++) {
                const v = await client.readWord(1072 + i * 2);
                aqWords.push(`AQ${i+1}:${C.yellow}${v}${C.reset}`);
            }
            console.log(` ${C.bold}▶ SAÍDAS ANALÓGICAS (AQ1..AQ2) [VM 1072..]:${C.reset}    ${aqWords.join('   ')}`);

            // M (Flags)
            const mBits = [];
            for (let i = 0; i < 8; i++) {
                const v = await client.readBit(1104, i);
                mBits.push(`M${i+1}:${v ? C.green + '● 1' : C.dim + '○ 0'}${C.reset}`);
            }
            console.log(` ${C.bold}▶ FLAGS DIGITAIS (M1..M8) [VM 1104]:${C.reset}             ${mBits.join('  ')}`);

            // NI (Rede In)
            const niBits = [];
            for (let i = 0; i < 8; i++) {
                const v = await client.readBit(1246, i);
                niBits.push(`NI${i+1}:${v ? C.green + '● 1' : C.dim + '○ 0'}${C.reset}`);
            }
            console.log(` ${C.bold}▶ ENTRADAS DE REDE (NI1..NI8) [VM 1246]:${C.reset}         ${niBits.join('  ')}`);
            console.log(`${C.cyan}─────────────────────────────────────────────────────────────────────────────────────────${C.reset}\n`);
            break;
        }

        case 'pulse': {
            if (args.length < 1) {
                console.log(`${C.red}✖ Uso: pulse <tag_digital> [intervalo_ms] [vezes]${C.reset}`);
                return;
            }
            const target = parseTag(args[0]);
            if (target.type !== 'bit') {
                console.log(`${C.red}✖ Pulso disponível apenas para tags booleanas/bits.${C.reset}`);
                return;
            }
            const interval = parseInt(args[1] || '500', 10);
            const count = parseInt(args[2] || '5', 10);
            console.log(`⚡ Pulsando ${target.name} ${count} vezes com intervalo de ${interval}ms...`);
            for (let i = 0; i < count; i++) {
                await client.writeBit(target.byteOff, target.bitOff, true);
                console.log(`  [${i+1}/${count}] ${target.name} = ON (1)`);
                await new Promise(r => setTimeout(r, interval));
                await client.writeBit(target.byteOff, target.bitOff, false);
                console.log(`  [${i+1}/${count}] ${target.name} = OFF (0)`);
                if (i < count - 1) await new Promise(r => setTimeout(r, interval));
            }
            console.log(`${C.green}✔ Pulsos concluídos.${C.reset}`);
            break;
        }

        case 'help':
        case '?': {
            console.log(`
${C.cyan}${C.bold}Comandos disponíveis para envio remoto:${C.reset}
  ${C.green}set <tag> <val>${C.reset}   : Definir valor (ex: set I1 1, set AI1 500, set Q1 1)
  ${C.green}toggle <tag>${C.reset}      : Inverter bit digital (ex: toggle I1, toggle Q1, toggle NI1)
  ${C.green}get <tag>${C.reset}         : Consultar valor atual (ex: get AI1, get Q1, get M1)
  ${C.green}status${C.reset} ou ${C.green}s${C.reset}     : Ver painel geral do CLP
  ${C.green}pulse <tag> [ms]${C.reset}  : Enviar pulsos repetidos
  ${C.green}exit${C.reset} ou ${C.green}sair${C.reset}    : Sair do terminal interativo
`);
            break;
        }

        case 'exit':
        case 'quit':
        case 'sair':
            client.close();
            process.exit(0);
            break;

        default:
            console.log(`${C.red}✖ Comando desconhecido: "${cmd}". Digite "?" ou "help".${C.reset}`);
            break;
    }
}

// ── Ponto de Entrada Principal ────────────────────────────────────────

async function main() {
    const cliArgs = process.argv.slice(2);
    const client = new S7Client(HOST, PORT);

    try {
        await client.connect();
    } catch (err) {
        console.error(`${C.red}✖ ${err.message}${C.reset}`);
        process.exit(1);
    }

    // Modo 1: Execução de comando único direto via linha de comando
    if (cliArgs.length > 0) {
        try {
            await executeCommand(client, cliArgs.join(' '));
        } catch (err) {
            console.error(`${C.red}✖ Erro: ${err.message}${C.reset}`);
        } finally {
            client.close();
            process.exit(0);
        }
    }

    // Modo 2: Console Interativo Remoto
    console.log(`
${C.cyan}${C.bold}╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                 🎮 CONSOLE DE COMANDOS REMOTOS - SIEMENS LOGO! (S7 ISO-on-TCP)        ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝${C.reset}
  Conectado ao Simulador em: ${C.green}${HOST}:${PORT}${C.reset}
  Digite comandos como: ${C.yellow}set I1 1${C.reset}, ${C.yellow}set AI1 500${C.reset}, ${C.yellow}toggle Q1${C.reset}, ${C.yellow}get AI1${C.reset}, ${C.yellow}status${C.reset}
  Digite ${C.yellow}help${C.reset} para ajuda ou ${C.yellow}exit${C.reset} para sair.
`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${C.green}LOGO-REMOTO > ${C.reset}`
    });

    rl.prompt();

    rl.on('line', async (line) => {
        try {
            await executeCommand(client, line);
        } catch (err) {
            console.error(`${C.red}✖ Erro: ${err.message}${C.reset}`);
        }
        rl.prompt();
    });

    rl.on('close', () => {
        client.close();
        console.log(`\n👋 Console remoto encerrado.\n`);
        process.exit(0);
    });
}

main();
