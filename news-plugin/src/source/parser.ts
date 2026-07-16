// 解析 source 脚本
import type { CustomSource } from './types';

/**
 * 解析 JSDoc 风格元数据
 * 格式：
 * /**
 *  * @name 我的源
 *  * @version 1.0.0
 *  * @author xxx
 *  * @description 描述
 *  * @id my_source
 *  * @platforms platform1,platform2
 *\/
 */
export function parseScriptMetadata(script: string): { id: string; name: string; version?: string; author?: string; description?: string; platforms?: string[] } {
  const meta: any = {
    id: '',
    name: '',
  };
  
  // 查找 JSDoc 块
  const jsdocMatch = script.match(/\/\*\*([\s\S]*?)\*\//);
  if (!jsdocMatch) return meta;
  
  const block = jsdocMatch[1];
  
  const getTag = (tag: string): string | undefined => {
    const regex = new RegExp(`@${tag}\\s+([^\\n*]+)`);
    const m = block.match(regex);
    return m ? m[1].trim() : undefined;
  };
  
  meta.name = getTag('name') || '';
  meta.id = getTag('id') || '';
  meta.version = getTag('version');
  meta.author = getTag('author');
  meta.description = getTag('description');
  
  const platformsStr = getTag('platforms');
  if (platformsStr) {
    meta.platforms = platformsStr.split(',').map(s => s.trim()).filter(Boolean);
  }
  
  return meta;
}

/**
 * 解析 JS 源文件
 */
export function parseJsSource(name: string, content: string): CustomSource {
  const meta = parseScriptMetadata(content);
  const id = meta.id || `src_${name}_${Date.now()}`;
  const now = Date.now();
  
  return {
    id,
    name: meta.name || name,
    version: meta.version,
    author: meta.author,
    description: meta.description,
    platforms: meta.platforms,
    script: content,
    enabled: true,
    createTime: now,
    updateTime: now,
  };
}

/**
 * 解析 ZIP 源文件 - ZIP 包含多个 .js 文件，每个文件一个源
 */
export function parseZipSource(zipName: string, zipData: Uint8Array): CustomSource[] {
  const sources: CustomSource[] = [];
  
  // ZIP 文件解析 - 简化的 ZIP 解析
  // 这里我们只做基础解析，更复杂的 ZIP 解析可能需要外部库
  const files = extractZipFiles(zipData);
  for (const [filename, content] of Object.entries(files)) {
    if (filename.endsWith('.js')) {
      const baseName = filename.replace(/\.js$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
      const source = parseJsSource(baseName, content);
      source.id = `${zipName}_${baseName}`;
      sources.push(source);
    }
  }
  
  return sources;
}

/**
 * 简易 ZIP 文件解析 - 仅支持 STORED (无压缩) 的简单 ZIP
 * 对于真实使用场景，建议使用 fflate 或 jszip 等库
 */
function extractZipFiles(zipData: Uint8Array): Record<string, string> {
  const files: Record<string, string> = {};
  let offset = 0;
  
  while (offset < zipData.length - 4) {
    // 查找 local file header signature: 0x04034b50
    if (
      zipData[offset] === 0x50 &&
      zipData[offset + 1] === 0x4b &&
      zipData[offset + 2] === 0x03 &&
      zipData[offset + 3] === 0x04
    ) {
      const compressionMethod = zipData[offset + 8] | (zipData[offset + 9] << 8);
      const compressedSize = zipData[offset + 18] | (zipData[offset + 19] << 8) | (zipData[offset + 20] << 16) | (zipData[offset + 21] << 24);
      const uncompressedSize = zipData[offset + 22] | (zipData[offset + 23] << 8) | (zipData[offset + 24] << 16) | (zipData[offset + 25] << 24);
      const filenameLength = zipData[offset + 26] | (zipData[offset + 27] << 8);
      const extraLength = zipData[offset + 28] | (zipData[offset + 29] << 8);
      
      const filenameBytes = zipData.slice(offset + 30, offset + 30 + filenameLength);
      const filename = new TextDecoder().decode(filenameBytes);
      
      const dataStart = offset + 30 + filenameLength + extraLength;
      const dataEnd = dataStart + compressedSize;
      const fileData = zipData.slice(dataStart, dataEnd);
      
      if (compressionMethod === 0) {
        // STORED - no compression
        files[filename] = new TextDecoder().decode(fileData);
      } else {
        // DEFLATED - we can't decompress without zlib, skip
        songloft.log.warn(`Skipping compressed file ${filename} in ZIP`);
      }
      
      offset = dataEnd;
    } else {
      offset++;
    }
  }
  
  return files;
}
