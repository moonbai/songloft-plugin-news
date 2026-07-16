"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseScriptMetadata = exports.parseZipSource = exports.parseJsSource = exports.SourceManager = void 0;
var manager_1 = require("./manager");
Object.defineProperty(exports, "SourceManager", { enumerable: true, get: function () { return manager_1.SourceManager; } });
var parser_1 = require("./parser");
Object.defineProperty(exports, "parseJsSource", { enumerable: true, get: function () { return parser_1.parseJsSource; } });
Object.defineProperty(exports, "parseZipSource", { enumerable: true, get: function () { return parser_1.parseZipSource; } });
Object.defineProperty(exports, "parseScriptMetadata", { enumerable: true, get: function () { return parser_1.parseScriptMetadata; } });
