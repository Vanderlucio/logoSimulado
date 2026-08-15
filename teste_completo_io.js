/**
 * =========================================================================================
 * TESTE EXAUSTIVO DE TODAS AS ENTRADAS, SAÍDAS E MEMÓRIAS DO LOGO!
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

async function run() {
    console.log(`\n🧪 Executando teste exaustivo de I/O no Simulador (${HOST}:${PORT})...\n`);

    const socket = new net.Socket();
    await new Promise((resolve, reject) => {
        socket.connect(PORT, HOST, () => resolve());
        socket.on('error', reject);
    });

    // COTP Handshake
    const cotpCr = Buffer.from([
        0x03, 0x00, 0x00, 0x16, 0x11, 0xE0, 0x00, 0x00, 0x00, 0x01, 0x00,
        0xC0, 0x01, 0x0A, 0xC1, 0x02, 0x01, 0x00, 0xC2, 0x02, 0x01, 0x02
    ]);
    const ccResp = await sendAndReceive(socket, cotpCr);
    if (ccResp[5] !== 0xD0) throw new Error('Falha no COTP CC');

    // S7 Setup Communication
    const pRefSetup = pduRefCounter++;
    const setupReq = Buffer.from([
        0x32, 0x01, 0x00, 0x00, (pRefSetup >> 8) & 0xFF, pRefSetup & 0xFF,
        0x00, 0x08, 0x00, 0x00, 0xF0, 0x00, 0x00, 0x04, 0x00, 0x04, 0x03, 0xC0
    ]);
    await sendAndReceive(socket, wrapTpktCotpDt(setupReq));

    async function writeBit(dbNum, byteOff, bitOff, val) {
        const pRef = pduRefCounter++;
        const bitAddress = (byteOff << 3) | (bitOff & 0x07);
        const req = Buffer.from([
            0x32, 0x01, 0x00, 0x00, (pRef >> 8) & 0xFF, pRef & 0xFF,
            0x00, 0x0E, 0x00, 0x05, 0x05, 0x01, 0x12, 0x0A, 0x10,
            0x01, 0x00, 0x01, (dbNum >> 8) & 0xFF, dbNum & 0xFF, 0x84,
            (bitAddress >> 16) & 0xFF, (bitAddress >> 8) & 0xFF, bitAddress & 0xFF,
            0x00, 0x03, 0x00, 0x01, val ? 0x01 : 0x00
        ]);
        const resp = await sendAndReceive(socket, wrapTpktCotpDt(req));
        if (resp[resp.length - 1] !== 0xFF) throw new Error(`Falha ao gravar bit DB${dbNum},X${byteOff}.${bitOff}`);
    }

    async function readBit(dbNum, byteOff, bitOff) {
        const pRef = pduRefCounter++;
        const bitAddress = (byteOff << 3) | (bitOff & 0x07);
        const req = Buffer.from([
            0x32, 0x01, 0x00, 0x00, (pRef >> 8) & 0xFF, pRef & 0xFF,
            0x00, 0x0E, 0x00, 0x00, 0x04, 0x01, 0x12, 0x0A, 0x10,
            0x01, 0x00, 0x01, (dbNum >> 8) & 0xFF, dbNum & 0xFF, 0x84,
            (bitAddress >> 16) & 0xFF, (bitAddress >> 8) & 0xFF, bitAddress & 0xFF
        ]);
        const resp = await sendAndReceive(socket, wrapTpktCotpDt(req));
        return resp[resp.length - 1] === 1;
    }

    console.log('▶ Testando TODAS as entradas digitais I1 até I16:');
    for (let i = 1; i <= 16; i++) {
        const zeroIdx = i - 1;
        const byteOff = 1024 + Math.floor(zeroIdx / 8);
        const bitOff = zeroIdx % 8;

        // Escreve 1
        await writeBit(1, byteOff, bitOff, true);
        let val = await readBit(1, byteOff, bitOff);
        if (!val) throw new Error(`Falha no bit I${i} (DB1,X${byteOff}.${bitOff}) = true`);

        // Escreve 0
        await writeBit(1, byteOff, bitOff, false);
        val = await readBit(1, byteOff, bitOff);
        if (val) throw new Error(`Falha no bit I${i} (DB1,X${byteOff}.${bitOff}) = false`);

        process.stdout.write(`  I${i}: OK `);
    }
    console.log('\n✔ Todas as entradas I1..I16 testadas com sucesso!');

    console.log('\n▶ Testando TODAS as saídas digitais Q1 até Q16:');
    for (let i = 1; i <= 16; i++) {
        const zeroIdx = i - 1;
        const byteOff = 1064 + Math.floor(zeroIdx / 8);
        const bitOff = zeroIdx % 8;

        await writeBit(1, byteOff, bitOff, true);
        let val = await readBit(1, byteOff, bitOff);
        if (!val) throw new Error(`Falha no bit Q${i} (DB1,X${byteOff}.${bitOff}) = true`);

        await writeBit(1, byteOff, bitOff, false);
        val = await readBit(1, byteOff, bitOff);
        if (val) throw new Error(`Falha no bit Q${i} (DB1,X${byteOff}.${bitOff}) = false`);

        process.stdout.write(`  Q${i}: OK `);
    }
    console.log('\n✔ Todas as saídas Q1..Q16 testadas com sucesso!');

    console.log('\n▶ Testando entradas de rede NI1 até NI16:');
    for (let i = 1; i <= 16; i++) {
        const zeroIdx = i - 1;
        const byteOff = 1246 + Math.floor(zeroIdx / 8);
        const bitOff = zeroIdx % 8;

        await writeBit(1, byteOff, bitOff, true);
        let val = await readBit(1, byteOff, bitOff);
        if (!val) throw new Error(`Falha no bit NI${i} (DB1,X${byteOff}.${bitOff})`);

        await writeBit(1, byteOff, bitOff, false);
        val = await readBit(1, byteOff, bitOff);
        if (val) throw new Error(`Falha no bit NI${i} (DB1,X${byteOff}.${bitOff}) desligado`);

        process.stdout.write(`  NI${i}: OK `);
    }
    console.log('\n✔ Todas as entradas de rede NI1..NI16 testadas com sucesso!');

    socket.end();
    console.log(`\n🎉 TESTE EXAUSTIVO DE TODAS AS ENTRADAS E SAÍDAS CONCLUÍDO COM 100% DE SUCESSO!\n`);
}

run().catch((err) => {
    console.error(`\n✖ Erro nos testes: ${err.message}`);
    process.exit(1);
});
