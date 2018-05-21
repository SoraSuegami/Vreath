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
async function check_tx(tx, stateroot, tag_limit, key_currency, fee_by_size, dag_root, chain, request_root, db) {
    if (tx.kind == "request") {
        return await TxSet.ValidRequestTx(tx, stateroot, tag_limit, key_currency, fee_by_size, db);
    }
    else if (tx.kind == "refresh") {
        return await TxSet.ValidRefreshTx(tx, dag_root, chain, stateroot, request_root, key_currency, fee_by_size, tag_limit, db);
    }
    else
        return false;
}
async function Tx_to_Pool(pool, tx, stateroot, tag_limit, key_currency, fee_by_size, dag_root, chain, request_root, db) {
    if (!await check_tx(tx, stateroot, tag_limit, key_currency, fee_by_size, dag_root, chain, request_root, db))
        return pool;
    const new_pool = ((pool) => {
        pool[tx.meta.hash] = tx;
        return pool;
    })(pool);
    return new_pool;
}
exports.Tx_to_Pool = Tx_to_Pool;
