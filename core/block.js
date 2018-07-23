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
const CryptoSet = __importStar(require("./crypto_set"));
const StateSet = __importStar(require("./state"));
const p_iteration_1 = require("p-iteration");
const TxSet = __importStar(require("./tx"));
const code_1 = require("./code");
const empty_block = () => {
    const meta = {
        version: 0,
        shard_id: 0,
        kind: "key",
        index: 0,
        parenthash: _.toHash(""),
        timestamp: 0,
        fraud: {
            flag: false,
            index: 0,
            hash: _.toHash(""),
            step: 0,
            data: _.ObjectHash({ states: [], inputs: [] })
        },
        pow_target: 0,
        pos_diff: 0,
        validator: _.toHash(""),
        token: "",
        validatorPub: [],
        candidates: _.toHash(""),
        stateroot: _.toHash(""),
        locationroot: _.toHash(""),
        tx_root: _.toHash(""),
        fee_sum: 0
    };
    const hash = _.ObjectHash(meta);
    return {
        hash: hash,
        validatorSign: [],
        meta: meta,
        txs: [],
        raws: [],
        fraudData: {
            states: [],
            inputs: []
        }
    };
};
const search_key_block = (chain) => {
    for (let block of chain.reverse()) {
        if (block.meta.kind === "key")
            return block;
    }
    return empty_block();
};
const search_micro_block = async (chain, key_block, StateDate) => {
    return await p_iteration_1.filter(chain.slice(key_block.meta.index), async (block) => {
        const state = await StateDate.get(block.meta.validator);
        return block.meta.kind === "micro" && block.meta.validatorPub.some((pub, i) => _.address_check(state.contents.owner[i], pub, block.meta.token));
    });
};
exports.GetTreeroot = (pre) => {
    if (pre.length == 0)
        return [_.toHash("")];
    else if (pre.length == 1)
        return pre;
    else {
        const union = pre.reduce((result, val, index, array) => {
            const i = Number(index);
            if (i % 2 == 0) {
                const left = val;
                const right = ((left, i, array) => {
                    if (array[i + 1] == null)
                        return _.toHash("");
                    else
                        return array[i + 1];
                })(left, i, array);
                return result.concat(_.toHash(left + right));
            }
            else
                return result;
        }, []);
        return exports.GetTreeroot(union);
    }
};
const tx_fee_sum = (pure_txs, raws) => {
    const txs = pure_txs.map((t, i) => {
        return {
            hash: t.hash,
            meta: t.meta,
            raw: raws[i]
        };
    });
    return txs.reduce((sum, tx) => sum + _.tx_fee(tx), 0);
};
exports.ValidKeyBlock = async (block, chain, my_shard_id, my_version, right_candidates, right_stateroot, right_locationroot, block_time, max_blocks, block_size, StateDate) => {
    const hash = block.hash;
    const sign = block.validatorSign;
    const meta = block.meta;
    const version = meta.version;
    const shard_id = meta.shard_id;
    const index = meta.index;
    const parenthash = meta.parenthash;
    const timestamp = meta.timestamp;
    const fraud = meta.fraud;
    const pow_target = meta.pow_target;
    const pos_diff = meta.pos_diff;
    const validator = meta.validator;
    const token = meta.token;
    const validatorPub = meta.validatorPub;
    const candidates = meta.candidates;
    const stateroot = meta.stateroot;
    const locationroot = meta.locationroot;
    const tx_root = meta.tx_root;
    const fee_sum = meta.fee_sum;
    const raws = block.raws;
    const fraudData = block.fraudData;
    const last = chain[chain.length - 1];
    const validator_state = await StateDate.get(validator);
    const date = new Date();
    if (_.object_hash_check(hash, meta) || _.Hex_to_Num(_.toHash(last.hash) + _.ObjectHash(validator_state.contents.owner) + timestamp) > Math.pow(2, 256) * validator_state.contents.amount / pos_diff) {
        console.log("invalid hash");
        return false;
    }
    else if (validator_state == null || sign.some((s, i) => _.sign_check(validator_state.contents.owner[i], token, hash, s, validatorPub[i]))) {
        console.log("invalid validator signature");
        return false;
    }
    else if (version != my_version) {
        console.log("invalid version");
        return false;
    }
    else if (shard_id != my_shard_id) {
        console.log("invalid shard id");
        return false;
    }
    else if (index != chain.length) {
        console.log("invalid index");
        return false;
    }
    else if (parenthash != last.hash) {
        console.log("invalid parenthash");
        return false;
    }
    else if (_.time_check(timestamp)) {
        console.log("invalid timestamp");
        return false;
    }
    else if (validator_state.contents.owner.some((add, i) => _.address_check(add, validatorPub[i], token))) {
        console.log("invalid validator addresses");
        return false;
    }
    else if (validatorPub.some(pub => pub != _.toHash(""))) {
        console.log("invalid validator public key");
        return false;
    }
    else if (candidates != _.ObjectHash(right_candidates.map(can => _.ObjectHash(can)))) {
        console.log("invalid candidates");
        return false;
    }
    else if (stateroot != right_stateroot) {
        console.log("invalid stateroot");
        return false;
    }
    else if (locationroot != right_locationroot) {
        console.log("invalid location");
        return false;
    }
    else if (tx_root != _.toHash("")) {
        console.log("invalid tx_root");
        return false;
    }
    else if (fee_sum != 0) {
        console.log("invalid fee_sum");
        return false;
    }
    else if (raws.length > 0) {
        console.log("invalid raws");
        return false;
    }
    else if (fraudData.states.length != 0 && fraudData.inputs.length != 0 && _.object_hash_check(fraud.data, fraudData)) {
        console.log("invalid fraudData");
    }
    else if (Buffer.from(JSON.stringify(meta) + JSON.stringify(raws)).length > block_size) {
        console.log("too big block");
        return false;
    }
    else if (date.getTime() - search_key_block(chain).meta.timestamp < block_time * max_blocks && fraud.flag === false) {
        console.log("not valid validator");
        return false;
    }
    else {
        return true;
    }
};
exports.ValidMicroBlock = async (block, chain, my_shard_id, my_version, block_time, max_blocks, block_size, right_candidates, right_stateroot, right_locationroot, StateDate) => {
    const hash = block.hash;
    const sign = block.validatorSign;
    const meta = block.meta;
    const version = meta.version;
    const shard_id = meta.shard_id;
    const index = meta.index;
    const parenthash = meta.parenthash;
    const timestamp = meta.timestamp;
    const fraud = meta.fraud;
    const pow_target = meta.pow_target;
    const pos_diff = meta.pos_diff;
    const validator = meta.validator;
    const token = meta.token;
    const validatorPub = meta.validatorPub;
    const candidates = meta.candidates;
    const stateroot = meta.stateroot;
    const locationroot = meta.locationroot;
    const tx_root = meta.tx_root;
    const fee_sum = meta.fee_sum;
    const txs = block.txs;
    const raws = block.raws;
    const fraudData = block.fraudData;
    const empty = empty_block();
    const last = chain[chain.length - 1];
    const key_block = search_key_block(chain);
    const right_pub = key_block.meta.validatorPub;
    const validator_state = await StateDate.get(validator);
    const date = new Date();
    const now = date.getTime();
    const already_micro = await search_micro_block(chain, key_block, StateDate);
    if (_.object_hash_check(hash, meta)) {
        console.log("invalid hash");
        return false;
    }
    else if (validator_state == null || sign.some((s, i) => _.sign_check(validator_state.contents.owner[i], token, hash, s, right_pub[i]))) {
        console.log("invalid validator signature");
        return false;
    }
    else if (version != my_version) {
        console.log("invalid version");
        return false;
    }
    else if (shard_id != my_shard_id) {
        console.log("invalid shard id");
        return false;
    }
    else if (index != chain.length) {
        console.log("invalid index");
        return false;
    }
    else if (parenthash != last.hash) {
        console.log("invalid parenthash");
        return false;
    }
    else if (_.time_check(timestamp) && now - key_block.meta.timestamp < block_time) {
        console.log("invalid timestamp");
        return false;
    }
    else if (validator_state.contents.owner.some((add, i) => _.address_check(add, validatorPub[i], token))) {
        console.log("invalid validator addresses");
        return false;
    }
    else if (validatorPub != empty.meta.validatorPub) {
        console.log("invalid validator public key");
        return false;
    }
    else if (candidates != _.ObjectHash(right_candidates.map(can => _.ObjectHash(can)))) {
        console.log("invalid candidates");
        return false;
    }
    else if (stateroot != right_stateroot) {
        console.log("invalid stateroot");
        return false;
    }
    else if (locationroot != right_locationroot) {
        console.log("invalid location");
        return false;
    }
    else if (tx_root != exports.GetTreeroot(txs.map(tx => tx.hash))[0]) {
        console.log("invalid tx_root");
        return false;
    }
    else if (fee_sum != tx_fee_sum(txs, raws)) {
        console.log("invalid fee_sum");
        return false;
    }
    else if (fraudData.states.length != 0 && fraudData.inputs.length != 0 && _.object_hash_check(fraud.data, fraudData)) {
        console.log("invalid fraudData");
    }
    else if (Buffer.from(JSON.stringify(meta) + JSON.stringify(raws)).length > block_size) {
        console.log("too big block");
        return false;
    }
    else if (already_micro.length + 1 > max_blocks) {
        console.log("too many micro blocks");
        return false;
    }
    else {
        return true;
    }
};
exports.CreateKeyBlock = (version, shard_id, chain, fraud, pow_target, pos_diff, validator, token, validatorPub, candidates, stateroot, locationroot, fraudData) => {
    const last = chain[chain.length - 1];
    const date = new Date();
    const empty = empty_block();
    const meta = {
        version: version,
        shard_id: shard_id,
        kind: "key",
        index: chain.length,
        parenthash: last.hash,
        timestamp: date.getTime(),
        fraud: fraud,
        pow_target: pow_target,
        pos_diff: pos_diff,
        validator: validator,
        token: token,
        validatorPub: validatorPub,
        candidates: candidates,
        stateroot: stateroot,
        locationroot: locationroot,
        tx_root: empty.meta.tx_root,
        fee_sum: empty.meta.fee_sum
    };
    const hash = _.ObjectHash(meta);
    return {
        hash: hash,
        validatorSign: [],
        meta: meta,
        txs: [],
        raws: [],
        fraudData: fraudData
    };
};
exports.CreateMicroBlock = (version, shard_id, chain, fraud, pow_target, pos_diff, validator, token, candidates, stateroot, locationroot, txs, fraudData) => {
    const last = chain[chain.length - 1];
    const date = new Date();
    const pures = txs.map(tx => { return { hash: tx.hash, meta: tx.meta }; });
    const raws = txs.map(tx => tx.raw);
    const tx_root = exports.GetTreeroot(pures.map(p => p.hash))[0];
    const fee_sum = tx_fee_sum(pures, raws);
    const meta = {
        version: version,
        shard_id: shard_id,
        kind: "micro",
        index: chain.length,
        parenthash: last.hash,
        timestamp: date.getTime(),
        fraud: fraud,
        pow_target: pow_target,
        pos_diff: pos_diff,
        validator: validator,
        token: token,
        validatorPub: [],
        candidates: candidates,
        stateroot: stateroot,
        locationroot: locationroot,
        tx_root: tx_root,
        fee_sum: fee_sum
    };
    const hash = _.ObjectHash(meta);
    return {
        hash: hash,
        validatorSign: [],
        meta: meta,
        txs: pures,
        raws: raws,
        fraudData: fraudData
    };
};
exports.SignBlock = async (block, password, my_pub, StateDate) => {
    const states = await StateDate.get(block.meta.validator);
    if (states == null)
        return block;
    const index = states.contents.owner.map(add => add.split(":")[2]).indexOf(_.toHash(my_pub));
    if (index === -1)
        return block;
    const sign = CryptoSet.SignData(block.hash, password);
    block.validatorSign[index] = sign;
    return block;
};
/*const reduce_units = ()=>{

}*/
exports.AcceptBlock = async (block, chain, my_shard_id, my_version, block_time, max_blocks, block_size, right_candidates, right_stateroot, right_locationroot, code, gas_limit, StateDate, pre_StateData) => {
    if (block.meta.kind === "key" && await exports.ValidKeyBlock(block, chain, my_shard_id, my_version, right_candidates, right_stateroot, right_locationroot, block_time, max_blocks, block_size, StateDate)) {
        if (!check_fraud_proof(block, chain, code, gas_limit, StateDate)) {
            right_stateroot = chain[block.meta.fraud.index].meta.stateroot;
            right_locationroot = chain[block.meta.fraud.index].meta.locationroot;
        }
    }
};
const tx_to_pure = (tx) => {
    return {
        hash: tx.hash,
        meta: tx.meta
    };
};
const check_fraud_proof = async (block, chain, code, gas_limit, StateDate) => {
    const tx = _.find_tx(chain, block.meta.fraud.hash);
    const empty_state = StateSet.CreateState(0, [], "", {}, []);
    const states = await p_iteration_1.map(tx.meta.data.base, async (key) => { return await StateDate.get(key) || empty_state; });
    if (block.meta.fraud.flag === false || tx === TxSet.empty_tx_pure() || tx.meta.kind != "refresh" || block.meta.fraud.step < 0 || !Number.isInteger(block.meta.fraud.step) || block.meta.fraud.step > tx.meta.data.trace.length - 1 || states.indexOf(empty_state) != -1)
        return false;
    const this_block = chain[tx.meta.data.index];
    const req = this_block.txs.filter(t => t.hash === tx.meta.data.request)[0];
    const inputs = this_block.raws[this_block.txs.indexOf(req)].raw;
    const result = await code_1.RunVM(2, code, states, block.meta.fraud.step, inputs, req, tx.meta.data.trace, gas_limit);
    if (result != tx.meta.data.trace)
        return false;
    return true;
};
