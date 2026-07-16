"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonResponse = jsonResponse;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.warningResponse = warningResponse;
exports.textResponse = textResponse;
exports.htmlResponse = htmlResponse;
exports.notFoundResponse = notFoundResponse;
exports.badRequestResponse = badRequestResponse;
function jsonResponse(body, status = 200) {
    const json = JSON.stringify(body);
    return {
        statusCode: status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: new Uint8Array(json.split('').map(c => c.charCodeAt(0))),
    };
}
function successResponse(data, msg = 'success') {
    return jsonResponse({ code: 0, msg, data });
}
function errorResponse(msg, code = 500) {
    return jsonResponse({ code, msg, data: null }, code);
}
function warningResponse(data, warning) {
    return jsonResponse({ code: 0, msg: 'success', data, warning });
}
function textResponse(text, status = 200) {
    return {
        statusCode: status,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
        body: new Uint8Array(text.split('').map(c => c.charCodeAt(0))),
    };
}
function htmlResponse(html, status = 200) {
    return {
        statusCode: status,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
        body: new Uint8Array(html.split('').map(c => c.charCodeAt(0))),
    };
}
function notFoundResponse() {
    return jsonResponse({ code: 404, msg: 'Not Found', data: null }, 404);
}
function badRequestResponse(msg) {
    return jsonResponse({ code: 400, msg, data: null }, 400);
}
