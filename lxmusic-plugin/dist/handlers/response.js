// handlers/response.ts - 统一响应封装 (内部 UI 用)
// 注意: 主程序契约端点 (/api/search, /api/music/url) 走 SDK 工厂返回裸 {results}/{url}
// 其他内部端点用统一封装 {code:0, msg:'success', data} / 错误 {code:statusCode, msg, data:null}
import { jsonResponse } from '../@songloft/plugin-sdk';
export function success(data, msg = 'success') {
    return jsonResponse({ code: 0, msg, data });
}
export function successWithWarning(data, warning) {
    return jsonResponse({ code: 0, msg: 'success', data, warning });
}
export function error(msg, status = 500) {
    return jsonResponse({ code: status, msg, data: null }, status);
}
export function badRequest(msg) {
    return error(msg, 400);
}
export function notFound(msg = 'Not Found') {
    return error(msg, 404);
}
export { jsonResponse } from '../@songloft/plugin-sdk';
