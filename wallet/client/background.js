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
const index_1 = require("./index");
const CryptoSet = __importStar(require("../../core/crypto_set"));
const _ = __importStar(require("../../core/basic"));
const con_1 = require("../con");
const peer_list_1 = require("./peer_list");
const gen = __importStar(require("../../genesis/index"));
const P = __importStar(require("p-iteration"));
const faye_1 = __importDefault(require("faye"));
const TxSet = __importStar(require("../../core/tx"));
const BlockSet = __importStar(require("../../core/block"));
const StateSet = __importStar(require("../../core/state"));
const storeName = 'vreath';
let db;
/*const open_req = indexedDB.open(storeName,1);
open_req.onupgradeneeded = (event)=>{
    db = open_req.result;
    db.createObjectStore(storeName,{keyPath:'id'});
}
open_req.onsuccess = (event)=>{
    console.log('db open success');
    db = open_req.result;
    db.close();
}
open_req.onerror = ()=>console.log("fail to open db");*/
exports.read_db = (key, def) => {
    const req = indexedDB.open('vreath', 2);
    let result = def;
    req.onerror = () => console.log('fail to open db');
    req.onupgradeneeded = (event) => {
        db = req.result;
        db.createObjectStore(storeName, { keyPath: 'id' });
    };
    req.onsuccess = (event) => {
        db = req.result;
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const get_req = store.get(key);
        get_req.onsuccess = () => {
            result = get_req.source.val;
        };
        db.close();
    };
    return result;
};
exports.write_db = (key, val) => {
    const req = indexedDB.open('vreath', 2);
    req.onerror = () => console.log('fail to open db');
    req.onupgradeneeded = (event) => {
        db = req.result;
        db.createObjectStore(storeName, { keyPath: 'id' });
    };
    req.onsuccess = (event) => {
        db = req.result;
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const data = {
            id: key,
            val: val
        };
        const put_req = store.put(data);
        put_req.onsuccess = () => console.log('write data success');
        tx.oncomplete = () => console.log('transaction complete');
    };
};
exports.delete_db = () => {
    const del_db_vreath = indexedDB.deleteDatabase('vreath');
    del_db_vreath.onsuccess = () => console.log('db delete success');
    del_db_vreath.onerror = () => console.log('db delete error');
    const del_db_level = indexedDB.deleteDatabase('level-js-./db');
    del_db_level.onsuccess = () => console.log('db delete success');
    del_db_level.onerror = () => console.log('db delete error');
};
const test_secret = "f836d7c5aa3f9fcf663d56e803972a573465a988d6457f1111e29e43ed7a1041";
const wallet = {
    name: "wallet",
    icon: "./img/vreathrogoi.jpg",
    pub_keys: [],
    deposited: 0
};
const setting = {
    name: "setting",
    icon: "./img/setting_icon.png",
    pub_keys: [],
    deposited: 0
};
const def_apps = {
    wallet: wallet,
    setting: setting
};
const codes = {
    "native": "const main = () => {};",
    "unit": "const main = () => {};"
};
class Store {
    constructor() {
        this._code = exports.read_db('code', codes);
        this._pool = exports.read_db('pool', {});
        this._chain = exports.read_db('chain', [gen.block]);
        this._roots = exports.read_db('roots', gen.roots);
        this._candidates = exports.read_db('candidates', gen.candidates);
        this._unit_store = exports.read_db('unit_store', {});
        this._secret = exports.read_db('secret', CryptoSet.GenerateKeys());
        this._balance = exports.read_db('balance', 0);
        this._yet_data = [];
        this._check_mode = false;
        this._replace_mode = false;
        this._replace_index = 0;
        this._not_refreshed_tx = [];
        this._now_buying = false;
        this._now_refreshing = [];
        this._req_index_map = {};
    }
    get code() {
        return this._code;
    }
    get pool() {
        return this._pool;
    }
    get chain() {
        return this._chain;
    }
    get roots() {
        return this._roots;
    }
    get candidates() {
        return this._candidates;
    }
    get unit_store() {
        return this._unit_store;
    }
    get secret() {
        return this._secret;
    }
    get balance() {
        return this._balance;
    }
    get yet_data() {
        return this._yet_data;
    }
    get check_mode() {
        return this._check_mode;
    }
    get replace_mode() {
        return this._replace_mode;
    }
    get replace_index() {
        return this._replace_index;
    }
    get not_refreshed_tx() {
        return this._not_refreshed_tx;
    }
    get now_buying() {
        return this._now_buying;
    }
    get now_refreshing() {
        return this._now_refreshing;
    }
    get req_index_map() {
        return this._req_index_map;
    }
    get my_address() {
        return CryptoSet.GenereateAddress(con_1.native, CryptoSet.PublicFromPrivate(this._secret)) || "";
    }
    refresh_pool(pool) {
        this._pool = _.copy(pool);
        exports.write_db('pool', _.copy(this.pool));
        /*self.postMessage({
            key:'refresh_pool',
            val:_.copy(pool)
        },location.protocol+'//'+location.host);*/
    }
    add_block(block) {
        this._chain = _.copy(this._chain).concat(block).filter((b, i) => b.meta.index === i);
        exports.write_db('chain', _.copy(this._chain));
        /*self.postMessage({
            key:'add_block',
            val:_.copy(block)
        },location.protocol+'//'+location.host);*/
    }
    replace_chain(chain) {
        this._chain = _.copy(chain).slice().sort((a, b) => {
            return a.meta.index - b.meta.index;
        }).filter((b, i) => b.meta.index === i);
        exports.write_db('chain', _.copy(this._chain));
        /*self.postMessage({
            key:'replace_chain',
            val:_.copy(chain)
        },location.protocol+'//'+location.host);*/
    }
    refresh_roots(roots) {
        this._roots = _.copy(roots);
        exports.write_db('roots', _.copy(this._roots));
        /*self.postMessage({
            key:'refresh_roots',
            val:_.copy(roots)
        },location.protocol+'//'+location.host);*/
    }
    refresh_candidates(candidates) {
        this._candidates = _.copy(candidates);
        exports.write_db('candidates', _.copy(this._candidates));
        /*self.postMessage({
            key:'refresh_candidates',
            val:_.copy(candidates)
        },location.protocol+'//'+location.host);*/
    }
    add_unit(unit) {
        const units = _.copy(this._unit_store)[unit.request] || [];
        if (!units.some(u => u.index === unit.index && u.payee === unit.payee)) {
            this._unit_store[unit.request] = _.copy(units).concat(unit);
            exports.write_db('unit_store', _.copy(this._unit_store));
            /*self.postMessage({
                key:'add_unit',
                val:_.copy(unit)
            },location.protocol+'//'+location.host);*/
        }
    }
    delete_unit(unit) {
        const units = _.copy(this._unit_store)[unit.request] || [];
        const deleted = units.filter(u => u.index === unit.index && u.payee != unit.payee && u.output === unit.output);
        this._unit_store[unit.request] = _.copy(deleted);
        if (deleted.length <= 0)
            delete this._unit_store[unit.request];
        exports.write_db('unit_store', _.copy(this._unit_store));
        /*self.postMessage({
            key:'delete_unit',
            val:_.copy(unit)
        },location.protocol+'//'+location.host);*/
    }
    refresh_unit_store(store) {
        this._unit_store = _.copy(store);
        exports.write_db('unit_store', _.copy(this._unit_store));
        /*self.postMessage({
            key:'refresh_unit_store',
            val:_.copy(store)
        },location.protocol+'//'+location.host);*/
    }
    refresh_secret(secret) {
        this._secret = secret;
        exports.write_db('secret', this._secret);
        /*self.postMessage({
            key:'refresh_secret',
            val:secret
        },location.protocol+'//'+location.host);*/
    }
    refresh_balance(amount) {
        this._balance = amount;
        exports.write_db('balance', this._balance);
        /*self.postMessage({
            key:'refresh_balance',
            val:amount
        },location.protocol+'//'+location.host);*/
    }
    push_yet_data(data) {
        this._yet_data.push(data);
        /*self.postMessage({
            key:'push_yet_data',
            val:data
        },location.protocol+'//'+location.host);*/
    }
    unshift_yet_data(data) {
        this._yet_data.unshift(data);
        /*self.postMessage({
            key:'unshift_yet_data',
            val:data
        },location.protocol+'//'+location.host);*/
    }
    refresh_yet_data(data) {
        this._yet_data = _.copy(data);
        /*self.postMessage({
            key:'refresh_yet_data',
            val:data
        },location.protocol+'//'+location.host);*/
    }
    checking(bool) {
        this._check_mode = bool;
        if (bool === true) {
            setTimeout(() => {
                this._check_mode = false;
            }, con_1.block_time * 10);
        }
        /*self.postMessage({
            key:'checking',
            val:bool
        },location.protocol+'//'+location.host);*/
    }
    replaceing(bool) {
        this._replace_mode = bool;
        /*self.postMessage({
            key:'replaceing',
            val:bool
        },location.protocol+'//'+location.host);*/
    }
    rep_limit(index) {
        this._replace_index = index;
        /*self.postMessage({
            key:'rep_limit',
            val:index
        },location.protocol+'//'+location.host);*/
    }
    add_not_refreshed(tx) {
        this._not_refreshed_tx = this._not_refreshed_tx.concat(_.copy(tx));
        /*self.postMessage({
            key:'add_not_refreshed',
            val:_.copy(tx)
        },location.protocol+'//'+location.host);*/
    }
    del_not_refreshed(hashes) {
        this._not_refreshed_tx = this._not_refreshed_tx.filter((tx) => hashes.indexOf(tx.hash) === -1);
        /*self.postMessage({
            key:'del_not_refreshed',
            val:_.copy(hashes)
        },location.protocol+'//'+location.host);*/
    }
    buying_unit(bool) {
        this._now_buying = bool;
        /*self.postMessage({
            key:'buying_unit',
            val:bool
        },location.protocol+'//'+location.host);*/
    }
    new_refreshing(requests) {
        this._now_refreshing = requests;
        /*self.postMessage({
            key:'new_refreshing',
            val:_.copy(requests)
        },location.protocol+'//'+location.host);*/
    }
    add_req_index(key, index) {
        this._req_index_map[key] = index;
    }
    del_req_index(key) {
        delete this._req_index_map[key];
    }
}
exports.Store = Store;
exports.store = new Store();
const sleep = (msec) => {
    return new Promise(function (resolve) {
        setTimeout(function () { resolve(); }, msec);
    });
};
const send_blocks = async () => {
    const S_Trie = index_1.trie_ins(exports.store.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(con_1.unit, CryptoSet.PublicFromPrivate(exports.store.secret));
    const unit_state = await S_Trie.get(unit_address) || StateSet.CreateState(0, unit_address, con_1.unit, 0);
    const unit_amount = unit_state.amount || 0;
    const last_key = BlockSet.search_key_block(_.copy(exports.store.chain));
    const last_micros = BlockSet.search_micro_block(_.copy(exports.store.chain), _.copy(last_key));
    const date = new Date();
    if (!exports.store.replace_mode && _.reduce_pub(last_key.meta.validatorPub) === CryptoSet.PublicFromPrivate(exports.store.secret) && last_micros.length <= con_1.max_blocks)
        await index_1.send_micro_block(_.copy(exports.store.pool), exports.store.secret, _.copy(exports.store.chain), _.copy(exports.store.candidates), _.copy(exports.store.roots), exports.store.unit_store);
    if (!exports.store.replace_mode && unit_state != null && unit_amount > 0 && date.getTime() - last_key.meta.timestamp > con_1.block_time * con_1.max_blocks)
        await index_1.send_key_block(_.copy(exports.store.chain), exports.store.secret, _.copy(exports.store.candidates), _.copy(exports.store.roots));
};
exports.compute_yet = async () => {
    const data = _.copy(exports.store.yet_data[0]);
    if (data == null) {
        exports.store.replaceing(false);
        await send_blocks();
        console.log('yet:');
        console.log(exports.store.yet_data.length);
        await sleep(con_1.block_time);
        //return await compute_yet();
    }
    else if (data.type === "tx" && data.tx.length > 0) {
        const target = _.copy(data.tx[0]);
        //if(target.meta.kind==="request"||target.meta.data.index<store.state.chain.length){
        await index_1.tx_accept(_.copy(target), _.copy(exports.store.chain), _.copy(exports.store.roots), _.copy(exports.store.pool), exports.store.secret, _.copy(exports.store.candidates), _.copy(exports.store.unit_store));
        const now_yets = _.copy(exports.store.yet_data);
        const reduced = now_yets.filter(d => {
            if (d.type === "tx" && d.tx[0] != null)
                return d.tx[0].hash != target.hash;
            else if (d.type === "block" && d.block[0] != null)
                return true;
            else
                return false;
        });
        exports.store.refresh_yet_data(_.copy(reduced));
        console.log('yet:');
        console.log(exports.store.yet_data.length);
        await sleep(con_1.block_time);
        //return await compute_yet();
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
        const chain = _.copy(exports.store.chain);
        if (block.meta.version >= con_1.compatible_version) {
            if (block.meta.index > chain.length) {
                if (!exports.store.replace_mode) {
                    const address = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(block.meta.validatorPub));
                    if (address != exports.store.my_address) {
                        exports.store.checking(true);
                        exports.client.publish("/checkchain", address);
                    }
                    else {
                        const deled_yet = _.copy(exports.store.yet_data).slice(1);
                        exports.store.refresh_yet_data(deled_yet);
                    }
                }
                else
                    exports.store.replaceing(false);
                //await send_blocks();
                await sleep(con_1.block_time);
                //return await compute_yet();
            }
            else if (block.meta.index === chain.length) {
                if (exports.store.replace_mode && chain[chain.length - 1].meta.index >= exports.store.replace_index)
                    exports.store.replaceing(false);
                await index_1.block_accept(_.copy(block), _.copy(exports.store.chain), _.copy(exports.store.candidates), _.copy(exports.store.roots), _.copy(exports.store.pool), _.copy(exports.store.not_refreshed_tx), exports.store.now_buying, _.copy(exports.store.unit_store));
                const new_chain = _.copy(exports.store.chain);
                if (exports.store.replace_mode && chain.length === new_chain.length)
                    exports.store.replaceing(false);
                if (exports.store.replace_mode) {
                    postMessage({
                        key: 'replaceing',
                        val: true
                    });
                }
                else {
                    postMessage({
                        key: 'replaceing',
                        val: false
                    });
                }
                if (new_chain.length === chain.length + 1) {
                    const refs = _.copy(block.txs.concat(block.natives).concat(block.units)).filter(tx => tx.meta.kind === "refresh");
                    const now_yets = _.copy(exports.store.yet_data);
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
                    exports.store.refresh_yet_data(_.copy(reduced));
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
                    const now_yets = _.copy(exports.store.yet_data);
                    const reduced = now_yets.filter(d => {
                        if (d.type === "tx" && d.tx[0] != null)
                            return true;
                        else if (d.type === "block" && d.block[0] != null)
                            return d.block[0].meta.index > block.meta.index;
                        else
                            return false;
                    });
                    exports.store.refresh_yet_data(reduced);
                }
                const balance = await index_1.get_balance(exports.store.my_address);
                exports.store.refresh_balance(balance);
                postMessage({
                    key: 'refresh_balance',
                    val: balance
                });
                /*let refreshed_hash:string[] = [];
                let get_not_refresh:T.Tx[] = [];
                for(let block of _.copy(new_chain).slice().reverse()){
                    for(let tx of _.copy(block.txs.concat(block.natives).concat(block.units))){
                        if(_.copy(tx).meta.kind==="request"&&refreshed_hash.indexOf(_.copy(tx).hash)===-1) get_not_refresh.push(_.copy(TxSet.pure_to_tx(_.copy(tx),_.copy(block))));
                        else if(_.copy(tx).meta.kind==="refresh") refreshed_hash.push(_.copy(tx).meta.data.request);
                        else if(get_not_refresh.length>=10) break;
                    }
                }*/
                const refreshes = _.copy(exports.store.not_refreshed_tx);
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
                if (related.length > 0) {
                    const req_tx = related[0];
                    const index = exports.store.req_index_map[req_tx.hash] || 0;
                    const code = exports.store.code[req_tx.meta.data.token];
                    await index_1.send_refresh_tx(_.copy(exports.store.roots), exports.store.secret, _.copy(req_tx), index, code, _.copy(new_chain));
                    //await send_blocks();
                }
                /*if(refs_pure.length>0){
                    await P.forEach(refs_pure, async (pure:T.TxPure)=>{
                        const req = pure.meta.data.request;
                        const buy_units:T.Unit[] = store.state.unit_store[req];
                        await unit_buying(store.state.secret,buy_units.slice(),_.copy(store.state.roots),store.state.chain.slice());
                    })
                }*/
                /*const unit_store_values:T.Unit[][] = Object.values(store.unit_store);
                const units_sum = unit_store_values.reduce((sum,us)=>sum+us.length,0);
                const reversed_chain:T.Block[] = _.copy(new_chain).slice().reverse();
                const refreshed = (()=>{
                    let result:T.Unit[] = [];
                    let price_sum:number;
                    let flag = false;
                    for(let block of reversed_chain){
                        const txs = _.copy(block).txs.concat(block.natives).concat(block.units).slice();
                        for(let tx of txs){
                            if(tx.meta.kind==="refresh"){
                                result = result.concat(unit_store_values.reduce((result,us)=>{
                                    if(us.length>0&&us[0].request===tx.meta.data.request){
                                        price_sum = result.reduce((sum,unit)=>new BigNumber(sum).plus(unit.unit_price).toNumber(),0);
                                        us.forEach(u=>{
                                            if(new BigNumber(price_sum).plus(u.unit_price).isGreaterThanOrEqualTo(new BigNumber(balance).times(0.99))){
                                                flag = true;
                                                return result;
                                            }
                                            else{
                                                price_sum = new BigNumber(price_sum).plus(u.unit_price).toNumber();
                                                result.push(u);
                                            }
                                        });
                                        return result;
                                    }
                                    else return result;
                                },[]));
                            }
                            if(result.length===units_sum||flag) break;
                        }
                    }
                    return result;
                })();
                console.log(unit_store_values);
                console.log('buy_units are:')
                console.log(refreshed)
                console.log(store.now_buying)
                if(refreshed.length>0&&!store.now_buying&&!store.replace_mode){
                    const validatorPub = BlockSet.search_key_block(_.copy(reversed_chain)).meta.validatorPub;
                    const validator_address = CryptoSet.GenereateAddress(native,_.reduce_pub(validatorPub));
                    const buy_units = refreshed;
                    await unit_buying(store.secret,_.copy(buy_units),_.copy(store.roots),_.copy(new_chain));
                    //await send_blocks();
                }*/
                console.log('yet:');
                console.log(exports.store.yet_data.length);
                await send_blocks();
                if (!exports.store.replace_mode || exports.store.yet_data.length > 10)
                    await sleep(con_1.block_time);
                //return await compute_yet();
            }
            else {
                const now_yets = _.copy(exports.store.yet_data);
                const reduced = now_yets.filter(d => {
                    if (d.type === "tx" && d.tx[0] != null)
                        return true;
                    else if (d.type === "block" && d.block[0] != null)
                        return d.block[0].meta.index > block.meta.index;
                    else
                        return false;
                });
                exports.store.refresh_yet_data(_.copy(reduced));
                console.log('yet:');
                console.log(exports.store.yet_data.length);
                await sleep(con_1.block_time);
                //return await compute_yet();
            }
        }
        else {
            const now_yets = _.copy(exports.store.yet_data);
            const reduced = now_yets.filter(d => {
                if (d.type === "tx" && d.tx[0] != null)
                    return true;
                else if (d.type === "block" && d.block[0] != null)
                    return d.block[0].meta.index > block.meta.index;
                else
                    return false;
            });
            exports.store.refresh_yet_data(_.copy(reduced));
            console.log('yet:');
            console.log(exports.store.yet_data.length);
            await sleep(con_1.block_time);
            //return await compute_yet();
        }
    }
    setImmediate(exports.compute_yet);
};
const port = peer_list_1.peer_list[0].port || "57750";
const ip = peer_list_1.peer_list[0].ip || "localhost";
console.log(ip);
exports.client = new faye_1.default.Client('http://' + ip + ':' + port + '/vreath');
exports.client.subscribe('/data', async (data) => {
    if (data.type === "block")
        exports.store.push_yet_data(_.copy(data));
    const S_Trie = index_1.trie_ins(exports.store.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(con_1.unit, CryptoSet.PublicFromPrivate(exports.store.secret));
    const unit_state = await S_Trie.get(unit_address) || StateSet.CreateState(0, unit_address, con_1.unit, 0);
    const unit_amount = unit_state.amount || 0;
    if (data.type === "tx" && unit_amount > 0)
        exports.store.push_yet_data(_.copy(data));
});
exports.client.subscribe('/checkchain', (address) => {
    console.log('checked');
    console.log(exports.store.check_mode);
    if (exports.store.my_address === address)
        exports.client.publish('/replacechain', _.copy(exports.store.chain));
    return 0;
});
exports.client.subscribe('/replacechain', async (chain) => {
    console.log("replace:");
    if (!exports.store.replace_mode && exports.store.check_mode) {
        await index_1.check_chain(_.copy(chain), _.copy(exports.store.chain), _.copy(exports.store.pool), _.copy(exports.store.code), exports.store.secret, _.copy(exports.store.unit_store));
    }
    exports.store.checking(false);
    console.log(exports.store.yet_data.length);
    return 0;
});
exports.client.bind('transport:down', () => {
    console.log('lose connection');
    exports.delete_db();
    exports.client = new faye_1.default.Client('http://' + ip + ':' + port + '/vreath');
});
/*(async ()=>{
    const gen_S_Trie = trie_ins("");
    await P.forEach(gen.state,async (s:T.State)=>{
        await gen_S_Trie.put(s.owner,s);
    });
    const last_block:T.Block = _.copy(store.state.chain[store.state.chain.length-1]) || _.copy(gen.block);
    const last_address = CryptoSet.GenereateAddress(native,_.reduce_pub(last_block.meta.validatorPub));
    console.log(last_address);
    if(last_address!=store.getters.my_address){
        store.commit('checking',true);
        client.publish("/checkchain",last_address);
    }
    const balance = await get_balance(store.getters.my_address);
    console.log(balance);
    store.commit("refresh_balance",balance);
    console.log('yet:')
    console.log(store.state.yet_data);;
    await compute_yet();
})()*/
self.onmessage = async (event) => {
    try {
        const type = event.data.type;
        switch (type) {
            case 'commit':
                const key = event.data.key;
                const val = event.data.val;
                if (key != null)
                    exports.store[key](val);
            case 'start':
                exports.delete_db();
                const gen_S_Trie = index_1.trie_ins("");
                await P.forEach(gen.state, async (s) => {
                    await gen_S_Trie.put(s.owner, s);
                });
                const chain = exports.read_db('chain', [gen.block]);
                const last_block = _.copy(chain[chain.length - 1]) || _.copy(gen.block);
                const last_address = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(last_block.meta.validatorPub));
                if (last_address != exports.store.my_address) {
                    exports.store.checking(true);
                    exports.client.publish("/checkchain", last_address);
                }
                const balance = await index_1.get_balance(exports.store.my_address);
                exports.store.refresh_balance(balance);
                postMessage({
                    key: 'refresh_balance',
                    val: balance
                });
                setImmediate(exports.compute_yet);
            case 'send_request':
                const options = event.data;
                await index_1.send_request_tx(exports.store.secret, options.tx_type, options.token, options.base, options.input_raw, options.log, _.copy(exports.store.roots), _.copy(exports.store.chain));
            case 'get_balance':
                const got_balance = await index_1.get_balance(event.data.address) || 0;
                postMessage({
                    address: event.data.address,
                    amount: got_balance
                });
        }
    }
    catch (e) {
        console.log(e);
    }
};
