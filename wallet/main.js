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
const http = __importStar(require("http"));
const express_1 = __importDefault(require("express"));
const faye_1 = __importDefault(require("faye"));
const index_1 = require("./index");
const fs = __importStar(require("fs"));
const gen = __importStar(require("../genesis/index"));
const permessage_deflate_1 = __importDefault(require("permessage-deflate"));
const vue_1 = __importDefault(require("vue"));
const vuex_1 = __importDefault(require("vuex"));
const _ = __importStar(require("../core/basic"));
const CryptoSet = __importStar(require("../core/crypto_set"));
const StateSet = __importStar(require("../core/state"));
const TxSet = __importStar(require("../core/tx"));
const BlockSet = __importStar(require("../core/block"));
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const db_1 = require("./client/db");
const con_1 = require("./con");
const P = __importStar(require("p-iteration"));
const readline_sync_1 = __importDefault(require("readline-sync"));
exports.port = process.env.vreath_port || "57750";
exports.ip = process.env.vreath_ip || "localhost";
const app = express_1.default();
const server = http.createServer(app);
const bayeux = new faye_1.default.NodeAdapter({ mount: '/vreath' });
bayeux.addWebsocketExtension(permessage_deflate_1.default);
bayeux.attach(server);
const codes = {
    "native": "const main = () => {};",
    "unit": "const main = () => {};"
};
exports.json_read = (key, def) => {
    try {
        const get = JSON.parse(fs.readFileSync(key, 'utf-8') || JSON.stringify(def));
        return get;
    }
    catch (e) {
        console.log(e);
        return def;
    }
};
exports.json_write = (key, val) => {
    try {
        fs.writeFileSync(key, JSON.stringify(val, null, '    '));
    }
    catch (e) {
        console.log(e);
    }
};
app.use(express_1.default.static(__dirname + '/client'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});
exports.client = new faye_1.default.Client('http://' + exports.ip + ':' + exports.port + '/vreath');
server.on('close', () => {
    console.log('lose connection');
    exports.json_write("./wallet/json/code.json", {});
    exports.json_write("./wallet/json/pool.json", {});
    exports.json_write("./wallet/json/chain.json", [gen.block]);
    exports.json_write("./wallet/json/roots.json", gen.roots);
    exports.json_write("./wallet/json/candidates.json", gen.candidates);
    exports.json_write("./wallet/json/unit_store.json", {});
});
server.on('error', (e) => console.log(e));
process.on('SIGINT', () => {
    console.log('lose connection');
    exports.json_write("./wallet/json/code.json", {});
    exports.json_write("./wallet/json/pool.json", {});
    exports.json_write("./wallet/json/chain.json", [gen.block]);
    exports.json_write("./wallet/json/roots.json", gen.roots);
    exports.json_write("./wallet/json/candidates.json", gen.candidates);
    exports.json_write("./wallet/json/unit_store.json", {});
    process.exit(1);
});
exports.client.subscribe('/data', async (data) => {
    if (data.type === "tx")
        console.log(data.tx[0]);
    else if (data.type === "block")
        console.log(data.block[0]);
    if (data.type === "block")
        exports.store.commit('push_yet_data', _.copy(data));
    const S_Trie = db_1.trie_ins(exports.store.state.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(con_1.unit, CryptoSet.PublicFromPrivate(exports.store.state.secret));
    const unit_state = await S_Trie.get(unit_address) || StateSet.CreateState(0, unit_address, con_1.unit, 0);
    const unit_amount = unit_state.amount || 0;
    if (data.type === "tx" && unit_amount > 0)
        exports.store.commit('push_yet_data', _.copy(data));
});
exports.client.subscribe('/checkchain', (address) => {
    console.log('checked');
    console.log(exports.store.state.check_mode);
    if (exports.store.getters.my_address === address)
        exports.client.publish('/replacechain', _.copy(exports.store.state.chain));
    return 0;
});
exports.client.subscribe('/replacechain', async (chain) => {
    try {
        console.log("replace:");
        if (!exports.store.state.replace_mode && exports.store.state.check_mode) {
            console.log(chain);
            await index_1.check_chain(_.copy(chain), _.copy(exports.store.state.chain), _.copy(exports.store.state.pool), _.copy(exports.store.state.code), exports.store.state.secret, _.copy(exports.store.state.unit_store));
        }
        exports.store.commit('checking', false);
        console.log(exports.store.state.yet_data);
        return 0;
    }
    catch (e) {
        throw new Error(e);
    }
});
server.listen(exports.port);
vue_1.default.use(vuex_1.default);
exports.store = new vuex_1.default.Store({
    state: {
        code: exports.json_read("./wallet/json/code.json", codes),
        pool: exports.json_read("./wallet/json/pool.json", {}),
        chain: exports.json_read("./wallet/json/chain.json", [gen.block]),
        roots: exports.json_read("./wallet/json/roots.json", gen.roots),
        candidates: exports.json_read("./wallet/json/candidates.json", gen.candidates),
        unit_store: exports.json_read("./wallet/json/unit_store.json", {}),
        secret: CryptoSet.GenerateKeys(),
        balance: 0,
        yet_data: [],
        check_mode: false,
        replace_mode: false,
        replace_index: 0,
        not_refreshed_tx: [],
        now_buying: false,
        now_refreshing: [],
        first_request: true
    },
    mutations: {
        refresh_pool(state, pool) {
            state.pool = _.copy(pool);
            exports.json_write("./wallet/json/pool.json", _.copy(state.pool));
        },
        add_block(state, block) {
            state.chain.push(block);
            exports.json_write("./wallet/json/chain.json", _.copy(state.chain));
        },
        replace_chain(state, chain) {
            state.chain = _.copy(chain).slice().sort((a, b) => {
                return a.meta.index - b.meta.index;
            }).filter((b, i) => b.meta.index === i);
            exports.json_write("./wallet/json/chain.json", _.copy(state.chain));
        },
        refresh_roots(state, roots) {
            state.roots = _.copy(roots);
            exports.json_write("./wallet/json/roots.json", _.copy(state.roots));
        },
        refresh_candidates(state, candidates) {
            state.candidates = _.copy(candidates);
            exports.json_write("./wallet/json/candidates.json", _.copy(state.candidates));
        },
        add_unit(state, unit) {
            const units = _.copy(state.unit_store)[unit.request] || [];
            if (!units.some(u => u.index === unit.index && u.payee === unit.payee)) {
                state.unit_store[unit.request] = _.copy(units).concat(unit);
                exports.json_write("./wallet/json/unit_store.json", _.copy(state.unit_store));
            }
        },
        delete_unit(state, unit) {
            const pre_unit = _.copy(state.unit_store);
            const units = pre_unit[unit.request] || [];
            const deleted = units.filter(u => u.index === unit.index && u.payee != unit.payee && u.output === unit.output);
            state.unit_store[unit.request] = _.copy(deleted);
            if (deleted.length <= 0)
                delete state.unit_store[unit.request];
            exports.json_write("./wallet/json/unit_store.json", _.copy(state.unit_store));
        },
        refresh_unit_store(state, store) {
            state.unit_store = _.copy(store);
            exports.json_write("./wallet/json/unit_store.json", _.copy(state.unit_store));
        },
        refresh_secret(state, secret) {
            state.secret = secret;
        },
        refresh_balance(state, amount) {
            state.balance = amount;
        },
        push_yet_data(state, data) {
            state.yet_data.push(data);
        },
        unshift_yet_data(state, data) {
            state.yet_data.unshift(data);
        },
        refresh_yet_data(state, data) {
            state.yet_data = _.copy(data);
        },
        checking(state, bool) {
            state.check_mode = bool;
            if (bool === true) {
                setTimeout(() => {
                    state.check_mode = false;
                }, con_1.block_time * 10);
            }
        },
        replaceing(state, bool) {
            state.replace_mode = bool;
        },
        rep_limit(state, index) {
            state.replace_index = index;
        },
        add_not_refreshed(state, tx) {
            state.not_refreshed_tx = state.not_refreshed_tx.concat(_.copy(tx));
        },
        del_not_refreshed(state, hashes) {
            state.not_refreshed_tx = state.not_refreshed_tx.filter((tx) => hashes.indexOf(tx.hash) === -1);
        },
        buying_unit(state, bool) {
            state.now_buying = bool;
        },
        new_refreshing(state, requests) {
            state.now_refreshing = requests;
        },
        requested(state) {
            state.first_request = false;
        }
    },
    getters: {
        my_address: (state) => CryptoSet.GenereateAddress(con_1.native, CryptoSet.PublicFromPrivate(state.secret)) || ""
    }
});
const sleep = (msec) => {
    return new Promise(function (resolve) {
        setTimeout(function () { resolve(); }, msec);
    });
};
const send_blocks = async () => {
    const S_Trie = db_1.trie_ins(exports.store.state.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(con_1.unit, CryptoSet.PublicFromPrivate(exports.store.state.secret));
    const unit_state = await S_Trie.get(unit_address) || StateSet.CreateState(0, unit_address, con_1.unit, 0);
    const unit_amount = unit_state.amount || 0;
    const last_key = BlockSet.search_key_block(_.copy(exports.store.state.chain));
    const last_micros = BlockSet.search_micro_block(_.copy(exports.store.state.chain), _.copy(last_key));
    const date = new Date();
    if (!exports.store.state.replace_mode && _.reduce_pub(last_key.meta.validatorPub) === CryptoSet.PublicFromPrivate(exports.store.state.secret) && last_micros.length <= con_1.max_blocks)
        await index_1.send_micro_block(_.copy(exports.store.state.pool), exports.store.state.secret, _.copy(exports.store.state.chain), _.copy(exports.store.state.candidates), _.copy(exports.store.state.roots), exports.store.state.unit_store);
    else if (!exports.store.state.replace_mode && unit_state != null && unit_amount > 0 && date.getTime() - last_key.meta.timestamp > con_1.block_time * con_1.max_blocks)
        await index_1.send_key_block(_.copy(exports.store.state.chain), exports.store.state.secret, _.copy(exports.store.state.candidates), _.copy(exports.store.state.roots));
    if (exports.store.state.first_request && !exports.store.state.replace_mode && unit_state != null && unit_amount > 0 && _.copy(exports.store.state.chain).filter(b => b.natives.length > 0).length === 0) {
        console.log(_.copy(exports.store.state.chain).filter(b => b.natives.length > 0));
        await index_1.send_request_tx(exports.store.state.secret, "issue", con_1.native, [exports.store.getters.my_address, exports.store.getters.my_address], ["remit", JSON.stringify([0])], [], _.copy(exports.store.state.roots), _.copy(exports.store.state.chain));
    }
};
const compute_yet = async () => {
    const data = _.copy(exports.store.state.yet_data[0]);
    if (data == null) {
        exports.store.commit('replaceing', false);
        await send_blocks();
        console.log('yet:');
        console.log(exports.store.state.yet_data);
        await sleep(con_1.block_time);
        return await compute_yet();
    }
    else if (data.type === "tx" && data.tx.length > 0) {
        const target = _.copy(data.tx[0]);
        console.log(target);
        //if(target.meta.kind==="request"||target.meta.data.index<store.state.chain.length){
        await index_1.tx_accept(_.copy(target), _.copy(exports.store.state.chain), _.copy(exports.store.state.roots), _.copy(exports.store.state.pool), exports.store.state.secret, _.copy(exports.store.state.candidates), _.copy(exports.store.state.unit_store));
        const now_yets = _.copy(exports.store.state.yet_data);
        const reduced = now_yets.filter(d => {
            if (d.type === "tx" && d.tx[0] != null)
                return d.tx[0].hash != target.hash;
            else if (d.type === "block" && d.block[0] != null)
                return true;
            else
                return false;
        });
        exports.store.commit("refresh_yet_data", _.copy(reduced));
        console.log(reduced);
        console.log('yet:');
        console.log(exports.store.state.yet_data);
        await sleep(con_1.block_time);
        return await compute_yet();
        /*}
        else{
            const txs:Data[] = store.state.yet_data.filter((d:Data)=>d.type==="tx"&&d.tx[0]!=null&&d.tx[0].hash!=target.hash);
            const blocks:Data[] = store.state.yet_data.filter((d:Data)=>d.type==="block");
            const reduced = txs.concat(blocks);
            const concated = reduced.concat(store.state.yet_data[0]);
            store.commit("refresh_yet_data",concated);
        }*/
    }
    else if (data.type === "block" && data.block.length > 0) {
        const block = data.block[0];
        const chain = _.copy(exports.store.state.chain);
        console.log(block);
        if (block.meta.version >= con_1.compatible_version) {
            if (block.meta.index > chain.length) {
                if (!exports.store.state.replace_mode) {
                    const address = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(block.meta.validatorPub));
                    if (address != exports.store.getters.my_address) {
                        exports.store.commit('checking', true);
                        exports.client.publish("/checkchain", address);
                    }
                    else {
                        const del_yet = _.copy(exports.store.state.yet_data).slice(1);
                        exports.store.commit('refresh_yet_data', del_yet);
                    }
                }
                else
                    exports.store.commit('replaceing', false);
                //await send_blocks();
                await sleep(con_1.block_time);
                return await compute_yet();
            }
            else if (block.meta.index === chain.length) {
                if (exports.store.state.replace_mode && chain[chain.length - 1].meta.index >= exports.store.state.replace_index)
                    exports.store.commit('replaceing', false);
                await index_1.block_accept(_.copy(block), _.copy(exports.store.state.chain), _.copy(exports.store.state.candidates), _.copy(exports.store.state.roots), _.copy(exports.store.state.pool), _.copy(exports.store.state.not_refreshed_tx), exports.store.state.now_buying, _.copy(exports.store.state.unit_store));
                const new_chain = _.copy(exports.store.state.chain);
                console.log(exports.store.state.replace_mode);
                console.log(chain.length);
                console.log(new_chain.length);
                if (exports.store.state.replace_mode && chain.length === new_chain.length)
                    exports.store.commit('replaceing', false);
                if (new_chain.length === chain.length + 1) {
                    const refs = _.copy(block.txs.concat(block.natives).concat(block.units)).filter(tx => tx.meta.kind === "refresh");
                    const now_yets = _.copy(exports.store.state.yet_data);
                    let units = [];
                    const reduced = now_yets.filter(d => {
                        if (d.type === "tx" && d.tx[0] != null) {
                            const t = _.copy(d.tx[0]);
                            return !refs.some(tx => {
                                if (t.meta.kind === "refresh" && t.meta.data.index === tx.meta.data.index && t.meta.data.request === tx.meta.data.request) {
                                    const unit = {
                                        request: t.meta.data.request,
                                        index: t.meta.data.index,
                                        nonce: t.meta.nonce,
                                        payee: t.meta.data.payee,
                                        output: t.meta.data.output,
                                        unit_price: t.meta.unit_price
                                    };
                                    units.push(_.copy(unit));
                                    return true;
                                }
                                //else if(t.meta.kind==="request"&&t.hash===tx.meta.data.request) return true;
                                else
                                    return false;
                            });
                        }
                        else if (d.type === "block" && d.block[0] != null)
                            return d.block[0].meta.index > block.meta.index;
                        else
                            return false;
                    });
                    exports.store.commit("refresh_yet_data", reduced);
                    /*const pre_unit_store:{[key:string]:T.Unit[]} = _.copy(store.state.unit_store);
                    const new_unit_store:{[key:string]:T.Unit[]} = _.new_obj(
                        pre_unit_store,
                        (store)=>{
                            units.forEach(unit=>{
                                const pre = store[unit.request] || [];
                                if(store[unit.request]!=null&&store[unit.request].some(u=>_.toHash(u.payee+u.request+u.index.toString())===_.toHash(unit.payee+unit.request+unit.index.toString())||u.output!=unit.output)) return store;
                                store[unit.request] = pre.concat(unit);
                            });
                            return store;
                        }
                    );
                    store.commit("refresh_unit_store",new_unit_store);*/
                }
                else {
                    const now_yets = _.copy(exports.store.state.yet_data);
                    const reduced = now_yets.filter(d => {
                        if (d.type === "tx" && d.tx[0] != null)
                            return true;
                        else if (d.type === "block" && d.block[0] != null)
                            return d.block[0].meta.index > block.meta.index;
                        else
                            return false;
                    });
                    exports.store.commit("refresh_yet_data", reduced);
                }
                const balance = await index_1.get_balance(exports.store.getters.my_address);
                exports.store.commit("refresh_balance", balance);
                let refreshed_hash = [];
                let get_not_refresh = [];
                for (let block of _.copy(new_chain).slice().reverse()) {
                    for (let tx of _.copy(block.txs.concat(block.natives).concat(block.units))) {
                        if (_.copy(tx).meta.kind === "request" && refreshed_hash.indexOf(_.copy(tx).hash) === -1)
                            get_not_refresh.push(_.copy(TxSet.pure_to_tx(_.copy(tx), _.copy(block))));
                        else if (_.copy(tx).meta.kind === "refresh")
                            refreshed_hash.push(_.copy(tx).meta.data.request);
                        else if (get_not_refresh.length >= 10)
                            break;
                    }
                }
                const refreshes = _.copy(get_not_refresh);
                const related = refreshes.filter(tx => {
                    if (tx.meta.pre.flag === true) {
                        const pres = TxSet.list_up_related(new_chain, TxSet.tx_to_pure(tx).meta, "pre");
                        return pres.length > 0;
                    }
                    else if (tx.meta.next.flag === true) {
                        const nexts = TxSet.list_up_related(new_chain, TxSet.tx_to_pure(tx).meta, "next");
                        return nexts.length > 0;
                    }
                    else
                        return true;
                });
                console.log('not refreshed:');
                console.log(related);
                if (related.length > 0) {
                    const req_tx = related[0];
                    const index = (() => {
                        for (let block of _.copy(new_chain).slice().reverse()) {
                            let txs = block.txs.concat(block.natives).concat(block.units);
                            let i = txs.map(tx => tx.hash).indexOf(req_tx.hash);
                            if (i != -1)
                                return block.meta.index;
                        }
                        return 0;
                    })();
                    const code = exports.store.state.code[req_tx.meta.data.token];
                    //await send_refresh_tx(_.copy(store.state.roots),store.state.secret,_.copy(req_tx),index,code,_.copy(new_chain));
                    //await send_blocks();
                }
                /*if(refs_pure.length>0){
                    await P.forEach(refs_pure, async (pure:T.TxPure)=>{
                        const req = pure.meta.data.request;
                        const buy_units:T.Unit[] = store.state.unit_store[req];
                        await unit_buying(store.state.secret,buy_units.slice(),_.copy(store.state.roots),store.state.chain.slice());
                    })
                }*/
                const unit_store_values = Object.values(exports.store.state.unit_store);
                const units_sum = unit_store_values.reduce((sum, us) => sum + us.length, 0);
                const reversed_chain = _.copy(new_chain).slice().reverse();
                const refreshed = (() => {
                    let result = [];
                    let price_sum;
                    let flag = false;
                    for (let block of reversed_chain) {
                        const txs = _.copy(block).txs.concat(block.natives).concat(block.units).slice();
                        for (let tx of txs) {
                            if (tx.meta.kind === "refresh") {
                                result = result.concat(unit_store_values.reduce((result, us) => {
                                    if (us.length > 0 && us[0].request === tx.meta.data.request) {
                                        price_sum = result.reduce((sum, unit) => new bignumber_js_1.default(sum).plus(unit.unit_price).toNumber(), 0);
                                        us.forEach(u => {
                                            if (new bignumber_js_1.default(price_sum).plus(u.unit_price).isGreaterThanOrEqualTo(new bignumber_js_1.default(balance).times(0.99))) {
                                                flag = true;
                                                return result;
                                            }
                                            else {
                                                price_sum = new bignumber_js_1.default(price_sum).plus(u.unit_price).toNumber();
                                                result.push(u);
                                            }
                                        });
                                        return result;
                                    }
                                    else
                                        return result;
                                }, []));
                            }
                            if (result.length === units_sum || flag)
                                break;
                        }
                    }
                    return result;
                })();
                console.log(unit_store_values);
                console.log('buy_units are:');
                console.log(refreshed);
                console.log(exports.store.state.now_buying);
                if (refreshed.length > 0 && !exports.store.state.now_buying && !exports.store.state.replace_mode) {
                    const validatorPub = BlockSet.search_key_block(_.copy(reversed_chain)).meta.validatorPub;
                    const validator_address = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(validatorPub));
                    const buy_units = refreshed;
                    await index_1.unit_buying(exports.store.state.secret, _.copy(buy_units), _.copy(exports.store.state.roots), _.copy(new_chain));
                    //await send_blocks();
                }
                console.log('yet:');
                console.log(exports.store.state.yet_data);
                await send_blocks();
                await sleep(con_1.block_time);
                return await compute_yet();
            }
            else {
                const now_yets = _.copy(exports.store.state.yet_data);
                const reduced = now_yets.filter(d => {
                    if (d.type === "tx" && d.tx[0] != null)
                        return true;
                    else if (d.type === "block" && d.block[0] != null)
                        return d.block[0].meta.index != block.meta.index;
                    else
                        return false;
                });
                console.log(reduced);
                exports.store.commit("refresh_yet_data", _.copy(reduced));
                console.log('yet:');
                console.log(exports.store.state.yet_data);
                await sleep(con_1.block_time);
                return await compute_yet();
            }
        }
    }
};
(async () => {
    exports.json_write("./wallet/json/code.json", {});
    exports.json_write("./wallet/json/pool.json", {});
    exports.json_write("./wallet/json/chain.json", [gen.block]);
    exports.json_write("./wallet/json/roots.json", gen.roots);
    exports.json_write("./wallet/json/candidates.json", gen.candidates);
    exports.json_write("./wallet/json/unit_store.json", {});
    const secret = readline_sync_1.default.question("What is your secret?");
    console.log(secret);
    exports.store.commit('refresh_secret', secret);
    const gen_S_Trie = db_1.trie_ins("");
    await P.forEach(gen.state, async (s) => {
        await gen_S_Trie.put(s.owner, s);
    });
    const last_block = _.copy(exports.store.state.chain[exports.store.state.chain.length - 1]) || _.copy(gen.block);
    const last_address = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(last_block.meta.validatorPub));
    console.log(last_address);
    if (last_address != exports.store.getters.my_address) {
        exports.store.commit('checking', true);
        exports.client.publish("/checkchain", last_address);
    }
    const balance = await index_1.get_balance(exports.store.getters.my_address);
    console.log(balance);
    exports.store.commit("refresh_balance", balance);
    console.log('yet:');
    console.log(exports.store.state.yet_data);
    await compute_yet();
})();
