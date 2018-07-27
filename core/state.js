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
// These are for test.
/*const password = 'Sora';
const my_pub = CryptoSet.PullMyPublic(password);
const my_address = CryptoSet.AddressFromPublic(my_pub);
CryptoSet.GenerateKeys("Test");
const test_pub = CryptoSet.PullMyPublic("Test");
const test_address = CryptoSet.AddressFromPublic(test_pub);*/
// These are for test.
/*function FunctoStr(func):string{
  return func.toString().replace(/^\(\)\s=>\s{/,"").replace(/}$/,"");
}*/
exports.CreateState = (amount, owner, token, data, product) => {
    const contents = {
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
