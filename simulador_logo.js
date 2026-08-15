/**
 * =========================================================================================
 * SIMULADOR COMPLETO SIEMENS LOGO! (0BA7 / 0BA8 / LOGO! 8.x) - S7 ISO-on-TCP (Porta 102)
 * =========================================================================================
 *
 * Implementação completa e de alta performance do protocolo ISO-on-TCP (RFC 1006 / S7Comm)
 * com emulação exata do mapa de memória VM (Variable Memory) do Siemens LOGO!.
 *
 * MAPA DE MEMÓRIA VM DO LOGO! (DB1):
 * ┌──────────┬────────────────┬────────────────────────────┬──────────────────────────────┐
 * │ Bloco    │ Faixa VM (DB1) │ Exemplo S7 / Node-RED      │ Descrição                    │
 * ├──────────┼────────────────┼────────────────────────────┼──────────────────────────────┤
 * │ I        │ 1024 - 1031    │ DB1,X1024.0 / DB1,BYTE1024 │ Entradas Digitais (I1..I64)  │
 * │ AI       │ 1032 - 1063    │ DB1,WORD1032 (16-bit int)  │ Entradas Analógicas (AI1..16)│
 * │ Q        │ 1064 - 1071    │ DB1,X1064.0 / DB1,BYTE1064 │ Saídas Digitais (Q1..Q64)    │
 * │ AQ       │ 1072 - 1103    │ DB1,WORD1072 (16-bit int)  │ Saídas Analógicas (AQ1..16)  │
 * │ M        │ 1104 - 1117    │ DB1,X1104.0 / DB1,BYTE1104 │ Flags / Merkers (M1..M112)   │
 * │ AM       │ 1118 - 1245    │ DB1,WORD1118 (16-bit int)  │ Flags Analógicas (AM1..AM64) │
 * │ NI       │ 1246 - 1261    │ DB1,X1246.0 (Trava/Rede)   │ Entradas de Rede (NI1..NI128)│
 * │ NAI      │ 1262 - 1389    │ DB1,WORD1262 (16-bit int)  │ Entradas de Rede Analógicas  │
 * │ NQ       │ 1390 - 1405    │ DB1,X1390.0 / DB1,BYTE1390 │ Saídas de Rede (NQ1..NQ128)  │
 * │ NAQ      │ 1406 - 1469    │ DB1,WORD1406 (16-bit int)  │ Saídas de Rede Analógicas    │
 * └──────────┴────────────────┴────────────────────────────┴──────────────────────────────┘
 *
 * ÁREAS S7 DIRETAS MAPÉADAS:
 *   - Entradas (0x81): I0.0 - I7.7   <-> VM 1024 - 1031 (I1..I64)
 *   - Saídas   (0x82): Q0.0 - Q7.7   <-> VM 1064 - 1071 (Q1..Q64)
 *   - Flags    (0x83): M0.0 - M13.7  <-> VM 1104 - 1117 (M1..M112)
 *   - DB1      (0x84): DB1,X..., DB1,WORD..., etc. <-> Buffer VM (0..2047)
 * =========================================================================================
 */

'use strict';

import net from 'net';
import fs from 'fs';
import readline from 'readline';

// ── Configurações do Servidor ─────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '102', 10);
const HOST = process.env.HOST || '0.0.0.0';
const VM_BUFFER_SIZE = 2048; // Buffer da memória VM do LOGO!

// ── Cores ANSI para Console ──────────────────────────────────────────
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
    white: '\x1b[37m',
    bgBlue: '\x1b[44m',
    bgCyan: '\x1b[46m',
    bgDark: '\x1b[100m'
};

// ── Mapa de Definição de Blocos do LOGO! ──────────────────────────────
export const LOGO_MAP = {
    I:   { name: 'Entradas Digitais (Inputs)',       start: 1024, end: 1031, count: 64,  type: 'bit',  unit: 'bit' },
    AI:  { name: 'Entradas Analógicas (Analog In)',  start: 1032, end: 1063, count: 16,  type: 'word', unit: 'word' },
    Q:   { name: 'Saídas Digitais (Outputs)',        start: 1064, end: 1071, count: 64,  type: 'bit',  unit: 'bit' },
    AQ:  { name: 'Saídas Analógicas (Analog Out)',   start: 1072, end: 1103, count: 16,  type: 'word', unit: 'word' },
    M:   { name: 'Flags / Merkers Digitais',         start: 1104, end: 1117, count: 112, type: 'bit',  unit: 'bit' },
    AM:  { name: 'Flags Analógicas (Analog Merkers)',start: 1118, end: 1245, count: 64,  type: 'word', unit: 'word' },
    NI:  { name: 'Entradas de Rede (Network In)',    start: 1246, end: 1261, count: 128, type: 'bit',  unit: 'bit' },
    NAI: { name: 'Entradas de Rede Analógicas',      start: 1262, end: 1389, count: 64,  type: 'word', unit: 'word' },
    NQ:  { name: 'Saídas de Rede (Network Out)',     start: 1390, end: 1405, count: 128, type: 'bit',  unit: 'bit' },
    NAQ: { name: 'Saídas de Rede Analógicas',        start: 1406, end: 1469, count: 32,  type: 'word', unit: 'word' }
};

// ── Buffer de Memória VM Centralizada ─────────────────────────────────
export const vmBuffer = Buffer.alloc(VM_BUFFER_SIZE);

// Gerenciador de simulações ativas (ondas, osciladores, pulsos)
const activeSimulations = new Map();
let simIdCounter = 1;
let watchTags = [];
let watchInterval = null;

// ── Helpers de Formatação e Data ──────────────────────────────────────
function ts() { return new Date().toLocaleTimeString('pt-BR'); }
function log(msg)  { console.log(`[${C.dim}${ts()}${C.reset}] ${msg}`); }
function logSuccess(msg) { console.log(`[${C.dim}${ts()}${C.reset}] ${C.green}✔ ${msg}${C.reset}`); }
function logWarn(msg) { console.log(`[${C.dim}${ts()}${C.reset}] ${C.yellow}⚠ ${msg}${C.reset}`); }
function logError(msg) { console.log(`[${C.dim}${ts()}${C.reset}] ${C.red}✖ ${msg}${C.reset}`); }

// ── Funções de Manipulação da Memória VM ──────────────────────────────

/**
 * Lê um bit na memória VM.
 * @param {number} byteOff 
 * @param {number} bitOff (0 a 7)
 * @returns {boolean}
 */
export function getVmBit(byteOff, bitOff) {
    if (byteOff < 0 || byteOff >= VM_BUFFER_SIZE) return false;
    const b = vmBuffer[byteOff];
    return ((b >> bitOff) & 0x01) === 1;
}

/**
 * Escreve um bit na memória VM preservando os demais bits do byte.
 * @param {number} byteOff 
 * @param {number} bitOff (0 a 7)
 * @param {boolean|number} val 
 */
export function setVmBit(byteOff, bitOff, val) {
    if (byteOff < 0 || byteOff >= VM_BUFFER_SIZE) return;
    const current = vmBuffer[byteOff];
    if (val) {
        vmBuffer[byteOff] = current | (1 << bitOff);
    } else {
        vmBuffer[byteOff] = current & ~(1 << bitOff);
    }
}

/**
 * Lê um byte da memória VM.
 */
export function getVmByte(byteOff) {
    if (byteOff < 0 || byteOff >= VM_BUFFER_SIZE) return 0;
    return vmBuffer[byteOff];
}

/**
 * Escreve um byte na memória VM.
 */
export function setVmByte(byteOff, val) {
    if (byteOff < 0 || byteOff >= VM_BUFFER_SIZE) return;
    vmBuffer[byteOff] = val & 0xFF;
}

/**
 * Lê uma Word (16-bit inteiro com sinal, Big-Endian) da memória VM.
 */
export function getVmWord(byteOff) {
    if (byteOff < 0 || byteOff + 1 >= VM_BUFFER_SIZE) return 0;
    return vmBuffer.readInt16BE(byteOff);
}

/**
 * Escreve uma Word (16-bit inteiro com sinal, Big-Endian) na memória VM.
 */
export function setVmWord(byteOff, val) {
    if (byteOff < 0 || byteOff + 1 >= VM_BUFFER_SIZE) return;
    const clamped = Math.max(-32768, Math.min(32767, Math.round(val)));
    vmBuffer.writeInt16BE(clamped, byteOff);
}

/**
 * Lê uma DWord / Int32 da memória VM.
 */
export function getVmDWord(byteOff) {
    if (byteOff < 0 || byteOff + 3 >= VM_BUFFER_SIZE) return 0;
    return vmBuffer.readInt32BE(byteOff);
}

/**
 * Escreve uma DWord / Int32 na memória VM.
 */
export function setVmDWord(byteOff, val) {
    if (byteOff < 0 || byteOff + 3 >= VM_BUFFER_SIZE) return;
    vmBuffer.writeInt32BE(Math.round(val), byteOff);
}

/**
 * Lê um Real / Float 32-bit da memória VM.
 */
export function getVmFloat(byteOff) {
    if (byteOff < 0 || byteOff + 3 >= VM_BUFFER_SIZE) return 0.0;
    return vmBuffer.readFloatBE(byteOff);
}

/**
 * Escreve um Real / Float 32-bit na memória VM.
 */
export function setVmFloat(byteOff, val) {
    if (byteOff < 0 || byteOff + 3 >= VM_BUFFER_SIZE) return;
    vmBuffer.writeFloatBE(Number(val), byteOff);
}

// ── Parser Inteligente de Endereços / Tags ────────────────────────────

/**
 * Resolve qualquer tag (ex: I1, AI1, Q2, AQ1, M5, AM1, NI1, NAI1, NQ1, NAQ1,
 * DB1,X1024.0, DB1,WORD1032, DB1,BYTE1024, I0.1, Q0.0, M0.0, etc.)
 * para a estrutura de acesso correspondente.
 */
export function parseTag(tagStr) {
    const raw = tagStr.trim();
    const upper = raw.toUpperCase();

    // 1. Tags Amigáveis do LOGO! (I1..I64, AI1..AI16, Q1..Q64, AQ1..AQ16, etc.)
    // Entradas Analógicas AI1..AI16
    let m = upper.match(/^AI(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        if (idx < 1 || idx > LOGO_MAP.AI.count) throw new Error(`AI${idx} fora da faixa (AI1 a AI${LOGO_MAP.AI.count})`);
        const byteOff = LOGO_MAP.AI.start + (idx - 1) * 2;
        return { type: 'word', byteOff, name: `AI${idx}`, alias: `DB1,WORD${byteOff}` };
    }

    // Saídas Analógicas AQ1..AQ16
    m = upper.match(/^AQ(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        if (idx < 1 || idx > LOGO_MAP.AQ.count) throw new Error(`AQ${idx} fora da faixa (AQ1 a AQ${LOGO_MAP.AQ.count})`);
        const byteOff = LOGO_MAP.AQ.start + (idx - 1) * 2;
        return { type: 'word', byteOff, name: `AQ${idx}`, alias: `DB1,WORD${byteOff}` };
    }

    // Flags Analógicas AM1..AM64
    m = upper.match(/^AM(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        if (idx < 1 || idx > LOGO_MAP.AM.count) throw new Error(`AM${idx} fora da faixa (AM1 a AM${LOGO_MAP.AM.count})`);
        const byteOff = LOGO_MAP.AM.start + (idx - 1) * 2;
        return { type: 'word', byteOff, name: `AM${idx}`, alias: `DB1,WORD${byteOff}` };
    }

    // Network Analog Inputs NAI1..NAI64
    m = upper.match(/^NAI(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        if (idx < 1 || idx > LOGO_MAP.NAI.count) throw new Error(`NAI${idx} fora da faixa (NAI1 a NAI${LOGO_MAP.NAI.count})`);
        const byteOff = LOGO_MAP.NAI.start + (idx - 1) * 2;
        return { type: 'word', byteOff, name: `NAI${idx}`, alias: `DB1,WORD${byteOff}` };
    }

    // Network Analog Outputs NAQ1..NAQ32
    m = upper.match(/^NAQ(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        if (idx < 1 || idx > LOGO_MAP.NAQ.count) throw new Error(`NAQ${idx} fora da faixa (NAQ1 a NAQ${LOGO_MAP.NAQ.count})`);
        const byteOff = LOGO_MAP.NAQ.start + (idx - 1) * 2;
        return { type: 'word', byteOff, name: `NAQ${idx}`, alias: `DB1,WORD${byteOff}` };
    }

    // Entradas Digitais I1..I64
    m = upper.match(/^I(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        if (idx < 1 || idx > LOGO_MAP.I.count) throw new Error(`I${idx} fora da faixa (I1 a I${LOGO_MAP.I.count})`);
        const zeroIdx = idx - 1;
        const byteOff = LOGO_MAP.I.start + Math.floor(zeroIdx / 8);
        const bitOff = zeroIdx % 8;
        return { type: 'bit', byteOff, bitOff, name: `I${idx}`, alias: `DB1,X${byteOff}.${bitOff} / I${Math.floor(zeroIdx/8)}.${bitOff}` };
    }

    // Saídas Digitais Q1..Q64
    m = upper.match(/^Q(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        if (idx < 1 || idx > LOGO_MAP.Q.count) throw new Error(`Q${idx} fora da faixa (Q1 a Q${LOGO_MAP.Q.count})`);
        const zeroIdx = idx - 1;
        const byteOff = LOGO_MAP.Q.start + Math.floor(zeroIdx / 8);
        const bitOff = zeroIdx % 8;
        return { type: 'bit', byteOff, bitOff, name: `Q${idx}`, alias: `DB1,X${byteOff}.${bitOff} / Q${Math.floor(zeroIdx/8)}.${bitOff}` };
    }

    // Flags Digitais M1..M112
    m = upper.match(/^M(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        if (idx < 1 || idx > LOGO_MAP.M.count) throw new Error(`M${idx} fora da faixa (M1 a M${LOGO_MAP.M.count})`);
        const zeroIdx = idx - 1;
        const byteOff = LOGO_MAP.M.start + Math.floor(zeroIdx / 8);
        const bitOff = zeroIdx % 8;
        return { type: 'bit', byteOff, bitOff, name: `M${idx}`, alias: `DB1,X${byteOff}.${bitOff} / M${Math.floor(zeroIdx/8)}.${bitOff}` };
    }

    // Entradas de Rede Digitais NI1..NI128
    m = upper.match(/^NI(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        if (idx < 1 || idx > LOGO_MAP.NI.count) throw new Error(`NI${idx} fora da faixa (NI1 a NI${LOGO_MAP.NI.count})`);
        const zeroIdx = idx - 1;
        const byteOff = LOGO_MAP.NI.start + Math.floor(zeroIdx / 8);
        const bitOff = zeroIdx % 8;
        return { type: 'bit', byteOff, bitOff, name: `NI${idx}`, alias: `DB1,X${byteOff}.${bitOff}` };
    }

    // Saídas de Rede Digitais NQ1..NQ128
    m = upper.match(/^NQ(\d+)$/);
    if (m) {
        const idx = parseInt(m[1], 10);
        if (idx < 1 || idx > LOGO_MAP.NQ.count) throw new Error(`NQ${idx} fora da faixa (NQ1 a NQ${LOGO_MAP.NQ.count})`);
        const zeroIdx = idx - 1;
        const byteOff = LOGO_MAP.NQ.start + Math.floor(zeroIdx / 8);
        const bitOff = zeroIdx % 8;
        return { type: 'bit', byteOff, bitOff, name: `NQ${idx}`, alias: `DB1,X${byteOff}.${bitOff}` };
    }

    // 2. Notações S7 Padrão (I0.1, Q0.0, M0.0, etc.)
    m = upper.match(/^([IQM])(\d+)\.(\d+)$/);
    if (m) {
        const areaCode = m[1];
        const s7Byte = parseInt(m[2], 10);
        const bitOff = parseInt(m[3], 10);
        if (bitOff < 0 || bitOff > 7) throw new Error(`Bit inválido .${bitOff} (deve ser 0 a 7)`);
        let base = 1024;
        let blockName = 'I';
        if (areaCode === 'Q') { base = 1064; blockName = 'Q'; }
        if (areaCode === 'M') { base = 1104; blockName = 'M'; }
        const byteOff = base + s7Byte;
        const logicalIdx = s7Byte * 8 + bitOff + 1;
        return { type: 'bit', byteOff, bitOff, name: `${areaCode}${s7Byte}.${bitOff}`, alias: `${blockName}${logicalIdx} (DB1,X${byteOff}.${bitOff})` };
    }

    // 3. Notações DB1 (DB1,X..., DB1,BYTE..., DB1,WORD..., DB1,INT..., DB1,DWORD..., DB1,REAL...)
    // DB1,X1024.0 ou DB1.DBX1024.0
    m = upper.match(/^DB\d+[,.]?(?:DB)?X(\d+)\.(\d+)$/);
    if (m) {
        const byteOff = parseInt(m[1], 10);
        const bitOff = parseInt(m[2], 10);
        if (bitOff < 0 || bitOff > 7) throw new Error(`Bit inválido .${bitOff} (deve ser 0 a 7)`);
        return { type: 'bit', byteOff, bitOff, name: `DB1,X${byteOff}.${bitOff}`, alias: getFriendlyNameForVmBit(byteOff, bitOff) };
    }

    // DB1,BYTE1024 ou DB1.DBB1024 ou DB1,B1024
    m = upper.match(/^DB\d+[,.]?(?:DB)?(?:BYTE|B)(\d+)$/);
    if (m) {
        const byteOff = parseInt(m[1], 10);
        return { type: 'byte', byteOff, name: `DB1,BYTE${byteOff}`, alias: `VM Byte ${byteOff}` };
    }

    // DB1,WORD1032 ou DB1.DBW1032 ou DB1,W1032 ou DB1,INT1032
    m = upper.match(/^DB\d+[,.]?(?:DB)?(?:WORD|W|INT)(\d+)$/);
    if (m) {
        const byteOff = parseInt(m[1], 10);
        return { type: 'word', byteOff, name: `DB1,WORD${byteOff}`, alias: getFriendlyNameForVmWord(byteOff) };
    }

    // DB1,DWORD1032 ou DB1.DBD1032 ou DB1,D1032 ou DB1,DINT1032
    m = upper.match(/^DB\d+[,.]?(?:DB)?(?:DWORD|D|DINT)(\d+)$/);
    if (m) {
        const byteOff = parseInt(m[1], 10);
        return { type: 'dword', byteOff, name: `DB1,DWORD${byteOff}`, alias: `VM DWord ${byteOff}` };
    }

    // DB1,REAL1032 ou DB1.REAL1032
    m = upper.match(/^DB\d+[,.]?(?:DB)?REAL(\d+)$/);
    if (m) {
        const byteOff = parseInt(m[1], 10);
        return { type: 'real', byteOff, name: `DB1,REAL${byteOff}`, alias: `VM Real ${byteOff}` };
    }

    // Fallback: Número direto de byte de VM (ex: 1024)
    if (/^\d+$/.test(upper)) {
        const byteOff = parseInt(upper, 10);
        return { type: 'byte', byteOff, name: `DB1,BYTE${byteOff}`, alias: `VM Byte ${byteOff}` };
    }

    throw new Error(`Endereço/Tag desconhecido: "${tagStr}". Use formatos como I1, AI1, Q1, AQ1, M1, AM1, NI1, DB1,X1024.0, DB1,WORD1032, etc.`);
}

/**
 * Retorna o nome amigável para um bit VM se pertencer aos blocos conhecidos.
 */
function getFriendlyNameForVmBit(byteOff, bitOff) {
    if (byteOff >= 1024 && byteOff <= 1031) {
        const idx = (byteOff - 1024) * 8 + bitOff + 1;
        return `I${idx} (Entrada ${idx})`;
    }
    if (byteOff >= 1064 && byteOff <= 1071) {
        const idx = (byteOff - 1064) * 8 + bitOff + 1;
        return `Q${idx} (Saída ${idx})`;
    }
    if (byteOff >= 1104 && byteOff <= 1117) {
        const idx = (byteOff - 1104) * 8 + bitOff + 1;
        return `M${idx} (Flag ${idx})`;
    }
    if (byteOff >= 1246 && byteOff <= 1261) {
        const idx = (byteOff - 1246) * 8 + bitOff + 1;
        return `NI${idx} (Rede In ${idx}${idx === 1 ? ' - Trava' : ''})`;
    }
    if (byteOff >= 1390 && byteOff <= 1405) {
        const idx = (byteOff - 1390) * 8 + bitOff + 1;
        return `NQ${idx} (Rede Out ${idx})`;
    }
    return `DB1,X${byteOff}.${bitOff}`;
}

/**
 * Retorna o nome amigável para uma Word VM se pertencer aos blocos conhecidos.
 */
function getFriendlyNameForVmWord(byteOff) {
    if (byteOff >= 1032 && byteOff <= 1062 && (byteOff % 2 === 0)) {
        const idx = Math.floor((byteOff - 1032) / 2) + 1;
        return `AI${idx} (Entrada Analógica ${idx})`;
    }
    if (byteOff >= 1072 && byteOff <= 1102 && (byteOff % 2 === 0)) {
        const idx = Math.floor((byteOff - 1072) / 2) + 1;
        return `AQ${idx} (Saída Analógica ${idx})`;
    }
    if (byteOff >= 1118 && byteOff <= 1244 && (byteOff % 2 === 0)) {
        const idx = Math.floor((byteOff - 1118) / 2) + 1;
        return `AM${idx} (Flag Analógica ${idx})`;
    }
    if (byteOff >= 1262 && byteOff <= 1388 && (byteOff % 2 === 0)) {
        const idx = Math.floor((byteOff - 1262) / 2) + 1;
        return `NAI${idx} (Rede Analógica In ${idx})`;
    }
    if (byteOff >= 1406 && byteOff <= 1468 && (byteOff % 2 === 0)) {
        const idx = Math.floor((byteOff - 1406) / 2) + 1;
        return `NAQ${idx} (Rede Analógica Out ${idx})`;
    }
    return `DB1,WORD${byteOff}`;
}

/**
 * Obtém o valor formatado de qualquer tag.
 */
export function readTagValue(tagStr) {
    const target = parseTag(tagStr);
    let val;
    switch (target.type) {
        case 'bit':
            val = getVmBit(target.byteOff, target.bitOff);
            break;
        case 'byte':
            val = getVmByte(target.byteOff);
            break;
        case 'word':
            val = getVmWord(target.byteOff);
            break;
        case 'dword':
            val = getVmDWord(target.byteOff);
            break;
        case 'real':
            val = getVmFloat(target.byteOff);
            break;
    }
    return { target, value: val };
}

/**
 * Escreve o valor em qualquer tag.
 */
export function writeTagValue(tagStr, val) {
    const target = parseTag(tagStr);
    switch (target.type) {
        case 'bit': {
            const bVal = (val === true || val === '1' || val === 1 || String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'on');
            setVmBit(target.byteOff, target.bitOff, bVal);
            return { target, value: bVal };
        }
        case 'byte': {
            const num = parseInt(val, 10) || 0;
            setVmByte(target.byteOff, num);
            return { target, value: num };
        }
        case 'word': {
            const num = parseInt(val, 10) || 0;
            setVmWord(target.byteOff, num);
            return { target, value: num };
        }
        case 'dword': {
            const num = parseInt(val, 10) || 0;
            setVmDWord(target.byteOff, num);
            return { target, value: num };
        }
        case 'real': {
            const num = parseFloat(val) || 0.0;
            setVmFloat(target.byteOff, num);
            return { target, value: num };
        }
    }
}

// ── Funções de Pacotes Protocolo S7 ISO-on-TCP ────────────────────────

/** Empacota payload S7 dentro de TPKT + COTP DT (0xF0, EOT=0x80) */
function wrapTpktCotpDt(s7Payload) {
    const totalLen = 4 + 3 + s7Payload.length;
    const buf = Buffer.alloc(totalLen);
    // TPKT (versão 3, reservado 0, length total em 2 bytes)
    buf[0] = 0x03;
    buf[1] = 0x00;
    buf.writeUInt16BE(totalLen, 2);
    // COTP DT (Length=2, PDU-Type=0xF0, TPDU-Nr/EOT=0x80)
    buf[4] = 0x02;
    buf[5] = 0xF0;
    buf[6] = 0x80;
    s7Payload.copy(buf, 7);
    return buf;
}

/** Monta cabeçalho S7 Ack_Data (12 bytes) */
function s7ResponseHeader(pduRef, paramLen, dataLen, errClass = 0, errCode = 0) {
    const h = Buffer.alloc(12);
    h[0] = 0x32;                  // Protocol ID S7
    h[1] = 0x03;                  // ROSCTR = Ack_Data (0x03)
    h[2] = 0x00; h[3] = 0x00;     // Redundancy ID
    h.writeUInt16BE(pduRef, 4);   // PDU Reference (eco do cliente)
    h.writeUInt16BE(paramLen, 6); // Param length
    h.writeUInt16BE(dataLen, 8);  // Data length
    h[10] = errClass;             // Error class
    h[11] = errCode;              // Error code
    return h;
}

/**
 * Resolve o byte da memória VM baseado na área e no offset da requisição S7.
 * Áreas:
 *   0x81 = Entradas (I/E) -> mapeia para VM 1024..1031
 *   0x82 = Saídas (Q/A)   -> mapeia para VM 1064..1071
 *   0x83 = Flags (M)      -> mapeia para VM 1104..1117
 *   0x84 = DB (DataBlock) -> VM Buffer direto (DB 1)
 */
function mapS7ToVmOffset(area, dbNum, byteOff) {
    if (area === 0x81) { // Entradas (I)
        return 1024 + byteOff;
    }
    if (area === 0x82) { // Saídas (Q)
        return 1064 + byteOff;
    }
    if (area === 0x83) { // Merkers (M)
        return 1104 + byteOff;
    }
    if (area === 0x84) { // DB1
        return byteOff;
    }
    return byteOff;
}

// ── Servidor TCP / ISO-on-TCP ─────────────────────────────────────────

let connectedClientsCount = 0;

export const server = net.createServer((socket) => {
    const client = `${socket.remoteAddress}:${socket.remotePort}`;
    connectedClientsCount++;
    logSuccess(`Cliente conectado: ${C.cyan}${client}${C.reset} (Total ativos: ${connectedClientsCount})`);

    let rxBuf = Buffer.alloc(0);

    socket.on('data', (chunk) => {
        rxBuf = Buffer.concat([rxBuf, chunk]);

        while (rxBuf.length >= 4) {
            // Valida cabeçalho TPKT (0x03)
            if (rxBuf[0] !== 0x03) {
                logWarn(`Byte inesperado 0x${rxBuf[0].toString(16)} — descartando pacote inválido`);
                rxBuf = Buffer.alloc(0);
                break;
            }

            const pktLen = rxBuf.readUInt16BE(2);
            if (rxBuf.length < pktLen) break; // Aguarda pacote completo

            const pkt = rxBuf.slice(0, pktLen);
            rxBuf = rxBuf.slice(pktLen);

            const cotpType = pkt[5];

            // ── 1. COTP Connection Request (CR = 0xE0) ────────────────
            if (cotpType === 0xE0) {
                const srcRef = pkt.readUInt16BE(8);
                // Resposta COTP CC (Connection Confirm)
                const cc = Buffer.from([
                    0x03, 0x00, 0x00, 0x16,                         // TPKT (len = 22)
                    0x11, 0xD0,                                     // COTP CC (len = 17, type = 0xD0)
                    0x00, 0x01,                                     // Dst ref
                    (srcRef >> 8) & 0xFF, srcRef & 0xFF,            // Src ref (eco)
                    0x00,                                           // Class 0
                    0xC0, 0x01, 0x0A,                               // TPDU size (1024 bytes)
                    0xC1, 0x02, 0x01, 0x00,                         // Calling TSAP
                    0xC2, 0x02, 0x01, 0x02                          // Called TSAP
                ]);
                socket.write(cc);
                log(`📥 COTP CR -> 📤 COTP CC enviado para ${client}`);
                continue;
            }

            // ── 2. COTP DT (Data = 0xF0) ──────────────────────────────
            if (cotpType === 0xF0) {
                const s7 = 7; // Início do cabeçalho S7

                if (pkt.length < s7 + 10) continue;
                if (pkt[s7] !== 0x32) continue; // S7 Protocol ID

                const pduRef = pkt.readUInt16BE(s7 + 4);
                const func   = pkt[s7 + 10];

                // ── S7 Setup Communication (Negotiate PDU = 0xF0) ─────
                if (func === 0xF0) {
                    const setupPayload = Buffer.from([
                        0x32, 0x03, 0x00, 0x00,                     // S7 Header
                        (pduRef >> 8) & 0xFF, pduRef & 0xFF,        // PDU ref eco
                        0x00, 0x08,                                 // Param length = 8
                        0x00, 0x00,                                 // Data length = 0
                        0x00, 0x00,                                 // Error = 0
                        0xF0, 0x00,                                 // Function & reserved
                        0x00, 0x04,                                 // Max AMQ calling = 4
                        0x00, 0x04,                                 // Max AMQ called = 4
                        0x03, 0xC0                                  // PDU length = 960 bytes
                    ]);
                    socket.write(wrapTpktCotpDt(setupPayload));
                    logSuccess(`S7 Negociação PDU concluída com sucesso (PDU Max: 960B)`);
                    continue;
                }

                // ── S7 Read Variable (Function = 0x04) ────────────────
                if (func === 0x04) {
                    const itemCount = pkt[s7 + 11];
                    let off = s7 + 12;
                    const dataItems = [];
                    const logDetails = [];

                    for (let i = 0; i < itemCount && off + 12 <= pkt.length; i++) {
                        const transportSize = pkt[off + 3]; // 0x01/0x02 = BIT, 0x04 = BYTE/WORD/DWORD
                        const reqLength     = pkt.readUInt16BE(off + 4); // Quantidade solicitada
                        const dbNum         = pkt.readUInt16BE(off + 6);
                        const area          = pkt[off + 8];
                        const bitRaw        = (pkt[off + 9] << 16) | (pkt[off + 10] << 8) | pkt[off + 11];
                        const byteOff       = bitRaw >> 3;
                        const bitOff        = bitRaw & 0x07;

                        const vmByte = mapS7ToVmOffset(area, dbNum, byteOff);

                        let itemBuf;
                        let desc = '';

                        // Leitura de BIT (TransportSize = 0x01 ou 0x02)
                        if (transportSize === 0x01 || transportSize === 0x02) {
                            const bitVal = getVmBit(vmByte, bitOff) ? 1 : 0;
                            // Resposta de Bit: Return Code 0xFF (OK), Data Type 0x03 (BIT), Length 0x0001 (1 bit), Dados = 0x01 ou 0x00
                            itemBuf = Buffer.from([0xFF, 0x03, 0x00, 0x01, bitVal]);
                            desc = `BIT [${getFriendlyNameForVmBit(vmByte, bitOff)}] = ${bitVal === 1 ? 'ON (1)' : 'OFF (0)'}`;
                        } else {
                            // Leitura em Bytes / Words / DWords
                            const numBytes = reqLength; // Para transport 0x04, length é número de bytes ou words
                            const byteSlice = Buffer.alloc(numBytes);
                            for (let b = 0; b < numBytes; b++) {
                                byteSlice[b] = getVmByte(vmByte + b);
                            }
                            
                            // Return Code 0xFF (OK), Data Type 0x04 (BYTE/WORD/DWORD), Length em BITS (numBytes * 8)
                            const bitLen = numBytes * 8;
                            const header = Buffer.from([0xFF, 0x04, (bitLen >> 8) & 0xFF, bitLen & 0xFF]);
                            itemBuf = Buffer.concat([header, byteSlice]);

                            if (numBytes === 2) {
                                const wVal = byteSlice.readInt16BE(0);
                                desc = `WORD [${getFriendlyNameForVmWord(vmByte)}] = ${wVal}`;
                            } else if (numBytes === 1) {
                                desc = `BYTE [VM ${vmByte}] = 0x${byteSlice[0].toString(16).padStart(2, '0')} (${byteSlice[0]})`;
                            } else {
                                desc = `BYTES [VM ${vmByte}..${vmByte + numBytes - 1}] (${numBytes} bytes)`;
                            }
                        }

                        // Alinhamento par para itens intermediários com tamanho ímpar
                        if (i < itemCount - 1 && (itemBuf.length % 2 !== 0)) {
                            dataItems.push(Buffer.concat([itemBuf, Buffer.from([0x00])]));
                        } else {
                            dataItems.push(itemBuf);
                        }

                        logDetails.push(desc);
                        off += 12;
                    }

                    // Envia resposta S7 Read
                    const dataSection = Buffer.concat(dataItems);
                    const paramSection = Buffer.from([0x04, itemCount]);
                    const s7Resp = Buffer.concat([
                        s7ResponseHeader(pduRef, paramSection.length, dataSection.length),
                        paramSection,
                        dataSection
                    ]);
                    socket.write(wrapTpktCotpDt(s7Resp));

                    if (logDetails.length <= 3) {
                        log(`📥 S7 Read (${itemCount} item(s)): ${logDetails.join(' | ')}`);
                    } else {
                        log(`📥 S7 Read (${itemCount} item(s)): ${logDetails.slice(0, 2).join(' | ')} ... (+${logDetails.length - 2} itens)`);
                    }
                    continue;
                }

                // ── S7 Write Variable (Function = 0x05) ───────────────
                if (func === 0x05) {
                    const itemCount = pkt[s7 + 11];
                    let paramOff = s7 + 12;
                    let dataOff = s7 + 12 + (itemCount * 12);
                    const ackItems = [];
                    const writeDetails = [];

                    for (let i = 0; i < itemCount && paramOff + 12 <= pkt.length; i++) {
                        const transportSize = pkt[paramOff + 3];
                        const reqLength     = pkt.readUInt16BE(paramOff + 4);
                        const dbNum         = pkt.readUInt16BE(paramOff + 6);
                        const area          = pkt[paramOff + 8];
                        const bitRaw        = (pkt[paramOff + 9] << 16) | (pkt[paramOff + 10] << 8) | pkt[paramOff + 11];
                        const byteOff       = bitRaw >> 3;
                        const bitOff        = bitRaw & 0x07;

                        const vmByte = mapS7ToVmOffset(area, dbNum, byteOff);

                        // Lê o bloco de dados enviado pelo cliente
                        if (dataOff + 4 <= pkt.length) {
                            const returnCode = pkt[dataOff];      // Reservado no request (geralmente 0x00 ou tipo)
                            const dataType   = pkt[dataOff + 1];  // 0x03 = BIT, 0x04 = BYTE/WORD
                            const bitLen     = pkt.readUInt16BE(dataOff + 2);
                            const byteLen    = dataType === 0x03 ? 1 : Math.ceil(bitLen / 8);
                            const valData    = pkt.slice(dataOff + 4, dataOff + 4 + byteLen);

                            if (dataType === 0x03 || transportSize === 0x01 || transportSize === 0x02) {
                                const bVal = valData.length > 0 && valData[0] !== 0;
                                setVmBit(vmByte, bitOff, bVal);
                                const friendly = getFriendlyNameForVmBit(vmByte, bitOff);
                                writeDetails.push(`BIT [${friendly}] <- ${bVal ? 'ON (1)' : 'OFF (0)'}`);
                            } else {
                                for (let b = 0; b < valData.length; b++) {
                                    setVmByte(vmByte + b, valData[b]);
                                }
                                if (valData.length === 2) {
                                    const wVal = valData.readInt16BE(0);
                                    writeDetails.push(`WORD [${getFriendlyNameForVmWord(vmByte)}] <- ${wVal}`);
                                } else {
                                    writeDetails.push(`BYTES [VM ${vmByte}] (${valData.length}B) <- [${Array.from(valData).map(x => '0x' + x.toString(16)).join(',')}]`);
                                }
                            }

                            // Avança ponteiro de dados com padding par
                            let consumed = 4 + byteLen;
                            if (consumed % 2 !== 0) consumed++;
                            dataOff += consumed;

                            ackItems.push(0xFF); // 0xFF = Gravação com sucesso
                        } else {
                            ackItems.push(0x05); // Erro de acesso
                        }

                        paramOff += 12;
                    }

                    // Envia resposta de escrita S7 Write
                    const ackBuffer = Buffer.from(ackItems);
                    const paramSection = Buffer.from([0x05, itemCount]);
                    const s7Resp = Buffer.concat([
                        s7ResponseHeader(pduRef, paramSection.length, ackBuffer.length),
                        paramSection,
                        ackBuffer
                    ]);
                    socket.write(wrapTpktCotpDt(s7Resp));

                    log(`📥 S7 Write (${itemCount} item(s)): ${C.magenta}${writeDetails.join(' | ')}${C.reset}`);
                    continue;
                }
            }
        }
    });

    socket.on('error', (err) => {
        logWarn(`Socket erro no cliente ${client}: ${err.message}`);
    });

    socket.on('close', () => {
        connectedClientsCount = Math.max(0, connectedClientsCount - 1);
        log(`🔌 Cliente desconectado: ${client} (Ativos: ${connectedClientsCount})`);
    });
});

server.on('error', (err) => {
    logError(`Erro crítico no servidor S7: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
        console.log(`\n${C.yellow}👉 A porta ${PORT} já está em uso por outro processo.${C.reset}`);
        console.log(`   Finalize o processo anterior ou defina outra porta via variável PORT=10200 node simulador_logo.js\n`);
    }
    process.exit(1);
});

// ── Geradores de Simulação Dinâmica (Sinais, Ondas e Pulsos) ──────────

/**
 * Inicia um gerador de onda senoidal/triangular em uma entrada/saída analógica.
 */
function startWaveSimulation(tagStr, minVal = 0, maxVal = 1000, periodMs = 5000) {
    const target = parseTag(tagStr);
    if (target.type !== 'word' && target.type !== 'real') {
        throw new Error(`Onda dinâmica suportada apenas para variáveis analógicas/Word (ex: AI1, AQ1, AM1, NAI1, NAQ1).`);
    }

    const id = simIdCounter++;
    const startTime = Date.now();
    const mid = (minVal + maxVal) / 2;
    const amp = (maxVal - minVal) / 2;

    const timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const rad = (elapsed % periodMs) / periodMs * 2 * Math.PI;
        const currentVal = Math.round(mid + amp * Math.sin(rad));
        if (target.type === 'word') {
            setVmWord(target.byteOff, currentVal);
        } else {
            setVmFloat(target.byteOff, currentVal);
        }
    }, 100);

    activeSimulations.set(id, {
        id,
        type: 'WAVE',
        tag: target.name,
        target,
        timer,
        info: `Onda Senoidal em ${target.name} [${minVal} .. ${maxVal}] (Período: ${periodMs}ms)`
    });

    return id;
}

/**
 * Inicia um gerador de pulsos (Clock) em uma entrada/saída digital.
 */
function startPulseSimulation(tagStr, intervalMs = 1000) {
    const target = parseTag(tagStr);
    if (target.type !== 'bit') {
        throw new Error(`Gerador de pulsos suportado apenas para variáveis digitais/Bit (ex: I1, Q1, M1, NI1, etc.).`);
    }

    const id = simIdCounter++;
    let state = false;

    const timer = setInterval(() => {
        state = !state;
        setVmBit(target.byteOff, target.bitOff, state);
    }, intervalMs);

    activeSimulations.set(id, {
        id,
        type: 'PULSE',
        tag: target.name,
        target,
        timer,
        info: `Pulso/Clock em ${target.name} (Alternando a cada ${intervalMs}ms)`
    });

    return id;
}

/**
 * Para simulação por ID ou todas.
 */
function stopSimulation(idOrAll) {
    if (idOrAll === 'all' || idOrAll === 'ALL') {
        let count = 0;
        for (const [id, sim] of activeSimulations.entries()) {
            clearInterval(sim.timer);
            count++;
        }
        activeSimulations.clear();
        return `Todas as ${count} simulações foram finalizadas.`;
    }
    const id = parseInt(idOrAll, 10);
    if (activeSimulations.has(id)) {
        const sim = activeSimulations.get(id);
        clearInterval(sim.timer);
        activeSimulations.delete(id);
        return `Simulação #${id} (${sim.tag}) finalizada.`;
    }
    throw new Error(`Simulação #${idOrAll} não encontrada.`);
}

// ── Cenários Pré-Configurados ─────────────────────────────────────────

export function applyScenario(name) {
    const sName = (name || '').toLowerCase().trim();
    stopSimulation('all');

    switch (sName) {
        case 'balanca':
        case 'balança':
        case 'martinrea':
            // Reseta e configura estado da balança
            vmBuffer.fill(0);
            setVmBit(1024, 0, true);   // I1 / I0.0 = true
            setVmBit(1024, 1, true);   // I2 / I0.1 = true (Porta Fechada)
            setVmBit(1246, 0, false);  // NI1 / DB1,X1246.0 = false (Trava Bloqueada)
            setVmWord(1032, 2540);     // AI1 = 2540g (Peso na balança)
            return `Cenário BALANÇA MARTINREA aplicado:\n` +
                   `   ▶ I0.1 (I2)         = ON (1) -> Porta FECHADA\n` +
                   `   ▶ DB1,X1246.0 (NI1) = OFF (0) -> Trava BLOQUEADA\n` +
                   `   ▶ AI1 (DB1,WORD1032)= 2540 -> Peso inicial (2.540 kg)`;

        case 'esteira':
            vmBuffer.fill(0);
            setVmBit(1024, 0, true);   // I1 = Sensor de Presença de Peça
            setVmBit(1024, 1, true);   // I2 = Botão de Emergência OK
            setVmBit(1064, 0, true);   // Q1 = Motor Esteira Ligado
            setVmWord(1032, 1750);     // AI1 = Rotação RPM Motor (1750 RPM)
            setVmWord(1072, 800);      // AQ1 = Referência de Inversor (80.0%)
            return `Cenário ESTEIRA INDUSTRIAL aplicado:\n` +
                   `   ▶ I1 (DB1,X1024.0)  = ON (1) -> Sensor Peça Presente\n` +
                   `   ▶ I2 (DB1,X1024.1)  = ON (1) -> Emergência OK\n` +
                   `   ▶ Q1 (DB1,X1064.0)  = ON (1) -> Motor da Esteira Ativo\n` +
                   `   ▶ AI1 (DB1,WORD1032)= 1750 -> Velocidade RPM\n` +
                   `   ▶ AQ1 (DB1,WORD1072)= 800  -> Setpoint Inversor`;

        case 'tanque':
            vmBuffer.fill(0);
            setVmBit(1064, 0, true);   // Q1 = Válvula de Entrada Aberta
            setVmBit(1064, 1, false);  // Q2 = Válvula de Dreno Fechada
            setVmWord(1032, 450);      // AI1 = Nível atual (450 Litros)
            startWaveSimulation('AI1', 200, 950, 8000);
            return `Cenário TANQUE DE NÍVEL aplicado:\n` +
                   `   ▶ AI1 (DB1,WORD1032)= Nível dinâmico com onda senoidal [200L..950L]\n` +
                   `   ▶ Q1 (DB1,X1064.0)  = ON (1) -> Válvula de Enchimento\n` +
                   `   ▶ Q2 (DB1,X1064.1)  = OFF (0) -> Dreno`;

        case 'limpo':
        case 'reset':
        case 'zerar':
            vmBuffer.fill(0);
            return `Memória VM completamente ZERADA (todos os 2048 bytes = 0).`;

        default:
            throw new Error(`Cenário "${name}" não existe. Opções: balanca, esteira, tanque, limpo`);
    }
}

// ── Tabelas e Visualizações do Console ────────────────────────────────

/**
 * Exibe visão geral compacta do status de todas as seções ativas.
 */
export function printStatusOverview() {
    console.log(`\n${C.cyan}${C.bold}╔═══════════════════════════════════════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.cyan}${C.bold}║                  📊 PAINEL DE STATUS GERAL - SIEMENS LOGO! (DB1)                     ║${C.reset}`);
    console.log(`${C.cyan}${C.bold}╚═══════════════════════════════════════════════════════════════════════════════════════╝${C.reset}`);

    // I (Entradas)
    const iBits = [];
    for (let i = 1; i <= 8; i++) {
        const v = getVmBit(1024, i - 1);
        iBits.push(`I${i}:${v ? C.green + '● 1' : C.dim + '○ 0'}${C.reset}`);
    }
    console.log(` ${C.bold}▶ ENTRADAS DIGITAIS (I1..I8) [VM 1024]:${C.reset}  ${iBits.join('  ')}`);

    // AI (Entradas Analógicas)
    const aiWords = [];
    for (let i = 1; i <= 4; i++) {
        const off = 1032 + (i - 1) * 2;
        const v = getVmWord(off);
        aiWords.push(`AI${i}:${C.yellow}${v}${C.reset}`);
    }
    console.log(` ${C.bold}▶ ENTRADAS ANALÓGICAS (AI1..AI4) [VM 1032..]:${C.reset} ${aiWords.join('   ')}`);

    // Q (Saídas)
    const qBits = [];
    for (let i = 1; i <= 8; i++) {
        const v = getVmBit(1064, i - 1);
        qBits.push(`Q${i}:${v ? C.green + '● 1' : C.dim + '○ 0'}${C.reset}`);
    }
    console.log(` ${C.bold}▶ SAÍDAS DIGITAIS (Q1..Q8) [VM 1064]:${C.reset}    ${qBits.join('  ')}`);

    // AQ (Saídas Analógicas)
    const aqWords = [];
    for (let i = 1; i <= 2; i++) {
        const off = 1072 + (i - 1) * 2;
        const v = getVmWord(off);
        aqWords.push(`AQ${i}:${C.yellow}${v}${C.reset}`);
    }
    console.log(` ${C.bold}▶ SAÍDAS ANALÓGICAS (AQ1..AQ2) [VM 1072..]:${C.reset}   ${aqWords.join('   ')}`);

    // M (Flags)
    const mBits = [];
    for (let i = 1; i <= 8; i++) {
        const v = getVmBit(1104, i - 1);
        mBits.push(`M${i}:${v ? C.green + '● 1' : C.dim + '○ 0'}${C.reset}`);
    }
    console.log(` ${C.bold}▶ FLAGS DIGITAIS (M1..M8) [VM 1104]:${C.reset}        ${mBits.join('  ')}`);

    // NI (Network Inputs)
    const niBits = [];
    for (let i = 1; i <= 8; i++) {
        const v = getVmBit(1246, i - 1);
        niBits.push(`NI${i}:${v ? C.green + '● 1' : C.dim + '○ 0'}${C.reset}`);
    }
    console.log(` ${C.bold}▶ ENTRADAS DE REDE (NI1..NI8) [VM 1246]:${C.reset}    ${niBits.join(' ')}`);

    // NAI & NAQ
    const nai1 = getVmWord(1262);
    const naq1 = getVmWord(1406);
    console.log(` ${C.bold}▶ REDE ANALÓGICA:${C.reset} NAI1:${C.yellow}${nai1}${C.reset} (VM 1262) | NAQ1:${C.yellow}${naq1}${C.reset} (VM 1406)`);

    // Balança / Tags Principais
    const i01 = getVmBit(1024, 1);
    const trava = getVmBit(1246, 0);
    console.log(`\n ${C.cyan}📌 Status Aplicação Balança:${C.reset} Porta (I0.1)=${i01 ? C.green + 'FECHADA (1)' : C.red + 'ABERTA (0)'}${C.reset} | Trava (DB1,X1246.0)=${trava ? C.green + 'LIBERADA (1)' : C.yellow + 'BLOQUEADA (0)'}${C.reset}`);
    
    // Simulações ativas
    if (activeSimulations.size > 0) {
        console.log(`\n ${C.magenta}⚡ Simulações Ativas (${activeSimulations.size}):${C.reset}`);
        for (const [id, sim] of activeSimulations.entries()) {
            console.log(`   [#${id}] ${sim.info}`);
        }
    }
    console.log(`${C.cyan}─────────────────────────────────────────────────────────────────────────────────────────${C.reset}\n`);
}

/**
 * Exibe detalhes de um bloco específico em formato tabular.
 */
export function printBlockDetails(blockKey) {
    const upper = (blockKey || '').toUpperCase().trim();
    if (upper === 'ALL') {
        Object.keys(LOGO_MAP).forEach(k => printBlockDetails(k));
        return;
    }

    const map = LOGO_MAP[upper];
    if (!map) {
        throw new Error(`Bloco "${blockKey}" inválido. Use: I, AI, Q, AQ, M, AM, NI, NAI, NQ, NAQ ou ALL`);
    }

    console.log(`\n${C.cyan}${C.bold}┌────────────────────────────────────────────────────────────────────────────────┐${C.reset}`);
    console.log(`${C.cyan}${C.bold}│ Bloco: ${map.name.padEnd(40)} Faixa VM: ${map.start} a ${map.end} │${C.reset}`);
    console.log(`${C.cyan}${C.bold}├────────┬─────────────────┬────────────────────┬──────────┬─────────────────────┤${C.reset}`);
    console.log(`${C.cyan}${C.bold}│ Tag    │ Endereço S7     │ Endereço DB1       │ Tipo     │ Valor Atual         │${C.reset}`);
    console.log(`${C.cyan}${C.bold}├────────┼─────────────────┼────────────────────┼──────────┼─────────────────────┤${C.reset}`);

    const maxItems = Math.min(map.count, 16); // Mostra até 16 primeiros para não poluir
    for (let i = 1; i <= maxItems; i++) {
        const tag = `${upper}${i}`;
        const target = parseTag(tag);
        let valStr = '';
        let s7Addr = target.name;

        if (target.type === 'bit') {
            const v = getVmBit(target.byteOff, target.bitOff);
            valStr = v ? `${C.green}● ON (1)${C.reset}` : `${C.dim}○ OFF (0)${C.reset}`;
            s7Addr = `DB1,X${target.byteOff}.${target.bitOff}`;
        } else if (target.type === 'word') {
            const v = getVmWord(target.byteOff);
            valStr = `${C.yellow}${v}${C.reset}`;
            s7Addr = `DB1,WORD${target.byteOff}`;
        }

        const tagCol = tag.padEnd(6);
        const s7Col = s7Addr.padEnd(15);
        const dbCol = `Byte ${target.byteOff}${target.bitOff !== undefined ? '.' + target.bitOff : ''}`.padEnd(18);
        const typeCol = target.type.toUpperCase().padEnd(8);

        console.log(`│ ${C.bold}${tagCol}${C.reset} │ ${s7Col} │ ${dbCol} │ ${typeCol} │ ${valStr.padEnd(28)}│`);
    }

    if (map.count > maxItems) {
        console.log(`│ ... e mais ${map.count - maxItems} itens disponíveis (consulte via get ${upper}<n>)             │`);
    }
    console.log(`${C.cyan}${C.bold}└────────────────────────────────────────────────────────────────────────────────┘${C.reset}\n`);
}

/**
 * Exibe Hex Dump de uma faixa de memória VM.
 */
export function dumpMemory(start = 1024, length = 64) {
    const s = Math.max(0, Math.min(VM_BUFFER_SIZE - 1, start));
    const len = Math.min(VM_BUFFER_SIZE - s, Math.max(1, length));
    console.log(`\n${C.cyan}${C.bold}── HEX DUMP MEMÓRIA VM [${s} .. ${s + len - 1}] (${len} bytes) ──${C.reset}`);

    for (let row = s; row < s + len; row += 16) {
        const rowLen = Math.min(16, s + len - row);
        const hex = [];
        const chars = [];
        for (let i = 0; i < 16; i++) {
            if (i < rowLen) {
                const b = vmBuffer[row + i];
                hex.push(b.toString(16).padStart(2, '0').toUpperCase());
                chars.push(b >= 32 && b <= 126 ? String.fromCharCode(b) : '.');
            } else {
                hex.push('  ');
                chars.push(' ');
            }
        }
        console.log(`${C.yellow}0x${row.toString(16).padStart(4, '0').toUpperCase()} (${row.toString().padStart(4, ' ')}) :${C.reset}  ${hex.slice(0, 8).join(' ')}  ${hex.slice(8).join(' ')}  |${chars.join('')}|`);
    }
    console.log('');
}

/**
 * Salva snapshot da memória em arquivo JSON.
 */
function saveSnapshot(filePath = 'snapshot_logo.json') {
    const data = {
        timestamp: new Date().toISOString(),
        bufferHex: vmBuffer.toString('hex')
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return `Snapshot salvo com sucesso em "${filePath}" (${data.timestamp})`;
}

/**
 * Carrega snapshot da memória a partir de arquivo JSON.
 */
function loadSnapshot(filePath = 'snapshot_logo.json') {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo "${filePath}" não encontrado.`);
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (data.bufferHex) {
        const loadedBuf = Buffer.from(data.bufferHex, 'hex');
        loadedBuf.copy(vmBuffer, 0, 0, Math.min(VM_BUFFER_SIZE, loadedBuf.length));
        return `Snapshot carregado com sucesso de "${filePath}" (Criado em: ${data.timestamp || 'N/A'})`;
    }
    throw new Error(`Formato de snapshot inválido em "${filePath}".`);
}

// ── Modo Watch (Monitoramento em tempo real) ──────────────────────────

function startWatch(tags) {
    if (watchInterval) clearInterval(watchInterval);
    watchTags = tags;
    console.log(`\n${C.green}👁 Modo Watch ATIVO para: ${tags.join(', ')} (Pressione Enter ou qualquer comando para sair)${C.reset}`);
    watchInterval = setInterval(() => {
        const readings = watchTags.map(t => {
            try {
                const res = readTagValue(t);
                let valStr = res.value;
                if (typeof res.value === 'boolean') {
                    valStr = res.value ? `${C.green}ON(1)${C.reset}` : `${C.dim}OFF(0)${C.reset}`;
                } else {
                    valStr = `${C.yellow}${res.value}${C.reset}`;
                }
                return `${C.bold}${res.target.name}:${valStr}`;
            } catch (e) {
                return `${t}:${C.red}ERR${C.reset}`;
            }
        });
        process.stdout.write(`\r[${ts()}] ${readings.join(' | ')}      `);
    }, 500);
}

function stopWatch() {
    if (watchInterval) {
        clearInterval(watchInterval);
        watchInterval = null;
        console.log(`\n${C.yellow}👁 Modo Watch desativado.${C.reset}\n`);
    }
}

// ── Ajuda Completa e Banner ───────────────────────────────────────────

function printBanner() {
    console.log(`
${C.cyan}${C.bold}╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                   🏭 SIMULADOR CLP SIEMENS LOGO! (0BA7 / 0BA8 / 8.x)                  ║
║                  Protocolo S7 ISO-on-TCP (Porta ${PORT}) | RFC 1006 / S7Comm                ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝${C.reset}
  ${C.bold}🌐 Servidor S7 Escutando em:${C.reset} ${C.green}${HOST}:${PORT}${C.reset}
  ${C.bold}⚙️  Configuração no Cliente (NodeS7 / Node-RED / SCADA):${C.reset}
     - IP: ${C.cyan}127.0.0.1${C.reset} | Porta: ${C.cyan}${PORT}${C.reset} | Rack: ${C.cyan}0${C.reset} | Slot: ${C.cyan}1${C.reset} (ou TSAP 0x0100 / 0x0200)
     - DB Padrão: ${C.cyan}DB1${C.reset} (cobrindo todo o mapa de memória VM)

  ${C.bold}📋 MAPEAMENTO DE BLOCOS DO LOGO! (DB1):${C.reset}
     • ${C.yellow}I${C.reset}   (1024..1031) : Entradas Digitais I1..I64      | Ex: ${C.dim}DB1,X1024.0 ou I1${C.reset}
     • ${C.yellow}AI${C.reset}  (1032..1063) : Entradas Analógicas AI1..AI16  | Ex: ${C.dim}DB1,WORD1032 ou AI1${C.reset}
     • ${C.yellow}Q${C.reset}   (1064..1071) : Saídas Digitais Q1..Q64        | Ex: ${C.dim}DB1,X1064.0 ou Q1${C.reset}
     • ${C.yellow}AQ${C.reset}  (1072..1103) : Saídas Analógicas AQ1..AQ16    | Ex: ${C.dim}DB1,WORD1072 ou AQ1${C.reset}
     • ${C.yellow}M${C.reset}   (1104..1117) : Flags Digitais M1..M112        | Ex: ${C.dim}DB1,X1104.0 ou M1${C.reset}
     • ${C.yellow}AM${C.reset}  (1118..1245) : Flags Analógicas AM1..AM64     | Ex: ${C.dim}DB1,WORD1118 ou AM1${C.reset}
     • ${C.yellow}NI${C.reset}  (1246..1261) : Entradas de Rede NI1..NI128    | Ex: ${C.dim}DB1,X1246.0 (Trava)${C.reset}
     • ${C.yellow}NAI${C.reset} (1262..1389) : Entradas de Rede Analógicas   | Ex: ${C.dim}DB1,WORD1262 ou NAI1${C.reset}
     • ${C.yellow}NQ${C.reset}  (1390..1405) : Saídas de Rede NQ1..NQ128      | Ex: ${C.dim}DB1,X1390.0 ou NQ1${C.reset}
     • ${C.yellow}NAQ${C.reset} (1406..1469) : Saídas de Rede Analógicas     | Ex: ${C.dim}DB1,WORD1406 ou NAQ1${C.reset}

  ${C.bold}⌨️  COMANDOS RÁPIDOS NO CONSOLE (Digite e dê Enter):${C.reset}
     ${C.green}[1]${C.reset} Fechar Porta (I0.1=1)  ${C.green}[0]${C.reset} Abrir Porta (I0.1=0)  ${C.green}[t]${C.reset} Toggle Trava (NI1/DB1,X1246.0)
     ${C.green}[s]${C.reset} Painel de Status       ${C.green}[?]${C.reset} Lista de Comandos    ${C.green}[q]${C.reset} Sair
`);
}

function printHelp() {
    console.log(`
${C.cyan}${C.bold}╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                             📖 MANUAL DE COMANDOS CLI                                 ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝${C.reset}

${C.bold}1. LEITURA E ESCRITA DIRETA DE TAGS:${C.reset}
   • ${C.green}set <tag> <valor>${C.reset}    : Define valor de uma tag digital ou analógica
       Exemplos:
         set I1 1              (Liga entrada digital I1 / DB1,X1024.0)
         set I0.1 0            (Abre a porta / I0.1 = 0)
         set AI1 750           (Define entrada analógica AI1 = 750 / DB1,WORD1032)
         set DB1,X1246.0 1     (Aciona trava de rede NI1)
         set Q1 1              (Liga saída digital Q1)
         set AQ1 500           (Define saída analógica AQ1 = 500)
   • ${C.green}toggle <tag>${C.reset} ou ${C.green}t <tag>${C.reset} : Inverte estado de uma tag digital (0 -> 1 -> 0)
       Exemplos: toggle I1, toggle NI1, toggle Q1
   • ${C.green}get <tag>${C.reset}            : Lê o valor atual de uma tag ou endereço
       Exemplos: get AI1, get DB1,WORD1032, get I0.1, get M1

${C.bold}2. VISUALIZAÇÃO E MONITORAMENTO:${C.reset}
   • ${C.green}status${C.reset} ou ${C.green}s${C.reset}          : Exibe dashboard consolidado de todos os blocos ativos
   • ${C.green}view <bloco>${C.reset}          : Mostra tabela detalhada de um bloco (I, AI, Q, AQ, M, AM, NI, NAI, NQ, NAQ, ALL)
       Exemplos: view I, view AI, view Q, view NI, view all
   • ${C.green}dump [inicio] [tam]${C.reset}   : Exibe Hex Dump dos bytes da memória VM (padrão: 1024 64)
       Exemplo: dump 1024 32
   • ${C.green}watch <tags>${C.reset}          : Monitoramento ao vivo em tempo real de tags separadas por vírgula
       Exemplo: watch I1,I2,AI1,DB1,X1246.0

${C.bold}3. GERADORES DE SINAIS E SIMULAÇÃO DINÂMICA:${C.reset}
   • ${C.green}wave <tag> [min] [max] [periodo_ms]${C.reset} : Gera onda senoidal contínua em tag analógica
       Exemplo: wave AI1 0 1000 5000  (Oscila AI1 entre 0 e 1000 a cada 5s)
   • ${C.green}pulse <tag> [intervalo_ms]${C.reset}          : Gera pulso/clock liga/desliga contínuo
       Exemplo: pulse I1 1000         (Inverte I1 a cada 1 segundo)
   • ${C.green}stopsim <id | all>${C.reset}                 : Para uma ou todas as simulações dinâmicas
       Exemplos: stopsim 1, stopsim all
   • ${C.green}listsim${C.reset}                            : Lista simulações ativas

${C.bold}4. CENÁRIOS E PERSISTÊNCIA:${C.reset}
   • ${C.green}scenario <nome>${C.reset}      : Aplica cenário pré-definido (balanca, esteira, tanque, limpo)
       Exemplo: scenario balanca
   • ${C.green}save [arquivo]${C.reset}       : Salva snapshot da memória VM em JSON (padrão: snapshot_logo.json)
   • ${C.green}load [arquivo]${C.reset}       : Restaura snapshot da memória VM a partir de JSON
   • ${C.green}reset${C.reset}                : Zera todos os 2048 bytes da memória VM

${C.bold}5. ATALHOS DE TECLADO RÁPIDOS:${C.reset}
   [1] -> Porta Fechada (I0.1 = true)
   [0] -> Porta Aberta (I0.1 = false)
   [t] -> Inverter Trava (DB1,X1246.0)
   [s] -> Painel de Status
   [q] -> Sair do Simulador
`);
}

// ── Processador de Comandos do Console (CLI) ──────────────────────────

export function executeCliCommand(inputLine) {
    const raw = inputLine.trim();
    if (!raw) return;

    if (watchInterval) {
        stopWatch();
    }

    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
        // Atalhos de 1 caractere
        if (cmd === '1') {
            writeTagValue('I0.1', 1);
            logSuccess(`Porta: ${C.bold}FECHADA${C.reset} (I0.1 = 1 / I2 = ON)`);
            return;
        }
        if (cmd === '0') {
            writeTagValue('I0.1', 0);
            logWarn(`Porta: ${C.bold}ABERTA${C.reset} (I0.1 = 0 / I2 = OFF)`);
            return;
        }
        if (cmd === 't' && args.length === 0) {
            const current = getVmBit(1246, 0);
            setVmBit(1246, 0, !current);
            const nv = !current;
            logSuccess(`Trava NI1 (DB1,X1246.0): ${nv ? C.green + 'LIBERADA (1)' : C.yellow + 'BLOQUEADA (0)'}${C.reset}`);
            return;
        }
        if (cmd === 's' || cmd === 'status') {
            printStatusOverview();
            return;
        }
        if (cmd === '?' || cmd === 'help' || cmd === 'h' || cmd === 'ajuda') {
            printHelp();
            return;
        }
        if (cmd === 'q' || cmd === 'exit' || cmd === 'quit' || cmd === 'sair') {
            console.log(`\n${C.yellow}👋 Encerrando Simulador Siemens LOGO!... Até logo!${C.reset}\n`);
            process.exit(0);
        }

        // Comandos estruturados
        switch (cmd) {
            case 'set':
            case 'write': {
                if (args.length < 2) {
                    logError(`Uso: set <tag> <valor>  (Ex: set I1 1, set AI1 500, set DB1,X1246.0 1)`);
                    return;
                }
                const tag = args[0];
                const val = args[1];
                const res = writeTagValue(tag, val);
                logSuccess(`Escrita: ${C.cyan}${res.target.name}${C.reset} (${res.target.alias}) = ${C.yellow}${res.value}${C.reset}`);
                break;
            }

            case 'toggle':
            case 't': {
                if (args.length < 1) {
                    logError(`Uso: toggle <tag>  (Ex: toggle I1, toggle NI1, toggle Q2)`);
                    return;
                }
                const tag = args[0];
                const current = readTagValue(tag);
                if (current.target.type !== 'bit') {
                    logError(`Comando toggle suportado apenas para tags booleanas/bits.`);
                    return;
                }
                const newVal = !current.value;
                setVmBit(current.target.byteOff, current.target.bitOff, newVal);
                logSuccess(`Toggle: ${C.cyan}${current.target.name}${C.reset} agora é ${newVal ? C.green + 'ON (1)' : C.dim + 'OFF (0)'}${C.reset}`);
                break;
            }

            case 'get':
            case 'read': {
                if (args.length < 1) {
                    logError(`Uso: get <tag>  (Ex: get AI1, get Q1, get DB1,WORD1032)`);
                    return;
                }
                const tag = args[0];
                const res = readTagValue(tag);
                let valDisplay = res.value;
                if (typeof res.value === 'boolean') {
                    valDisplay = res.value ? `${C.green}● ON (1)${C.reset}` : `${C.dim}○ OFF (0)${C.reset}`;
                } else {
                    valDisplay = `${C.yellow}${res.value}${C.reset}`;
                }
                console.log(`\n 🔎 ${C.bold}Leitura:${C.reset} ${C.cyan}${res.target.name}${C.reset} [${res.target.alias}] = ${valDisplay}\n`);
                break;
            }

            case 'view':
            case 'bloco': {
                const blk = args[0] || 'I';
                printBlockDetails(blk);
                break;
            }

            case 'dump':
            case 'hex': {
                const start = parseInt(args[0] || '1024', 10);
                const len = parseInt(args[1] || '64', 10);
                dumpMemory(start, len);
                break;
            }

            case 'watch':
            case 'monitor': {
                if (args.length < 1) {
                    logError(`Uso: watch <tag1,tag2,...>  (Ex: watch I1,I2,AI1,DB1,X1246.0)`);
                    return;
                }
                const tagList = args.join(',').split(',').map(s => s.trim()).filter(Boolean);
                startWatch(tagList);
                break;
            }

            case 'wave':
            case 'onda': {
                if (args.length < 1) {
                    logError(`Uso: wave <tag_analogica> [min] [max] [periodo_ms]  (Ex: wave AI1 0 1000 5000)`);
                    return;
                }
                const tag = args[0];
                const minV = args[1] !== undefined ? parseFloat(args[1]) : 0;
                const maxV = args[2] !== undefined ? parseFloat(args[2]) : 1000;
                const per = args[3] !== undefined ? parseInt(args[3], 10) : 5000;
                const id = startWaveSimulation(tag, minV, maxV, per);
                logSuccess(`Simulação de Onda #${id} iniciada em ${tag} [${minV}..${maxV}] (${per}ms)`);
                break;
            }

            case 'pulse':
            case 'clock': {
                if (args.length < 1) {
                    logError(`Uso: pulse <tag_digital> [intervalo_ms]  (Ex: pulse I1 1000)`);
                    return;
                }
                const tag = args[0];
                const interval = args[1] !== undefined ? parseInt(args[1], 10) : 1000;
                const id = startPulseSimulation(tag, interval);
                logSuccess(`Simulação de Pulso #${id} iniciada em ${tag} (${interval}ms)`);
                break;
            }

            case 'stopsim':
            case 'stop': {
                if (args.length < 1) {
                    logError(`Uso: stopsim <id | all>`);
                    return;
                }
                const res = stopSimulation(args[0]);
                logSuccess(res);
                break;
            }

            case 'listsim': {
                if (activeSimulations.size === 0) {
                    console.log(`\n ℹ Nenhuma simulação dinâmica ativa no momento.\n`);
                } else {
                    console.log(`\n${C.magenta}${C.bold}⚡ SIMULAÇÕES DINÂMICAS ATIVAS (${activeSimulations.size}):${C.reset}`);
                    for (const [id, sim] of activeSimulations.entries()) {
                        console.log(`   [#${id}] ${sim.info}`);
                    }
                    console.log('');
                }
                break;
            }

            case 'scenario':
            case 'cenario': {
                if (args.length < 1) {
                    logError(`Uso: scenario <balanca | esteira | tanque | limpo>`);
                    return;
                }
                const msg = applyScenario(args[0]);
                logSuccess(msg);
                printStatusOverview();
                break;
            }

            case 'save': {
                const path = args[0] || 'snapshot_logo.json';
                const msg = saveSnapshot(path);
                logSuccess(msg);
                break;
            }

            case 'load': {
                const path = args[0] || 'snapshot_logo.json';
                const msg = loadSnapshot(path);
                logSuccess(msg);
                printStatusOverview();
                break;
            }

            case 'reset': {
                const msg = applyScenario('limpo');
                logSuccess(msg);
                printStatusOverview();
                break;
            }

            default:
                logError(`Comando não reconhecido: "${cmd}". Digite "?" ou "help" para ver a lista de comandos.`);
                break;
        }
    } catch (err) {
        logError(`Erro: ${err.message}`);
    }
}

// ── Inicialização do Servidor e Interface CLI ─────────────────────────

server.listen(PORT, HOST, () => {
    // Configura cenário inicial padrão (Balança Martinrea)
    applyScenario('balanca');

    printBanner();

    // Interface de linha de comando iterativa com Readline
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${C.cyan}LOGO-CLP > ${C.reset}`
    });

    rl.prompt();

    rl.on('line', (line) => {
        executeCliCommand(line);
        if (!watchInterval) {
            rl.prompt();
        }
    });

    rl.on('close', () => {
        console.log(`\n${C.yellow}👋 Simulador encerrado.${C.reset}\n`);
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log(`\n\n${C.yellow}👋 Simulador Siemens LOGO! encerrado com sucesso.${C.reset}`);
    process.exit(0);
});
