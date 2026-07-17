// musicSdk/crypto-shim.ts - 加密适配层
// 不依赖 npm crypto-js (其内部 require('crypto') 会被 plugin-builder 拦截)
// 纯 JS 实现 + 宿主 polyfill

// ============ MD5 纯 JS 实现 ============

function md5cycle(x: number[], k: number[]): void {
  let a = x[0], b = x[1], c = x[2], d = x[3];
  a = ff(a, b, c, d, k[0], 7, -680876936);
  d = ff(d, a, b, c, k[1], 12, -389564586);
  c = ff(c, d, a, b, k[2], 17, 606105819);
  b = ff(b, c, d, a, k[3], 22, -1044525330);
  a = ff(a, b, c, d, k[4], 7, -176418897);
  d = ff(d, a, b, c, k[5], 12, 1200080426);
  c = ff(c, d, a, b, k[6], 17, -1473231341);
  b = ff(b, c, d, a, k[7], 22, -45705983);
  a = ff(a, b, c, d, k[8], 7, 1770035416);
  d = ff(d, a, b, c, k[9], 12, -1958414417);
  c = ff(c, d, a, b, k[10], 17, -42063);
  b = ff(b, c, d, a, k[11], 22, -1990404162);
  a = ff(a, b, c, d, k[12], 7, 1804603682);
  d = ff(d, a, b, c, k[13], 12, -40341101);
  c = ff(c, d, a, b, k[14], 17, -1502002290);
  b = ff(b, c, d, a, k[15], 22, 1236535329);
  a = gg(a, b, c, d, k[1], 5, -165796510);
  d = gg(d, a, b, c, k[6], 9, -1069501632);
  c = gg(c, d, a, b, k[11], 14, 643717713);
  b = gg(b, c, d, a, k[0], 20, -373897302);
  a = gg(a, b, c, d, k[5], 5, -701558691);
  d = gg(d, a, b, c, k[10], 9, 38016083);
  c = gg(c, d, a, b, k[15], 14, -660478335);
  b = gg(b, c, d, a, k[4], 20, -405537848);
  a = gg(a, b, c, d, k[9], 5, 568446438);
  d = gg(d, a, b, c, k[14], 9, -1019803690);
  c = gg(c, d, a, b, k[3], 14, -187363961);
  b = gg(b, c, d, a, k[8], 20, 1163531501);
  a = gg(a, b, c, d, k[13], 5, -1444681467);
  d = gg(d, a, b, c, k[2], 9, -51403784);
  c = gg(c, d, a, b, k[7], 14, 1735328473);
  b = gg(b, c, d, a, k[12], 20, -1926607734);
  a = hh(a, b, c, d, k[5], 4, -378558);
  d = hh(d, a, b, c, k[8], 11, -2022574463);
  c = hh(c, d, a, b, k[11], 16, 1839030562);
  b = hh(b, c, d, a, k[14], 23, -35309556);
  a = hh(a, b, c, d, k[1], 4, -1530992060);
  d = hh(d, a, b, c, k[4], 11, 1272893353);
  c = hh(c, d, a, b, k[7], 16, -155497632);
  b = hh(b, c, d, a, k[10], 23, -1094730640);
  a = hh(a, b, c, d, k[13], 4, 681279174);
  d = hh(d, a, b, c, k[0], 11, -358537222);
  c = hh(c, d, a, b, k[3], 16, -722521979);
  b = hh(b, c, d, a, k[6], 23, 76029189);
  a = hh(a, b, c, d, k[9], 4, -640364487);
  d = hh(d, a, b, c, k[12], 11, -421815835);
  c = hh(c, d, a, b, k[15], 16, 530742520);
  b = hh(b, c, d, a, k[2], 23, -995338651);
  a = ii(a, b, c, d, k[0], 6, -198630844);
  d = ii(d, a, b, c, k[7], 10, 1126891415);
  c = ii(c, d, a, b, k[14], 15, -1416354905);
  b = ii(b, c, d, a, k[5], 21, -57434055);
  a = ii(a, b, c, d, k[12], 6, 1700485571);
  d = ii(d, a, b, c, k[3], 10, -1894986606);
  c = ii(c, d, a, b, k[10], 15, -1051523);
  b = ii(b, c, d, a, k[1], 21, -2054922799);
  a = ii(a, b, c, d, k[8], 6, 1873313359);
  d = ii(d, a, b, c, k[15], 10, -30611744);
  c = ii(c, d, a, b, k[6], 15, -1560198380);
  b = ii(b, c, d, a, k[13], 21, 1309151649);
  a = ii(a, b, c, d, k[4], 6, -145523070);
  d = ii(d, a, b, c, k[11], 10, -1120210379);
  c = ii(c, d, a, b, k[2], 15, 718787259);
  b = ii(b, c, d, a, k[9], 21, -343485551);
  x[0] = add32(a, x[0]);
  x[1] = add32(b, x[1]);
  x[2] = add32(c, x[2]);
  x[3] = add32(d, x[3]);
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  a = add32(add32(a, q), add32(x, t));
  return add32((a << s) | (a >>> (32 - s)), b);
}
function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(b ^ c ^ d, a, b, x, s, t);
}
function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(c ^ (b | (~d)), a, b, x, s, t);
}

function add32(a: number, b: number): number {
  return (a + b) & 0xFFFFFFFF;
}

function md5blk(s: string): number[] {
  const md5blks: number[] = [];
  for (let i = 0; i < 64; i += 4) {
    md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
  }
  return md5blks;
}

function rhex(n: number): string {
  const hexChr = '0123456789abcdef';
  let s = '';
  for (let j = 0; j < 4; j++) {
    s += hexChr.charAt((n >> (j * 8 + 4)) & 0x0F) + hexChr.charAt((n >> (j * 8)) & 0x0F);
  }
  return s;
}

function hex(x: number[]): string {
  return x.map(rhex).join('');
}

function md5str(s: string): string {
  const n = s.length;
  let state = [1732584193, -271733879, -1732584194, 271733878];
  let i: number;
  for (i = 64; i <= n; i += 64) {
    md5cycle(state, md5blk(s.substring(i - 64, i)));
  }
  s = s.substring(i - 64);
  const tail = new Array(16).fill(0);
  for (i = 0; i < s.length; i++) {
    tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
  }
  tail[i >> 2] |= 0x80 << ((i % 4) << 3);
  if (i > 55) {
    md5cycle(state, tail);
    for (i = 0; i < 16; i++) tail[i] = 0;
  }
  tail[14] = n * 8;
  md5cycle(state, tail);
  return hex(state);
}

// ============ 宿主 polyfill 优先 + 纯 JS fallback ============

export function md5(data: string): string {
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).md5) {
      return (crypto as any).md5(data);
    }
  } catch { /* fallback */ }
  return md5str(data);
}

// ============ SHA-1 纯 JS ============

function sha1str(msg: string): string {
  function rotateLeft(n: number, s: number) { return (n << s) | (n >>> (32 - s)); }
  function toHexStr(arr: number[]): string {
    return arr.map(v => v.toString(16).padStart(8, '0')).join('');
  }

  let H0 = 0x67452301, H1 = 0xEFCDAB89, H2 = 0x98BADCFE, H3 = 0x10325476, H4 = 0xC3D2E1F0;
  const msgLen = msg.length;
  const words: number[] = [];
  for (let i = 0; i < msgLen - 3; i += 4) {
    words[i >> 2] = msg.charCodeAt(i) << 24 | msg.charCodeAt(i + 1) << 16 | msg.charCodeAt(i + 2) << 8 | msg.charCodeAt(i + 3);
  }
  words[msgLen >> 2] |= 0x80 << (24 - (msgLen % 4) * 8);
  words[(((msgLen + 8) >> 6) << 4) + 15] = msgLen * 8;

  for (let offset = 0; offset < words.length; offset += 16) {
    const w = new Array(80);
    for (let i = 0; i < 16; i++) w[i] = words[offset + i];
    for (let i = 16; i < 80; i++) w[i] = rotateLeft(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);

    let a = H0, b = H1, c = H2, d = H3, e = H4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      const temp = rotateLeft(a, 5) + f + e + k + w[i];
      e = d; d = c; c = rotateLeft(b, 30); b = a; a = temp;
    }
    H0 += a; H1 += b; H2 += c; H3 += d; H4 += e;
  }
  return toHexStr([H0, H1, H2, H3, H4]);
}

export function sha1(data: string): string {
  return sha1str(data);
}

// ============ Base64 ============

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export function base64Encode(data: string): string {
  let o = '';
  for (let i = 0; i < data.length; i += 3) {
    const b0 = data.charCodeAt(i), b1 = data.charCodeAt(i + 1), b2 = data.charCodeAt(i + 2);
    o += B64.charAt(b0 >> 2) + B64.charAt(((b0 & 3) << 4) | (b1 >> 4)) +
      (isNaN(b1) ? '=' : B64.charAt(((b1 & 15) << 2) | (b2 >> 6))) +
      (isNaN(b1) ? '=' : isNaN(b2) ? '=' : B64.charAt(b2 & 63));
  }
  return o;
}

export function base64Decode(data: string): string {
  let o = '';
  for (let i = 0; i < data.length; i += 4) {
    const b0 = B64.indexOf(data.charAt(i)), b1 = B64.indexOf(data.charAt(i + 1));
    const b2 = B64.indexOf(data.charAt(i + 2)), b3 = B64.indexOf(data.charAt(i + 3));
    o += String.fromCharCode((b0 << 2) | (b1 >> 4));
    if (b2 !== -1 && b2 !== 64) o += String.fromCharCode(((b1 & 15) << 4) | (b2 >> 2));
    if (b3 !== -1 && b3 !== 64) o += String.fromCharCode(((b2 & 3) << 6) | b3);
  }
  return o;
}

// ============ AES (CBC/ECB, PKCS7, 128-bit key) ============

export function aesEncrypt(
  data: string,
  key: string,
  iv?: string,
  mode?: 'CBC' | 'ECB' | 'CFB' | 'OFB' | 'CTR',
): string {
  // 优先宿主 polyfill
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).aesEncrypt) {
      return (crypto as any).aesEncrypt(data, key, iv, mode ? mode.toLowerCase() : 'cbc');
    }
  } catch { /* fallback */ }

  // 宿主不可用时抛错 (纯 JS AES 太庞大,实际平台都需要宿主 polyfill)
  throw new Error('AES encrypt requires host crypto polyfill');
}

export function aesDecrypt(
  data: string,
  key: string,
  iv?: string,
  mode?: 'CBC' | 'ECB' | 'CFB' | 'OFB' | 'CTR',
): string {
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).aesDecrypt) {
      return (crypto as any).aesDecrypt(data, key, iv, mode ? mode.toLowerCase() : 'cbc');
    }
  } catch { /* fallback */ }

  throw new Error('AES decrypt requires host crypto polyfill');
}

// ============ RSA ============

export function rsaEncrypt(data: string, publicKey: string): string {
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).rsaEncrypt) {
      return (crypto as any).rsaEncrypt(data, publicKey);
    }
  } catch { /* fallback */ }

  throw new Error('RSA encrypt requires host crypto polyfill');
}

// ============ Random ============

export function randomBytes(length: number): Uint8Array {
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).randomBytes) {
      const hex = (crypto as any).randomBytes(length);
      const arr = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        arr[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
      return arr;
    }
  } catch { /* fallback */ }

  // 伪随机 fallback
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

export function randomHex(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
