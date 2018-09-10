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
const gen = __importStar(require("../../genesis/index"));
const code_1 = require("../../core/code");
const script_2 = require("./script");
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
    const base_states = await P.reduce(base, async (result, key) => {
        const getted = await S_Trie.get(key);
        if (getted == null)
            return result;
        else
            return result.concat(getted);
    }, []);
    const outputs = output_keys(tx);
    const output_states = await P.reduce(outputs, async (result, key) => {
        const getted = await S_Trie.get(key);
        if (getted == null)
            return result;
        else
            return result.concat(getted);
    }, []);
    const payes = pays(tx, chain);
    const pay_states = await P.reduce(payes, async (result, key) => {
        const getted = await S_Trie.get(key);
        if (getted == null)
            return result.concat(StateSet.CreateState(0, key, con_1.native, 0));
        else
            return result.concat(getted);
    }, []);
    const concated = base_states.concat(output_states).concat(pay_states);
    const hashes = concated.map(state => _.ObjectHash(state));
    return concated.filter((val, i) => hashes.indexOf(_.ObjectHash(val)) === i);
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
    const native_validator_state = await S_Trie.get(native_validator) || StateSet.CreateState(0, native_validator, con_1.native);
    const unit_validator = CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(block.meta.validatorPub));
    const unit_validator_state = await S_Trie.get(unit_validator) || StateSet.CreateState(0, unit_validator, con_1.unit);
    const targets = block.txs.concat(block.natives).concat(block.units).map(pure => TxSet.pure_to_tx(pure, block));
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
    const unit_states = await P.reduce(block.units, async (result, tx) => {
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
        const remiter = await S_Trie.get(raw.raw[1]) || StateSet.CreateState(0, raw.raw[1], con_1.native, 0);
        const units = JSON.parse(raw.raw[2]);
        const sellers = await P.map(units, async (u) => await S_Trie.get(u.payee) || StateSet.CreateState(0, u.payee, con_1.native, 0));
        return result.concat(sellers).concat(remiter);
    }, []) || [];
    const all_units = Object.values(await S_Trie.filter((key, state) => {
        return state.kind === "state" && state.token === con_1.unit;
    }));
    const native_token = await S_Trie.get(con_1.native);
    const unit_token = await S_Trie.get(con_1.unit);
    const concated = tx_states.concat(native_validator_state).concat(unit_validator_state).concat(native_states).concat(unit_states).concat(all_units).concat(native_token).concat(unit_token);
    console.log(concated);
    return concated.filter((val, i, array) => array.map(s => _.ObjectHash(s)).indexOf(_.ObjectHash(val)) === i);
};
exports.locations_for_block = async (block, chain, L_Trie) => {
    const targets = block.txs.concat(block.natives).concat(block.units);
    const tx_loc = await P.reduce(targets, async (result, tx) => result.concat(await exports.locations_for_tx(tx, chain, L_Trie)), []);
    const native_validator = await L_Trie.get(CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(block.meta.validatorPub)));
    const unit_validator = await L_Trie.get(CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(block.meta.validatorPub)));
    const concated = (() => {
        let array = tx_loc.slice();
        if (native_validator != null)
            array.push(native_validator);
        if (unit_validator != null)
            array.push(unit_validator);
        return array;
    })();
    return concated.filter((val, i, array) => array.map(l => _.ObjectHash(l)).indexOf(_.ObjectHash(val)) === i);
};
exports.random_chose = (array, num) => {
    for (let i = array.length - 1; i > 0; i--) {
        let r = Math.floor(Math.random() * (i + 1));
        let tmp = array[i];
        array[i] = array[r];
        array[r] = tmp;
    }
    return array.slice(0, num);
};
exports.tx_accept = async (tx, chain, roots, pool, secret, candidates, unit_store) => {
    console.log("tx_accept");
    const stateroot = roots.stateroot;
    const S_Trie = exports.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie = exports.trie_ins(locationroot);
    const states = await exports.states_for_tx(tx, chain, S_Trie) || [];
    const locations = await exports.locations_for_tx(tx, chain, L_Trie) || [];
    const new_pool = tx_pool_1.Tx_to_Pool(pool, tx, con_1.my_version, con_1.native, con_1.unit, chain, con_1.token_name_maxsize, states, locations);
    if (tx.meta.kind === "refresh") {
        const new_unit = {
            request: tx.meta.data.request,
            index: tx.meta.data.index,
            nonce: tx.meta.nonce,
            payee: tx.meta.data.payee,
            output: tx.meta.data.output,
            unit_price: tx.meta.unit_price
        };
        const new_unit_store = _.new_obj(unit_store, (store) => {
            const pre = store[tx.meta.data.request] || [];
            if (store[tx.meta.data.request] != null && store[tx.meta.data.request].some(u => _.ObjectHash(u) === _.ObjectHash(new_unit)))
                return store;
            store[tx.meta.data.request] = pre.concat(new_unit);
            return store;
        });
        script_1.store.commit("refresh_unit_store", new_unit_store);
        /*const already = (()=>{
            for(let block of chain.slice().reverse()){
                for(let tx of block.txs.concat(block.natives).concat(block.units)){
                    if(tx.meta.kind==="refresh"&&tx.meta.data.request===new_unit.request&&tx.meta.data.index===new_unit.index) return true;
                }
            }
            return false;
        })();
        console.log("already:")
        console.log(already);*/
    }
    if (_.ObjectHash(new_pool) != _.ObjectHash(pool)) {
        script_1.store.commit("refresh_pool", _.copy(new_pool));
        /*if(Object.keys(new_pool).length>=1&&unit_amount>0){
            await send_key_block(chain.slice(),secret,candidates.slice(),_.copy(roots),_.copy(new_pool),codes,validator_mode);
        }*/
        return _.copy(new_pool);
    }
    else
        return _.copy(pool);
};
exports.block_accept = async (block, chain, candidates, roots, pool, codes, secret, unit_store) => {
    console.log("block_accept");
    const stateroot = roots.stateroot;
    const S_Trie = exports.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie = exports.trie_ins(locationroot);
    const StateData = await exports.states_for_block(block, chain, S_Trie);
    const LocationData = await exports.locations_for_block(block, chain, L_Trie);
    const accepted = await BlockSet.AcceptBlock(block, chain, 0, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, stateroot, locationroot, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, con_1.all_issue, StateData, LocationData);
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
        console.log(await S_Trie.filter());
        console.log(await L_Trie.filter());
        const new_roots = {
            stateroot: S_Trie.now_root(),
            locationroot: L_Trie.now_root()
        };
        const new_pool = ((p) => {
            block.txs.concat(block.natives).concat(block.units).forEach(tx => {
                delete p[tx.hash];
            });
            return p;
        })(_.copy(pool));
        const new_chain = chain.slice().concat(accepted.block[0]);
        await script_1.store.commit('refresh_pool', _.copy(new_pool));
        await script_1.store.commit("refresh_roots", _.copy(new_roots));
        await script_1.store.commit("refresh_candidates", accepted.candidates.slice());
        await script_1.store.commit("add_block", _.copy(accepted.block[0]));
        return {
            pool: _.copy(new_pool),
            roots: _.copy(new_roots),
            candidates: accepted.candidates.slice(),
            chain: new_chain,
        };
    }
    else {
        console.log("receive invalid block");
        /*const last_key = BlockSet.search_key_block(chain);
        const last_micros = BlockSet.search_micro_block(chain,last_key);

        const my_unit_state:T.State = await S_Trie.get(CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(secret)));
        const date = new Date();

        if(!store.state.check_mode&&_.reduce_pub(last_key.meta.validatorPub)===CryptoSet.PublicFromPrivate(store.state.secret)&&last_micros.length<=max_blocks) await send_micro_block(_.copy(pool),secret,chain.slice(),accepted.candidates.slice(),_.copy(roots),unit_store);
        else if(!store.state.check_mode&&my_unit_state!=null&&my_unit_state.amount>0&&date.getTime()-last_key.meta.timestamp>block_time*max_blocks) await send_key_block(chain.slice(),secret,accepted.candidates.slice(),_.copy(roots));*/
        return {
            pool: _.copy(pool),
            roots: _.copy(roots),
            candidates: candidates.slice(),
            chain: chain.slice()
        };
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
exports.send_request_tx = async (secret, to, amount, roots, chain) => {
    try {
        console.log("send_request_tx");
        const pub_key = [CryptoSet.PublicFromPrivate(secret)];
        const from = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(pub_key));
        const pre_tx = TxSet.CreateRequestTx(pub_key, from, Math.pow(2, -5), "scrap", con_1.native, [from], ["remit", to, "-" + amount], [], con_1.my_version, TxSet.empty_tx_pure().meta.pre, TxSet.empty_tx_pure().meta.next, Math.pow(2, -18));
        const tx = TxSet.SignTx(pre_tx, secret, pub_key[0]);
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
            script_2.client.publish('/data', { type: 'tx', tx: [tx], block: [] });
            //await store.dispatch("tx_accept",_.copy(tx));
            //await tx_accept(tx,chain,roots,pool,secret,mode,candidates,codes,socket);
            /*const pool = store.state.pool;
            const new_pool = Object.assign({[tx.hash]:tx},pool);
            store.commit('refresh_pool',new_pool);*/
            /*await send_key_block(socket);
            await send_micro_block(socket);*/
        }
    }
    catch (e) {
        console.log(e);
    }
};
exports.send_refresh_tx = async (roots, secret, req_tx, index, code, chain) => {
    try {
        console.log("send_refresh_tx");
        const stateroot = roots.stateroot;
        const S_Trie = exports.trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie = exports.trie_ins(locationroot);
        const pub_key = [CryptoSet.PublicFromPrivate(secret)];
        const payee = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(pub_key));
        const req_pure = TxSet.tx_to_pure(req_tx);
        const pre_states = await P.map(req_pure.meta.data.base, async (add) => await S_Trie.get(add));
        const token = req_tx.meta.data.token || "";
        const token_state = await S_Trie.get(token) || StateSet.CreateToken(0, token);
        const pure_chain = chain.map(b => {
            return {
                hash: b.hash,
                meta: b.meta
            };
        });
        const relate_pre_tx = (() => {
            for (let block of chain.slice().reverse()) {
                const index = block.txs.map(t => t.hash).concat(block.natives.map(t => t.hash)).concat(block.units.map(t => t.hash)).indexOf(req_tx.meta.pre.hash) || -1;
                if (index === -1)
                    continue;
                const pure = block.txs.concat(block.natives).concat(block.units)[index];
                return {
                    hash: pure.hash,
                    meta: pure.meta,
                    raw: block.raws[index]
                };
            }
            return TxSet.empty_tx();
        })();
        const relate_next_tx = (() => {
            for (let block of chain.slice().reverse()) {
                const index = block.txs.map(t => t.hash).concat(block.natives.map(t => t.hash)).concat(block.units.map(t => t.hash)).indexOf(req_tx.meta.next.hash) || -1;
                if (index === -1)
                    continue;
                const pure = block.txs.concat(block.natives).concat(block.units)[index];
                return {
                    hash: pure.hash,
                    meta: pure.meta,
                    raw: block.raws[index]
                };
            }
            return TxSet.empty_tx();
        })();
        const output_states = code_1.RunVM(code, pre_states, req_tx.raw.raw, req_pure, token_state, pure_chain, relate_pre_tx, relate_next_tx, con_1.gas_limit);
        const output_raws = output_states.map(state => JSON.stringify(state));
        const pre_tx = TxSet.CreateRefreshTx(con_1.my_version, 0.1, pub_key, con_1.pow_target, Math.pow(2, -18), req_tx.hash, index, payee, output_raws, [], chain);
        const tx = TxSet.SignTx(pre_tx, secret, pub_key[0]);
        const StateData = await exports.states_for_tx(tx, chain, S_Trie);
        const LocationData = await exports.locations_for_tx(tx, chain, L_Trie);
        if (!TxSet.ValidRefreshTx(tx, chain, con_1.my_version, con_1.native, con_1.unit, con_1.token_name_maxsize, StateData, LocationData))
            console.log("fail to create valid refresh");
        else {
            console.log("create valid refresh tx");
            script_2.client.publish('/data', { type: 'tx', tx: [tx], block: [] });
            //await store.dispatch("tx_accept",_.copy(tx));
            //await tx_accept(tx,chain,roots,pool,secret,mode,candidates,codes,socket);
            /*const pool = store.state.pool;
            const new_pool = Object.assign({[tx.hash]:tx},pool);
            store.commit('refresh_pool',new_pool);*/
        }
    }
    catch (e) {
        console.log(e);
    }
};
exports.send_key_block = async (chain, secret, candidates, roots) => {
    console.log("send_key_block");
    const pub_key = [CryptoSet.PublicFromPrivate(secret)];
    const stateroot = roots.stateroot;
    const S_Trie = exports.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie = exports.trie_ins(locationroot);
    const validator_address = CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(pub_key));
    const validator_state = [await S_Trie.get(validator_address) || StateSet.CreateState(0, validator_address, con_1.unit, 0, {}, [])];
    const pre_block = BlockSet.CreateKeyBlock(con_1.my_version, 0, chain, con_1.block_time, con_1.max_blocks, con_1.pow_target, con_1.pos_diff, con_1.unit, pub_key, _.ObjectHash(candidates), stateroot, locationroot, validator_state);
    const key_block = BlockSet.SignBlock(pre_block, secret, pub_key[0]);
    const StateData = await exports.states_for_block(key_block, chain, S_Trie);
    const LocationData = await exports.locations_for_block(key_block, chain, L_Trie);
    const check = BlockSet.ValidKeyBlock(key_block, chain, 0, con_1.my_version, candidates, stateroot, locationroot, con_1.block_size, con_1.native, con_1.unit, StateData, LocationData);
    if (!check)
        console.log("fail to create valid block");
    else {
        script_2.client.publish('/data', { type: 'block', tx: [], block: [key_block] });
        //await store.dispatch("block_accept",_.copy(key_block));
        //await block_accept(key_block,chain,candidates,roots,pool,codes,secret,mode,socket);
    }
};
exports.send_micro_block = async (pool, secret, chain, candidates, roots, unit_store) => {
    console.log("send_micro_block");
    const stateroot = roots.stateroot;
    const S_Trie = exports.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie = exports.trie_ins(locationroot);
    console.log(Object.values(pool));
    const splited = exports.random_chose(Object.values(pool), con_1.block_size / 1000);
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
    const txs = reduced.txs;
    const natives = reduced.natives;
    const units = reduced.units;
    const pre_block = BlockSet.CreateMicroBlock(con_1.my_version, 0, chain, con_1.pow_target, con_1.pos_diff, pub_key, _.ObjectHash(candidates), stateroot, locationroot, txs, natives, units, con_1.block_time);
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
        script_2.client.publish('/data', { type: 'block', tx: [], block: [micro_block] });
        //await store.dispatch("block_accept",_.copy(micro_block));
        //await block_accept(micro_block,chain,candidates,roots,pool,codes,secret,mode,socket);
        console.log("create micro block");
        //await send_micro_block(socket);
    }
    else if (invalid_index != -1) {
        const target_pure = micro_block.txs.concat(micro_block.natives).concat(micro_block.units)[invalid_index];
        const del_pool = ((p) => {
            delete p[target_pure.hash];
            return p;
        })(_.copy(pool));
        const add_unit_store = ((store) => {
            if (target_pure.meta.kind === "refresh") {
                const new_unit = {
                    request: target_pure.meta.data.request,
                    index: target_pure.meta.data.index,
                    nonce: target_pure.meta.nonce,
                    payee: target_pure.meta.data.payee,
                    output: target_pure.meta.data.output,
                    unit_price: target_pure.meta.unit_price
                };
                const pre = store[target_pure.meta.data.request] || [];
                store[target_pure.meta.data.request] = pre.concat(new_unit);
                return store;
            }
            else
                return store;
        })(_.copy(unit_store));
        script_1.store.commit("refresh_pool", _.copy(del_pool));
        script_1.store.commit("refresh_unit_store", _.copy(add_unit_store));
        await exports.send_micro_block(_.copy(del_pool), secret, chain.slice(), candidates.slice(), _.copy(roots), _.copy(unit_store));
    }
    else {
        console.log("fall to create micro block;");
    }
};
const get_pre_info = async (chain) => {
    const pre_block = chain[chain.length - 1] || BlockSet.empty_block();
    const S_Trie = exports.trie_ins(pre_block.meta.stateroot);
    const StateData = await exports.states_for_block(pre_block, chain.slice(0, pre_block.meta.index), S_Trie);
    const L_Trie = exports.trie_ins(pre_block.meta.locationroot);
    const LocationData = await exports.locations_for_block(pre_block, chain.slice(0, pre_block.meta.index), L_Trie);
    /*const pre_block2 = chain[chain.length-2] || BlockSet.empty_block();
    const pre_S_Trie = trie_ins(pre_block2.meta.stateroot);
    const pre_StateData = await states_for_block(pre_block2,chain.slice(0,pre_block.meta.index-1),pre_S_Trie);*/
    const candidates = BlockSet.CandidatesForm(BlockSet.get_units(con_1.unit, StateData));
    const accepted = await BlockSet.AcceptBlock(pre_block, chain.slice(0, pre_block.meta.index), 0, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates.slice(), S_Trie.now_root(), L_Trie.now_root(), con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, con_1.all_issue, StateData, LocationData);
    await P.forEach(accepted.state, async (state) => {
        if (state.kind === "state")
            await S_Trie.put(state.owner, state);
        else
            await S_Trie.put(state.token, state);
    });
    await P.forEach(accepted.location, async (loc) => {
        await L_Trie.put(loc.address, loc);
    });
    const pre_root = {
        stateroot: S_Trie.now_root(),
        locationroot: L_Trie.now_root()
    };
    return [_.copy(pre_root), accepted.candidates.slice()];
};
exports.check_chain = async (new_chain, my_chain, pool, codes, secret, unit_store) => {
    if (new_chain.length > my_chain.length) {
        const news = new_chain.slice().reverse();
        let target = [];
        for (let index in news) {
            let i = Number(index);
            if (my_chain[news.length - i - 1] != null && my_chain[news.length - i - 1].hash === news[i].hash)
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
        /*const back_chain:T.Block[] = [gen.block];
        const add_blocks = new_chain.slice(1);*/
        script_1.store.commit("replace_chain", back_chain.slice());
        const info = await (async () => {
            if (back_chain.length === 1) {
                return {
                    pool: _.copy(pool),
                    roots: _.copy(gen.roots),
                    candidates: gen.candidates.slice(),
                    chain: back_chain.slice()
                };
            }
            const pre_info = await get_pre_info(back_chain);
            return {
                pool: _.copy(pool),
                roots: _.copy(pre_info[0]),
                candidates: pre_info[1].slice(),
                chain: back_chain.slice()
            };
        })();
        const add_blocks_data = add_blocks.map(block => {
            return {
                type: 'block',
                tx: [],
                block: [block]
            };
        });
        script_1.store.commit("refresh_roots", _.copy(info.roots));
        script_1.store.commit("refresh_candidates", info.candidates.slice());
        //store.commit('checking',true);
        //store.commit('check_limit',add_blocks[add_blocks.length-1].meta.index);
        script_1.store.commit('refresh_yet_data', add_blocks_data);
        //add_blocks.forEach(block=>store.commit('push_yet_block',block));
        /*store.commit("checking",true);
        await P.reduce(add_blocks,async (result:{pool:T.Pool,roots:{[key:string]:string},candidates:T.Candidates[],chain:T.Block[]},block:T.Block)=>{
            const accepted = await block_accept(block,result.chain.slice(),result.candidates.slice(),_.copy(result.roots),_.copy(result.pool),codes,secret,unit_store);
            return _.copy(accepted);
        },info);
        store.commit("checking",false);*/
        const amount = await exports.get_balance(script_1.store.getters.my_address);
        script_1.store.commit("refresh_balance", amount);
    }
    else
        console.log("not replace");
};
exports.unit_buying = async (secret, units, roots, chain) => {
    try {
        console.log("unit!");
        const pub_key = [CryptoSet.PublicFromPrivate(secret)];
        const from = CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(pub_key));
        const remiter = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(pub_key));
        const pre_tx = TxSet.CreateRequestTx(pub_key, remiter, Math.pow(2, -5), "issue", con_1.unit, [from], ["buy", remiter, JSON.stringify(units)], [], con_1.my_version, TxSet.empty_tx_pure().meta.pre, TxSet.empty_tx_pure().meta.next, Math.pow(10, -18));
        const tx = TxSet.SignTx(pre_tx, secret, pub_key[0]);
        const stateroot = roots.stateroot;
        const S_Trie = exports.trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie = exports.trie_ins(locationroot);
        const StateData = await exports.states_for_tx(tx, chain, S_Trie);
        const LocationData = await exports.locations_for_tx(tx, chain, L_Trie);
        if (!TxSet.ValidRequestTx(tx, con_1.my_version, con_1.native, con_1.unit, StateData, LocationData))
            console.log("fail to buy units");
        else {
            console.log("buy unit!");
            script_2.client.publish('/data', { type: 'tx', tx: [tx], block: [] });
        }
    }
    catch (e) {
        console.log(e);
    }
};
