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
    console.log(tx);
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
    const targets = block.txs.concat(block.natives).concat(block.units).map(pure => exports.pure_to_tx(pure, block));
    const tx_states = await P.reduce(targets, async (result, tx) => result.concat(await exports.states_for_tx(tx, chain, S_Trie)), []);
    const native_states = await P.map(block.natives, async (tx) => {
        const key = (() => {
            if (tx.meta.kind === "request")
                return tx.hash;
            else
                return tx.meta.data.request;
        })();
        const b = (() => {
            if (tx.meta.kind === "request")
                return block;
            else
                return chain[tx.meta.data.index] || BlockSet.empty_block();
        })();
        const i = b.natives.map(t => t.hash).indexOf(key);
        const raw = b.raws[b.txs.length + i] || TxSet.empty_tx().raw;
        return await S_Trie.get(raw.raw[1]) || StateSet.CreateState(0, raw.raw[1], con_1.native, 0);
    });
    const unit_states = await P.map(block.units, async (tx) => {
        const key = (() => {
            if (tx.meta.kind === "request")
                return tx.hash;
            else
                return tx.meta.data.request;
        })();
        const b = (() => {
            if (tx.meta.kind === "request")
                return block;
            else
                return chain[tx.meta.data.index] || BlockSet.empty_block();
        })();
        const i = b.units.map(t => t.hash).indexOf(key);
        const raw = b.raws[b.txs.length + b.natives.length + i] || TxSet.empty_tx().raw;
        const remiter = await S_Trie.get(raw.raw[1]) || StateSet.CreateState(0, raw.raw[1], con_1.unit, 0);
        const items = JSON.parse(raw.raw[2]) || [TxSet.empty_tx()];
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
exports.tx_accept = async (tx, chain, roots, pool, secret, validator_mode, candidates, socket) => {
    const stateroot = roots.stateroot;
    const S_Trie = exports.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie = exports.trie_ins(locationroot);
    const states = await exports.states_for_tx(tx, chain, S_Trie) || [];
    const locations = await exports.locations_for_tx(tx, chain, L_Trie) || [];
    const new_pool = tx_pool_1.Tx_to_Pool(pool, tx, con_1.my_version, con_1.native, con_1.unit, chain, con_1.token_name_maxsize, states, locations);
    const unit_address = CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub([CryptoSet.PublicFromPrivate(secret)]));
    const unit_state = await S_Trie.get(unit_address) || StateSet.CreateState(0, unit_address, con_1.unit, 0, {}, []);
    const unit_amount = unit_state.amount;
    if (_.ObjectHash(new_pool) != _.ObjectHash(pool) && unit_amount > 0) {
        script_1.store.commit("refresh_pool", new_pool);
        if (validator_mode && tx.meta.kind === "refresh")
            await exports.send_micro_block(Object.assign({}, new_pool), secret, chain.slice(), candidates.slice(), Object.assign({}, roots), socket);
        else
            await exports.send_key_block(chain.slice(), secret, candidates.slice(), Object.assign({}, roots), socket);
        //socket.emit('tx',JSON.stringify(tx))
        return new_pool;
    }
    else
        return pool;
};
exports.block_accept = async (block, chain, candidates, roots, pool, codes, secret, socket) => {
    try {
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
            const new_pool = ((p) => {
                block.txs.concat(block.natives).concat(block.units).forEach(tx => {
                    delete p[tx.hash];
                });
                return p;
            })(pool);
            await script_1.store.commit('refresh_pool', new_pool);
            await script_1.store.commit("refresh_roots", new_roots);
            await script_1.store.commit("refresh_candidates", accepted.candidates);
            await script_1.store.commit("add_block", accepted.block[0]);
            //socket.emit('block',JSON.stringify(block));
            const reqs_pure = block.txs.filter(tx => tx.meta.kind === "request").concat(block.natives.filter(tx => tx.meta.kind === "request")).concat(block.units.filter(tx => tx.meta.kind === "request"));
            await exports.send_micro_block(Object.assign({}, new_pool), secret, chain.concat(accepted.block[0]), accepted.candidates.slice(), Object.assign({}, new_roots), socket);
            if (reqs_pure.length > 0) {
                await P.forEach(reqs_pure, async (pure) => {
                    console.log("refresh!");
                    const req_tx = exports.pure_to_tx(pure, block);
                    const code = codes[req_tx.meta.data.token];
                    await exports.send_refresh_tx(Object.assign({}, new_roots), secret, req_tx, block.meta.index, code, chain.concat(accepted.block[0]), socket);
                });
            }
            return {
                pool: new_pool,
                roots: new_roots,
                candidates: accepted.candidates,
                chain: chain.concat(accepted.block[0]),
            };
        }
        else {
            console.log("receive invalid block");
            return {
                pool: pool,
                roots: roots,
                candidates: candidates,
                chain: chain
            };
        }
    }
    catch (e) {
        console.log(e);
    }
};
exports.tx_check = (block, chain, StateData, LocationData) => {
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
    return target.reduce((num, tx, i) => {
        if (tx.meta.kind === "request" && !TxSet.ValidRequestTx(tx, con_1.my_version, con_1.native, con_1.unit, StateData, LocationData)) {
            return i;
        }
        else if (tx.meta.kind === "refresh" && !TxSet.ValidRefreshTx(tx, chain, con_1.my_version, con_1.native, con_1.unit, con_1.token_name_maxsize, StateData, LocationData)) {
            return i;
        }
        else
            return num;
    }, -1);
};
exports.get_balance = async (address) => {
    const S_Trie = exports.trie_ins(script_1.store.state.roots.stateroot || "");
    const state = await S_Trie.get(address);
    if (state == null)
        return 0;
    return state.amount;
};
exports.send_request_tx = async (secret, to, amount, roots, chain, socket) => {
    try {
        const pub_key = [CryptoSet.PublicFromPrivate(secret)];
        const from = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(pub_key));
        const pre_tx = TxSet.CreateRequestTx(pub_key, from, 10, "scrap", con_1.native, [from], ["remit", to, "-" + amount], [], con_1.my_version, TxSet.empty_tx_pure().meta.pre, TxSet.empty_tx_pure().meta.next, 0.0000000001);
        const tx = TxSet.SignTx(pre_tx, secret, from);
        const stateroot = roots.stateroot;
        const S_Trie = exports.trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie = exports.trie_ins(locationroot);
        const StateData = await exports.states_for_tx(tx, chain, S_Trie);
        const LocationData = await exports.locations_for_tx(tx, chain, L_Trie);
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
exports.send_refresh_tx = async (roots, secret, req_tx, index, code, chain, socket) => {
    try {
        const stateroot = roots.stateroot;
        const S_Trie = exports.trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie = exports.trie_ins(locationroot);
        const pub_key = [CryptoSet.PublicFromPrivate(secret)];
        const payee = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(pub_key));
        const req_pure = TxSet.tx_to_pure(req_tx);
        const pre_states = await P.map(req_pure.meta.data.base, async (add) => await S_Trie.get(add));
        const output_states = code_1.RunVM(code, pre_states, req_tx.raw.raw, req_pure, con_1.gas_limit);
        const output_raws = output_states.map(state => JSON.stringify(state));
        const pre_tx = TxSet.CreateRefreshTx(con_1.my_version, 10, pub_key, con_1.pow_target, 0.0000000001, req_tx.hash, index, payee, output_raws, [], chain);
        const tx = TxSet.SignTx(pre_tx, secret, payee);
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
exports.send_key_block = async (chain, secret, candidates, roots, socket) => {
    const pub_key = [CryptoSet.PublicFromPrivate(secret)];
    const stateroot = roots.stateroot;
    const S_Trie = exports.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie = exports.trie_ins(locationroot);
    const validator_address = CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(pub_key));
    const validator_state = [await S_Trie.get(validator_address) || StateSet.CreateState(0, validator_address, con_1.unit, 0, {}, [])];
    const pre_block = BlockSet.CreateKeyBlock(con_1.my_version, 0, chain, con_1.block_time, con_1.max_blocks, con_1.pow_target, con_2.pos_diff, con_1.unit, pub_key, _.ObjectHash(candidates), stateroot, locationroot, validator_state);
    const key_block = BlockSet.SignBlock(pre_block, secret, pub_key[0]);
    const StateData = await exports.states_for_block(key_block, chain, S_Trie);
    const LocationData = await exports.locations_for_block(key_block, chain, L_Trie);
    const accepted = BlockSet.AcceptBlock(key_block, chain, 0, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, stateroot, locationroot, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, StateData, LocationData);
    if (accepted.block.length === 0)
        console.log("fail to create valid block");
    else {
        socket.emit('block', JSON.stringify(key_block));
    }
};
exports.send_micro_block = async (pool, secret, chain, candidates, roots, socket) => {
    if (Object.keys(pool).length > 0) {
        const stateroot = roots.stateroot;
        const S_Trie = exports.trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie = exports.trie_ins(locationroot);
        const splited = random_chose(Object.values(pool), con_1.block_size / 100);
        const not_same = splited.reduce((result, tx) => {
            const bases = result.reduce((r, t) => {
                if (t.meta.kind === "request")
                    return r.concat(t.meta.data.base);
                else
                    return r;
            }, []);
            const requests = result.reduce((r, t) => {
                if (t.meta.kind === "refresh")
                    return r.concat(t.meta.data.request);
                else
                    return r;
            }, []);
            if (tx.meta.kind === "request" && !bases.some(b => tx.meta.data.base.indexOf(b) != -1))
                return result.concat(tx);
            else if (tx.meta.kind === "refresh" && requests.indexOf(tx.meta.data.request) === -1)
                return result.concat(tx);
            else
                return result;
        }, []);
        const reduced = not_same.reduce((result, tx) => {
            if (tx.meta.data.token === con_1.native)
                result.natives.push(tx);
            else if (tx.meta.data.token === con_1.unit)
                result.units.push(tx);
            else
                result.txs.push(tx);
            return result;
        }, { txs: [], natives: [], units: [] });
        const pub_key = [CryptoSet.PublicFromPrivate(secret)];
        chain.sort((a, b) => {
            return a.meta.index - b.meta.index;
        });
        ;
        const txs = reduced.txs;
        const natives = reduced.natives;
        const units = reduced.units;
        const pre_block = BlockSet.CreateMicroBlock(con_1.my_version, 0, chain, con_1.pow_target, con_2.pos_diff, pub_key, _.ObjectHash(candidates), stateroot, locationroot, txs, natives, units, con_1.block_time);
        const micro_block = BlockSet.SignBlock(pre_block, secret, pub_key[0]);
        const StateData = await exports.states_for_block(micro_block, chain, S_Trie);
        const LocationData = await exports.locations_for_block(micro_block, chain, L_Trie);
        //console.log(BlockSet.ValidMicroBlock(micro_block,chain,0,my_version,candidates,stateroot,locationroot,block_time,max_blocks,block_size,native,unit,token_name_maxsize,StateData,LocationData))
        const invalid_index = exports.tx_check(micro_block, chain, StateData, LocationData);
        const block_check = BlockSet.ValidMicroBlock(micro_block, chain, 0, con_1.my_version, candidates, stateroot, locationroot, con_1.block_time, con_1.max_blocks, con_1.block_size, con_1.native, con_1.unit, con_1.token_name_maxsize, StateData, LocationData);
        if (invalid_index === -1 && block_check) {
            /*const new_pool = ((p)=>{
                micro_block.txs.concat(micro_block.natives).concat(micro_block.units).forEach(tx=>{
                    delete p[tx.hash];
                });
                return p;
            })(pool);
            store.commit('refresh_pool',new_pool);*/
            socket.emit('block', JSON.stringify(micro_block));
            console.log("create micro block");
            //await send_micro_block(socket);
        }
        else if (invalid_index != -1) {
            const target_pure = micro_block.txs.concat(micro_block.natives).concat(micro_block.units)[invalid_index];
            const del_pool = ((p) => {
                delete p[target_pure.hash];
                return p;
            })(Object.assign({}, pool));
            script_1.store.commit("refresh_pool", del_pool);
            await exports.send_micro_block(del_pool, secret, chain, candidates, roots, socket);
        }
        else {
            console.log("fall to create micro block;");
        }
    }
    else
        script_1.store.commit('validator_time');
};
exports.check_chain = async (new_chain, my_chain, pool, roots, candidates, codes, secret, socket) => {
    if (new_chain.length > my_chain.length) {
        const news = new_chain.slice().reverse();
        let target = [];
        for (let index in news) {
            let i = Number(index);
            if (my_chain[news.length - i - 1] != null && _.ObjectHash(my_chain[news.length - i - 1]) === _.ObjectHash(news[i]))
                break;
            else if (news[i].meta.kind === "key")
                target.push(news[i]);
            else if (news[i].meta.kind === "micro")
                target.push(news[i]);
        }
        const add_blocks = target.slice().reverse();
        const back_chain = my_chain.slice(0, add_blocks[0].meta.index);
        console.log("add_block:");
        console.log(add_blocks);
        script_1.store.commit("replace_chain", back_chain);
        const info = {
            pool: pool,
            roots: roots,
            candidates: candidates,
            chain: back_chain
        };
        await P.reduce(add_blocks, async (result, block) => {
            const accepted = await exports.block_accept(block, result.chain.slice(), result.candidates.slice(), result.roots, result.pool, codes, secret, socket);
            const amount = await exports.get_balance(script_1.store.getters.my_address);
            script_1.store.commit("refresh_balance", amount);
            return accepted;
        }, info);
    }
    else
        console.log("not replace");
};
