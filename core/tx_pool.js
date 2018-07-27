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
const check_tx = async (tx, my_version, native, unit, chain, pow_target, token_name_maxsize, StateData, LocationData) => {
    if (tx.meta.kind == "request") {
        return await TxSet.ValidRequestTx(tx, my_version, native, unit, StateData, LocationData);
    }
    else if (tx.meta.kind == "refresh") {
        return await TxSet.ValidRefreshTx(tx, chain, my_version, pow_target, native, token_name_maxsize, StateData, LocationData);
    }
    else
        return false;
};
async function Tx_to_Pool(pool, tx, my_version, native, unit, chain, pow_target, token_name_maxsize, StateData, LocationData) {
    if (!await check_tx(tx, my_version, native, unit, chain, pow_target, token_name_maxsize, StateData, LocationData))
        return pool;
    const new_pool = ((pool) => {
        pool[tx.hash] = tx;
        return pool;
    })(pool);
    return new_pool;
}
exports.Tx_to_Pool = Tx_to_Pool;
