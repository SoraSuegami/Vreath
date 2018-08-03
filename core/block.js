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
const con_1 = require("../server/con");
exports.empty_fraud = () => {
    return {
        flag: false,
        index: 0,
        hash: _.toHash(""),
        step: 0,
        data: _.ObjectHash({ states: [], inputs: [] })
    };
};
exports.empty_block = () => {
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
        },
        natives: [],
        units: []
    };
};
const search_key_block = (chain) => {
    for (let block of chain.reverse()) {
        if (block.meta.kind === "key")
            return block;
    }
    return exports.empty_block();
};
const search_micro_block = async (chain, key_block, native, StateData) => {
    return await p_iteration_1.filter(chain.slice(key_block.meta.index), async (block) => {
        const validator = block.meta.validatorPub.map(pub => CryptoSet.GenereateAddress(native, pub));
        const state = await StateData.get(JSON.stringify(validator));
        return block.meta.kind === "micro" && block.meta.validatorPub.some((pub, i) => _.address_check(state.contents.owner[i], pub, native));
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
const PoS_mining = (parenthash, address, balance, difficulty) => {
    let date;
    let timestamp;
    let i = 0;
    do {
        date = new Date();
        timestamp = date.getTime();
        i++;
        if (i > 300)
            break;
        console.log("left:" + _.Hex_to_Num(_.toHash(parenthash + JSON.stringify(address) + timestamp.toString())));
        console.log("right:" + Math.pow(2, 256) * balance / difficulty);
    } while (_.Hex_to_Num(_.toHash(parenthash)) + _.Hex_to_Num(_.ObjectHash(address)) + timestamp > Math.pow(2, 256) * balance / difficulty);
    return timestamp;
};
const Wait_block_time = (pre, block_time) => {
    let date;
    let timestamp;
    do {
        date = new Date();
        timestamp = date.getTime();
    } while (timestamp - pre < block_time);
    return timestamp;
};
const txs_check = async (block, my_version, native, unit, chain, token_name_maxsize, StateData, LocationData) => {
    const txs = block.txs.map((tx, i) => {
        return {
            hash: tx.hash,
            meta: tx.meta,
            raw: block.raws[i]
        };
    });
    const natives = block.natives.map((n, i) => {
        return {
            hash: n.hash,
            meta: n.meta,
            raw: block.raws[i]
        };
    });
    const units = block.units.map((u, i) => {
        return {
            hash: u.hash,
            meta: u.meta,
            raw: block.raws[i]
        };
    });
    const target = txs.concat(natives).concat(units);
    return await p_iteration_1.some(target, async (tx) => {
        if (tx.meta.kind === "request") {
            const validator = block.meta.validatorPub.map(pub => CryptoSet.GenereateAddress(native, pub));
            return !await TxSet.ValidRequestTx(tx, my_version, native, unit, StateData, LocationData);
        }
        else if (tx.meta.kind === "refresh") {
            return !await TxSet.ValidRefreshTx(tx, chain, my_version, native, unit, token_name_maxsize, StateData, LocationData);
        }
        else
            return true;
    });
};
exports.ValidKeyBlock = async (block, chain, my_shard_id, my_version, right_candidates, right_stateroot, right_locationroot, block_time, max_blocks, block_size, native, StateData) => {
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
    const validatorPub = meta.validatorPub;
    const candidates = meta.candidates;
    const stateroot = meta.stateroot;
    const locationroot = meta.locationroot;
    const tx_root = meta.tx_root;
    const fee_sum = meta.fee_sum;
    const raws = block.raws;
    const fraudData = block.fraudData;
    console.log(chain.length);
    const last = chain[chain.length - 1];
    const right_parenthash = (() => {
        if (last != null)
            return last.hash;
        else
            return _.toHash('');
    })();
    const validator = JSON.stringify(validatorPub.map(pub => CryptoSet.GenereateAddress(native, pub)));
    const validator_state = await StateData.get(validator);
    const date = new Date();
    if (_.object_hash_check(hash, meta) || _.Hex_to_Num(_.toHash(parenthash)) + _.Hex_to_Num(_.ObjectHash(validator_state.contents.owner)) + timestamp > Math.pow(2, 256) * validator_state.contents.amount / pos_diff) {
        console.log("invalid hash");
        return false;
    }
    else if (validator_state == null || sign.length === 0 || sign.some((s, i) => _.sign_check(hash, s, validatorPub[i]))) {
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
    else if (parenthash != right_parenthash) {
        console.log(chain);
        console.log(parenthash);
        console.log(right_parenthash);
        console.log("invalid parenthash");
        return false;
    }
    else if (_.time_check(timestamp)) {
        console.log("invalid timestamp");
        return false;
    }
    else if (validator_state.contents.owner.length === 0 || validator_state.contents.owner.some((add, i) => _.address_check(add, validatorPub[i], native))) {
        console.log("invalid validator addresses");
        return false;
    }
    else if (candidates != _.ObjectHash(right_candidates)) {
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
        return false;
    }
    else if (Buffer.from(JSON.stringify(meta) + JSON.stringify(block.txs) + JSON.stringify(block.natives) + JSON.stringify(block.units) + JSON.stringify(raws)).length > block_size) {
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
exports.ValidMicroBlock = async (block, chain, my_shard_id, my_version, right_candidates, right_stateroot, right_locationroot, block_time, max_blocks, block_size, native, unit, StateData, LocationData) => {
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
    const validatorPub = meta.validatorPub;
    const candidates = meta.candidates;
    const stateroot = meta.stateroot;
    const locationroot = meta.locationroot;
    const tx_root = meta.tx_root;
    const fee_sum = meta.fee_sum;
    const txs = block.txs;
    const natives = block.natives;
    const units = block.units;
    const raws = block.raws;
    const fraudData = block.fraudData;
    const empty = exports.empty_block();
    const last = chain[chain.length - 1];
    const right_parenthash = (() => {
        if (last != null)
            return last.hash;
        else
            return _.toHash('');
    })();
    const key_block = search_key_block(chain);
    const right_pub = key_block.meta.validatorPub;
    const validator = JSON.stringify(validatorPub.map(pub => CryptoSet.GenereateAddress(native, pub)));
    const validator_state = await StateData.get(validator);
    const tx_roots = txs.map(t => t.hash).concat(natives.map(n => n.hash)).concat(units.map(u => u.hash));
    const pures = txs.map(tx => { return { hash: tx.hash, meta: tx.meta }; }).concat(natives.map(n => { return { hash: n.hash, meta: n.meta }; })).concat(units.map(u => { return { hash: u.hash, meta: u.meta }; }));
    const date = new Date();
    const now = date.getTime();
    const already_micro = await search_micro_block(chain, key_block, native, StateData);
    if (_.object_hash_check(hash, meta)) {
        console.log("invalid hash");
        return false;
    }
    else if (validator_state == null || sign.length === 0 || sign.some((s, i) => _.sign_check(hash, s, validatorPub[i]))) {
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
    else if (parenthash != right_parenthash) {
        console.log("invalid parenthash");
        return false;
    }
    else if (last == null || _.time_check(timestamp) && now - last.meta.timestamp < block_time) {
        console.log("invalid timestamp");
        return false;
    }
    else if (validator_state.contents.owner.length === 0 || validator_state.contents.owner.some((add, i) => _.address_check(add, validatorPub[i], native))) {
        console.log("invalid validator addresses");
        return false;
    }
    else if (_.ObjectHash(validatorPub) != _.ObjectHash(right_pub)) {
        console.log("invalid validator public key");
        return false;
    }
    else if (candidates != _.ObjectHash(right_candidates)) {
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
    else if (tx_root != exports.GetTreeroot(tx_roots)[0]) {
        console.log("invalid tx_root");
        return false;
    }
    else if (fee_sum != tx_fee_sum(pures, raws)) {
        console.log("invalid fee_sum");
        return false;
    }
    else if (txs.length + natives.length + units.length != raws.length) {
        console.log("invalid raws");
        return false;
    }
    else if (fraudData.states.length != 0 && fraudData.inputs.length != 0 && _.object_hash_check(fraud.data, fraudData)) {
        console.log("invalid fraudData");
        return false;
    }
    else if (Buffer.from(JSON.stringify(meta) + JSON.stringify(txs) + JSON.stringify(natives) + JSON.stringify(units) + JSON.stringify(raws)).length > block_size) {
        console.log("too big block");
        return false;
    }
    else if (already_micro.length + 1 > max_blocks) {
        console.log("too many micro blocks");
        return false;
    }
    else if (await txs_check(block, my_version, native, unit, chain, con_1.token_name_maxsize, StateData, LocationData)) {
        console.log("invalid txs");
        return false;
    }
    else if (txs.some(tx => tx.meta.data.token === native || tx.meta.data.token === unit)) {
        console.log("native tx or unit tx is in txs");
        return false;
    }
    else {
        return true;
    }
};
exports.CreateKeyBlock = async (version, shard_id, chain, block_time, max_blocks, fraud, pow_target, pos_diff, native, validatorPub, candidates, stateroot, locationroot, fraudData, StateData) => {
    const last = chain[chain.length - 1];
    const parenthash = (() => {
        if (last == null)
            return _.toHash('');
        else
            return last.hash;
    })();
    const validator_address = validatorPub.map(pub => CryptoSet.GenereateAddress(native, pub));
    const validator_state = await StateData.get(JSON.stringify(validator_address)) || StateSet.CreateState(0, validator_address, native, 0, {}, []);
    const pre_key = search_key_block(chain);
    const timestamp = (() => {
        const waited = Wait_block_time(pre_key.meta.timestamp, block_time * max_blocks);
        return PoS_mining(parenthash, validator_address, validator_state.contents.amount, pos_diff);
    })();
    const empty = exports.empty_block();
    const meta = {
        version: version,
        shard_id: shard_id,
        kind: "key",
        index: chain.length,
        parenthash: parenthash,
        timestamp: timestamp,
        fraud: fraud,
        pow_target: pow_target,
        pos_diff: pos_diff,
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
        natives: [],
        units: [],
        raws: [],
        fraudData: fraudData,
    };
};
exports.CreateMicroBlock = (version, shard_id, chain, fraud, pow_target, pos_diff, validatorPub, candidates, stateroot, locationroot, txs, natives, units, fraudData, block_time) => {
    const last = chain[chain.length - 1];
    const timestamp = Wait_block_time(last.meta.timestamp, block_time);
    const pures = txs.map(tx => { return { hash: tx.hash, meta: tx.meta }; }).concat(natives.map(n => { return { hash: n.hash, meta: n.meta }; })).concat(units.map(u => { return { hash: u.hash, meta: u.meta }; }));
    const raws = txs.map(tx => tx.raw).concat(natives.map(n => n.raw)).concat(units.map(u => u.raw));
    const tx_root = exports.GetTreeroot(txs.map(t => t.hash).concat(natives.map(n => n.hash)).concat(units.map(u => u.hash)))[0];
    const fee_sum = tx_fee_sum(pures, raws);
    const meta = {
        version: version,
        shard_id: shard_id,
        kind: "micro",
        index: chain.length,
        parenthash: last.hash,
        timestamp: timestamp,
        fraud: fraud,
        pow_target: pow_target,
        pos_diff: pos_diff,
        validatorPub: validatorPub,
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
        txs: txs.map(t => TxSet.tx_to_pure(t)),
        natives: natives.map(n => TxSet.tx_to_pure(n)),
        units: units.map(u => TxSet.tx_to_pure(u)),
        raws: raws,
        fraudData: fraudData
    };
};
exports.SignBlock = async (block, my_private, my_pub) => {
    const index = block.meta.validatorPub.indexOf(my_pub);
    if (index === -1)
        return block;
    const sign = CryptoSet.SignData(block.hash, my_private);
    block.validatorSign[index] = sign;
    return block;
};
const get_units = async (unit, StateData) => {
    const getted = await StateData.filter((key, val) => {
        if (val == null)
            return false;
        const state = val;
        return state.contents != null && state.contents.token === unit;
    });
    return Object.values(getted);
};
const reduce_units = (states, rate) => {
    return states.map(state => {
        state.contents.amount *= rate;
        return state;
    });
};
const CandidatesForm = (states) => {
    return states.map(state => {
        return { address: state.contents.owner, amount: state.contents.amount };
    });
};
const NewCandidates = async (unit, rate, StateData) => {
    return CandidatesForm(reduce_units(await get_units(unit, StateData), rate));
};
const check_fraud_proof = async (block, chain, code, gas_limit, StateData) => {
    const tx = _.find_tx(chain, block.meta.fraud.hash);
    const empty_state = StateSet.CreateState();
    const states = await p_iteration_1.map(tx.meta.data.base, async (key) => { return await StateData.get(key) || empty_state; });
    if (block.meta.fraud.flag === false || tx === TxSet.empty_tx_pure() || tx.meta.kind != "refresh" || block.meta.fraud.step < 0 || !Number.isInteger(block.meta.fraud.step) || block.meta.fraud.step > tx.meta.data.trace.length - 1 || states.indexOf(empty_state) != -1)
        return true;
    const this_block = chain[tx.meta.data.index];
    const req = this_block.txs.filter(t => t.hash === tx.meta.data.request)[0];
    const inputs = this_block.raws[this_block.txs.indexOf(req)].raw;
    const result = await code_1.RunVM(2, code, states, block.meta.fraud.step, inputs, req, tx.meta.data.trace, gas_limit);
    if (result.traced != tx.meta.data.trace)
        return true;
    return false;
};
exports.AcceptBlock = async (block, chain, my_shard_id, my_version, block_time, max_blocks, block_size, right_candidates, right_stateroot, right_locationroot, code, gas_limit, native, unit, rate, token_name_maxsize, StateData, pre_StateData, LocationData) => {
    let index = block.meta.index;
    if (block.meta.fraud.flag) {
        index = block.meta.fraud.index - 1;
        StateData = pre_StateData;
        right_stateroot = chain[block.meta.fraud.index].meta.stateroot;
        right_locationroot = chain[block.meta.fraud.index].meta.locationroot;
        right_candidates = await NewCandidates(unit, rate, pre_StateData);
    }
    if (block.meta.kind === "key" && await exports.ValidKeyBlock(block, chain, my_shard_id, my_version, right_candidates, right_stateroot, right_locationroot, block_time, max_blocks, block_size, native, StateData) && (block.meta.fraud.flag === false || await check_fraud_proof(block, chain, code, gas_limit, StateData))) {
        const new_candidates = await NewCandidates(unit, rate, StateData);
        return {
            state: StateData,
            location: LocationData,
            candidates: new_candidates,
            chain: [block]
        };
    }
    else if (block.meta.kind === "micro" && await exports.ValidMicroBlock(block, chain, my_shard_id, my_version, right_candidates, right_stateroot, right_locationroot, block_time, max_blocks, block_size, native, unit, StateData, LocationData) && (block.meta.fraud.flag === false || await check_fraud_proof(block, chain, code, gas_limit, StateData))) {
        const txs = block.txs.map((tx, i) => {
            return {
                hash: tx.hash,
                meta: tx.meta,
                raw: block.raws[i]
            };
        });
        const natives = block.natives.map((n, i) => {
            return {
                hash: n.hash,
                meta: n.meta,
                raw: block.raws[i]
            };
        });
        const units = block.units.map((u, i) => {
            return {
                hash: u.hash,
                meta: u.meta,
                raw: block.raws[i]
            };
        });
        const target = txs.concat(natives).concat(units);
        const refreshed = await p_iteration_1.reduce(target, async (result, tx) => {
            if (tx.meta.kind === "request") {
                const validator = block.meta.validatorPub.map(pub => CryptoSet.GenereateAddress(native, pub));
                return await TxSet.AcceptRequestTx(tx, validator, index, result[0], result[1]);
            }
            else if (tx.meta.kind === "refresh") {
                return await TxSet.AcceptRefreshTx(tx, chain, native, unit, result[0], result[1]);
            }
            else
                return result;
        }, [StateData, LocationData]);
        const new_candidates = await NewCandidates(unit, rate, StateData);
        return {
            state: refreshed[0],
            location: refreshed[1],
            candidates: new_candidates,
            chain: [block]
        };
    }
    else {
        return {
            state: StateData,
            location: LocationData,
            candidates: right_candidates,
            chain: []
        };
    }
};
