"use strict";
// 音源脚本解析
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsSource = parseJsSource;
exports.parseZipSource = parseZipSource;
const JSDOC_REGEX = /\/\*[\s\S]*?\*\//;
const TAG_REGEX = (tag) => new RegExp(`@${tag}\\s+(.+)`);
function parseJsSource(name, content) {
    const jsdocMatch = content.match(JSDOC_REGEX);
    const jsdoc = jsdocMatch ? jsdocMatch[0] : '';
    const getTag = (tag) => {
        const m = jsdoc.match(TAG_REGEX(tag));
        return m ? m[1].trim() : undefined;
    };
    const sourceName = getTag('name') || name || 'Unknown Source';
    const id = generateId(sourceName);
    return {
        id,
        name: sourceName,
        version: getTag('version'),
        author: getTag('author'),
        description: getTag('description'),
        script: content,
        enabled: true,
        createTime: Date.now(),
        updateTime: Date.now(),
    };
}
function generateId(name) {
    let id = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_');
    id = id.replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!id)
        id = 'source_' + Date.now();
    return id;
}
function parseZipSource(zipName, zipData) {
    const sources = [];
    try {
        const eocdOffset = findEOCD(zipData);
        if (eocdOffset < 0)
            return sources;
        const centralDirOffset = readUint32LE(zipData, eocdOffset + 16);
        parseCentralDirectory(zipData, centralDirOffset, sources);
    }
    catch (e) {
        songloft.log.error('Failed to parse ZIP:', e);
    }
    return sources;
}
function findEOCD(bytes) {
    for (let i = bytes.length - 22; i >= 0; i--) {
        if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b &&
            bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
            return i;
        }
    }
    return -1;
}
function readUint32LE(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}
function readUint16LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
}
function parseCentralDirectory(bytes, offset, result) {
    let pos = offset;
    while (pos + 46 < bytes.length) {
        const sig = readUint32LE(bytes, pos);
        if (sig !== 0x02014B50)
            break;
        const fileNameLength = readUint16LE(bytes, pos + 28);
        const extraLength = readUint16LE(bytes, pos + 30);
        const commentLength = readUint16LE(bytes, pos + 32);
        const compressedSize = readUint32LE(bytes, pos + 20);
        const localOffset = readUint32LE(bytes, pos + 42);
        const fileName = String.fromCharCode(...bytes.slice(pos + 46, pos + 46 + fileNameLength));
        pos += 46 + fileNameLength + extraLength + commentLength;
        if (!fileName.endsWith('.js') || fileName.startsWith('__MACOSX/') ||
            fileName.startsWith('._') || fileName.includes('.DS_Store')) {
            continue;
        }
        try {
            const content = readLocalFile(bytes, localOffset, compressedSize);
            if (content) {
                const name = fileName.replace(/\.js$/, '').split('/').pop() || 'source';
                result.push(parseJsSource(name, content));
            }
        }
        catch {
            // ignore
        }
    }
}
function readLocalFile(bytes, offset, compressedSize) {
    if (offset + 30 > bytes.length)
        return null;
    const sig = readUint32LE(bytes, offset);
    if (sig !== 0x04034B50)
        return null;
    const fileNameLength = readUint16LE(bytes, offset + 26);
    const extraLength = readUint16LE(bytes, offset + 28);
    const compressionMethod = readUint16LE(bytes, offset + 10);
    const dataOffset = offset + 30 + fileNameLength + extraLength;
    if (compressionMethod === 0) {
        return String.fromCharCode(...bytes.slice(dataOffset, dataOffset + compressedSize));
    }
    else if (compressionMethod === 8) {
        try {
            const hex = Array.from(bytes.slice(dataOffset, dataOffset + compressedSize))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            // 使用宿主提供的 inflate
            if (typeof __go_raw_inflate === 'function') {
                const inflatedHex = __go_raw_inflate(hex);
                const inflatedBytes = new Uint8Array(inflatedHex.length / 2);
                for (let i = 0; i < inflatedBytes.length; i++) {
                    inflatedBytes[i] = parseInt(inflatedHex.substr(i * 2, 2), 16);
                }
                return new TextDecoder().decode(inflatedBytes);
            }
        }
        catch {
            // ignore
        }
    }
    return null;
}
