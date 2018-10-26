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
const StateSet = __importStar(require("../../core/state"));
const level_browserify_1 = __importDefault(require("level-browserify"));
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
const level_db = level_browserify_1.default('./db');
exports.store = new index_1.Store(false, exports.read_db, exports.write_db);
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
    if (!exports.store.check_mode && !exports.store.replace_mode && !exports.store.return_chain)
        exports.store.refresh_return_chain(true); //client.publish('/replacechain',_.copy(store.chain));
    return 0;
});
exports.client.subscribe('/replacechain', async (chain) => {
    if (!exports.store.replace_mode && exports.store.check_mode && !exports.store.return_chain) {
        console.log("replace:");
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
                index_1.set_config(level_db, exports.store, exports.client);
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
                setImmediate(index_1.compute_tx);
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
