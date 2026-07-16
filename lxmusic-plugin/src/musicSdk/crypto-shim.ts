// 加密适配层 - 收敛所有加密调用
// 宿主提供的 crypto polyfill + CryptoJS

import CryptoJS from 'crypto-js';

// 宿主提供的加密接口
declare const hostCrypto: {
  md5: (data: string) => string;
  aesEncrypt: (data: string, key: string, iv: string) => string;
  rsaEncrypt: (data: string, publicKey: string) => string;
  randomBytes: (n: number) => Uint8Array;
};

// MD5 哈希
export function md5(data: string): string {
  try {
    return (crypto as any).md5(data);
  } catch {
    return CryptoJS.MD5(data).toString();
  }
}

// AES 加密 (CBC 模式)
export function aesEncrypt(data: string, key: string, iv: string): string {
  try {
    return (crypto as any).aesEncrypt(data, key, iv);
  } catch {
    const k = CryptoJS.enc.Utf8.parse(key);
    const i = CryptoJS.enc.Utf8.parse(iv);
    const encrypted = CryptoJS.AES.encrypt(data, k, {
      iv: i,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.toString();
  }
}

// AES 解密
export function aesDecrypt(data: string, key: string, iv: string): string {
  const k = CryptoJS.enc.Utf8.parse(key);
  const i = CryptoJS.enc.Utf8.parse(iv);
  const decrypted = CryptoJS.AES.decrypt(data, k, {
    iv: i,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

// RSA 加密
export function rsaEncrypt(data: string, publicKey: string): string {
  return (crypto as any).rsaEncrypt(data, publicKey);
}

// 随机字节
export function randomBytes(length: number): Uint8Array {
  return (crypto as any).randomBytes(length);
}

// Base64 编码
export function base64Encode(data: string): string {
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(data));
}

// Base64 解码
export function base64Decode(data: string): string {
  return CryptoJS.enc.Base64.parse(data).toString(CryptoJS.enc.Utf8);
}

// 字符串转字节数组
export function stringToBytes(str: string): Uint8Array {
  return new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
}

// 字节数组转字符串
export function bytesToString(bytes: Uint8Array): string {
  return String.fromCharCode(...Array.from(bytes));
}

// HMAC-SHA1
export function hmacSha1(data: string, key: string): string {
  return CryptoJS.HmacSHA1(data, key).toString();
}

// SHA256
export function sha256(data: string): string {
  return CryptoJS.SHA256(data).toString();
}

// Hex 编解码
export function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}