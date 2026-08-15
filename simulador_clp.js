/**
 * =====================================================================
 * SIMULADOR CLP SIEMENS S7 - Balança Martinrea
 * =====================================================================
 * Simula um CLP Siemens S7-300/400 no protocolo ISO-on-TCP (porta 102).
 * Compatibilidade total com a biblioteca NodeS7.
 *
 * COMO USAR:
 *   1. Execute este script: node simulador_clp.js
 *   2. No app, nas Configurações → CLP, configure:
 *        IP: 127.0.0.1
 *        Porta: 102
 *        Rack: 0
 *        Slot: 1 (ou 2)
 *        Salvar
 *   3. O app vai conectar automaticamente e mostrar o status do CLP.
 *
 * TAGS SIMULADAS (conforme clp_config.json):
 *   I0.1          → Porta Fechada  (Entrada)
 *   DB1,X1246.0   → Destrava/Trava (Saída)
 *
 * COMANDOS NO CONSOLE:
 *   [1] + Enter → Porta FECHADA (I0.1 = true)
 *   [0] + Enter → Porta ABERTA  (I0.1 = false)
 *   [t] + Enter → Toggle Trava  (DB1,X1246.0)
 *   [s] + Enter → Ver estado atual
 * =====================================================================
 */

'use strict';
import net from 'net';

const PORT = 102;
const HOST = '0.0.0.0';

// ── Estado do CLP simulado ─────────────────────────────────────────
export const state = {
    'I0.1': true,           // Porta fechada (true = fechada)
    'DB1,X1246.0': false,   // Trava (false = bloqueada)
};

// ── Helpers de log ─────────────────────────────────────────────────
function ts() { return new Date().toLocaleTimeString('pt-BR'); }
function log(msg)  { console.log(`[${ts()}] ${msg}`); }
function info(msg) { console.log(`\n${'═'.repeat(60)}\n  ${msg}\n${'═'.repeat(60)}`); }

/** Empacota payload S7 dentro de TPKT + COTP DT (0xF0, EOT=0x80) */
function wrapTpktCotpDt(s7Payload) {
    const totalLen = 4 + 3 + s7Payload.length;
    const buf = Buffer.alloc(totalLen);
    // TPKT
    buf[0] = 0x03;
    buf[1] = 0x00;
    buf.writeUInt16BE(totalLen, 2);
    // COTP DT (len=2, type=F0, EOT=80)
    buf[4] = 0x02;
    buf[5] = 0xF0;
    buf[6] = 0x80;
    s7Payload.copy(buf, 7);
    return buf;
}

/** Monta cabeçalho S7 Ack_Data (12 bytes) */
function s7ResponseHeader(pduRef, paramLen, dataLen) {
    const h = Buffer.alloc(12);
    h[0] = 0x32;                  // Protocol ID S7
    h[1] = 0x03;                  // ROSCTR = Ack_Data
    h[2] = 0x00; h[3] = 0x00;     // Redundancy ID
    h.writeUInt16BE(pduRef, 4);   // PDU Reference
    h.writeUInt16BE(paramLen, 6); // Param length
    h.writeUInt16BE(dataLen, 8);  // Data length
    h[10] = 0x00; h[11] = 0x00;   // Error class / Error code = 0 (Success)
    return h;
}

/** Retorna o byte correspondente para a tag/área lida */
function getByteValue(area, dbNum, byteOff) {
    // Área de Entradas (I / 0x81)
    if (area === 0x81) {
        if (byteOff === 0) {
            // Bit 1 = Porta Fechada (I0.1)
            return state['I0.1'] ? 0x02 : 0x00;
        }
        return 0x00;
    }
    // Área de DB (0x84)
    if (area === 0x84) {
        if (dbNum === 1 && byteOff === 1246) {
            // Bit 0 = Trava (DB1,X1246.0)
            return state['DB1,X1246.0'] ? 0x01 : 0x00;
        }
        return 0x00;
    }
    // Flags / Merker (0x83) ou Saídas (0x82)
    return 0x00;
}

// ── Servidor TCP ───────────────────────────────────────────────────
const server = net.createServer((socket) => {
    const client = `${socket.remoteAddress}:${socket.remotePort}`;
    log(`✅ App conectado: ${client}`);

    let rxBuf = Buffer.alloc(0);

    socket.on('data', (chunk) => {
        rxBuf = Buffer.concat([rxBuf, chunk]);

        while (rxBuf.length >= 4) {
            if (rxBuf[0] !== 0x03) {
                log(`⚠️ Byte inesperado 0x${rxBuf[0].toString(16)} — descartando buffer`);
                rxBuf = Buffer.alloc(0);
                break;
            }

            const pktLen = rxBuf.readUInt16BE(2);
            if (rxBuf.length < pktLen) break; // Aguarda pacote completo

            const pkt = rxBuf.slice(0, pktLen);
            rxBuf = rxBuf.slice(pktLen);

            const cotpType = pkt[5];

            // ── COTP Connection Request (CR = 0xE0) ───────────────
            if (cotpType === 0xE0) {
                log('📥 COTP CR (Connection Request) recebido');
                const srcRef = pkt.readUInt16BE(8);
                // Resposta COTP CC completa de 22 bytes conforme especificação ISO 8073
                const cc = Buffer.from([
                    0x03, 0x00, 0x00, 0x16,                         // TPKT (len = 22)
                    0x11, 0xD0,                                     // COTP CC (len = 17 = 22 - 5)
                    0x00, 0x01,                                     // dst ref
                    (srcRef >> 8) & 0xFF, srcRef & 0xFF,            // src ref (eco)
                    0x00,                                           // class
                    0xC0, 0x01, 0x0A,                               // TPDU size (1024)
                    0xC1, 0x02, 0x01, 0x00,                         // Calling TSAP
                    0xC2, 0x02, 0x01, 0x02                          // Called TSAP
                ]);
                socket.write(cc);
                log('📤 COTP CC (Connection Confirm, 22 bytes) enviado');
                continue;
            }

            // ── COTP DT (Data = 0xF0) ────────────────────────────
            if (cotpType === 0xF0) {
                const s7 = 7; // Início do cabeçalho S7

                if (pkt.length < s7 + 10) continue;
                if (pkt[s7] !== 0x32) continue; // S7 Protocol ID

                const pduRef = pkt.readUInt16BE(s7 + 4);
                const func   = pkt[s7 + 10];

                // ── S7 Setup Communication (Negotiate PDU = 0xF0) ─
                if (func === 0xF0) {
                    log('📥 S7 Setup Communication Request');
                    const setupPayload = Buffer.from([
                        0x32, 0x03, 0x00, 0x00,                     // S7 Header
                        (pduRef >> 8) & 0xFF, pduRef & 0xFF,        // PDU ref eco
                        0x00, 0x08,                                 // Param length = 8
                        0x00, 0x00,                                 // Data length = 0
                        0x00, 0x00,                                 // Error = 0
                        0xF0, 0x00,                                 // Function & reserved
                        0x00, 0x03,                                 // Max AMQ calling = 3
                        0x00, 0x03,                                 // Max AMQ called = 3
                        0x03, 0xC0                                  // PDU length = 960
                    ]);
                    socket.write(wrapTpktCotpDt(setupPayload));
                    log('📤 S7 Setup Communication Response enviado');
                    log(`\n  🟢 Status Atual CLP: Porta=${state['I0.1'] ? 'FECHADA (1)' : 'ABERTA (0)'} | Trava=${state['DB1,X1246.0'] ? 'LIBERADA (1)' : 'BLOQUEADA (0)'}`);
                    continue;
                }

                // ── S7 Read Variable (Function = 0x04) ────────────
                if (func === 0x04) {
                    const itemCount = pkt[s7 + 11];
                    let off = s7 + 12;
                    const dataItems = [];
                    const logLines = [];

                    for (let i = 0; i < itemCount && off + 12 <= pkt.length; i++) {
                        const dbNum   = pkt.readUInt16BE(off + 6);
                        const area    = pkt[off + 8];
                        const bitRaw  = (pkt[off + 9] << 16) | (pkt[off + 10] << 8) | pkt[off + 11];
                        const byteOff = bitRaw >> 3;
                        const bitOff  = bitRaw & 0x07;

                        const val = getByteValue(area, dbNum, byteOff);

                        // Formata item de dados S7 (Return code 0xFF = OK, Transport 0x04 = BYTE, 8 bits)
                        const itemBuf = Buffer.from([0xFF, 0x04, 0x00, 0x08, val]);
                        
                        // S7 requer alinhamento par com byte de preenchimento (filler) se o tamanho for ímpar e não for o último
                        if (i < itemCount - 1 && (itemBuf.length % 2 !== 0)) {
                            dataItems.push(Buffer.concat([itemBuf, Buffer.from([0x00])]));
                        } else {
                            dataItems.push(itemBuf);
                        }

                        const areaName = area === 0x81 ? `I${byteOff}.${bitOff}` :
                                         area === 0x84 ? `DB${dbNum},X${byteOff}.${bitOff}` :
                                         `Area(0x${area.toString(16)})`;
                        const bitVal = (val >> bitOff) & 0x01;
                        logLines.push(`   ${areaName} = ${bitVal === 1}`);
                        off += 12;
                    }

                    log(`📥 S7 Read (${itemCount} tags):\n${logLines.join('\n')}`);

                    const dataSection = Buffer.concat(dataItems);
                    const paramSection = Buffer.from([0x04, itemCount]);
                    const s7Resp = Buffer.concat([
                        s7ResponseHeader(pduRef, paramSection.length, dataSection.length),
                        paramSection,
                        dataSection
                    ]);
                    socket.write(wrapTpktCotpDt(s7Resp));
                    continue;
                }

                // ── S7 Write Variable (Function = 0x05) ───────────
                if (func === 0x05) {
                    const itemCount = pkt[s7 + 11];
                    log(`📥 S7 Write Variable (${itemCount} item(s))`);

                    let off = s7 + 12;
                    for (let i = 0; i < itemCount && off + 12 <= pkt.length; i++) {
                        const area    = pkt[off + 8];
                        const dbNum   = pkt.readUInt16BE(off + 6);
                        const bitRaw  = (pkt[off + 9] << 16) | (pkt[off + 10] << 8) | pkt[off + 11];
                        const byteOff = bitRaw >> 3;
                        const bitOff  = bitRaw & 0x07;
                        
                        // Atualiza estado se for a trava
                        if (area === 0x84 && dbNum === 1 && byteOff === 1246 && bitOff === 0) {
                            state['DB1,X1246.0'] = true;
                            log(`   → Trava DB1,X1246.0 acionada`);
                        }
                        off += 12;
                    }

                    const ackItems = Buffer.alloc(itemCount, 0xFF); // 0xFF = Success
                    const paramSection = Buffer.from([0x05, itemCount]);
                    const s7Resp = Buffer.concat([
                        s7ResponseHeader(pduRef, paramSection.length, ackItems.length),
                        paramSection,
                        ackItems
                    ]);
                    socket.write(wrapTpktCotpDt(s7Resp));
                    continue;
                }
            }
        }
    });

    socket.on('error', (e) => log(`⚠️ Erro no socket: ${e.message}`));
    socket.on('close', () => log(`🔌 App desconectado: ${client}`));
});

server.on('error', (err) => {
    console.error(`\n❌ Erro no simulador: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
        console.error(`   A porta ${PORT} já está em uso por outro processo.`);
    }
    process.exit(1);
});

server.listen(PORT, HOST, () => {
    info('🏭 SIMULADOR CLP SIEMENS S7 - Balança Martinrea');
    console.log(`  Escutando em: 0.0.0.0:${PORT}`);
    console.log('');
    console.log('  ⚙️  CONFIGURAÇÃO NO APP:');
    console.log('  Configurações → CLP → IP: 127.0.0.1 | Porta: 102 → Salvar');
    console.log('');
    console.log('  ESTADO INICIAL:');
    console.log(`  ▶ I0.1        = true  → Porta FECHADA`);
    console.log(`  ▶ DB1,X1246.0 = false → Trava BLOQUEADA`);
    console.log('');
    console.log('  COMANDOS (digite e pressione Enter):');
    console.log('  [1] → Porta FECHADA  | [0] → Porta ABERTA');
    console.log('  [t] → Toggle Trava   | [s] → Ver estado');
    console.log(`${'═'.repeat(60)}\n`);
});

// ── Controle interativo via teclado ───────────────────────────────
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (raw) => {
    const cmd = raw.trim().toLowerCase();
    switch(cmd) {
        case '1':
            state['I0.1'] = true;
            log('✅ Porta: FECHADA (I0.1 = true)');
            break;
        case '0':
            state['I0.1'] = false;
            log('⚠️  Porta: ABERTA (I0.1 = false)');
            break;
        case 't':
            state['DB1,X1246.0'] = !state['DB1,X1246.0'];
            log(`🔄 Trava: ${state['DB1,X1246.0'] ? 'LIBERADA' : 'BLOQUEADA'} (DB1,X1246.0 = ${state['DB1,X1246.0']})`);
            break;
        case 's':
            log(`📊 Estado: Porta=${state['I0.1'] ? 'FECHADA' : 'ABERTA'} | Trava=${state['DB1,X1246.0'] ? 'LIBERADA' : 'BLOQUEADA'}`);
            break;
        default:
            log(`❓ Comando desconhecido: '${cmd}'. Use: 1, 0, t, s`);
    }
});

process.on('SIGINT', () => {
    console.log('\n\n👋 Simulador CLP encerrado.');
    process.exit(0);
});
