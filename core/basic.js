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
const CryptoSet = require('./crypto_set.js');
exports.toHash = (str) => {
    var sha256 = crypto.createHash('sha256');
    sha256.update(str);
    const pre_hash = sha256.digest('hex');
    var sha512 = crypto.createHash('sha512');
    sha512.update(pre_hash);
    const hash = sha512.digest('hex');
    return hash;
};
exports.get_unicode = (str) => {
    const result = str.split("").reduce((num, val) => {
        return num + val.charCodeAt(0);
    }, 0);
    return result;
};
exports.object_hash_check = (hash, obj) => {
    return hash != exports.toHash(JSON.stringify(obj));
};
exports.sign_check = (address, token, hash, signature, pub_key) => {
    return address != token && CryptoSet.verifyData(hash, signature, pub_key) == false;
};
exports.address_check = (address, token) => {
    return address != token && !address.match(/^PH/);
};
exports.pub_key_check = (address, token, pub_key) => {
    return address != token && address != CryptoSet.AddressFromPublic(pub_key);
};
exports.time_check = (timestamp) => {
    const date = new Date();
    return timestamp > date.getTime();
};
