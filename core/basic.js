"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = __importStar(require("crypto"));
function toHash(str) {
    var sha256 = crypto.createHash('sha256');
    sha256.update(str);
    const pre_hash = sha256.digest('hex');
    var sha512 = crypto.createHash('sha512');
    sha512.update(pre_hash);
    const hash = sha512.digest('hex');
    return hash;
}
exports.toHash = toHash;
function get_unicode(str) {
    const result = str.split("").reduce((num, val) => {
        return num + val.charCodeAt(0);
    }, 0);
    return result;
}
exports.get_unicode = get_unicode;
