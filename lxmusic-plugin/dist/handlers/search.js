"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSearchHandlers = createSearchHandlers;
const facade_1 = require("../musicSdk/facade");
const response_1 = require("./response");
const platformModules = { kw: facade_1.kw, kg: facade_1.kg, tx: facade_1.tx, wy: facade_1.wy, mg: facade_1.mg };
function createSearchHandlers() {
    return {
        async search(req) {
            try {
                const body = req.body;
                if (!body)
                    return (0, response_1.badRequestResponse)('No body provided');
                const content = Array.from(body).map(b => String.fromCharCode(b)).join('');
                const parsed = JSON.parse(content);
                const keyword = String(parsed.keyword);
                const source_id = String(parsed.source_id || 'kw');
                const page = Number(parsed.page) || 1;
                const page_size = Number(parsed.page_size) || 20;
                if (!keyword)
                    return (0, response_1.badRequestResponse)('Keyword is required');
                const module = platformModules[source_id];
                if (!module)
                    return (0, response_1.badRequestResponse)('Unknown source');
                const result = await module.musicSearch.search(keyword, page, page_size);
                const songs = result.songs;
                const searchResults = songs.map(song => ({
                    title: song.name,
                    artist: song.singer,
                    album: song.album || '',
                    duration: song.duration || 0,
                    cover_url: '',
                    source_data: {
                        platform: song.platform,
                        quality: 'standard',
                        songInfo: song,
                    },
                }));
                return (0, response_1.successResponse)({
                    results: searchResults,
                    total: result.total || searchResults.length,
                });
            }
            catch (e) {
                return (0, response_1.errorResponse)('Search failed');
            }
        },
        async getSources(req) {
            try {
                return (0, response_1.successResponse)(facade_1.sources);
            }
            catch (e) {
                return (0, response_1.errorResponse)('Failed to get sources');
            }
        },
    };
}
