// 业务 HTTP 辅助函数（官方 SDK 不提供的部分）

/**
 * 解析请求 body 为文本（兼容 string 和 Uint8Array 两种格式）
 * QuickJS 宿主可能传入 string，标准 Web API 期望 Uint8Array
 */
export function bodyToText(body: unknown): string {
  if (!body) return '';
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  // 兜底：尝试 TextDecoder
  try {
    return new TextDecoder().decode(body as Uint8Array);
  } catch {
    return String(body);
  }
}

/**
 * 解析 JSON body（兼容 string 和 Uint8Array）
 */
export function parseJsonBody(body: unknown): Record<string, unknown> {
  const text = bodyToText(body);
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('请求内容不是有效的 JSON');
  }
}

/**
 * 业务层响应包装（沿用 { code, msg, data } 约定）
 */
import { jsonResponse } from '@songloft/plugin-sdk';

export function successResponse(data: unknown) {
  return jsonResponse({ code: 0, msg: 'success', data });
}

export function errorResponse(msg: string, status = 500) {
  return jsonResponse({ code: status, msg }, status);
}

export function badRequestResponse(msg: string) {
  return errorResponse(msg, 400);
}
