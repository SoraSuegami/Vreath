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
const StateSet = __importStar(require("../../core/state"));
const P = __importStar(require("p-iteration"));
const con_1 = require("../con");
const tx_pool_1 = require("../../core/tx_pool");
const script_1 = require("./script");
const level_browserify_1 = __importDefault(require("level-browserify"));
const code_1 = require("../../core/code");
const con_2 = require("../../server/con");
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
    const target = concated.reduce((result, key, index) => {
        if (result.filter(val => val === key).length >= 2)
            return result.filter((key, i) => index != i);
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
    const native_validator_state = await S_Trie.get(native_validator) || [];
    const unit_validator = CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(block.meta.validatorPub));
    const unit_validator_state = await S_Trie.get(unit_validator) || [];
    const targets = block.txs.concat(block.natives).concat(block.units);
    const tx_states = await P.reduce(targets, async (result, tx) => result.concat(await exports.states_for_tx(tx, chain, S_Trie)), []);
    const native_states = await P.map(block.natives, async (tx, i) => await S_Trie.get(block.raws[block.txs.length + i].raw[1]) || StateSet.CreateState(0, block.raws[block.txs.length + i].raw[1], con_1.native, 0));
    const unit_states = await P.map(block.units, async (tx, i) => {
        const remiter = await S_Trie.get(block.raws[block.txs.length + block.natives.length + i].raw[1]) || StateSet.CreateState(0, block.raws[block.txs.length + block.natives.length + i].raw[1], con_1.unit, 0);
        const items = JSON.parse(block.raws[block.txs.length + block.natives.length + i].raw[2]) || [TxSet.empty_tx()];
        const sellers = await P.map(items, async (it) => await S_Trie.get(it.meta.data.payee) || StateSet.CreateState(0, it.meta.data.payee, con_1.unit, 0));
        return sellers.concat(remiter);
    }) || [];
    const native_token = await S_Trie.get(con_1.native);
    const unit_token = await S_Trie.get(con_1.unit);
    const concated = tx_states.concat(native_validator_state).concat(unit_validator_state).concat(native_states).concat(unit_states).concat(native_token).concat(unit_token);
    return concated.reduce((result, state, index) => {
        if (result.filter(val => _.ObjectHash(val) === _.ObjectHash(state)).length >= 2)
            return result.filter((val, i) => index != i);
        else
            return result;
    }, concated);
};
exports.locations_for_block = async (block, chain, L_Trie) => {
    const targets = block.txs.concat(block.natives).concat(block.units);
    const result = await P.reduce(targets, async (result, tx) => result.concat(await exports.locations_for_tx(tx, chain, L_Trie)), []);
    return result;
};
exports.pure_to_tx = (pure, block) => {
    const index = block.txs.concat(block.natives).concat(block.units).indexOf(pure);
    if (index === -1)
        return TxSet.empty_tx();
    const raw = block.raws[index];
    return {
        hash: pure.hash,
        meta: pure.meta,
        raw: raw
    };
};
const random_chose = (array, num) => {
    for (let i = array.length - 1; i > 0; i--) {
        let r = Math.floor(Math.random() * (i + 1));
        let tmp = array[i];
        array[i] = array[r];
        array[r] = tmp;
    }
    return array.slice(0, num);
};
exports.tx_accept = async (tx, socket) => {
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
    if (_.ObjectHash(new_pool) != _.ObjectHash(pool)) {
        script_1.store.commit("refresh_pool", new_pool);
        socket.emit('tx', JSON.stringify(tx));
    }
};
exports.block_accept = async (block, socket) => {
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
    if (accepted.block.length > 0) {
        await P.forEach(accepted.state, async (state) => {
            if (state.kind === "state")
                await S_Trie.put(state.owner, state);
            else
                await S_Trie.put(state.token, state);
        });
        await P.forEach(accepted.location, async (loc) => {
            await L_Trie.put(loc.address, loc);
        });
        const new_roots = {
            stateroot: S_Trie.now_root(),
            locationroot: L_Trie.now_root()
        };
        script_1.store.commit("refresh_roots", new_roots);
        script_1.store.commit("refresh_candidates", accepted.candidates);
        script_1.store.commit("add_block", accepted.block[0]);
        socket.emit('block', JSON.stringify(block));
    }
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
            /*const pool = store.state.pool;
            const new_pool = Object.assign({[tx.hash]:tx},pool);
            store.commit('refresh_pool',new_pool);*/
            socket.emit('tx', JSON.stringify(tx));
            /*await send_key_block(socket);
            await send_micro_block(socket);*/
        }
    }
    catch (e) {
        console.log(e);
    }
};
exports.send_refresh_tx = async (req_tx, index, code, socket) => {
    try {
        const roots = script_1.store.state.roots;
        const stateroot = roots.stateroot;
        const S_Trie = exports.trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie = exports.trie_ins(locationroot);
        const pub_key = [CryptoSet.PublicFromPrivate(script_1.store.state.secret)];
        const payee = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(pub_key));
        const req_pure = TxSet.tx_to_pure(req_tx);
        const pre_states = await P.map(req_pure.meta.data.base, async (add) => await S_Trie.get(add));
        const output_states = code_1.RunVM(code, pre_states, req_tx.raw.raw, req_pure, con_1.gas_limit);
        const output_raws = output_states.map(state => JSON.stringify(state));
        const chain = script_1.store.state.chain;
        const pre_tx = TxSet.CreateRefreshTx(con_1.my_version, 10, pub_key, con_1.pow_target, 10, req_tx.hash, index, payee, output_raws, [], chain);
        const tx = TxSet.SignTx(pre_tx, script_1.store.state.secret, payee);
        const StateData = await exports.states_for_tx(tx, chain, S_Trie);
        const LocationData = await exports.locations_for_tx(tx, chain, L_Trie);
        if (!TxSet.ValidRefreshTx(tx, chain, con_1.my_version, con_1.native, con_1.unit, con_1.token_name_maxsize, StateData, LocationData))
            console.log("fail to create valid refresh");
        else {
            console.log("create valid refresh tx");
            /*const pool = store.state.pool;
            const new_pool = Object.assign({[tx.hash]:tx},pool);
            store.commit('refresh_pool',new_pool);*/
            socket.emit('tx', JSON.stringify(tx));
        }
    }
    catch (e) {
        console.log(e);
    }
};
exports.send_key_block = async (socket) => {
    const chain = script_1.store.state.chain;
    const pub_key = [CryptoSet.PublicFromPrivate(script_1.store.state.secret)];
    const candidates = script_1.store.state.candidates;
    const roots = script_1.store.state.roots;
    const stateroot = roots.stateroot;
    const S_Trie = exports.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie = exports.trie_ins(locationroot);
    const validator_state = [await S_Trie.get(CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(pub_key)))] || [];
    const pre_block = BlockSet.CreateKeyBlock(con_1.my_version, 0, chain, con_1.block_time, con_1.max_blocks, con_1.pow_target, con_2.pos_diff, con_1.unit, pub_key, _.ObjectHash(candidates), stateroot, locationroot, validator_state);
    const key_block = BlockSet.SignBlock(pre_block, script_1.store.state.secret, pub_key[0]);
    const StateData = await exports.states_for_block(key_block, chain, S_Trie);
    const LocationData = await exports.locations_for_block(key_block, chain, L_Trie);
    const accepted = BlockSet.AcceptBlock(key_block, chain, 0, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, stateroot, locationroot, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, StateData, LocationData);
    if (accepted.block.length === 0)
        console.log("fail to create valid block");
    else {
        /*await P.forEach(accepted.state, async (state:T.State)=>{
            if(state.kind==="state") await S_Trie.put(state.owner,state);
            else await S_Trie.put(state.token,state);
        });
        await P.forEach(accepted.location, async (loc:T.Location)=>{
            await L_Trie.put(loc.address,loc);
        });
        const new_roots = {
            stateroot:S_Trie.now_root(),
            locationroot:L_Trie.now_root()
        }
        console.log("create key block");
        store.commit("refresh_roots",new_roots);
        store.commit("refresh_candidates",accepted.candidates);
        store.commit("add_block",key_block);*/
        socket.emit('block', JSON.stringify(key_block));
        //await send_micro_block(socket);
    }
};
exports.send_micro_block = async (socket) => {
    const pool = script_1.store.state.pool;
    const splited = random_chose(Object.values(pool), con_1.block_size / 100);
    const reduced = splited.reduce((result, tx) => {
        if (tx.meta.data.token === con_1.native)
            result.natives.push(tx);
        else if (tx.meta.data.token === con_1.unit)
            result.units.push(tx);
        else
            result.txs.push(tx);
        return result;
    }, { txs: [], natives: [], units: [] });
    while (1) {
        let chain = script_1.store.state.chain;
        let pub_key = [CryptoSet.PublicFromPrivate(script_1.store.state.secret)];
        let candidates = script_1.store.state.candidates;
        let roots = script_1.store.state.roots;
        let stateroot = roots.stateroot;
        let S_Trie = exports.trie_ins(stateroot);
        let locationroot = roots.locationroot;
        let L_Trie = exports.trie_ins(locationroot);
        let txs = reduced.txs;
        let natives = reduced.natives;
        let units = reduced.units;
        let pre_block = BlockSet.CreateMicroBlock(con_1.my_version, 0, chain, con_1.pow_target, con_2.pos_diff, pub_key, _.ObjectHash(candidates), stateroot, locationroot, txs, natives, units, con_1.block_time);
        let micro_block = BlockSet.SignBlock(pre_block, script_1.store.state.secret, pub_key[0]);
        let StateData = await exports.states_for_block(micro_block, chain, S_Trie);
        let LocationData = await exports.locations_for_block(micro_block, chain, L_Trie);
        let accepted = BlockSet.AcceptBlock(micro_block, chain, 0, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, stateroot, locationroot, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, StateData, LocationData);
        if (accepted.block.length === 0) {
            console.log("fail to create valid block");
            break;
        }
        ;
        /*await P.forEach(accepted.state, async (state:T.State)=>{
            if(state.kind==="state") await S_Trie.put(state.owner,state);
            else await S_Trie.put(state.token,state);
        });
        await P.forEach(accepted.location, async (loc:T.Location)=>{
            await L_Trie.put(loc.address,loc);
        });

        let new_roots = {
            stateroot:S_Trie.now_root(),
            locationroot:L_Trie.now_root()
        }
        let new_pool = ((pool:T.Pool)=>{
            micro_block.txs.concat(micro_block.natives).concat(micro_block.units).forEach(tx=>{
                delete pool[tx.hash];
            });
            return pool;
        })(Object.assign({},store.state.pool));
        store.commit("refresh_pool",new_pool);
        store.commit("refresh_roots",new_roots);
        store.commit("refresh_candidates",accepted.candidates);
        store.commit("add_block",micro_block);*/
        socket.emit('block', JSON.stringify(micro_block));
        console.log("create micro block");
        /*const reqs_pure = micro_block.txs.filter(tx=>tx.meta.kind==="request").concat(micro_block.natives.filter(tx=>tx.meta.kind==="request")).concat(micro_block.units.filter(tx=>tx.meta.kind==="request"));
        if(reqs_pure.length>0){
            await P.forEach(reqs_pure,async (pure:T.TxPure)=>{
                console.log("refresh!")
                const req_tx = pure_to_tx(pure,micro_block);
                const code:string = store.state.code[req_tx.meta.data.token]
                await send_refresh_tx(req_tx,micro_block.meta.index,code,socket);
            })
        }
        if(Object.keys(new_pool).length===0){console.log("no transaction in pool");break;}*/
    }
};
