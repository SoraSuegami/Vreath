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
const gen = __importStar(require("../../genesis/index"));
const code_1 = require("../../core/code");
const bignumber_js_1 = require("bignumber.js");
const faye_1 = __importDefault(require("faye"));
const io = __importStar(require("socket.io-client"));
const peer_list_1 = require("./peer_list");
const jszip_1 = __importDefault(require("jszip"));
const codes = {
    "native": "const main = () => {};",
    "unit": "const main = () => {};"
};
class Store {
    constructor(_isNode, read_func, write_func) {
        this._isNode = _isNode;
        this.read_func = read_func;
        this.write_func = write_func;
        this._code = codes;
        this._pool = {};
        this._chain = [gen.block];
        this._roots = gen.roots;
        this._candidates = gen.candidates;
        this._unit_store = {};
        this._secret = CryptoSet.GenerateKeys();
        this._balance = 0;
        this._peers = { type: 'client', ip: 'localhost', port: 57750, time: 0 };
        this._yet_data = [];
        this._check_mode = false;
        this._replace_mode = false;
        this._replace_index = 0;
        this._rebuild_mode = false;
        this._not_refreshed_tx = [];
        this._now_buying = false;
        this._now_refreshing = [];
        this._req_index_map = {};
        this._return_chain = false;
        this._first_request = true;
        this._invalids = 0;
        this._loop_mode = false;
    }
    async read() {
        this._code = await this.read_func('code', codes);
        this._pool = await this.read_func('pool', {});
        this._chain = await this.read_func('chain', [gen.block]);
        this._roots = await this.read_func('roots', gen.roots);
        this._candidates = await this.read_func('candidates', gen.candidates);
        this._unit_store = await this.read_func('unit_store', {});
        if (!this._isNode) {
            this._secret = await this.read_func('secret', this._secret);
            this._balance = await this.read_func('balance', 0);
            this._peers = await this.read_func('peers', { type: 'client', ip: 'localhost', port: 57750, time: 0 });
        }
    }
    async write() {
        await this.write_func('pool', this.pool);
        await this.write_func('chain', this.chain);
        await this.write_func('roots', this.roots);
        await this.write_func('candidates', this.candidates);
        await this.write_func('unit_store', this.unit_store);
        if (!this.isNode) {
            await this.write_func('secret', this.secret);
            await this.write_func('balance', this.balance);
        }
    }
    get isNode() {
        return this._isNode;
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
    get rebuild_mode() {
        return this._rebuild_mode;
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
    get return_chain() {
        return this._return_chain;
    }
    get first_request() {
        return this._first_request;
    }
    get invalids() {
        return this._invalids;
    }
    get loop_mode() {
        return this._loop_mode;
    }
    get my_address() {
        return CryptoSet.GenereateAddress(con_1.native, CryptoSet.PublicFromPrivate(this._secret)) || "";
    }
    get unit_address() {
        return CryptoSet.GenereateAddress(con_1.unit, CryptoSet.PublicFromPrivate(this._secret)) || "";
    }
    refresh_pool(pool) {
        this._pool = _.copy(pool);
        //this.write_func('pool',_.copy(this.pool));
        /*self.postMessage({
            key:'refresh_pool',
            val:_.copy(pool)
        },location.protocol+'//'+location.host);*/
    }
    add_block(block) {
        this._chain = _.copy(this._chain).concat(block).filter((b, i) => b.meta.index === i);
        //this.write_func('chain',_.copy(this._chain));
        /*self.postMessage({
            key:'add_block',
            val:_.copy(block)
        },location.protocol+'//'+location.host);*/
    }
    replace_chain(chain) {
        this._chain = _.copy(chain).slice().sort((a, b) => {
            return a.meta.index - b.meta.index;
        }).filter((b, i) => b.meta.index === i);
        //this.write_func('chain',_.copy(this._chain));
        /*self.postMessage({
            key:'replace_chain',
            val:_.copy(chain)
        },location.protocol+'//'+location.host);*/
    }
    refresh_roots(roots) {
        this._roots = _.copy(roots);
        //this.write_func('roots',_.copy(this._roots));
        /*self.postMessage({
            key:'refresh_roots',
            val:_.copy(roots)
        },location.protocol+'//'+location.host);*/
    }
    refresh_candidates(candidates) {
        this._candidates = _.copy(candidates);
        //this.write_func('candidates',_.copy(this._candidates));
        /*self.postMessage({
            key:'refresh_candidates',
            val:_.copy(candidates)
        },location.protocol+'//'+location.host);*/
    }
    add_unit(unit) {
        const units = _.copy(this._unit_store)[unit.request] || [];
        if (!units.some(u => u.index === unit.index && u.payee === unit.payee)) {
            this._unit_store[unit.request] = _.copy(units).concat(unit);
            //this.write_func('unit_store',_.copy(this._unit_store));
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
        //this.write_func('unit_store',_.copy(this._unit_store));
        /*self.postMessage({
            key:'delete_unit',
            val:_.copy(unit)
        },location.protocol+'//'+location.host);*/
    }
    refresh_unit_store(store) {
        this._unit_store = _.copy(store);
        //this.write_func('unit_store',_.copy(this._unit_store));
        /*self.postMessage({
            key:'refresh_unit_store',
            val:_.copy(store)
        },location.protocol+'//'+location.host);*/
    }
    refresh_secret(secret) {
        this._secret = secret;
        //this.write_func('secret',this._secret);
        /*self.postMessage({
            key:'refresh_secret',
            val:secret
        },location.protocol+'//'+location.host);*/
    }
    refresh_balance(amount) {
        this._balance = amount;
        //this.write_func('balance',this._balance);
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
    rebuilding(bool) {
        this._rebuild_mode = bool;
        if (bool === true) {
            setTimeout(() => {
                this._rebuild_mode = false;
            }, con_1.block_time * 10);
        }
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
    refresh_return_chain(bool) {
        this._return_chain = bool;
    }
    requested(bool) {
        this._first_request = bool;
    }
    refresh_invalids(num) {
        this._invalids = num;
    }
    async looping(bool) {
        this._loop_mode = bool;
        if (bool === true)
            await exports.start();
    }
}
exports.Store = Store;
let db;
let store;
const port = peer_list_1.peer_list[0].port || "57750";
const ip = peer_list_1.peer_list[0].ip || "localhost";
const client = new faye_1.default.Client('http://' + ip + ':' + port + '/pubsub');
const socket = io.connect('http://' + ip + ':' + port);
client.subscribe('/data', async (data) => {
    if (data.type === "block") {
        store.push_yet_data(_.copy(data));
        return 0;
    }
    const unit_amount = await exports.get_balance(store.unit_address);
    if (data.type === "tx" && unit_amount > 0)
        store.push_yet_data(_.copy(data));
    //setImmediate(compute_tx);
    return 0;
});
socket.on('replacechain', async (chain) => {
    if (!store.replace_mode)
        await exports.check_chain(_.copy(chain), _.copy(store.chain), _.copy(store.pool), _.copy(store.code), store.secret, _.copy(store.unit_store));
    store.checking(false);
    //setImmediate(compute_tx);
    console.log(store.yet_data.length);
    console.log(store.chain.length);
    return 0;
});
socket.on('rebuildchain', async (blob) => {
    const zip = await jszip_1.default.loadAsync(blob);
    const folder = zip.folder('rebuild');
    const chain = JSON.parse(await folder.file('chain.json').async('text'));
    const states = JSON.parse(await folder.file('states.json').async('text'));
    const locations = JSON.parse(await folder.file('locations.json').async('text'));
    const candidates = JSON.parse(await folder.file('canidates.json').async('text'));
    await exports.rebuild_chain(_.copy(chain), _.copy(states), _.copy(locations), _.copy(candidates));
    store.rebuilding(false);
    console.log('rebuild chain');
    return 0;
});
/*socket.on('disconnect',()=>{
    store.refresh_pool({});
    store.replace_chain([gen.block]);
    store.refresh_roots(gen.roots);
    store.refresh_candidates(gen.candidates);
    store.refresh_unit_store({});
    store.refresh_yet_data([]);
});*/
client.bind('transport:down', () => {
    console.log('lose connection');
    store.refresh_balance(0);
    store.refresh_pool({});
    store.replace_chain([gen.block]);
    store.refresh_roots(gen.roots);
    store.refresh_candidates(gen.candidates);
    store.refresh_unit_store({});
    store.refresh_yet_data([]);
});
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
        if (getted == null) {
            const token = key.split(':')[1];
            //if(_.address_form_check(key,token_name_maxsize)) return result.concat(StateSet.CreateToken(0,token));
            return result.concat(StateSet.CreateState(0, key, token, 0));
        }
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
    const keys = target.meta.data.base.filter((val, i, array) => array.indexOf(val) === i);
    const result = await P.reduce(keys, async (array, key) => {
        if (key.split(':')[2] === _.toHash(''))
            return array;
        const getted = await L_Trie.get(key);
        if (getted == null) {
            const new_loc = {
                address: key,
                state: 'yet',
                index: 0,
                hash: _.toHash('')
            };
            return array.concat(new_loc);
        }
        else
            return array.concat(getted);
    }, []);
    return result;
};
exports.states_for_block = async (block, chain, S_Trie) => {
    const native_validator = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(block.meta.validatorPub));
    const native_validator_state = await S_Trie.get(native_validator) || StateSet.CreateState(0, native_validator, con_1.native);
    const unit_validator = CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(block.meta.validatorPub));
    const unit_validator_state = await S_Trie.get(unit_validator) || StateSet.CreateState(0, unit_validator, con_1.unit);
    const targets = block.txs.concat(block.natives).concat(block.units).map(pure => TxSet.pure_to_tx(pure, block));
    const tx_states = await P.reduce(targets, async (result, tx) => result.concat(await exports.states_for_tx(tx, chain, S_Trie)), []);
    const all_units = Object.values(await S_Trie.filter((key, state) => {
        return state.kind === "state" && state.token === con_1.unit;
    }));
    const native_token = await S_Trie.get("Vr:" + con_1.native + ":" + _.toHash('')) || StateSet.CreateToken(0, con_1.native);
    const unit_token = await S_Trie.get("Vr:" + con_1.unit + ":" + _.toHash('')) || StateSet.CreateToken(0, con_1.unit);
    const concated = tx_states.concat(native_validator_state).concat(unit_validator_state).concat(all_units).concat(native_token).concat(unit_token);
    return concated.filter((val, i, array) => array.map(s => _.ObjectHash(s)).indexOf(_.ObjectHash(val)) === i);
};
exports.locations_for_block = async (block, chain, L_Trie) => {
    const targets = block.txs.concat(block.natives).concat(block.units);
    const tx_loc = await P.reduce(targets, async (result, tx) => result.concat(await exports.locations_for_tx(tx, chain, L_Trie)), []);
    const native_validator = await L_Trie.get(CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(block.meta.validatorPub)));
    const unit_validator = await L_Trie.get(CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(block.meta.validatorPub)));
    let array;
    const concated = (() => {
        array = tx_loc;
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
        /*const new_unit_store = _.new_obj(
            unit_store,
            (store)=>{
                const valid_ref_tx = (()=>{
                    for(let block of _.copy(chain).slice()){
                        let txs = block.txs.concat(block.natives).concat(block.units);
                        for(let t of _.copy(txs)){
                            if(t.meta.kind==="refresh"&&t.meta.data.request===tx.meta.data.request&&t.meta.data.index===tx.meta.data.index) return t;
                        }
                    }
                    return TxSet.empty_tx_pure();
                })();
                if(valid_ref_tx.hash!=TxSet.empty_tx_pure().hash&&valid_ref_tx.meta.data.output!=tx.meta.data.output) return store;
                const pre = store[tx.meta.data.request] || [];
                if(store[tx.meta.data.request]!=null&&store[tx.meta.data.request].some(u=>u.payee===new_unit.payee&&u.index===new_unit.index)) return _.copy(store);
                else store[tx.meta.data.request] = pre.concat(new_unit);
                return store;
            }
        )*/
        store.add_unit(new_unit);
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
        store.refresh_pool(new_pool);
        /*if(Object.keys(new_pool).length>=1&&unit_amount>0){
            await send_key_block(chain.slice(),secret,candidates.slice(),_.copy(roots),_.copy(new_pool),codes,validator_mode);
        }*/
        return _.copy(new_pool);
    }
    else
        return _.copy(pool);
};
exports.block_accept = async (block, chain, candidates, roots, pool, not_refreshed, now_buying, unit_store) => {
    try {
        console.log("block_accept");
        const stateroot = roots.stateroot;
        const S_Trie = exports.trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie = exports.trie_ins(locationroot);
        const StateData = await exports.states_for_block(block, chain, S_Trie);
        const LocationData = await exports.locations_for_block(block, chain, L_Trie);
        const accepted = await BlockSet.AcceptBlock(block, chain, 0, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, stateroot, locationroot, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, con_1.all_issue, StateData, LocationData);
        /*const request_hashes = block.txs.concat(block.natives).concat(block.units).reduce((result:string[],tx)=>{
            if(tx.meta.kind==="request") return result;
            return result.concat(tx.meta.data.request);
        },[]);
        const requested_index_min = block.txs.concat(block.natives).concat(block.units).reduce((min,tx)=>{
            if(tx.meta.kind==="request") return min;
            else if(new BigNumber(tx.meta.data.index).isGreaterThanOrEqualTo(min)) return min;
            else return tx.meta.data.index;
        },_.copy(chain).length-1);*/
        /*const reqested = (()=>{
            for(let block of _.copy(chain).slice(requested_index_min)){
                const txs = block.txs.concat(block.natives).concat(block.units);
                for(let tx of _.copy(txs)){
                    if(tx.meta.kind==="refresh"&&request_hashes.indexOf(tx.meta.data.request)!=-1) return true;
                }
            }
            return false;
        })();*/
        if (accepted.block.length > 0 /*&&!reqested*/) {
            await P.forEach(accepted.state, async (state) => {
                await S_Trie.put(state.owner, state);
            });
            await P.forEach(accepted.location, async (loc) => {
                await L_Trie.put(loc.address, loc);
            });
            const new_roots = {
                stateroot: S_Trie.now_root(),
                locationroot: L_Trie.now_root()
            };
            const new_pool = _.new_obj(pool, p => {
                block.txs.concat(block.natives).concat(block.units).forEach(tx => {
                    Object.values(p).forEach(t => {
                        if (tx.meta.kind === "refresh" && t.meta.kind === "refresh" && t.meta.data.index === tx.meta.data.index && t.meta.data.request === tx.meta.data.request) {
                            delete p[t.hash];
                            delete p[t.meta.data.request];
                        }
                        else if (tx.meta.kind === "request" && t.meta.kind === "request" && tx.hash === t.hash) {
                            delete p[t.hash];
                        }
                    });
                });
                return p;
            });
            const new_chain = chain.concat(accepted.block[0]);
            store.refresh_pool(new_pool);
            if (!store.rebuild_mode)
                store.refresh_roots(new_roots);
            if (!store.rebuild_mode)
                store.refresh_candidates(accepted.candidates);
            if (!store.rebuild_mode)
                store.add_block(accepted.block[0]);
            const reqs_pure = block.txs.filter(tx => tx.meta.kind === "request").concat(block.natives.filter(tx => tx.meta.kind === "request")).concat(block.units.filter(tx => tx.meta.kind === "request"));
            const refs_pure = block.txs.filter(tx => tx.meta.kind === "refresh").concat(block.natives.filter(tx => tx.meta.kind === "refresh")).concat(block.units.filter(tx => tx.meta.kind === "refresh"));
            const added_not_refresh_tx = reqs_pure.reduce((result, pure) => {
                const full_tx = TxSet.pure_to_tx(pure, block);
                store.add_not_refreshed(full_tx);
                return result.concat(full_tx);
            }, not_refreshed);
            if (reqs_pure.length > 0) {
                reqs_pure.map(pure => pure.hash).forEach(key => store.add_req_index(key, block.meta.index));
            }
            if (refs_pure.length > 0) {
                store.del_not_refreshed(refs_pure.map(pure => pure.meta.data.request));
            }
            const now_refreshing = _.copy(store.now_refreshing);
            const refreshed = refs_pure.map(pure => pure.meta.data.request);
            const new_refreshing = now_refreshing.filter(key => refreshed.indexOf(key) === -1);
            store.new_refreshing(new_refreshing);
            const new_not_refreshed_tx = refs_pure.reduce((result, pure) => {
                return result.filter(tx => tx.meta.kind === "request" && tx.hash != pure.meta.data.request);
            }, added_not_refresh_tx);
            const bought_units = block.units.reduce((result, u) => {
                if (u.meta.kind === "request")
                    return result;
                const ref_tx = TxSet.pure_to_tx(u, block);
                const req_tx = TxSet.find_req_tx(ref_tx, chain);
                const raw = req_tx.raw || TxSet.empty_tx().raw;
                const this_units = JSON.parse(raw.raw[1] || "[]") || [];
                return result.concat(this_units);
            }, []);
            const my_unit_buying = block.units.some(tx => {
                if (tx.meta.kind === "request")
                    return false;
                const ref_tx = TxSet.pure_to_tx(tx, block);
                const req_tx = TxSet.find_req_tx(ref_tx, chain);
                const unit_address = CryptoSet.GenereateAddress(con_1.unit, CryptoSet.PublicFromPrivate(store.secret));
                return req_tx.meta.data.address === unit_address;
            });
            const new_now_buying = store.now_buying || !my_unit_buying;
            if (my_unit_buying)
                store.buying_unit(false);
            const new_unit_store = _.new_obj(unit_store, (store) => {
                bought_units.forEach(unit => {
                    const com = store[unit.request] || [];
                    const deleted = com.filter(c => (c.payee != unit.payee && c.index == unit.index && c.output === unit.output) || (c.index != unit.index));
                    store[unit.request] = deleted;
                });
                return store;
            });
            bought_units.forEach(unit => {
                store.delete_unit(unit);
            });
            return {
                pool: _.copy(new_pool),
                roots: _.copy(new_roots),
                candidates: _.copy(accepted.candidates),
                chain: _.copy(new_chain),
                not_refreshed_tx: _.copy(new_not_refreshed_tx),
                now_buying: new_now_buying,
                unit_store: _.copy(new_unit_store)
            };
        }
        else {
            console.log("receive invalid block");
            const valids = block.txs.concat(block.natives).concat(block.units).map(pure => {
                const tx = TxSet.pure_to_tx(pure, block);
                if (tx.meta.kind === "request")
                    return TxSet.ValidRequestTx(tx, con_1.my_version, con_1.native, con_1.unit, false, StateData, LocationData);
                else
                    return TxSet.ValidRefreshTx(tx, chain, con_1.my_version, con_1.native, con_1.unit, true, con_1.token_name_maxsize, StateData, LocationData);
            });
            const deleted_pool = block.txs.concat(block.natives).concat(block.units).reduce((pool, tx, i) => {
                const target_tx = pool[tx.hash];
                if (target_tx == null)
                    return pool;
                const valid = valids[i];
                if (valid)
                    return pool;
                return _.new_obj(pool, p => {
                    delete p[tx.hash];
                    return p;
                });
            }, pool);
            store.refresh_pool(deleted_pool);
            const now_refreshing = _.copy(store.now_refreshing);
            const refreshed = block.txs.concat(block.natives).concat(block.units).filter((pure, i) => pure.meta.kind === "refresh" && !valids[i]).map(pure => pure.meta.data.request);
            const new_refreshing = now_refreshing.filter(key => refreshed.indexOf(key) === -1);
            store.new_refreshing(new_refreshing);
            return {
                pool: _.copy(pool),
                roots: _.copy(roots),
                candidates: _.copy(candidates),
                chain: _.copy(chain),
                not_refreshed_tx: _.copy(not_refreshed),
                now_buying: now_buying,
                unit_store: _.copy(unit_store)
            };
        }
    }
    catch (e) {
        console.log(e);
        return {
            pool: _.copy(pool),
            roots: _.copy(roots),
            candidates: _.copy(candidates),
            chain: _.copy(chain),
            not_refreshed_tx: _.copy(not_refreshed),
            now_buying: now_buying,
            unit_store: _.copy(unit_store)
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
            raw: block.raws[txs.length + i]
        };
    });
    const units = block.units.map((u, i) => {
        return {
            hash: u.hash,
            meta: u.meta,
            raw: block.raws[txs.length + natives.length + i]
        };
    });
    const target = txs.concat(natives).concat(units);
    return target.reduce((num, tx, i) => {
        if (tx.meta.kind === "request" && !TxSet.ValidRequestTx(tx, con_1.my_version, con_1.native, con_1.unit, true, StateData, LocationData)) {
            return i;
        }
        else if (tx.meta.kind === "refresh" && !TxSet.ValidRefreshTx(tx, chain, con_1.my_version, con_1.native, con_1.unit, true, con_1.token_name_maxsize, StateData, LocationData)) {
            return i;
        }
        else
            return num;
    }, -1);
};
exports.get_balance = async (address) => {
    try {
        const S_Trie = exports.trie_ins(store.roots.stateroot);
        const state = await S_Trie.get(address);
        if (state == null)
            return 0;
        return new bignumber_js_1.BigNumber(state.amount).toNumber();
    }
    catch (e) {
        console.log(e);
        return 0;
    }
};
exports.send_request_tx = async (secret, type, token, base, input_raw, log, roots, chain, pre = TxSet.empty_tx_pure().meta.pre, next = TxSet.empty_tx_pure().meta.next) => {
    try {
        console.log("send_request_tx");
        const pub_key = [CryptoSet.PublicFromPrivate(secret)];
        const solvency = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(pub_key));
        const pre_tx = TxSet.CreateRequestTx(pub_key, solvency, Math.pow(2, -3), type, token, base, input_raw, log, con_1.my_version, pre, next, Math.pow(2, -18));
        const tx = TxSet.SignTx(pre_tx, secret, pub_key[0]);
        const stateroot = roots.stateroot;
        const S_Trie = exports.trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie = exports.trie_ins(locationroot);
        const StateData = await exports.states_for_tx(tx, chain, S_Trie);
        const LocationData = await exports.locations_for_tx(tx, chain, L_Trie);
        if (!TxSet.ValidRequestTx(tx, con_1.my_version, con_1.native, con_1.unit, false, StateData, LocationData))
            console.log("invalid infomations");
        else {
            console.log('remit!');
            store.requested(false);
            client.publish('/data', { type: 'tx', tx: [tx], block: [] });
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
        throw new Error(e);
    }
};
exports.send_refresh_tx = async (roots, secret, req_tx, index, code, chain) => {
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
        if (req_tx.meta.pre.flag === false)
            return TxSet.empty_tx();
        let block;
        let txs;
        let hashes;
        let i;
        let tx;
        for (block of _.copy(chain).slice().reverse()) {
            txs = _.copy(_.copy(block).txs.concat(_.copy(block).natives).concat(_.copy(block).units));
            hashes = _.copy(txs).map(tx => tx.meta.purehash);
            i = hashes.indexOf(req_tx.meta.pre.hash);
            if (i != -1) {
                tx = _.copy(_.copy(txs)[i]);
                if (tx.meta.kind == "request" && tx.meta.next.flag === true && tx.meta.next.hash === req_tx.meta.purehash) {
                    return TxSet.pure_to_tx(_.copy(tx), _.copy(block));
                }
            }
        }
        return TxSet.empty_tx();
    })();
    const relate_next_tx = (() => {
        if (req_tx.meta.next.flag === false)
            return TxSet.empty_tx();
        let block;
        let txs;
        let hashes;
        let i;
        let tx;
        for (block of _.copy(chain).slice().reverse()) {
            txs = _.copy(_.copy(block).txs.concat(_.copy(block).natives).concat(_.copy(block).units));
            hashes = _.copy(txs).map(tx => tx.meta.purehash);
            i = hashes.indexOf(req_tx.meta.next.hash);
            if (i != -1) {
                tx = _.copy(_.copy(txs)[i]);
                if (tx.meta.kind == "request" && tx.meta.pre.flag === true && tx.meta.pre.hash === req_tx.meta.purehash) {
                    return TxSet.pure_to_tx(_.copy(tx), _.copy(block));
                }
            }
        }
        return TxSet.empty_tx();
    })();
    const output_states = (() => {
        if (req_tx.meta.data.token === con_1.native)
            return TxSet.native_code(pre_states, req_tx, con_1.native);
        else if (req_tx.meta.data.token === con_1.unit)
            return TxSet.unit_code(pre_states, req_tx, relate_pre_tx, con_1.native, con_1.unit, chain);
        else
            return code_1.RunVM(code, pre_states, req_tx.raw.raw, req_pure, token_state, pure_chain, relate_pre_tx, relate_next_tx, con_1.gas_limit);
    })();
    const output_raws = output_states.map(state => JSON.stringify(state));
    const pre_tx = TxSet.CreateRefreshTx(con_1.my_version, 0.01, pub_key, con_1.pow_target, Math.pow(2, -18), req_tx.hash, index, payee, output_raws, [], chain);
    const tx = TxSet.SignTx(pre_tx, secret, pub_key[0]);
    const StateData = await exports.states_for_tx(tx, chain, S_Trie);
    const LocationData = await exports.locations_for_tx(tx, chain, L_Trie);
    if (!TxSet.ValidRefreshTx(tx, chain, con_1.my_version, con_1.native, con_1.unit, false, con_1.token_name_maxsize, StateData, LocationData))
        console.log("fail to create valid refresh");
    else {
        store.del_not_refreshed([tx.meta.data.request]);
        store.del_req_index(req_tx.hash);
        console.log("create valid refresh tx");
        client.publish('/data', { type: 'tx', tx: [tx], block: [] });
        //await store.dispatch("tx_accept",_.copy(tx));
        //await tx_accept(tx,chain,roots,pool,secret,mode,candidates,codes,socket);
        /*const pool = store.state.pool;
        const new_pool = Object.assign({[tx.hash]:tx},pool);
        store.commit('refresh_pool',new_pool);*/
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
        console.log('create valid key block');
        client.publish('/data', { type: 'block', tx: [], block: [key_block] });
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
    const pub_key = [CryptoSet.PublicFromPrivate(secret)];
    const native_validator = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(pub_key));
    const unit_validator = CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(pub_key));
    const pool_txs = Object.values(pool);
    const requested_bases = Object.keys(await L_Trie.filter((key, val) => {
        const getted = val;
        if (getted.state === "already")
            return true;
        else
            return false;
    }));
    const already_requests = _.copy(store.now_refreshing);
    const not_same = pool_txs.reduce((result, tx) => {
        const bases = result.reduce((r, t) => {
            if (t.meta.kind === "request")
                return r.concat(t.meta.data.base);
            else
                return r;
        }, requested_bases);
        const requests = result.reduce((r, t) => {
            if (t.meta.kind === "refresh")
                return r.concat(t.meta.data.request);
            else
                return r;
        }, already_requests);
        if (tx.meta.kind === "request" && !bases.some(b => tx.meta.data.base.indexOf(b) != -1))
            return result.concat(tx);
        else if (tx.meta.kind === "refresh" && requests.indexOf(tx.meta.data.request) === -1)
            return result.concat(tx);
        else
            return result;
    }, []);
    const related = not_same.filter(tx => {
        if (tx.meta.kind === "request")
            return true;
        const req_tx = TxSet.find_req_tx(tx, chain);
        if (req_tx.meta.pre.flag === true) {
            const pres = TxSet.list_up_related(chain, TxSet.tx_to_pure(req_tx).meta, "pre");
            return pres.length > 0;
        }
        else if (req_tx.meta.next.flag === true) {
            const nexts = TxSet.list_up_related(chain, TxSet.tx_to_pure(req_tx).meta, "next");
            return nexts.length > 0;
        }
        else
            return true;
    });
    let size_sum = new bignumber_js_1.BigNumber(0);
    const choosed = related.reduce((result, tx) => {
        if (size_sum.isGreaterThan(new bignumber_js_1.BigNumber(con_1.block_size).times(0.9)))
            return result;
        const tx_size = new bignumber_js_1.BigNumber(Buffer.from(JSON.stringify(tx)).length);
        const added_size = size_sum.plus(tx_size);
        size_sum = added_size;
        if (added_size.isGreaterThan(new bignumber_js_1.BigNumber(con_1.block_size).times(0.9)))
            return result;
        else
            return result.concat(tx);
    }, []);
    const reduced = choosed.reduce((result, tx) => {
        if (tx.meta.data.token === con_1.native)
            result.natives.push(tx);
        else if (tx.meta.data.token === con_1.unit)
            result.units.push(tx);
        else
            result.txs.push(tx);
        return result;
    }, { txs: [], natives: [], units: [] });
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
        const new_pool = _.new_obj(pool, p => {
            micro_block.txs.concat(micro_block.natives).concat(micro_block.units).forEach(tx => {
                if (tx.meta.kind === "refresh")
                    delete p[tx.hash];
            });
            return p;
        });
        store.refresh_pool(new_pool);
        const new_refreshing = already_requests.concat(micro_block.txs.concat(micro_block.natives).concat(micro_block.units).filter(tx => tx.meta.kind === "refresh").map(tx => tx.meta.data.request));
        store.new_refreshing(new_refreshing);
        client.publish('/data', { type: 'block', tx: [], block: [micro_block] });
        //await store.dispatch("block_accept",_.copy(micro_block));
        //await block_accept(micro_block,chain,candidates,roots,pool,codes,secret,mode,socket);
        console.log("create micro block");
        //await send_micro_block(socket);
    }
    else if (invalid_index != -1) {
        const target_pure = micro_block.txs.concat(micro_block.natives).concat(micro_block.units)[invalid_index];
        const target_tx = TxSet.pure_to_tx(target_pure, micro_block);
        const valid = (() => {
            if (target_tx.meta.kind === "request")
                return !TxSet.ValidRequestTx(target_tx, con_1.my_version, con_1.native, con_1.unit, false, StateData, LocationData);
            else
                return true;
        })();
        const del_pool = ((p) => {
            if (valid)
                delete p[target_pure.hash];
            return p;
        })(pool);
        /*const add_unit_store = ((store)=>{
            if(target_pure.meta.kind==="refresh"){
                const new_unit:T.Unit = {
                    request:target_pure.meta.data.request,
                    index:target_pure.meta.data.index,
                    nonce:target_pure.meta.nonce,
                    payee:target_pure.meta.data.payee,
                    output:target_pure.meta.data.output,
                    unit_price:target_pure.meta.unit_price
                }
                const pre = store[target_pure.meta.data.request] || []
                if(pre.length>0&&(pre.map(u=>_.toHash(u.payee+u.request+u.index)).indexOf(_.toHash(new_unit.payee+new_unit.request+new_unit.index))!=-1||pre[0].output!=new_unit.output)) return store;
                store[target_pure.meta.data.request] = pre.concat(new_unit);
                return store;
            }
            else return store;
        })(unit_store)*/
        const new_unit = {
            request: target_pure.meta.data.request,
            index: target_pure.meta.data.index,
            nonce: target_pure.meta.nonce,
            payee: target_pure.meta.data.payee,
            output: target_pure.meta.data.output,
            unit_price: target_pure.meta.unit_price
        };
        store.refresh_pool(del_pool);
        store.add_unit(new_unit);
        await exports.send_micro_block(del_pool, secret, chain, candidates, roots, unit_store);
    }
    else {
        console.log("fall to create micro block;");
    }
};
const get_pre_info = async (chain) => {
    try {
        const pre_block = chain[chain.length - 1] || BlockSet.empty_block();
        const pre_stateroot = pre_block.meta.stateroot;
        const pre_locationroot = pre_block.meta.locationroot;
        const S_Trie = exports.trie_ins(pre_stateroot);
        const L_Trie = exports.trie_ins(pre_locationroot);
        if (!(await S_Trie.checkRoot) || !(await L_Trie.checkRoot)) {
            return [
                {
                    stateroot: store.roots.stateroot,
                    locationroot: store.roots.locationroot
                },
                gen.candidates
            ];
        }
        const StateData = await exports.states_for_block(pre_block, chain.slice(0, pre_block.meta.index), S_Trie);
        const LocationData = await exports.locations_for_block(pre_block, chain.slice(0, pre_block.meta.index), L_Trie);
        /*const pre_block2 = chain[chain.length-2] || BlockSet.empty_block();
        const pre_S_Trie = trie_ins(pre_block2.meta.stateroot);
        const pre_StateData = await states_for_block(pre_block2,chain.slice(0,pre_block.meta.index-1),pre_S_Trie);*/
        const candidates = BlockSet.CandidatesForm(BlockSet.get_units(con_1.unit, StateData));
        const accepted = await BlockSet.AcceptBlock(pre_block, _.copy(chain).slice(0, pre_block.meta.index), 0, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, _.copy(candidates), S_Trie.now_root(), L_Trie.now_root(), con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, con_1.all_issue, StateData, LocationData);
        if (accepted.block.length > 0) {
            await P.forEach(accepted.state, async (state) => {
                await S_Trie.put(state.owner, state);
            });
            await P.forEach(accepted.location, async (loc) => {
                await L_Trie.put(loc.address, loc);
            });
        }
        const pre_root = {
            stateroot: S_Trie.now_root(),
            locationroot: L_Trie.now_root()
        };
        return [_.copy(pre_root), _.copy(accepted.candidates)];
    }
    catch (e) {
        console.log(e);
        return [
            {
                stateroot: gen.roots.stateroot,
                locationroot: gen.roots.locationroot
            },
            gen.candidates
        ];
    }
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
        if (!store.rebuild_mode)
            store.replace_chain(back_chain);
        const info = await (async () => {
            if (back_chain.length === 1) {
                return {
                    pool: _.copy(pool),
                    roots: _.copy(gen.roots),
                    candidates: _.copy(gen.candidates),
                    chain: _.copy(back_chain)
                };
            }
            //const pre_info = await get_pre_info(back_chain);
            const S_Trie = exports.trie_ins(add_blocks[0].meta.stateroot);
            const L_Trie = exports.trie_ins(add_blocks[0].meta.locationroot);
            if (!(await S_Trie.checkRoot) || !(await L_Trie.checkRoot)) {
                return {
                    pool: _.copy(store.pool),
                    roots: _.copy(store.roots),
                    candidates: _.copy(store.candidates),
                    chain: _.copy(store.chain)
                };
            }
            const roots = {
                stateroot: add_blocks[0].meta.stateroot,
                locationroot: add_blocks[0].meta.locationroot
            };
            return {
                pool: _.copy(pool),
                roots: _.copy(roots),
                candidates: [],
                chain: _.copy(back_chain)
            };
        })();
        const add_blocks_data = add_blocks.map(block => {
            const data = {
                type: 'block',
                tx: [],
                block: [block]
            };
            return data;
        });
        if (!store.rebuild_mode)
            store.refresh_roots(info.roots);
        //if(!store.rebuild_mode) store.refresh_candidates(_.copy(info.candidates));
        if (!store.rebuild_mode)
            store.replaceing(true);
        if (!store.rebuild_mode)
            store.rep_limit(add_blocks[add_blocks.length - 1].meta.index);
        /*await P.reduce(add_blocks,async (result:{pool:T.Pool,roots:{[key:string]:string},candidates:T.Candidates[],chain:T.Block[]},block:T.Block)=>{
            const accepted = await block_accept(block,result.chain.slice(),result.candidates.slice(),_.copy(result.roots),_.copy(result.pool),codes,secret,unit_store);
            return _.copy(accepted);
        },info);*/
        if (!store.rebuild_mode)
            store.refresh_yet_data(add_blocks_data.concat(_.copy(store.yet_data)));
        //add_blocks.forEach(block=>store.commit('push_yet_block',block));
        /*store.commit("checking",true);
        store.commit("checking",false);*/
        const amount = await exports.get_balance(store.my_address);
        if (!store.rebuild_mode)
            store.refresh_balance(amount);
    }
    else {
        console.log("not replace");
        store.replaceing(false);
    }
};
exports.call_rebuild = () => {
    if (!store.rebuild_mode) {
        store.rebuilding(true);
        socket.emit('rebuildinfo');
    }
};
exports.rebuild_chain = async (new_chain, states, locations, candidates) => {
    /*const state_map:{[key:string]:number} = new_chain.reduce((map:{[key:string]:number},block)=>{
        const pures = _.copy(block.txs.concat(block.natives).concat(block.units));
        return pures.reduce((ma,pure)=>{
            if(pure.meta.kind==="request") return ma;
            const index = _.copy(pure).meta.data.index;
            const req_tx = TxSet.find_req_tx(TxSet.pure_to_tx(_.copy(pure),_.copy(block)),_.copy(chain));
            const bases = _.copy(req_tx.meta.data.base);
            return bases.reduce((m,key)=>{
                m[key] = index;
                return _.copy(m);
            },ma)
        },map);
    },{});*/
    const S_Trie = exports.trie_ins(gen.roots.stateroot);
    const L_Trie = exports.trie_ins(gen.roots.locationroot);
    await P.forEach(states, async (s) => {
        await S_Trie.put(s.owner, s);
    });
    await P.forEach(locations, async (l) => {
        await L_Trie.put(l.address, l);
    });
    const new_roots = {
        stateroot: S_Trie.now_root(),
        locationroot: L_Trie.now_root()
    };
    store.replace_chain(new_chain);
    store.refresh_roots(new_roots);
    store.refresh_candidates(candidates);
    const amount = await exports.get_balance(store.my_address);
    store.refresh_balance(amount);
};
exports.unit_buying = async (secret, units, roots, chain) => {
    try {
        console.log("unit!");
        const pub_key = [CryptoSet.PublicFromPrivate(secret)];
        const native_remiter = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(pub_key));
        const unit_remiter = CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(pub_key));
        const unit_sellers = units.map(u => u.payee);
        const native_sellers = unit_sellers.reduce((res, add) => {
            const index = res.indexOf(add);
            if (index === -1)
                return res.concat(add);
            else
                return res;
        }, []);
        const prices = Object.values(units.reduce((res, unit) => {
            const amount = res[unit.payee];
            if (amount == null) {
                return _.new_obj(res, r => {
                    r[unit.payee] = unit.unit_price;
                    return r;
                });
            }
            else {
                return _.new_obj(res, r => {
                    r[unit.payee] = new bignumber_js_1.BigNumber(amount).plus(unit.unit_price).toNumber();
                    return r;
                });
            }
        }, {}));
        const pure_native_tx = TxSet.CreateRequestTx(pub_key, native_remiter, Math.pow(2, -3), "issue", con_1.native, [native_remiter].concat(native_sellers), ["remit", JSON.stringify(prices)], [], con_1.my_version, TxSet.empty_tx_pure().meta.pre, TxSet.empty_tx_pure().meta.next, Math.pow(2, -18));
        const pure_unit_tx = TxSet.CreateRequestTx(pub_key, native_remiter, Math.pow(2, -3), "issue", con_1.unit, [unit_remiter].concat("Vr:" + con_1.unit + ":" + _.toHash('')), ["buy", JSON.stringify(units)], [], con_1.my_version, TxSet.empty_tx_pure().meta.pre, TxSet.empty_tx_pure().meta.next, Math.pow(2, -18));
        const native_pure_hash = pure_native_tx.meta.purehash;
        const unit_pure_hash = pure_unit_tx.meta.purehash;
        const next_rel = {
            flag: true,
            hash: unit_pure_hash
        };
        const pre_rel = {
            flag: true,
            hash: native_pure_hash
        };
        const rel_native_tx = _.new_obj(pure_native_tx, (tx) => {
            const new_meta = _.new_obj(tx.meta, m => {
                m.next = next_rel;
                return m;
            });
            tx.meta = new_meta;
            tx.hash = _.ObjectHash(new_meta);
            return tx;
        });
        const rel_unit_tx = _.new_obj(pure_unit_tx, (tx) => {
            const new_meta = _.new_obj(tx.meta, m => {
                m.pre = pre_rel;
                return m;
            });
            tx.meta = new_meta;
            tx.hash = _.ObjectHash(new_meta);
            return tx;
        });
        const native_tx = TxSet.SignTx(rel_native_tx, secret, pub_key[0]);
        const unit_tx = TxSet.SignTx(rel_unit_tx, secret, pub_key[0]);
        const stateroot = roots.stateroot;
        const S_Trie = exports.trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie = exports.trie_ins(locationroot);
        const native_StateData = await exports.states_for_tx(native_tx, chain, S_Trie);
        const native_LocationData = await exports.locations_for_tx(native_tx, chain, L_Trie);
        const unit_StateData = await exports.states_for_tx(unit_tx, chain, S_Trie);
        const unit_LocationData = await exports.locations_for_tx(unit_tx, chain, L_Trie);
        if (!TxSet.ValidRequestTx(native_tx, con_1.my_version, con_1.native, con_1.unit, true, native_StateData, native_LocationData) || !TxSet.ValidRequestTx(unit_tx, con_1.my_version, con_1.native, con_1.unit, true, unit_StateData, unit_LocationData))
            console.log("fail to buy units");
        else {
            console.log("buy unit!");
            store.buying_unit(true);
            //console.error(unit_tx.hash);
            units.forEach(u => {
                store.delete_unit(u);
            });
            client.publish('/data', { type: 'tx', tx: [native_tx], block: [] });
            client.publish('/data', { type: 'tx', tx: [unit_tx], block: [] });
        }
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.sleep = (msec) => {
    return new Promise(function (resolve) {
        setTimeout(function () { resolve(); }, msec);
    });
};
exports.send_blocks = async () => {
    const unit_amount = await exports.get_balance(store.unit_address);
    const last_key = BlockSet.search_key_block(_.copy(store.chain));
    const last_micros = BlockSet.search_micro_block(_.copy(store.chain), last_key);
    const date = new Date();
    if (!store.replace_mode && _.reduce_pub(last_key.meta.validatorPub) === CryptoSet.PublicFromPrivate(store.secret) && last_micros.length <= con_1.max_blocks)
        await exports.send_micro_block(_.copy(store.pool), store.secret, _.copy(store.chain), _.copy(store.candidates), _.copy(store.roots), store.unit_store);
    if (!store.replace_mode && unit_amount > 0 && date.getTime() - last_key.meta.timestamp > con_1.block_time * con_1.max_blocks)
        await exports.send_key_block(_.copy(store.chain), store.secret, _.copy(store.candidates), _.copy(store.roots));
    if (store.isNode && store.first_request && !store.replace_mode && unit_amount > 0 && _.copy(store.chain).filter(b => b.natives.length > 0).length === 0) {
        await exports.send_request_tx(store.secret, "issue", con_1.native, [store.my_address, store.my_address], ["remit", JSON.stringify([0])], [], _.copy(store.roots), _.copy(store.chain));
    }
};
exports.set_config = async (_db, _store) => {
    db = _db;
    store = _store;
    await store.read();
    const last_block = _.copy(store.chain[store.chain.length - 1]) || gen.block;
    const last_address = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(last_block.meta.validatorPub));
    if (last_address != store.my_address) {
        store.checking(true);
        socket.emit("checkchain");
    }
};
exports.compute_tx = async () => {
    const now_yets = _.copy(store.yet_data);
    const data = now_yets.filter(d => d.type === "tx" && d.tx[0] != null)[0];
    if (data != null) {
        const target = data.tx[0];
        //if(target.meta.kind==="request"||target.meta.data.index<store.state.chain.length){
        await exports.tx_accept(target, _.copy(store.chain), _.copy(store.roots), _.copy(store.pool), store.secret, _.copy(store.candidates), _.copy(store.unit_store));
    }
    let units = [];
    const reduced = now_yets.filter(d => {
        if (d.type === "tx" && d.tx[0] != null && data != null && d.tx[0].hash === data.tx[0].hash)
            return false;
        else if (d.type === "tx" && d.tx[0] != null) {
            const t = d.tx[0];
            if (t.meta.kind === "request")
                return true;
            for (let block of _.copy(store.chain).slice(t.meta.data.index)) {
                for (let tx of block.txs.concat(block.natives).concat(block.units)) {
                    if (tx.meta.kind === "refresh" && tx.meta.data.index === t.meta.data.index && tx.meta.data.request === t.meta.data.request) {
                        console.log('remove');
                        const unit = {
                            request: t.meta.data.request,
                            index: t.meta.data.index,
                            nonce: t.meta.nonce,
                            payee: t.meta.data.payee,
                            output: t.meta.data.output,
                            unit_price: t.meta.unit_price
                        };
                        units.push(unit);
                        return false;
                    }
                }
            }
            return true;
        }
        else if (d.type === "block" && d.block[0] != null)
            return true;
        else
            return false;
    });
    store.refresh_yet_data(reduced);
    const pre_unit_store = _.copy(store.unit_store);
    const new_unit_store = _.new_obj(pre_unit_store, (store) => {
        units.forEach(unit => {
            const pre = store[unit.request] || [];
            if (store[unit.request] != null && store[unit.request].some(u => _.toHash(u.payee + u.request + u.index.toString()) === _.toHash(unit.payee + unit.request + unit.index.toString()) || u.output != unit.output))
                return store;
            store[unit.request] = pre.concat(unit);
        });
        return store;
    });
    store.refresh_unit_store(new_unit_store);
    await store.write();
    await exports.sleep(con_1.block_time);
    //setImmediate(compute_block);
};
let chain;
let new_chain;
let refs;
let now_yets;
let units;
let reduced;
let pre_pool;
let new_pool;
let pre_unit_store;
let new_unit_store;
let refreshes;
let related;
let unit_store_values;
let reversed_chain;
let refreshed;
exports.compute_block = async () => {
    const data = store.yet_data[0];
    if (data == null) {
        store.replaceing(false);
        await exports.send_blocks();
        console.log('yet:');
        console.log(store.yet_data.length);
        console.log(store.chain.length);
        await exports.sleep(con_1.block_time);
        //return await compute_yet();
    }
    /*else if(data.type==="tx"&&data.tx.length>0){
        const target:T.Tx = _.copy(data.tx[0]);
        //if(target.meta.kind==="request"||target.meta.data.index<store.state.chain.length){
        await tx_accept(_.copy(target),_.copy(store.chain),_.copy(store.roots),_.copy(store.pool),store.secret,_.copy(store.candidates),_.copy(store.unit_store));
        const now_yets:Data[] = _.copy(store.yet_data);
        const reduced = now_yets.filter(d=>{
            if(d.type==="tx"&&d.tx[0]!=null) return d.tx[0].hash!=target.hash;
            else if(d.type==="block"&&d.block[0]!=null) return true;
            else return false;
        });
        store.refresh_yet_data(_.copy(reduced));
        console.log('yet:')
        console.log(store.yet_data.length);
        await sleep(block_time);
        //return await compute_yet();
        /*}
        else{
            const txs:Data[] = store.state.yet_data.filter((d:Data)=>d.type==="tx"&&d.tx[0]!=null&&d.tx[0].hash!=target.hash);
            const blocks:Data[] = store.state.yet_data.filter((d:Data)=>d.type==="block");
            const reduced = txs.concat(blocks);
            const concated = reduced.concat(store.state.yet_data[0]);
            store.commit("refresh_yet_data",concated);
        }*/
    /*}*/
    else if (data.type === "block" && data.block.length > 0) {
        const block = data.block[0];
        chain = _.copy(store.chain);
        if (block.meta.version >= con_1.compatible_version) {
            if (block.meta.index > chain.length) {
                if (!store.replace_mode) {
                    const address = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(block.meta.validatorPub));
                    if (address != store.my_address) {
                        store.checking(true);
                        socket.emit("checkchain", address);
                    }
                    else {
                        store.refresh_yet_data(_.copy(store.yet_data).slice(1));
                    }
                }
                else
                    store.replaceing(false);
                //await send_blocks();
                await exports.sleep(con_1.block_time);
                //return await compute_yet();
            }
            else if (block.meta.index === chain.length) {
                if (store.replace_mode && chain[chain.length - 1].meta.index >= store.replace_index)
                    store.replaceing(false);
                await exports.block_accept(block, _.copy(store.chain), _.copy(store.candidates), _.copy(store.roots), _.copy(store.pool), _.copy(store.not_refreshed_tx), store.now_buying, _.copy(store.unit_store));
                new_chain = _.copy(store.chain);
                if (store.replace_mode && chain.length === new_chain.length)
                    store.replaceing(false);
                if (store.replace_mode && !store.isNode) {
                    postMessage({
                        key: 'replaceing',
                        val: true
                    });
                }
                else if (!store.isNode) {
                    postMessage({
                        key: 'replaceing',
                        val: false
                    });
                }
                if (new_chain.length === chain.length + 1) {
                    refs = block.txs.concat(block.natives).concat(block.units).filter(tx => tx.meta.kind === "refresh");
                    now_yets = _.copy(store.yet_data);
                    units = [];
                    reduced = now_yets.filter(d => {
                        if (d.type === "tx" && d.tx[0] != null) {
                            const t = d.tx[0];
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
                                    units.push(unit);
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
                    store.refresh_yet_data(reduced);
                    pre_pool = _.copy(store.pool);
                    new_pool = _.new_obj(pre_pool, p => {
                        block.txs.concat(block.natives).concat(block.units).forEach(tx => {
                            Object.values(p).forEach(t => {
                                if (t.meta.kind === "refresh" && t.meta.data.index === tx.meta.data.index && t.meta.data.request === tx.meta.data.request) {
                                    delete p[t.hash];
                                    delete p[t.meta.data.request];
                                    const unit = {
                                        request: t.meta.data.request,
                                        index: t.meta.data.index,
                                        nonce: t.meta.nonce,
                                        payee: t.meta.data.payee,
                                        output: t.meta.data.output,
                                        unit_price: t.meta.unit_price
                                    };
                                    units.push(unit);
                                }
                            });
                        });
                        return p;
                    });
                    store.refresh_pool(new_pool);
                    pre_unit_store = _.copy(store.unit_store);
                    new_unit_store = _.new_obj(pre_unit_store, (store) => {
                        units.forEach(unit => {
                            const pre = store[unit.request] || [];
                            if (store[unit.request] != null && store[unit.request].some(u => _.toHash(u.payee + u.request + u.index.toString()) === _.toHash(unit.payee + unit.request + unit.index.toString()) || u.output != unit.output))
                                return store;
                            store[unit.request] = pre.concat(unit);
                        });
                        return store;
                    });
                    store.refresh_unit_store(new_unit_store);
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
                    now_yets = _.copy(store.yet_data);
                    reduced = now_yets.filter(d => {
                        if (d.type === "tx" && d.tx[0] != null)
                            return true;
                        else if (d.type === "block" && d.block[0] != null)
                            return d.block[0].meta.index > block.meta.index;
                        else
                            return false;
                    });
                    store.refresh_yet_data(reduced);
                    store.refresh_invalids(store.invalids + 1);
                    /*if(store.invalids>=5){
                        store.refresh_invalids(0);
                        store.rebuilding(true);
                        const roots = _.copy(store.roots);
                        const S_Trie = trie_ins(roots.stateroot);
                        const L_Trie = trie_ins(roots.locationroot);
                        const states:T.State[] = Object.values(await S_Trie.filter());
                        const locations:T.Location[] = Object.values(await L_Trie.filter());
                        await rebuild_chain(_.copy(store.chain),_.copy(states),_.copy(locations),_.copy(store.candidates));
                        store.rebuilding(false);
                    }*/
                }
                const balance = await exports.get_balance(store.my_address);
                store.refresh_balance(balance);
                if (!store.isNode) {
                    postMessage({
                        key: 'refresh_balance',
                        val: balance
                    });
                }
                /*let refreshed_hash:string[] = [];
                let get_not_refresh:T.Tx[] = [];
                for(let block of _.copy(new_chain).slice().reverse()){
                    for(let tx of _.copy(block.txs.concat(block.natives).concat(block.units))){
                        if(_.copy(tx).meta.kind==="request"&&refreshed_hash.indexOf(_.copy(tx).hash)===-1) get_not_refresh.push(_.copy(TxSet.pure_to_tx(_.copy(tx),_.copy(block))));
                        else if(_.copy(tx).meta.kind==="refresh") refreshed_hash.push(_.copy(tx).meta.data.request);
                        else if(get_not_refresh.length>=10) break;
                    }
                }*/
                refreshes = _.copy(store.not_refreshed_tx);
                related = refreshes.filter(tx => {
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
                    const index = store.req_index_map[req_tx.hash] || 0;
                    const code = store.code[req_tx.meta.data.token];
                    await exports.send_refresh_tx(_.copy(store.roots), store.secret, req_tx, index, code, new_chain);
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
                if (store.isNode) {
                    unit_store_values = Object.values(store.unit_store);
                    const units_sum = unit_store_values.reduce((sum, us) => sum + us.length, 0);
                    reversed_chain = new_chain.slice().reverse();
                    refreshed = (() => {
                        let result = [];
                        let price_sum;
                        let flag = false;
                        for (let block of reversed_chain) {
                            const txs = block.txs.concat(block.natives).concat(block.units).slice();
                            for (let tx of txs) {
                                if (tx.meta.kind === "refresh") {
                                    result = result.concat(unit_store_values.reduce((result, us) => {
                                        if (us.length > 0 && us[0].request === tx.meta.data.request) {
                                            price_sum = result.reduce((sum, unit) => new bignumber_js_1.BigNumber(sum).plus(unit.unit_price).toNumber(), 0);
                                            us.forEach(u => {
                                                if (new bignumber_js_1.BigNumber(price_sum).plus(u.unit_price).isGreaterThanOrEqualTo(new bignumber_js_1.BigNumber(balance).times(0.99))) {
                                                    flag = true;
                                                    return result;
                                                }
                                                else {
                                                    price_sum = new bignumber_js_1.BigNumber(price_sum).plus(u.unit_price).toNumber();
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
                    if (refreshed.length > 0 && !store.now_buying && !store.replace_mode) {
                        const validatorPub = BlockSet.search_key_block(reversed_chain).meta.validatorPub;
                        const validator_address = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(validatorPub));
                        const buy_units = refreshed;
                        await exports.unit_buying(store.secret, buy_units, _.copy(store.roots), new_chain);
                        //await send_blocks();
                    }
                }
                console.log('yet:');
                console.log(store.yet_data.length);
                console.log(store.chain.length);
                await store.write();
                await exports.send_blocks();
                if (!store.replace_mode || store.yet_data.length > 10)
                    await exports.sleep(con_1.block_time);
                //return await compute_yet();
            }
            else {
                now_yets = _.copy(store.yet_data);
                reduced = now_yets.filter(d => {
                    if (d.type === "tx" && d.tx[0] != null)
                        return true;
                    else if (d.type === "block" && d.block[0] != null)
                        return d.block[0].meta.index > chain.length - 1;
                    else
                        return false;
                });
                store.refresh_yet_data(reduced);
                console.log('yet:');
                console.log(store.yet_data.length);
                console.log(store.chain.length);
                await exports.sleep(con_1.block_time);
                //return await compute_yet();
            }
        }
        else {
            now_yets = _.copy(store.yet_data);
            reduced = now_yets.filter(d => {
                if (d.type === "tx" && d.tx[0] != null)
                    return true;
                else if (d.type === "block" && d.block[0] != null)
                    return d.block[0].meta.index > chain.length - 1;
                else
                    return false;
            });
            store.refresh_yet_data(reduced);
            console.log('yet:');
            console.log(store.yet_data.length);
            console.log(store.chain.length);
            await exports.sleep(con_1.block_time);
            //return await compute_yet();
        }
    }
    //setImmediate(compute_tx);
};
exports.start = async () => {
    await store.looping(false);
    while (1) {
        await exports.compute_tx();
        await exports.compute_block();
    }
    await store.looping(true);
};
