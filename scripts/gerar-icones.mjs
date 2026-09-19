// Gera ícones PWA placeholder (fundo sólido + "R$") sem dependências externas.
// Escreve PNGs manualmente via zlib, sem lib de canvas.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const PRIMARY = [37, 99, 235]; // #2563eb
const WHITE = [255, 255, 255];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Desenha um "R$" bem simples como blocos de pixel (fonte bitmap 5x7 minimalista).
const GLYPHS = {
  R: [
    '1110',
    '1001',
    '1001',
    '1110',
    '1010',
    '1001',
    '1001',
  ],
  $: [
    '0110',
    '1111',
    '1100',
    '0110',
    '0011',
    '1111',
    '0110',
  ],
};

function buildPixels(size) {
  const px = new Array(size * size).fill(0); // 0 = primary bg, 1 = white glyph
  const glyphs = ['R', '$'];
  const scale = Math.floor(size / 14);
  const glyphW = 4 * scale;
  const glyphH = 7 * scale;
  const gap = Math.floor(scale * 1.5);
  const totalW = glyphW * 2 + gap;
  const startX = Math.floor((size - totalW) / 2);
  const startY = Math.floor((size - glyphH) / 2);

  glyphs.forEach((g, gi) => {
    const rows = GLYPHS[g];
    const offsetX = startX + gi * (glyphW + gap);
    for (let ry = 0; ry < rows.length; ry++) {
      for (let rx = 0; rx < rows[ry].length; rx++) {
        if (rows[ry][rx] === '1') {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const x = offsetX + rx * scale + sx;
              const y = startY + ry * scale + sy;
              if (x >= 0 && x < size && y >= 0 && y < size) px[y * size + x] = 1;
            }
          }
        }
      }
    }
  });
  return px;
}

function makePng(size) {
  const pixels = buildPixels(size);
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const isGlyph = pixels[y * size + x] === 1;
      const [r, g, b] = isGlyph ? WHITE : PRIMARY;
      const o = rowStart + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const idat = deflateSync(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(new URL('../public/icon-192.png', import.meta.url), makePng(192));
writeFileSync(new URL('../public/icon-512.png', import.meta.url), makePng(512));
writeFileSync(new URL('../public/favicon.png', import.meta.url), makePng(48));
console.log('Ícones gerados em public/: icon-192.png, icon-512.png, favicon.png');
