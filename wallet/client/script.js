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
const rxjs_socket_io_1 = require("rxjs-socket.io");
const index_1 = require("./index");
const CryptoSet = __importStar(require("../../core/crypto_set"));
const con_1 = require("../con");
const vue_1 = __importDefault(require("vue"));
const vuex_1 = __importDefault(require("vuex"));
const at_ui_1 = __importDefault(require("at-ui"));
const vue_router_1 = __importDefault(require("vue-router"));
const gen = __importStar(require("../../genesis/index"));
const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_port || "localhost";
const socket = new rxjs_socket_io_1.IO();
socket.connect('http://' + ip + ':' + port);
const onTx = new rxjs_socket_io_1.ioEvent('tx');
const onBlock = new rxjs_socket_io_1.ioEvent('block');
const tx$ = socket.listenToEvent(onTx).event$.subscribe(async (data) => {
    const tx = JSON.parse(data);
    exports.store.dispatch("tx_accept", tx);
});
const block$ = socket.listenToEvent(onBlock).event$.subscribe(async (data) => {
    const block = JSON.parse(data);
    exports.store.dispatch("block_accept", block);
});
vue_1.default.use(vuex_1.default);
vue_1.default.use(vue_router_1.default);
vue_1.default.use(at_ui_1.default);
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
localStorage.removeItem("data");
localStorage.removeItem("apps");
localStorage.removeItem("pool");
localStorage.removeItem("chain");
localStorage.removeItem("roots");
localStorage.removeItem("candidates");
exports.store = new vuex_1.default.Store({
    state: {
        data: JSON.parse(localStorage.getItem("data") || "{}"),
        apps: JSON.parse(localStorage.getItem("apps") || JSON.stringify(def_apps)),
        pool: JSON.parse(localStorage.getItem("pool") || "{}"),
        chain: JSON.parse(localStorage.getItem("chain") || "[]"),
        roots: JSON.parse(localStorage.getItem("roots") || JSON.stringify(gen.roots)),
        candidates: JSON.parse(localStorage.getItem("candidates") || "[]"),
        secret: "f836d7c5aa3f9fcf663d56e803972a573465a988d6457f1111e29e43ed7a1041"
    },
    mutations: {
        add_app(state, obj) {
            state.apps[obj.name] = obj;
            localStorage.setItem("apps", JSON.stringify(state.apps));
        },
        del_app(state, key) {
            delete state.apps[key];
            localStorage.setItem("apps", JSON.stringify(state.apps));
        },
        refresh_pool(state, pool) {
            state.pool = pool;
            localStorage.setItem("pool", JSON.stringify(state.pool));
        },
        add_block(state, block) {
            state.chain.concat(block);
            localStorage.setItem("chain", state.chain);
        },
        refresh_roots(state, roots) {
            state.roots = roots;
            localStorage.setItem("roots", state.roots);
        },
        refresh_candidates(state, candidates) {
            state.candidates = candidates;
            localStorage.setItem("candidates", state.candidates);
        },
        refresh_secret(state, secret) {
            state.secret = secret;
        }
    },
    getters: {
        my_address: (state) => CryptoSet.GenereateAddress(con_1.native, CryptoSet.PublicFromPrivate(state.secret)) || ""
    },
    actions: {
        tx_accept(commit, tx) {
            index_1.tx_accept(tx);
        },
        block_accept(commit, block) {
            index_1.block_accept(block);
        }
    }
});
const Home = {
    data: function () {
        return {
            installed: this.$store.state.apps
        };
    },
    store: exports.store,
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
const Wallet = {
    store: exports.store,
    data: function () {
        return {
            from: this.$store.getters.my_address,
            to: "Vr:native:1181567ccfa945016eccca505107ec3b43f9541e158f87d8c9be0a678593995d",
            amount: "100",
            secret: this.$store.state.secret,
            balance: 0
        };
    },
    created: async function () {
        this.balance = await index_1.get_balance(this.from);
    },
    methods: {
        remit: async function () {
            try {
                await index_1.send_request_tx(this.to, this.amount, socket);
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
    store: exports.store,
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
            this.$store.commit('refresh_secret', this.secret);
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
    store: exports.store,
    computed: {
        installed: function () {
            console.log(this.$store.state.apps);
            return this.$store.state.apps;
        }
    },
    methods: {
        uninstall: function (key) {
            this.$store.commit('del_app', key);
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
const app = new vue_1.default({
    router: router
}).$mount('#app');
