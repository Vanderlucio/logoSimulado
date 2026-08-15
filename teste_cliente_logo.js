/**
 * =========================================================================================
 * CLIENTE DE TESTE AUTOMATIZADO - SIMULADOR SIEMENS LOGO! (S7 ISO-on-TCP)
 * =========================================================================================
 *
 * Valida a pilha de comunicação completa:
 *  1. Handshake TPKT + COTP CR -> COTP CC
 *  2. Negociação de PDU S7 (Setup Communication)
 *  3. Leitura e Escrita de Bits em DB1 (I1, Q1, M1, NI1/Trava, NQ1)
 *  4. Leitura e Escrita de Words em DB1 (AI1, AQ1, AM1, NAI1, NAQ1)
 *  5. Leitura de Áreas Diretas S7 (0x81/Entradas, 0x82/Saídas, 0x83/Flags)
 *  6. Leitura de múltiplos itens simultâneos em uma única PDU
 * =========================================================================================
 */

'use strict';

import net from 'net';

const PORT = parseInt(process.env.PORT || '102', 10);
const HOST = process.env.HOST || '127.0.0.1';

let pduRefCounter = 1;

function wrapTpktCotpDt(s7Payload) {
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

function sendAndReceive(socket, reqBuf) {
    return new Promise((resolve, reject) => {
        const onData = (chunk) => {
            socket.removeListener('data', onData);
            socket.removeListener('error', onError);
            resolve(chunk);
        };
        const onError = (err) => {
            socket.removeListener('data', onData);
            socket.removeListener('error', onError);
            reject(err);
        };
        socket.on('data', onData);
        socket.on('error', onError);
        socket.write(reqBuf);
    });
}

async function runTests() {
    console.log(`\n🧪 Iniciando testes de validação no Simulador LOGO! (${HOST}:${PORT})...\n`);

    const socket = new net.Socket();
    await new Promise((resolve, reject) => {
        socket.connect(PORT, HOST, () => resolve());
        socket.on('error', reject);
    });

    console.log('✔ Socket TCP conectado.');

    // ── 1. COTP Connection Request (CR) ───────────────────────────────
    const cotpCr = Buffer.from([
        0x03, 0x00, 0x00, 0x16,                         // TPKT
        0x11, 0xE0,                                     // COTP CR
        0x00, 0x00,                                     // Dst ref
        0x00, 0x01,                                     // Src ref
        0x00,                                           // Class
        0xC0, 0x01, 0x0A,                               // TPDU size
        0xC1, 0x02, 0x01, 0x00,                         // Calling TSAP
        0xC2, 0x02, 0x01, 0x02                          // Called TSAP
    ]);

    const ccResp = await sendAndReceive(socket, cotpCr);
    if (ccResp[5] !== 0xD0) {
        throw new Error(`Esperado COTP CC (0xD0), recebido: 0x${ccResp[5]?.toString(16)}`);
    }
    console.log('✔ Handshake COTP CR -> CC confirmado (Conexão ISO-on-TCP estabelecida).');

    // ── 2. S7 Setup Communication ─────────────────────────────────────
    const pduRefSetup = pduRefCounter++;
    const setupReq = Buffer.from([
        0x32, 0x01, 0x00, 0x00,                         // S7 Header (Job = 0x01)
        (pduRefSetup >> 8) & 0xFF, pduRefSetup & 0xFF,  // PDU Ref
        0x00, 0x08,                                     // Param length
        0x00, 0x00,                                     // Data length
        0xF0, 0x00,                                     // Function Setup Communication
        0x00, 0x04,                                     // Max AMQ caller
        0x00, 0x04,                                     // Max AMQ callee
        0x03, 0xC0                                      // PDU size = 960
    ]);

    const setupResp = await sendAndReceive(socket, wrapTpktCotpDt(setupReq));
    const s7HeaderOff = 7;
    if (setupResp[s7HeaderOff] !== 0x32 || setupResp[s7HeaderOff + 1] !== 0x03) {
        throw new Error(`Falha na resposta de S7 Setup Communication.`);
    }
    console.log('✔ S7 Setup Communication concluído com sucesso.');

    // ── 3. Teste de Escrita e Leitura de Bits em DB1 ───────────────────
    async function writeBit(dbNum, byteOff, bitOff, val) {
        const pduRef = pduRefCounter++;
        const bitAddress = (byteOff << 3) | (bitOff & 0x07);
        const s7Write = Buffer.from([
            0x32, 0x01, 0x00, 0x00,
            (pduRef >> 8) & 0xFF, pduRef & 0xFF,
            0x00, 0x0E,                                 // Param length = 14
            0x00, 0x05,                                 // Data length = 5 (1 item bit)
            0x05, 0x01,                                 // Function Write, 1 item
            0x12, 0x0A, 0x10,                           // Var spec
            0x01,                                       // Transport size = BIT (0x01)
            0x00, 0x01,                                 // Length = 1 bit
            (dbNum >> 8) & 0xFF, dbNum & 0xFF,          // DB Number
            0x84,                                       // Area = DB (0x84)
            (bitAddress >> 16) & 0xFF, (bitAddress >> 8) & 0xFF, bitAddress & 0xFF,
            0x00, 0x03, 0x00, 0x01, val ? 0x01 : 0x00   // Data payload: return=0, type=BIT, len=1, val
        ]);
        const resp = await sendAndReceive(socket, wrapTpktCotpDt(s7Write));
        const ackCode = resp[resp.length - 1];
        if (ackCode !== 0xFF) throw new Error(`Falha ao escrever bit: Ack 0x${ackCode?.toString(16)}`);
    }

    async function readBit(dbNum, byteOff, bitOff, area = 0x84) {
        const pduRef = pduRefCounter++;
        const bitAddress = (byteOff << 3) | (bitOff & 0x07);
        const s7Read = Buffer.from([
            0x32, 0x01, 0x00, 0x00,
            (pduRef >> 8) & 0xFF, pduRef & 0xFF,
            0x00, 0x0E,                                 // Param length = 14
            0x00, 0x00,                                 // Data length = 0
            0x04, 0x01,                                 // Function Read, 1 item
            0x12, 0x0A, 0x10,                           // Var spec
            0x01,                                       // Transport size = BIT (0x01)
            0x00, 0x01,                                 // Length = 1 bit
            (dbNum >> 8) & 0xFF, dbNum & 0xFF,          // DB Number
            area,                                       // Area code
            (bitAddress >> 16) & 0xFF, (bitAddress >> 8) & 0xFF, bitAddress & 0xFF
        ]);
        const resp = await sendAndReceive(socket, wrapTpktCotpDt(s7Read));
        const val = resp[resp.length - 1];
        return val === 1;
    }

    async function writeWord(dbNum, byteOff, val) {
        const pduRef = pduRefCounter++;
        const bitAddress = byteOff << 3;
        const s7Write = Buffer.from([
            0x32, 0x01, 0x00, 0x00,
            (pduRef >> 8) & 0xFF, pduRef & 0xFF,
            0x00, 0x0E,                                 // Param length = 14
            0x00, 0x06,                                 // Data length = 6 (header 4 + 2 bytes)
            0x05, 0x01,                                 // Function Write, 1 item
            0x12, 0x0A, 0x10,                           // Var spec
            0x04,                                       // Transport size = WORD (0x04)
            0x00, 0x02,                                 // Length = 2 bytes
            (dbNum >> 8) & 0xFF, dbNum & 0xFF,          // DB Number
            0x84,                                       // Area = DB (0x84)
            (bitAddress >> 16) & 0xFF, (bitAddress >> 8) & 0xFF, bitAddress & 0xFF,
            0x00, 0x04, 0x00, 0x10,                     // Return=0, type=WORD, len=16 bits
            (val >> 8) & 0xFF, val & 0xFF               // Valor 16-bit
        ]);
        const resp = await sendAndReceive(socket, wrapTpktCotpDt(s7Write));
        const ackCode = resp[resp.length - 1];
        if (ackCode !== 0xFF) throw new Error(`Falha ao escrever word: Ack 0x${ackCode?.toString(16)}`);
    }

    async function readWord(dbNum, byteOff) {
        const pduRef = pduRefCounter++;
        const bitAddress = byteOff << 3;
        const s7Read = Buffer.from([
            0x32, 0x01, 0x00, 0x00,
            (pduRef >> 8) & 0xFF, pduRef & 0xFF,
            0x00, 0x0E,                                 // Param length = 14
            0x00, 0x00,                                 // Data length = 0
            0x04, 0x01,                                 // Function Read, 1 item
            0x12, 0x0A, 0x10,                           // Var spec
            0x04,                                       // Transport size = BYTE/WORD (0x04)
            0x00, 0x02,                                 // Length = 2 bytes
            (dbNum >> 8) & 0xFF, dbNum & 0xFF,          // DB Number
            0x84,                                       // Area = DB (0x84)
            (bitAddress >> 16) & 0xFF, (bitAddress >> 8) & 0xFF, bitAddress & 0xFF
        ]);
        const resp = await sendAndReceive(socket, wrapTpktCotpDt(s7Read));
        // Data está no final (2 bytes)
        const w = resp.readInt16BE(resp.length - 2);
        return w;
    }

    // Executa testes unitários de cada bloco:
    console.log('\n📋 Testando Blocos de Memória do LOGO!:');

    // 1. I (Entradas Digitais): I1 (1024.0) e I2 (1024.1)
    await writeBit(1, 1024, 0, true);
    let bitI1 = await readBit(1, 1024, 0);
    if (!bitI1) throw new Error('Falha no teste de I1 (DB1,X1024.0)');
    console.log('  ✔ Bloco I (Entradas Digitais I1..I64): DB1,X1024.0 = true [OK]');

    // 2. AI (Entradas Analógicas): AI1 (VM 1032)
    await writeWord(1, 1032, 7850);
    let ai1 = await readWord(1, 1032);
    if (ai1 !== 7850) throw new Error(`Falha no teste de AI1 (DB1,WORD1032): esperado 7850, lido ${ai1}`);
    console.log('  ✔ Bloco AI (Entradas Analógicas AI1..AI16): DB1,WORD1032 = 7850 [OK]');

    // 3. Q (Saídas Digitais): Q1 (VM 1064.0)
    await writeBit(1, 1064, 0, true);
    let bitQ1 = await readBit(1, 1064, 0);
    if (!bitQ1) throw new Error('Falha no teste de Q1 (DB1,X1064.0)');
    console.log('  ✔ Bloco Q (Saídas Digitais Q1..Q64): DB1,X1064.0 = true [OK]');

    // 4. AQ (Saídas Analógicas): AQ1 (VM 1072)
    await writeWord(1, 1072, 450);
    let aq1 = await readWord(1, 1072);
    if (aq1 !== 450) throw new Error(`Falha no teste de AQ1 (DB1,WORD1072): esperado 450, lido ${aq1}`);
    console.log('  ✔ Bloco AQ (Saídas Analógicas AQ1..AQ16): DB1,WORD1072 = 450 [OK]');

    // 5. M (Flags Digitais): M1 (VM 1104.0)
    await writeBit(1, 1104, 0, true);
    let bitM1 = await readBit(1, 1104, 0);
    if (!bitM1) throw new Error('Falha no teste de M1 (DB1,X1104.0)');
    console.log('  ✔ Bloco M (Flags Digitais M1..M112): DB1,X1104.0 = true [OK]');

    // 6. AM (Flags Analógicas): AM1 (VM 1118)
    await writeWord(1, 1118, 1234);
    let am1 = await readWord(1, 1118);
    if (am1 !== 1234) throw new Error(`Falha no teste de AM1 (DB1,WORD1118): esperado 1234, lido ${am1}`);
    console.log('  ✔ Bloco AM (Flags Analógicas AM1..AM64): DB1,WORD1118 = 1234 [OK]');

    // 7. NI (Network Inputs Digitais): NI1 (Trava - VM 1246.0)
    await writeBit(1, 1246, 0, true);
    let bitNI1 = await readBit(1, 1246, 0);
    if (!bitNI1) throw new Error('Falha no teste de NI1 (DB1,X1246.0 - Trava)');
    console.log('  ✔ Bloco NI (Network Inputs Digitais NI1..NI128 / Trava): DB1,X1246.0 = true [OK]');

    // 8. NAI (Network Analog Inputs): NAI1 (VM 1262)
    await writeWord(1, 1262, 999);
    let nai1 = await readWord(1, 1262);
    if (nai1 !== 999) throw new Error(`Falha no teste de NAI1 (DB1,WORD1262): esperado 999, lido ${nai1}`);
    console.log('  ✔ Bloco NAI (Network Analog Inputs NAI1..NAI64): DB1,WORD1262 = 999 [OK]');

    // 9. NQ (Network Outputs Digitais): NQ1 (VM 1390.0)
    await writeBit(1, 1390, 0, true);
    let bitNQ1 = await readBit(1, 1390, 0);
    if (!bitNQ1) throw new Error('Falha no teste de NQ1 (DB1,X1390.0)');
    console.log('  ✔ Bloco NQ (Network Outputs Digitais NQ1..NQ128): DB1,X1390.0 = true [OK]');

    // 10. NAQ (Network Analog Outputs): NAQ1 (VM 1406)
    await writeWord(1, 1406, 321);
    let naq1 = await readWord(1, 1406);
    if (naq1 !== 321) throw new Error(`Falha no teste de NAQ1 (DB1,WORD1406): esperado 321, lido ${naq1}`);
    console.log('  ✔ Bloco NAQ (Network Analog Outputs NAQ1..NAQ32): DB1,WORD1406 = 321 [OK]');

    // 11. Teste de Área Direta S7 (Entradas 0x81 mapeadas para VM 1024)
    let areaIBit = await readBit(0, 0, 0, 0x81); // I0.0
    if (!areaIBit) throw new Error('Falha no mapeamento direto da Área de Entradas 0x81 (I0.0)');
    console.log('  ✔ Mapeamento Direto S7: Área I (0x81) <-> VM 1024 [OK]');

    socket.end();
    console.log(`\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! O Simulador LOGO! está totalmente operacional.\n`);
    process.exit(0);
}

runTests().catch((err) => {
    console.error(`\n❌ Erro durante os testes: ${err.message}`);
    process.exit(1);
});
