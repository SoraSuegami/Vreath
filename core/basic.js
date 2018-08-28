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
const bignumber_js_1 = require("bignumber.js");
exports.copy = (data) => {
    return Object.assign({}, data);
};
exports.new_obj = (obj, fn) => {
    return fn(exports.copy(obj));
};
exports.toHash = (str) => {
    return CryptoSet.HashFromPass(str);
};
exports.ObjectSort = (obj) => {
    const keys = Object.keys(obj).sort();
    let maped = {};
    keys.forEach(((key) => {
        let val = obj[key];
        if (typeof val === "object")
            val = exports.ObjectSort(val);
        maped[key] = val;
    }));
    return JSON.stringify(maped);
};
exports.ObjectHash = (obj) => {
    const sorted = exports.ObjectSort(obj);
    return exports.toHash(sorted);
};
exports.Hex_to_Num = (str) => {
    return parseInt(str, 16);
};
exports.get_unicode = (str) => {
    return str.split("").map((val) => {
        return val.charCodeAt(0);
    });
};
exports.reduce_pub = (pubs) => {
    return pubs.slice().sort().reduce((res, pub) => {
        return exports.toHash(pub + res);
    });
};
exports.get_string = (uni) => {
    return String.fromCharCode.apply({}, uni);
};
exports.object_hash_check = (hash, obj) => {
    return hash != exports.ObjectHash(obj);
};
exports.hash_size_check = (hash) => {
    return Buffer.from(hash).length != Buffer.from(exports.toHash('')).length;
};
exports.sign_check = (hash, signature, pub_key) => {
    return CryptoSet.verifyData(hash, signature, pub_key) == false;
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
    const meta_part = Object.entries(tx.meta).filter(en => en[0] != "feeprice");
    const raw_part = Object.entries(tx.raw).filter(en => en[0] != "signature");
    const target = JSON.stringify(meta_part) + JSON.stringify(raw_part);
    return new bignumber_js_1.BigNumber(price).times(Buffer.from(target).length).toNumber();
};
exports.find_tx = (chain, hash) => {
    for (let block of chain.slice()) {
        if (block.meta.kind === "key")
            continue;
        for (let tx of block.txs.slice()) {
            if (tx.hash === hash)
                return tx;
        }
        for (let tx of block.natives.slice()) {
            if (tx.hash === hash)
                return tx;
        }
        for (let tx of block.units.slice()) {
            if (tx.hash === hash)
                return tx;
        }
    }
    return TxSet.empty_tx_pure();
};
