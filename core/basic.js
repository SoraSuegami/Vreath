"use strict";
exports.__esModule = true;
var crypto = require("crypto");
function toHash(str) {
    var sha256 = crypto.createHash('sha256');
    sha256.update(str);
    var pre_hash = sha256.digest('hex');
    var sha512 = crypto.createHash('sha512');
    sha512.update(pre_hash);
    var hash = sha512.digest('hex');
    return hash;
}
exports.toHash = toHash;
function get_unicode(str) {
    var result = str.split("").reduce(function (num, val) {
        return num + val.charCodeAt(0);
    }, 0);
    return result;
}
exports.get_unicode = get_unicode;
