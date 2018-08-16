"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const CryptoSet = __importStar(require("../core/crypto_set"));
const con_1 = require("../wallet/con");
const genesis_pub = "03197dced5b880718079c048f42c25cf3378a4352919ba3183f428d3290ce5c494";
exports.genesis_candidates = [{
        address: CryptoSet.GenereateAddress(con_1.native, genesis_pub),
        amount: 100000000000000
    }];
