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
const vue_1 = __importDefault(require("vue"));
const vuex_1 = __importDefault(require("vuex"));
const at_ui_1 = __importDefault(require("at-ui"));
const vue_router_1 = __importDefault(require("vue-router"));
const gen = __importStar(require("../../genesis/index"));
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const worker = new Worker('bg-bundle.js');
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
const storeName = 'vreath';
let db;
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
    const del_db = indexedDB.deleteDatabase('vreath');
    del_db.onsuccess = () => console.log('db delete success');
    del_db.onerror = () => console.log('db delete error');
};
const commit = (key, val) => {
    worker.postMessage({
        key: key,
        val: val
    });
};
vue_1.default.use(vuex_1.default);
vue_1.default.use(vue_router_1.default);
vue_1.default.use(at_ui_1.default);
/*export const store = new Vuex.Store({
    state:{
        apps:read_db('app',def_apps),
        code:read_db('code',codes),
        pool:read_db('pool',{}),
        chain:read_db('chain',[gen.block]),
        roots:read_db('roots',gen.roots),
        candidates:read_db('candidates',gen.candidates),
        unit_store:read_db('unit_store',{}),
        secret:read_db('secret',CryptoSet.GenerateKeys()),
        registed:Number(read_db('registed',0)),
        balance:0,
        yet_data:[],
        check_mode:false,
        replace_mode:false,
        replace_index:0,
        not_refreshed_tx:[],
        now_buying:false,
        now_refreshing:[]
    },
    mutations:{
        add_app(state,obj:Installed){
            state.apps[obj.name] = _.copy(obj);
        },
        del_app(state,key:string){
            delete state.apps[key];
        },
        refresh_pool(state,pool:T.Pool){
            state.pool = _.copy(pool);
        },
        add_block(state,block:T.Block){
            state.chain.push(block);
        },
        replace_chain(state,chain:T.Block[]){
            state.chain = _.copy(chain).slice().sort((a:T.Block,b:T.Block)=>{
                return a.meta.index - b.meta.index;
            }).filter((b:T.Block,i:number)=>b.meta.index===i);
        },
        refresh_roots(state,roots:{[key:string]:string}){
            state.roots = _.copy(roots);
        },
        refresh_candidates(state,candidates:T.Candidates[]){
            state.candidates = _.copy(candidates);
        },
        add_unit(state,unit:T.Unit){
            const units:T.Unit[] = _.copy(state.unit_store)[unit.request] || [];
            if(!units.some(u=>u.index===unit.index&&u.payee===unit.payee)){
                state.unit_store[unit.request] = _.copy(units).concat(unit);
            }
        },
        delete_unit(state,unit:T.Unit){
            const units:T.Unit[] = _.copy(state.unit_store)[unit.request] || [];
            const deleted = units.filter(u=>u.index===unit.index&&u.payee!=unit.payee&&u.output===unit.output);
            state.unit_store[unit.request] = _.copy(deleted);
            if(deleted.length<=0) delete state.unit_store[unit.request];
        },
        refresh_unit_store(state,store:{[key:string]:T.Unit[]}){
            state.unit_store = _.copy(store);
        },
        refresh_secret(state,secret:string){
            state.secret = secret;
        },
        regist(state){
            state.registed = 1;
        },
        refresh_balance(state,amount:number){
            state.balance = amount;
        },
        push_yet_data(state,data:Data){
            state.yet_data.push(data);
        },
        unshift_yet_data(state,data:Data){
            state.yet_data.unshift(data);
        },
        refresh_yet_data(state,data:Data[]){
            state.yet_data = _.copy(data);
        },
        checking(state,bool:boolean){
            state.check_mode = bool;
            if(bool===true){
                setTimeout(()=>{
                    state.check_mode = false;
                },block_time*10);
            }
        },
        replaceing(state,bool:boolean){
            state.replace_mode = bool;
        },
        rep_limit(state,index:number){
            state.replace_index = index;
        },
        add_not_refreshed(state,tx:T.Tx){
            state.not_refreshed_tx = state.not_refreshed_tx.concat(_.copy(tx));
        },
        del_not_refreshed(state,hashes:string[]){
            state.not_refreshed_tx = state.not_refreshed_tx.filter((tx:T.Tx)=>hashes.indexOf(tx.hash)===-1);
        },
        buying_unit(state,bool:boolean){
            state.now_buying =bool;
        },
        new_refreshing(state,requests:string[]){
            state.now_refreshing = requests;
        }
    },
    getters:{
        my_address:(state) => CryptoSet.GenereateAddress(native,CryptoSet.PublicFromPrivate(state.secret)) || ""
    }
});*/
/*worker.addEventListener('message',e=>{
    const key:string = e.data.key;
    if(e.data.val==null) store.commit(key);
    const val:any = e.data.val;
    store.commit(key,val);
});*/
const store = new vuex_1.default.Store({
    state: {
        apps: exports.read_db('app', def_apps),
        registed: false,
        secret: CryptoSet.GenerateKeys(),
        balance: 0
    },
    getters: {
        my_address: (state) => CryptoSet.GenereateAddress(con_1.native, CryptoSet.PublicFromPrivate(state.secret)) || ""
    },
    mutations: {
        add_app(state, obj) {
            state.apps[obj.name] = _.copy(obj);
            exports.write_db('app', state.apps);
        },
        del_app(state, key) {
            delete state.apps[key];
            exports.write_db('app', state.apps);
        },
        refresh_secret(state, secret) {
            state.secret = secret;
            commit('refresh_secret', secret);
        },
        regist(state) {
            state.registed = true;
        },
        refresh_balance(state, amount) {
            state.balance = amount;
        }
    }
});
const Home = {
    data: function () {
        return {
            installed: this.$store.state.apps
        };
    },
    store,
    template: `
    <div id="vreath_home_apps">
        <ul>
            <li v-for="item in installed"
            class="vreath_app_unit">
                <div>
                <at-card>
                <router-link v-bind:to="item.name">
                <img v-bind:src="item.icon" width="150" height="150"/>
                </router-link>
                <h2 class="vreath_app_name">{{item.name}}</h2>
                </at-card>
                </div>
            </li>
        </ul>
    </div>
    `
};
const Registration = {
    computed: {
        secret: function () {
            return this.$store.state.secret;
        },
        registed: function () {
            return this.$store.state.registed;
        }
    },
    store,
    methods: {
        regist: function () {
            try {
                console.log(this.secret);
                store.commit('refresh_secret', this.secret);
                store.commit('regist');
                router.push({ path: '/' });
            }
            catch (e) {
                console.log(e);
            }
        }
    },
    template: `
    <div>
        <h1 id="front_title">Welcome to Vreath</h1><br>
        <at-input placeholder="secret" type="password" v-model="secret"></at-input><br>
        <a href="/#" id="square_btn"><at-button v-on:click="regist" type="default">Start</at-button></a>
    </div>
    `
};
const Wallet = {
    data: function () {
        return {
            to: "",
            amount: ""
        };
    },
    store,
    computed: {
        from: function () {
            return this.$store.getters.my_address;
        },
        balance: function () {
            return new bignumber_js_1.default(this.$store.state.balance).toNumber();
        },
        secret: function () {
            return this.$store.state.secret;
        }
    },
    methods: {
        remit: async function () {
            try {
                console.log("request");
                const roots = exports.read_db('roots', gen.roots);
                const chain = exports.read_db('chain', [gen.block]);
                await index_1.send_request_tx(this.secret, "issue", con_1.native, [this.from, this.to], ["remit", JSON.stringify([this.amount])], [], _.copy(roots), _.copy(chain));
                alert('remit!');
            }
            catch (e) {
                console.log(e);
            }
        }
    },
    template: `
    <div>
        <h2>Wallet</h2>
        <at-input placeholder="from" v-model="from"></at-input>
        <at-input placeholder="to" v-model="to"></at-input>
        <at-input placeholder="amount" v-model="amount"></at-input>
        <at-input placeholder="secret" type="password" v-model="secret"></at-input>
        <at-button v-on:click="remit">Remit</at-button>
        <h3>Balance:{{ balance }}</h3>
    </div>
    `
};
const Setting = {
    computed: {
        menu_flag: function () {
            return this.$route.path === "/setting";
        }
    },
    methods: {
        back: function () {
            router.go(-1);
        }
    },
    template: `
    <div>
        <div v-if="menu_flag">
            <at-button><router-link to="/setting/account">Account</router-link></at-button><br>
            <at-button><router-link to="/setting/deposit">Deposit</router-link></at-button>
        </div>
        <div v-else>
            <at-button @click="back">Back</at-button>
            <router-view></router-view>
        </div>
    </div>
    `
};
const Account = {
    store,
    data: function () {
        return {
            secret: this.$store.state.secret
        };
    },
    computed: {
        pub_key: function () {
            try {
                console.log(CryptoSet.PublicFromPrivate(this.secret));
                return CryptoSet.PublicFromPrivate(this.secret);
            }
            catch (e) {
                return "";
            }
        },
        address: function () {
            if (this.pub_key === "")
                return "";
            try {
                console.log(CryptoSet.GenereateAddress(con_1.native, this.pub_key));
                return CryptoSet.GenereateAddress(con_1.native, this.pub_key);
            }
            catch (e) {
                return "";
            }
        }
    },
    methods: {
        save: function () {
            store.commit('refresh_secret', this.secret);
        }
    },
    template: `
    <div>
        <h2>Account</h2>
        <at-input v-model="secret" placeholder="secret" type="passowrd" size="large" status="info"></at-input><br>
        <p>address:{{address}}</p>
        <at-button v-on:click="save">Save</at-button>
    </div>
    `
};
const Deposit = {
    store,
    computed: {
        installed: function () {
            return this.$store.state.apps;
        }
    },
    methods: {
        uninstall: function (key) {
            store.commit('del_app', key);
        }
    },
    template: `
    <div>
        <h2>Deposit List</h2>
        <h1></h1>
        <div>
            <ul id="deposit_ul">
                <li v-for="inst in installed">
                    <at-card>
                    <img v-bind:src="inst.icon" width="70" height="70"/><h3>{{inst.name}}</h3>
                    <h4>deposited:{{inst.deposited}}</h4>
                    <at-button>deposit</at-button>
                    <at-button v-on:click="uninstall(inst.name)">uninstall</at-button>
                    </at-card>
                </li>
            </ul>
        </div>
    </div>
    `
};
let routes = [
    { path: '/', component: Home },
    { path: '/regist', component: Registration },
    { path: '/wallet', component: Wallet },
    { path: '/setting', component: Setting,
        children: [
            { path: 'account', component: Account },
            { path: 'deposit', component: Deposit }
        ]
    }
];
const router = new vue_router_1.default({
    routes: routes
});
if (store.state.registed === false)
    router.push({ path: '/regist' });
const app = new vue_1.default({
    router: router
}).$mount('#app');
worker.postMessage('start');
worker.addEventListener('message', (event) => {
    store.commit('refresh_balance', event.data);
});
