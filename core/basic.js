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
const TxSet = __importStar(require("./tx"));
exports.toHash = (str) => {
    return CryptoSet.HashFromPass(str);
};
exports.ObjectHash = (obj) => {
    const sorted = Object.keys(obj).slice().sort();
    const maped = sorted.map(key => { return { [key]: obj[key] }; });
    return exports.toHash(JSON.stringify(maped));
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
    return hash != exports.ObjectHash(obj);
};
exports.hash_size_check = (hash) => {
    return Buffer.from(hash).length != 128;
};
exports.sign_check = (address, token, hash, signature, pub_key) => {
    return address != CryptoSet.GenereateAddress(token, exports.toHash("")) && CryptoSet.verifyData(hash, signature, pub_key) == false;
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
exports.tx_fee = (tx) => {
    const price = tx.meta.feeprice;
    delete tx.meta.feeprice;
    delete tx.raw.signature;
    const target = JSON.stringify(tx.meta) + JSON.stringify(tx.raw);
    return price * Buffer.from(target).length;
};
exports.find_tx = (chain, hash) => {
    for (let block of chain) {
        if (block.meta.kind === "key")
            continue;
        for (let tx of block.txs) {
            if (tx.hash === hash)
                return tx;
        }
    }
    return TxSet.empty_tx_pure();
};
