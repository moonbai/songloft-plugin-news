// musicSdk/crypto-shim.ts - 加密适配层
// 收敛所有加密调用:宿主 polyfill + 纯 JS CryptoJS
// 平台代码统一 import 它

import CryptoJS from 'crypto-js';

// ============ MD5 ============
export function md5(data: string): string {
  // 优先用宿主 polyfill
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).md5) {
      return (crypto as any).md5(data);
    }
  } catch { /* fallback */ }
  return CryptoJS.MD5(data).toString();
}

// ============ SHA256 ============
export function sha256(data: string): string {
  return CryptoJS.SHA256(data).toString();
}

export function sha1(data: string): string {
  return CryptoJS.SHA1(data).toString();
}

// ============ HMAC ============
export function hmacSHA256(data: string, key: string): string {
  return CryptoJS.HmacSHA256(data, key).toString();
}

export function hmacSHA1(data: string, key: string): string {
  return CryptoJS.HmacSHA1(data, key).toString();
}

export function hmacMD5(data: string, key: string): string {
  return CryptoJS.HmacMD5(data, key).toString();
}

// ============ AES ============
export function aesEncrypt(
  data: string,
  key: string,
  iv?: string,
  mode?: 'CBC' | 'ECB' | 'CFB' | 'OFB' | 'CTR',
): string {
  // 尝试宿主 polyfill
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).aesEncrypt) {
      const modeStr = mode ? mode.toLowerCase() : 'cbc';
      return (crypto as any).aesEncrypt(data, key, iv, modeStr);
    }
  } catch { /* fallback */ }

  const keyWords = CryptoJS.enc.Utf8.parse(key);
  const ivWords = iv ? CryptoJS.enc.Utf8.parse(iv) : undefined;
  const modeName = mode ? (CryptoJS.mode as any)[mode] : CryptoJS.mode.CBC;

  const encrypted = CryptoJS.AES.encrypt(data, keyWords, {
    iv: ivWords,
    mode: modeName,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString(); // base64
}

export function aesDecrypt(
  data: string,
  key: string,
  iv?: string,
  mode?: 'CBC' | 'ECB' | 'CFB' | 'OFB' | 'CTR',
): string {
  // 尝试宿主 polyfill
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).aesDecrypt) {
      const modeStr = mode ? mode.toLowerCase() : 'cbc';
      return (crypto as any).aesDecrypt(data, key, iv, modeStr);
    }
  } catch { /* fallback */ }

  const keyWords = CryptoJS.enc.Utf8.parse(key);
  const ivWords = iv ? CryptoJS.enc.Utf8.parse(iv) : undefined;
  const modeName = mode ? (CryptoJS.mode as any)[mode] : CryptoJS.mode.CBC;

  const decrypted = CryptoJS.AES.decrypt(data, keyWords, {
    iv: ivWords,
    mode: modeName,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

// ============ RSA ============
export function rsaEncrypt(data: string, publicKey: string): string {
  // 宿主 polyfill
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).rsaEncrypt) {
      return (crypto as any).rsaEncrypt(data, publicKey);
    }
  } catch { /* fallback */ }

  // CryptoJS 不直接支持 RSA,必须依赖宿主
  throw new Error('RSA encrypt requires host crypto polyfill');
}

// ============ Base64 ============
export function base64Encode(data: string): string {
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(data));
}

export function base64Decode(data: string): string {
  return CryptoJS.enc.Base64.parse(data).toString(CryptoJS.enc.Utf8);
}

// ============ Hex ============
export function hexEncode(data: string): string {
  return CryptoJS.enc.Hex.stringify(CryptoJS.enc.Utf8.parse(data));
}

export function hexDecode(data: string): string {
  return CryptoJS.enc.Hex.parse(data).toString(CryptoJS.enc.Utf8);
}

// ============ Random ============
export function randomBytes(length: number): Uint8Array {
  // 尝试宿主 polyfill
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

  // CryptoJS random
  const words = CryptoJS.lib.WordArray.random(length);
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = (words.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return arr;
}

export function randomHex(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============ 导出 CryptoJS 供直接使用 ============
export { CryptoJS };
