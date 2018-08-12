"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("../../core/basic"));
const CryptoSet = __importStar(require("../../core/crypto_set"));
const merkle_patricia_1 = require("../../core/merkle_patricia");
const TxSet = __importStar(require("../../core/tx"));
const BlockSet = __importStar(require("../../core/block"));
const P = __importStar(require("p-iteration"));
const con_1 = require("../con");
const tx_pool_1 = require("../../core/tx_pool");
const script_1 = require("./script");
const level_browserify_1 = __importDefault(require("level-browserify"));
const db = level_browserify_1.default('./db');
exports.trie_ins = (root) => {
    try {
        return new merkle_patricia_1.Trie(db, root);
    }
    catch (e) {
        console.log(e);
        return new merkle_patricia_1.Trie(db);
    }
};
const output_keys = (tx) => {
    if (tx.meta.kind === "request")
        return [];
    else if (tx.meta.data.type === "create" || tx.meta.data.type === "update") {
        const token = JSON.parse(tx.raw.raw[0]);
        return [token.token];
    }
    const states = tx.raw.raw.map(r => JSON.parse(r));
    return states.map(s => s.owner);
};
const pays = (tx, chain) => {
    if (tx.meta.kind === "request") {
        return [tx.meta.data.solvency];
    }
    else if (tx.meta.kind === "refresh") {
        const req_tx = TxSet.find_req_tx(tx, chain);
        return [req_tx.meta.data.solvency, tx.meta.data.payee];
    }
    else
        return [];
};
exports.states_for_tx = async (tx, chain, S_Trie) => {
    const base = tx.meta.data.base;
    const outputs = output_keys(tx);
    const payes = pays(tx, chain);
    const concated = base.concat(outputs).concat(payes);
    const target = concated.reduce((result, key, i) => {
        if (result.filter(val => val === key).length >= 2)
            return result.splice(i, 1);
        else
            return result;
    }, concated);
    const states = Object.values(await S_Trie.filter((key) => {
        const i = target.indexOf(key);
        if (i != -1)
            return true;
        else
            return false;
    }));
    return states;
};
exports.locations_for_tx = async (tx, chain, L_Trie) => {
    const target = (() => {
        if (tx.meta.kind === "request")
            return tx;
        else
            return TxSet.find_req_tx(tx, chain);
    })();
    const result = Object.values(await L_Trie.filter(key => {
        if (target.meta.data.base.indexOf(key) != -1)
            return true;
        else if (target.meta.data.solvency === key && target.meta.data.base.indexOf(key) === -1)
            return true;
        else
            return false;
    }));
    return result;
};
exports.states_for_block = async (block, chain, S_Trie) => {
    const native_validator = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(block.meta.validatorPub));
    const native_validator_state = await S_Trie.get(native_validator);
    const unit_validator = CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(block.meta.validatorPub));
    const unit_validator_state = await S_Trie.get(unit_validator);
    const targets = block.txs.concat(block.natives).concat(block.units);
    const tx_states = P.map(targets, async (tx) => await exports.states_for_tx(tx, chain, S_Trie));
    const native_states = P.map(block.natives, async (tx) => await S_Trie.get(tx.raw.raw[1]));
    const unit_states = P.map(block.units, async (tx) => {
        const remiter = await S_Trie.get(tx.raw.raw[1]);
        const items = JSON.parse(tx.raw.raw[2]) || [TxSet.empty_tx()];
        const sellers = P.map(items, async (it) => await S_Trie.get(it.meta.data.payee));
        return sellers.concat(remiter);
    });
    const native_token = await S_Trie.get(con_1.native);
    const unit_token = await S_Trie.get(con_1.unit);
    const concated = tx_states.concat(native_validator_state).concat(unit_validator_state).concat(native_states).concat(unit_states).concat(native_token).concat(unit_token);
    return concated.reduce((result, state, i) => {
        if (result.filter(val => val === state).length >= 2)
            return result.splice(i, 1);
        else
            return result;
    }, concated);
};
exports.locations_for_block = async (block, chain, L_Trie) => {
    const targets = block.txs.concat(block.natives).concat(block.units);
    const result = P.map(targets, async (tx) => await exports.locations_for_tx(tx, chain, L_Trie));
    return result;
};
exports.tx_accept = async (tx) => {
    const chain = script_1.store.state.chain;
    const roots = script_1.store.state.roots;
    const stateroot = roots.stateroot;
    const S_Trie = exports.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie = exports.trie_ins(locationroot);
    const pool = script_1.store.state.pool;
    const states = await exports.states_for_tx(tx, chain, S_Trie);
    const locations = await exports.locations_for_tx(tx, chain, L_Trie);
    const new_pool = tx_pool_1.Tx_to_Pool(pool, tx, con_1.my_version, con_1.native, con_1.unit, chain, con_1.token_name_maxsize, states, locations);
    script_1.store.commit("pool", new_pool);
};
exports.block_accept = async (block) => {
    const chain = script_1.store.state.chain;
    const candidates = script_1.store.state.candidates;
    const roots = script_1.store.state.roots;
    const stateroot = roots.stateroot;
    const S_Trie = exports.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie = exports.trie_ins(locationroot);
    const StateData = await exports.states_for_block(block, chain, S_Trie);
    const LocationData = await exports.locations_for_block(block, chain, L_Trie);
    const accepted = await BlockSet.AcceptBlock(block, chain, 0, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, stateroot, locationroot, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, StateData, LocationData);
    P.forEach(accepted.state, async (state) => {
        if (state.kind === "state")
            await S_Trie.put(state.owner, state);
        else
            await S_Trie.put(state.token, state);
    });
    P.forEach(accepted.location, async (loc) => {
        await L_Trie.put(loc.address, loc);
    });
    const new_roots = {
        stateroot: S_Trie.now_root(),
        locationroot: L_Trie.now_root()
    };
    script_1.store.commit("roots", new_roots);
    script_1.store.commit("candidates", accepted.candidates);
    script_1.store.commit("chain", chain.concat(accepted.block));
};
exports.get_balance = async (address) => {
    const S_Trie = exports.trie_ins(script_1.store.state.roots.stateroot || "");
    const state = await S_Trie.get(address);
    if (state == null)
        return 0;
    return state.amount;
};
exports.send_request_tx = async (to, amount, socket) => {
    try {
        const pub_key = [CryptoSet.PublicFromPrivate(script_1.store.state.secret)];
        const from = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(pub_key));
        const pre_tx = TxSet.CreateRequestTx(pub_key, from, 10, "scrap", con_1.native, [from], ["remit", to, "-" + amount], [], con_1.my_version, TxSet.empty_tx_pure().meta.pre, TxSet.empty_tx_pure().meta.next, 10);
        const tx = TxSet.SignTx(pre_tx, script_1.store.state.secret, from);
        console.log(tx);
        const roots = script_1.store.state.roots;
        const stateroot = roots.stateroot;
        const S_Trie = exports.trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie = exports.trie_ins(locationroot);
        const StateData = await exports.states_for_tx(tx, script_1.store.state.chain, S_Trie);
        const LocationData = await exports.locations_for_tx(tx, script_1.store.state.chain, L_Trie);
        if (!TxSet.ValidRequestTx(tx, con_1.my_version, con_1.native, con_1.unit, StateData, LocationData))
            alert("invalid infomations");
        else {
            alert("remit!");
            script_1.store.commit('refresh_pool', tx);
            socket.emit('tx', JSON.stringify(tx));
        }
    }
    catch (e) {
        console.log(e);
    }
};
