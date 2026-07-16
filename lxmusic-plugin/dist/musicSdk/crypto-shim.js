"use strict";
// 加密适配层 - 收敛所有加密调用
// 宿主提供的 crypto polyfill + CryptoJS
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.md5 = md5;
exports.aesEncrypt = aesEncrypt;
exports.aesDecrypt = aesDecrypt;
exports.rsaEncrypt = rsaEncrypt;
exports.randomBytes = randomBytes;
exports.base64Encode = base64Encode;
exports.base64Decode = base64Decode;
exports.stringToBytes = stringToBytes;
exports.bytesToString = bytesToString;
exports.hmacSha1 = hmacSha1;
exports.sha256 = sha256;
exports.hexEncode = hexEncode;
exports.hexDecode = hexDecode;
const crypto_js_1 = __importDefault(require("crypto-js"));
// MD5 哈希
function md5(data) {
    try {
        return crypto.md5(data);
    }
    catch {
        return crypto_js_1.default.MD5(data).toString();
    }
}
// AES 加密 (CBC 模式)
function aesEncrypt(data, key, iv) {
    try {
        return crypto.aesEncrypt(data, key, iv);
    }
    catch {
        const k = crypto_js_1.default.enc.Utf8.parse(key);
        const i = crypto_js_1.default.enc.Utf8.parse(iv);
        const encrypted = crypto_js_1.default.AES.encrypt(data, k, {
            iv: i,
            mode: crypto_js_1.default.mode.CBC,
            padding: crypto_js_1.default.pad.Pkcs7,
        });
        return encrypted.toString();
    }
}
// AES 解密
function aesDecrypt(data, key, iv) {
    const k = crypto_js_1.default.enc.Utf8.parse(key);
    const i = crypto_js_1.default.enc.Utf8.parse(iv);
    const decrypted = crypto_js_1.default.AES.decrypt(data, k, {
        iv: i,
        mode: crypto_js_1.default.mode.CBC,
        padding: crypto_js_1.default.pad.Pkcs7,
    });
    return decrypted.toString(crypto_js_1.default.enc.Utf8);
}
// RSA 加密
function rsaEncrypt(data, publicKey) {
    return crypto.rsaEncrypt(data, publicKey);
}
// 随机字节
function randomBytes(length) {
    return crypto.randomBytes(length);
}
// Base64 编码
function base64Encode(data) {
    return crypto_js_1.default.enc.Base64.stringify(crypto_js_1.default.enc.Utf8.parse(data));
}
// Base64 解码
function base64Decode(data) {
    return crypto_js_1.default.enc.Base64.parse(data).toString(crypto_js_1.default.enc.Utf8);
}
// 字符串转字节数组
function stringToBytes(str) {
    return new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
}
// 字节数组转字符串
function bytesToString(bytes) {
    return String.fromCharCode(...Array.from(bytes));
}
// HMAC-SHA1
function hmacSha1(data, key) {
    return crypto_js_1.default.HmacSHA1(data, key).toString();
}
// SHA256
function sha256(data) {
    return crypto_js_1.default.SHA256(data).toString();
}
// Hex 编解码
function hexEncode(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
function hexDecode(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}
