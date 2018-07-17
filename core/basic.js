"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const CryptoSet = __importStar(require("./crypto_set"));
exports.toHash = (str) => {
    return CryptoSet.HashFromPass(str);
};
exports.Hex_to_Num = (str) => {
    return parseInt(str, 16);
};
exports.get_unicode = (str) => {
    return str.split("").map((val) => {
        return val.charCodeAt(0);
    });
};
exports.get_string = (uni) => {
    return String.fromCharCode.apply({}, uni);
};
exports.object_hash_check = (hash, obj) => {
    return hash != exports.toHash(JSON.stringify(obj));
};
exports.hash_size_check = (hash) => {
    return Buffer.from(hash).length != 128;
};
exports.sign_check = (address, token, hash, signature, pub_key) => {
    return address != token && CryptoSet.verifyData(hash, signature, pub_key) == false;
};
exports.address_check = (address, Public, token) => {
    return address != CryptoSet.GenereateAddress(token, Public);
};
exports.time_check = (timestamp) => {
    const date = new Date();
    return timestamp > date.getTime();
};
exports.address_form_check = (address, token_name_maxsize) => {
    const splitted = address.split(":");
    return splitted.length != 3 || splitted[0] != "Vr" || Buffer.from(splitted[1]).length > token_name_maxsize;
};
