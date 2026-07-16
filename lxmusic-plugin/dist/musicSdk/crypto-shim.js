import CryptoJS from 'crypto-js';
export function md5(data) {
    if (data instanceof Uint8Array) {
        const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
        return CryptoJS.MD5(CryptoJS.enc.Hex.parse(hex)).toString();
    }
    return CryptoJS.MD5(data).toString();
}
export function sha1(data) {
    if (data instanceof Uint8Array) {
        const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
        return CryptoJS.SHA1(CryptoJS.enc.Hex.parse(hex)).toString();
    }
    return CryptoJS.SHA1(data).toString();
}
export function sha256(data) {
    if (data instanceof Uint8Array) {
        const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
        return CryptoJS.SHA256(CryptoJS.enc.Hex.parse(hex)).toString();
    }
    return CryptoJS.SHA256(data).toString();
}
export function hmacSHA1(data, key) {
    return CryptoJS.HmacSHA1(data, key).toString();
}
export function hmacSHA256(data, key) {
    return CryptoJS.HmacSHA256(data, key).toString();
}
export function aesEncrypt(data, key, iv) {
    const keyBytes = CryptoJS.enc.Utf8.parse(key);
    const ivBytes = iv ? CryptoJS.enc.Utf8.parse(iv) : undefined;
    const encrypted = ivBytes
        ? CryptoJS.AES.encrypt(data, keyBytes, { iv: ivBytes, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 })
        : CryptoJS.AES.encrypt(data, keyBytes, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 });
    return encrypted.toString();
}
export function aesDecrypt(data, key, iv) {
    const keyBytes = CryptoJS.enc.Utf8.parse(key);
    const ivBytes = iv ? CryptoJS.enc.Utf8.parse(iv) : undefined;
    const decrypted = ivBytes
        ? CryptoJS.AES.decrypt(data, keyBytes, { iv: ivBytes, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 })
        : CryptoJS.AES.decrypt(data, keyBytes, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 });
    return decrypted.toString(CryptoJS.enc.Utf8);
}
export function base64Encode(data) {
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(data));
}
export function base64Decode(data) {
    return CryptoJS.enc.Base64.parse(data).toString(CryptoJS.enc.Utf8);
}
export function rsaEncrypt(data, publicKey) {
    try {
        return crypto.rsaEncrypt(data, publicKey);
    }
    catch {
        throw new Error('RSA encrypt not supported in this environment');
    }
}
export function randomBytes(length) {
    try {
        return crypto.randomBytes(length);
    }
    catch {
        const array = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    }
}
export function stringToBytes(str) {
    return new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
}
export function bytesToString(bytes) {
    return Array.from(bytes).map(b => String.fromCharCode(b)).join('');
}
export const CryptoShim = {
    md5,
    sha1,
    sha256,
    hmacSHA1,
    hmacSHA256,
    aesEncrypt,
    aesDecrypt,
    base64Encode,
    base64Decode,
    rsaEncrypt,
    randomBytes,
    stringToBytes,
    bytesToString,
};
export default CryptoShim;
