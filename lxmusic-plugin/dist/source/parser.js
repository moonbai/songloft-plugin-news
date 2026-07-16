// source/parser.ts - 脚本元数据解析 + ZIP 解析
// ============ JSDoc 元数据解析 ============
/** 从脚本头 JSDoc 解析 @name/@version/@description/@author/@homepage */
export function parseScriptMetadata(script, fallbackName) {
    const meta = {
        name: fallbackName || '未命名音源',
    };
    // 匹配 /** */ 或 /*! */ 风格的 JSDoc
    const jsdocRegex = /\/\*[!*][\s\S]*?\*\//;
    const match = script.match(jsdocRegex);
    if (match) {
        const content = match[0];
        const extract = (tag) => {
            // @tag value
            const reg = new RegExp('@' + tag + '\\s+(.+?)(?=\\n\\s*\\*|\\n\\s*@|\\*/|$)', 'i');
            const m = content.match(reg);
            if (m && m[1]) {
                return m[1].trim().replace(/^\s*\*\s*/, '');
            }
            return undefined;
        };
        const name = extract('name');
        const version = extract('version');
        const description = extract('description');
        const author = extract('author');
        const homepage = extract('homepage');
        if (name)
            meta.name = name;
        if (version)
            meta.version = version;
        if (description)
            meta.description = description;
        if (author)
            meta.author = author;
        if (homepage)
            meta.homepage = homepage;
    }
    return meta;
}
// ============ slug 生成 ============
/** 将 name 转为 slug (保留中文,非安全字符替换) */
export function slugify(name) {
    // 保留中文、字母、数字、下划线、连字符
    let slug = '';
    for (const ch of name) {
        if (/[\u4e00-\u9fa5a-zA-Z0-9_\-]/.test(ch)) {
            slug += ch;
        }
        else if (ch === ' ') {
            slug += '_';
        }
        else {
            // 非安全字符跳过
        }
    }
    if (!slug)
        slug = 'source';
    return slug;
}
// ============ latin1 → utf8 转换 ============
/** latin1 字符串转 utf8 (中文文件名/内容需要) */
export function latin1ToUtf8(latin1) {
    try {
        // 先把每个字符转为 byte
        const bytes = new Uint8Array(latin1.length);
        for (let i = 0; i < latin1.length; i++) {
            bytes[i] = latin1.charCodeAt(i) & 0xff;
        }
        return new TextDecoder('utf-8').decode(bytes);
    }
    catch {
        return latin1;
    }
}
// ============ ZIP 解析 (手写 Central Directory) ============
/**
 * 解析 ZIP 文件,返回 .js 文件列表
 * @param latin1Data ZIP 文件的 latin1 字符串表示 (按字节)
 */
export function parseZip(latin1Data) {
    const entries = [];
    // 1. 找到 EOCD (End of Central Directory) — PK\x05\x06
    const eocdSig = 'PK\x05\x06';
    let eocdOffset = -1;
    // 从末尾搜索 EOCD (最多搜索 65557 字节)
    const searchStart = Math.max(0, latin1Data.length - 65557);
    for (let i = latin1Data.length - 4; i >= searchStart; i--) {
        if (latin1Data.charCodeAt(i) === 0x50 &&
            latin1Data.charCodeAt(i + 1) === 0x4b &&
            latin1Data.charCodeAt(i + 2) === 0x05 &&
            latin1Data.charCodeAt(i + 3) === 0x06) {
            eocdOffset = i;
            break;
        }
    }
    if (eocdOffset < 0) {
        throw new Error('ZIP EOCD not found');
    }
    // 2. 读取 Central Directory 信息
    const cdEntries = readUint16(latin1Data, eocdOffset + 10);
    const cdOffset = readUint32(latin1Data, eocdOffset + 16);
    // 3. 遍历 Central Directory 条目
    let offset = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
        if (offset + 46 > latin1Data.length)
            break;
        // Central Directory 签名 PK\x01\x02
        if (latin1Data.charCodeAt(offset) !== 0x50 ||
            latin1Data.charCodeAt(offset + 1) !== 0x4b ||
            latin1Data.charCodeAt(offset + 2) !== 0x01 ||
            latin1Data.charCodeAt(offset + 3) !== 0x02) {
            break;
        }
        const compressMethod = readUint16(latin1Data, offset + 10);
        const compressedSize = readUint32(latin1Data, offset + 20);
        const uncompressedSize = readUint32(latin1Data, offset + 24);
        const filenameLen = readUint16(latin1Data, offset + 28);
        const extraFieldLen = readUint16(latin1Data, offset + 30);
        const commentLen = readUint16(latin1Data, offset + 32);
        const localHeaderOffset = readUint32(latin1Data, offset + 42);
        // 读取文件名 (latin1)
        let filename = latin1Data.substring(offset + 46, offset + 46 + filenameLen);
        filename = latin1ToUtf8(filename);
        // 跳过目录和系统文件
        if (filename.endsWith('/') ||
            filename.startsWith('__MACOSX/') ||
            filename.includes('/__MACOSX/') ||
            filename.includes('/._') ||
            filename.endsWith('.DS_Store')) {
            offset += 46 + filenameLen + extraFieldLen + commentLen;
            continue;
        }
        // 只处理 .js 文件
        if (!filename.toLowerCase().endsWith('.js')) {
            offset += 46 + filenameLen + extraFieldLen + commentLen;
            continue;
        }
        // 4. 读取 Local Header 获取实际数据
        if (localHeaderOffset + 30 <= latin1Data.length) {
            const lhFilenameLen = readUint16(latin1Data, localHeaderOffset + 26);
            const lhExtraLen = readUint16(latin1Data, localHeaderOffset + 28);
            const dataOffset = localHeaderOffset + 30 + lhFilenameLen + lhExtraLen;
            let content = '';
            if (compressMethod === 0) {
                // STORE (无压缩)
                content = latin1Data.substring(dataOffset, dataOffset + uncompressedSize);
                content = latin1ToUtf8(content);
            }
            else if (compressMethod === 8) {
                // DEFLATE
                const hexData = latin1ToHex(latin1Data.substring(dataOffset, dataOffset + compressedSize));
                try {
                    const inflated = __go_raw_inflate(hexData);
                    // inflated 可能是 utf8 文本或 hex
                    if (/^[0-9a-fA-F]+$/.test(inflated) && inflated.length > 0) {
                        content = hexToUtf8(inflated);
                    }
                    else {
                        content = inflated;
                    }
                }
                catch {
                    // inflate 失败,尝试直接读取
                    content = latin1ToUtf8(latin1Data.substring(dataOffset, dataOffset + compressedSize));
                }
            }
            entries.push({ filename, content });
        }
        offset += 46 + filenameLen + extraFieldLen + commentLen;
    }
    return entries;
}
// ============ 辅助函数 ============
function readUint16(data, offset) {
    return (data.charCodeAt(offset) | (data.charCodeAt(offset + 1) << 8)) & 0xffff;
}
function readUint32(data, offset) {
    return ((data.charCodeAt(offset)) |
        (data.charCodeAt(offset + 1) << 8) |
        (data.charCodeAt(offset + 2) << 16) |
        (data.charCodeAt(offset + 3) << 24)) >>> 0;
}
/** latin1 字符串转 hex */
function latin1ToHex(latin1) {
    let hex = '';
    for (let i = 0; i < latin1.length; i++) {
        hex += (latin1.charCodeAt(i) & 0xff).toString(16).padStart(2, '0');
    }
    return hex;
}
/** hex 转 utf8 */
function hexToUtf8(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return new TextDecoder('utf-8').decode(bytes);
}
// ============ multipart 解析 ============
/** 从 multipart body 解析出字段和文件 */
export function parseMultipart(body, contentType) {
    const fields = {};
    const files = [];
    // 提取 boundary
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);
    if (!boundaryMatch)
        return { fields, files };
    const boundary = boundaryMatch[1].trim().replace(/^"|"$/g, '');
    // body 按 latin1 读取
    let bodyStr = '';
    for (let i = 0; i < body.length; i++) {
        bodyStr += String.fromCharCode(body[i]);
    }
    // 按 boundary 分割
    const sep = '--' + boundary;
    const parts = bodyStr.split(sep);
    for (const part of parts) {
        if (part.length === 0 || part === '--\r\n' || part === '--')
            continue;
        // 去除前后的 \r\n
        const trimmed = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
        // 分离 header 和 body
        const headerEnd = trimmed.indexOf('\r\n\r\n');
        if (headerEnd < 0)
            continue;
        const header = trimmed.substring(0, headerEnd);
        const content = trimmed.substring(headerEnd + 4);
        // 解析 Content-Disposition
        const nameMatch = header.match(/name="([^"]*)"/);
        const filenameMatch = header.match(/filename="([^"]*)"/);
        if (!nameMatch)
            continue;
        const fieldName = nameMatch[1];
        if (filenameMatch) {
            const filename = latin1ToUtf8(filenameMatch[1]);
            files.push({
                name: fieldName,
                filename,
                content: latin1ToUtf8(content),
            });
        }
        else {
            fields[fieldName] = latin1ToUtf8(content).replace(/\r\n$/, '');
        }
    }
    return { fields, files };
}
