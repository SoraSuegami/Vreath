"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const TxSet = __importStar(require("./tx"));
const { map, reduce, filter, forEach, some } = require('p-iteration');
//const RadixTree = require('dfinity-radix-tree');
//const levelup = require('levelup');
//const leveldown = require('leveldown');
//const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
const rlp = require('rlp');
const CryptoSet = require('./crypto_set.js');
async function check_tx(tx, tag_limit, key_currency, fee_by_size, chain, StateData, DagData, RequestsAlias) {
    if (tx.kind == "request") {
        return await TxSet.ValidRequestTx(tx, tag_limit, key_currency, fee_by_size, StateData);
    }
    else if (tx.kind == "refresh") {
        return await TxSet.ValidRefreshTx(tx, chain, key_currency, fee_by_size, tag_limit, StateData, DagData, RequestsAlias);
    }
    else
        return false;
}
async function Tx_to_Pool(pool, tx, tag_limit, key_currency, fee_by_size, chain, StateData, DagData, RequestsAlias) {
    if (!await check_tx(tx, tag_limit, key_currency, fee_by_size, chain, StateData, DagData, RequestsAlias))
        return pool;
    const new_pool = ((pool) => {
        pool[tx.meta.hash] = tx;
        return pool;
    })(pool);
    return new_pool;
}
exports.Tx_to_Pool = Tx_to_Pool;
