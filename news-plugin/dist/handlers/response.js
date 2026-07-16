"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.badRequestResponse = exports.successResponse = exports.errorResponse = exports.jsonResponse = void 0;
// 通用响应函数
const plugin_sdk_1 = require("@songloft/plugin-sdk");
Object.defineProperty(exports, "jsonResponse", { enumerable: true, get: function () { return plugin_sdk_1.jsonResponse; } });
Object.defineProperty(exports, "errorResponse", { enumerable: true, get: function () { return plugin_sdk_1.errorResponse; } });
Object.defineProperty(exports, "successResponse", { enumerable: true, get: function () { return plugin_sdk_1.successResponse; } });
Object.defineProperty(exports, "badRequestResponse", { enumerable: true, get: function () { return plugin_sdk_1.badRequestResponse; } });
