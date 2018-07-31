"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const level_browserify_1 = __importDefault(require("level-browserify"));
const con_1 = require("../con");
const _ = __importStar(require("../../core/basic"));
const CryptoSet = __importStar(require("../../core/crypto_set"));
const merkle_patricia_1 = require("../../core/merkle_patricia");
const tx_pool_1 = require("../../core/tx_pool");
const BlockSet = __importStar(require("../../core/block"));
const vue_1 = __importDefault(require("vue"));
const at_ui_1 = __importDefault(require("at-ui"));
const vue_router_1 = __importDefault(require("vue-router"));
//import 'at-ui-style'
let db = level_browserify_1.default('./trie');
const empty_root = {
    stateroot: _.toHash(''),
    locationroot: _.toHash('')
};
const getted = {
    roots: localStorage.getItem('root') || JSON.stringify(empty_root),
    pool: localStorage.getItem("tx_pool") || "{}",
    chain: localStorage.getItem("blockchain") || "[]",
    candidates: localStorage.getItem("candidates") || "[]"
};
let roots = JSON.parse(getted.roots);
let StateData;
if (roots.stateroot != _.toHash(''))
    StateData = new merkle_patricia_1.Trie(db, roots.stateroot);
else
    StateData = new merkle_patricia_1.Trie(db);
let LocationData;
if (roots.locationroot != _.toHash(''))
    LocationData = new merkle_patricia_1.Trie(db, roots.locationroot);
else
    LocationData = new merkle_patricia_1.Trie(db);
let pool = JSON.parse(getted.pool);
let chain = JSON.parse(getted.chain);
let candidates = JSON.parse(getted.candidates);
const my_shard_id = 0;
const port = "57750";
const ip = "localhost";
/*const option = {
    'force new connection':true,
    port:port
};*/
const socket = socket_io_client_1.default.connect("http://" + ip + ":" + port);
socket.on('tx', async (msg) => {
    const tx = JSON.parse(msg);
    const new_pool = await tx_pool_1.Tx_to_Pool(pool, tx, con_1.my_version, con_1.native, con_1.unit, chain, con_1.token_name_maxsize, StateData, LocationData);
    pool = new_pool;
});
socket.on('block', async (msg) => {
    const block = JSON.parse(msg);
    let code = "";
    let pre_StateData = StateData;
    const fraud = block.meta.fraud;
    if (fraud.flag === true) {
        const target_tx = chain[fraud.index].txs.filter(tx => tx.hash === fraud.hash)[0];
        code = localStorage.getItem("contract_modules/" + target_tx.meta.data.token) || "";
        pre_StateData = new merkle_patricia_1.Trie(db, chain[fraud.index].meta.stateroot);
    }
    const checked = await BlockSet.AcceptBlock(block, chain, my_shard_id, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, roots.stateroot, roots.locationroot, code, con_1.gas_limit, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, StateData, pre_StateData, LocationData);
    StateData = checked.state;
    LocationData = checked.location;
    candidates = checked.candidates;
    chain = checked.chain;
});
const setting = {
    name: "setting",
    icon: "./setting_icon.png",
    states: [],
    pub_keys: [],
    deposited: 0
};
localStorage.setItem("installed_tokens", JSON.stringify([setting]));
let installed_tokens = JSON.parse(localStorage.getItem("installed_tokens") || "[setting]");
vue_1.default.use(vue_router_1.default);
vue_1.default.use(at_ui_1.default);
const Home = {
    data: function () {
        return {
            installed: installed_tokens
        };
    },
    template: `
    <div id="vreath_home_apps">
        <ul>
            <li v-for="item in installed"
            class="vreath_app_unit">
                <div>
                <at-card>
                <router-link to="/setting">
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
    data: function () {
        return {
            secret: ""
        };
    },
    computed: {
        address: function () {
            try {
                return CryptoSet.GenereateAddress(con_1.native, CryptoSet.PublicFromPrivate(this.secret));
            }
            catch (e) {
                return "";
            }
        }
    },
    template: `
    <div>
        <h2>Account</h2>
        <at-input v-model="secret" placeholder="secret" type="passowrd" size="large" status="info"></at-input><br>
        <p>address:{{address}}</p>
    </div>
    `
};
const Deposit = {
    data: function () {
        return {
            installed: installed_tokens
        };
    },
    methods: {
        uninstall: function (i) {
            installed_tokens.splice(i, 1);
        }
    },
    template: `
    <div>
        <h2>Deposit List</h2>
        <h1></h1>
        <div>
            <ul id="deposit_ul">
                <li v-for="(inst,i) in installed">
                    <at-card>
                    <img v-bind:src="inst.icon" width="70" height="70"/><h3>{{inst.name}}</h3>
                    <h4>deposited:{{inst.deposited}}</h4>
                    <at-button>deposit</at-button>
                    <at-button v-on:click="uninstall(i)">uninstall</at-button>
                    </at-card>
                </li>
            </ul>
        </div>
    </div>
    `
};
let routes = [
    { path: '/', component: Home },
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
const app = new vue_1.default({
    router: router
}).$mount('#app');
