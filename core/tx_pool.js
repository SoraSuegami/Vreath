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
const _ = __importStar(require("./basic"));
const check_tx = (tx, my_version, native, unit, chain, token_name_maxsize, StateData, LocationData) => {
    if (tx.meta.kind == "request") {
        return TxSet.ValidRequestTx(tx, my_version, native, unit, false, StateData, LocationData);
    }
    else if (tx.meta.kind == "refresh") {
        return TxSet.ValidRefreshTx(tx, chain, my_version, native, unit, true, token_name_maxsize, StateData, LocationData);
    }
    else
        return false;
};
exports.Tx_to_Pool = (pool, tx, my_version, native, unit, chain, token_name_maxsize, StateData, LocationData) => {
    if (!check_tx(tx, my_version, native, unit, chain, token_name_maxsize, StateData, LocationData))
        return pool;
    const new_pool = _.new_obj(pool, p => {
        p[tx.hash] = tx;
        return p;
    });
    return new_pool;
};
