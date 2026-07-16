"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mg = exports.wy = exports.tx = exports.kg = exports.kw = exports.sources = void 0;
exports.sources = [
    { id: 'kw', name: '酷我音乐' },
    { id: 'kg', name: '酷狗音乐' },
    { id: 'tx', name: 'QQ音乐' },
    { id: 'wy', name: '网易云音乐' },
    { id: 'mg', name: '咪咕音乐' },
];
var index_1 = require("./kw/index");
Object.defineProperty(exports, "kw", { enumerable: true, get: function () { return __importDefault(index_1).default; } });
var index_2 = require("./kg/index");
Object.defineProperty(exports, "kg", { enumerable: true, get: function () { return __importDefault(index_2).default; } });
var index_3 = require("./tx/index");
Object.defineProperty(exports, "tx", { enumerable: true, get: function () { return __importDefault(index_3).default; } });
var index_4 = require("./wy/index");
Object.defineProperty(exports, "wy", { enumerable: true, get: function () { return __importDefault(index_4).default; } });
var index_5 = require("./mg/index");
Object.defineProperty(exports, "mg", { enumerable: true, get: function () { return __importDefault(index_5).default; } });
