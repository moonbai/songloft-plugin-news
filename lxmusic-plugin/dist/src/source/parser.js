const JSDOC_REGEX = /\/\*\*[\s\S]*?\*\//;
const NAME_REGEX = /@name\s+(.+)/;
const VERSION_REGEX = /@version\s+(.+)/;
const DESCRIPTION_REGEX = /@description\s+(.+)/;
const AUTHOR_REGEX = /@author\s+(.+)/;
const HOMEPAGE_REGEX = /@homepage\s+(.+)/;
export function parseSourceScript(script, fileName) {
    const jsdocMatch = script.match(JSDOC_REGEX);
    const jsdoc = jsdocMatch ? jsdocMatch[0] : '';
    const nameMatch = jsdoc.match(NAME_REGEX);
    const versionMatch = jsdoc.match(VERSION_REGEX);
    const descriptionMatch = jsdoc.match(DESCRIPTION_REGEX);
    const authorMatch = jsdoc.match(AUTHOR_REGEX);
    const homepageMatch = jsdoc.match(HOMEPAGE_REGEX);
    let name = nameMatch ? nameMatch[1].trim() : '';
    if (!name && fileName) {
        name = fileName.replace(/\.js$/, '');
    }
    if (!name) {
        name = 'Unknown Source';
    }
    const id = generateId(name);
    return {
        id,
        name,
        version: versionMatch ? versionMatch[1].trim() : '1.0.0',
        description: descriptionMatch ? descriptionMatch[1].trim() : undefined,
        author: authorMatch ? authorMatch[1].trim() : undefined,
        homepage: homepageMatch ? homepageMatch[1].trim() : undefined,
        enabled: false,
        loading: false,
        platforms: [],
        rawScript: script,
        successCalls: 0,
        totalCalls: 0,
    };
}
export function generateId(name) {
    let id = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_');
    id = id.replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!id)
        id = 'source_' + Date.now();
    return id;
}
export function generateUniqueId(name, existingIds) {
    let id = generateId(name);
    let counter = 2;
    while (existingIds.includes(id)) {
        id = generateId(name) + '_' + counter;
        counter++;
    }
    return id;
}
export function parseZipContent(content) {
    const result = [];
    try {
        const bytes = new Uint8Array(content.length);
        for (let i = 0; i < content.length; i++) {
            bytes[i] = content.charCodeAt(i);
        }
        const eocdOffset = findEOCD(bytes);
        if (eocdOffset < 0) {
            return result;
        }
        const centralDirOffset = readUint32LE(bytes, eocdOffset + 16);
        parseCentralDirectory(bytes, centralDirOffset, result);
    }
    catch {
    }
    return result;
}
function findEOCD(bytes) {
    const signature = [0x50, 0x4B, 0x05, 0x06];
    for (let i = bytes.length - 22; i >= 0; i--) {
        if (bytes[i] === signature[0] &&
            bytes[i + 1] === signature[1] &&
            bytes[i + 2] === signature[2] &&
            bytes[i + 3] === signature[3]) {
            return i;
        }
    }
    return -1;
}
function readUint32LE(bytes, offset) {
    return (bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)) >>> 0;
}
function readUint16LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
}
function parseCentralDirectory(bytes, offset, result) {
    let pos = offset;
    while (pos + 4 < bytes.length) {
        const signature = bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24);
        if (signature !== 0x02014B50)
            break;
        const fileNameLength = readUint16LE(bytes, pos + 28);
        const extraFieldLength = readUint16LE(bytes, pos + 30);
        const fileCommentLength = readUint16LE(bytes, pos + 32);
        const compressedSize = readUint32LE(bytes, pos + 20);
        const uncompressedSize = readUint32LE(bytes, pos + 24);
        const localHeaderOffset = readUint32LE(bytes, pos + 42);
        const fileName = String.fromCharCode(...bytes.slice(pos + 46, pos + 46 + fileNameLength));
        if (fileName.endsWith('/') ||
            fileName.startsWith('__MACOSX/') ||
            fileName.startsWith('._') ||
            fileName === '.DS_Store') {
            pos += 46 + fileNameLength + extraFieldLength + fileCommentLength;
            continue;
        }
        if (!fileName.endsWith('.js')) {
            pos += 46 + fileNameLength + extraFieldLength + fileCommentLength;
            continue;
        }
        try {
            const fileData = readLocalFile(bytes, localHeaderOffset, compressedSize, uncompressedSize);
            if (fileData) {
                result.push({ name: fileName, data: fileData });
            }
        }
        catch {
        }
        pos += 46 + fileNameLength + extraFieldLength + fileCommentLength;
    }
}
function readLocalFile(bytes, offset, compressedSize, uncompressedSize) {
    if (offset + 30 > bytes.length)
        return null;
    const signature = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
    if (signature !== 0x04034B50)
        return null;
    const fileNameLength = readUint16LE(bytes, offset + 26);
    const extraFieldLength = readUint16LE(bytes, offset + 28);
    const compressionMethod = readUint16LE(bytes, offset + 10);
    const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
    if (compressionMethod === 0) {
        return String.fromCharCode(...bytes.slice(dataOffset, dataOffset + uncompressedSize));
    }
    else if (compressionMethod === 8) {
        try {
            const hex = Array.from(bytes.slice(dataOffset, dataOffset + compressedSize))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            const inflatedHex = __go_raw_inflate(hex);
            const inflatedBytes = new Uint8Array(inflatedHex.length / 2);
            for (let i = 0; i < inflatedBytes.length; i++) {
                inflatedBytes[i] = parseInt(inflatedHex.substr(i * 2, 2), 16);
            }
            return new TextDecoder('utf-8').decode(inflatedBytes);
        }
        catch {
            return null;
        }
    }
    return null;
}
