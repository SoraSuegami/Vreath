"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("./basic"));
exports.CreateState = (nonce = 0, owner = [], token = "", amount = 0, data = {}, product = []) => {
    const contents = {
        nonce: 0,
        owner: owner,
        token: token,
        amount: amount,
        data: data,
        product: product
    };
    const hash = _.ObjectHash(contents);
    const state = {
        hash: hash,
        contents: contents
    };
    return state;
};
exports.CreateToken = (nonce = 0, token = "", issued = 0, deposited = 0, committed = [], code = "", developer = []) => {
    return {
        nonce: nonce,
        token: token,
        issued: issued,
        deposited: deposited,
        committed: committed,
        code: code,
        developer: developer
    };
};
