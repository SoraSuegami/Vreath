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
const _ = __importStar(require("../../core/basic"));
const gen = __importStar(require("../../genesis/index"));
const P = __importStar(require("p-iteration"));
const level_browserify_1 = __importDefault(require("level-browserify"));
const peer_list_1 = require("./peer_list");
const db_1 = require("./db");
const storeName = 'vreath';
let db;
const port = peer_list_1.peer_list[0].port || "57750";
const ip = peer_list_1.peer_list[0].ip || "localhost";
console.log(ip);
//const socket = io('http://'+ip+':'+port);
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
/*export const read_db = async <T>(key:string,def:T)=>{
    const db = await idb.open('vreath',2,upgradeDB=>{
        upgradeDB.createObjectStore('vreath',{keyPath:'id'});
    });
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const result = await store.get(key)
    db.close();
    if(result==null) return def;
    return result.val || def;
}

export const write_db = async <T>(key:string,val:T)=>{
    const db = await idb.open('vreath',2,upgradeDB=>{
        upgradeDB.createObjectStore('vreath',{keyPath:'id'});
    });
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    await store.put({
        id:key,
        val:val
    });
    return tx.complete;
}*/
/*export const delete_db = ()=>{
    const del_db_vreath = indexedDB.deleteDatabase('vreath');
    del_db_vreath.onsuccess = ()=>console.log('db delete success');
    del_db_vreath.onerror = ()=>console.log('db delete error');
    const del_db_level = indexedDB.deleteDatabase('level-js-./db');
    del_db_level.onsuccess = ()=>console.log('db delete success');
    del_db_level.onerror = ()=>console.log('db delete error');
}*/
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
const level_db = level_browserify_1.default('./trie');
exports.store = new index_1.Store(false, db_1.get, db_1.put);
/*client.subscribe('/data',async (data:Data)=>{
    if(data.type==="block") store.push_yet_data(_.copy(data));
    const S_Trie = trie_ins(store.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.secret));
    const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0);
    const unit_amount = unit_state.amount || 0;
    if(data.type==="tx"&&unit_amount>0) store.push_yet_data(_.copy(data));
});

client.subscribe('/checkchain',(address:string)=>{
    console.log('checked')
    console.log(store.check_mode)
    if(!store.check_mode&&!store.replace_mode&&!store.return_chain) store.refresh_return_chain(true);//client.publish('/replacechain',_.copy(store.chain));
    return 0;
});

client.subscribe('/replacechain',async (chain:T.Block[])=>{
    if(!store.replace_mode&&store.check_mode&&!store.return_chain){
        console.log("replace:")
        await check_chain(_.copy(chain),_.copy(store.chain),_.copy(store.pool),_.copy(store.code),store.secret,_.copy(store.unit_store));
    }
    store.checking(false);
    console.log(store.yet_data.length);
    return 0;
});

client.bind('transport:down', ()=>{
    console.log('lose connection');
    delete_db();
    client = new faye.Client('http://'+ip+':'+port+'/vreath');
});*/
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
                if (key != null && exports.store[key] != null)
                    exports.store[key](val);
                break;
            case 'start':
                exports.store.refresh_pool({});
                exports.store.replace_chain([gen.block]);
                exports.store.refresh_roots(gen.roots);
                exports.store.refresh_candidates(gen.candidates);
                exports.store.refresh_unit_store({});
                exports.store.refresh_yet_data([]);
                await index_1.set_config(level_db, exports.store);
                const gen_S_Trie = index_1.trie_ins("");
                await P.forEach(gen.state, async (s) => {
                    await gen_S_Trie.put(s.owner, s);
                });
                const balance = await index_1.get_balance(exports.store.my_address);
                exports.store.refresh_balance(balance);
                postMessage({
                    key: 'refresh_secret',
                    val: exports.store.secret
                });
                postMessage({
                    key: 'refresh_balance',
                    val: balance
                });
                setImmediate(index_1.compute_tx);
                break;
            case 'send_request':
                const options = event.data;
                await index_1.send_request_tx(exports.store.secret, options.tx_type, options.token, options.base, options.input_raw, options.log, _.copy(exports.store.roots), _.copy(exports.store.chain));
                break;
            case 'get_balance':
                const got_balance = await index_1.get_balance(event.data.address) || 0;
                postMessage({
                    address: event.data.address,
                    amount: got_balance
                });
                break;
            default: break;
        }
    }
    catch (e) {
        console.log(e);
    }
};
