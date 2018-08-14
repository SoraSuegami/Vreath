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
const P = __importStar(require("p-iteration"));
const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_port || "localhost";
const socket = new rxjs_socket_io_1.IO();
socket.connect('http://' + ip + ':' + port);
const onTx = new rxjs_socket_io_1.ioEvent('tx');
const onBlock = new rxjs_socket_io_1.ioEvent('block');
const tx$ = socket.listenToEvent(onTx).event$.subscribe(async (data) => {
    const tx = JSON.parse(data);
    console.log(tx);
    exports.store.dispatch("tx_accept", tx);
});
const block$ = socket.listenToEvent(onBlock).event$.subscribe(async (data) => {
    const block = JSON.parse(data);
    exports.store.dispatch("block_accept", block);
    console.log(exports.store.state.chain);
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
const codes = {
    "native": "function main(){const state = vreath.states[0];const type = input[0];const other = input[1];const amount = Number(input[2]);switch (type) {case 'remit':if (tx.meta.data.type != 'scrap' || state.owner != tx.meta.data.address || amount >= 0) return 0; const remited = vreath.create_state(state.nonce + 1, state.owner, state.token, state.amount + amount, state.data, state.product);console.log(remited);vreath.change_states([state], [remited]);}}"
};
localStorage.removeItem("data");
localStorage.removeItem("apps");
localStorage.removeItem("code");
localStorage.removeItem("pool");
localStorage.removeItem("chain");
localStorage.removeItem("roots");
localStorage.removeItem("candidates");
(async () => {
    const S_Trie = index_1.trie_ins("");
    await P.forEach(gen.state, async (s) => {
        if (s.kind === "state")
            await S_Trie.put(s.owner, s);
        else
            await S_Trie.put(s.token, s);
    });
    console.log(S_Trie.now_root());
})();
exports.store = new vuex_1.default.Store({
    state: {
        data: JSON.parse(localStorage.getItem("data") || "{}"),
        apps: JSON.parse(localStorage.getItem("apps") || JSON.stringify(def_apps)),
        code: JSON.parse(localStorage.getItem("code") || JSON.stringify(codes)),
        pool: JSON.parse(localStorage.getItem("pool") || "{}"),
        chain: JSON.parse(localStorage.getItem("chain") || JSON.stringify([gen.block])),
        roots: JSON.parse(localStorage.getItem("roots") || JSON.stringify(gen.roots)),
        candidates: JSON.parse(localStorage.getItem("candidates") || JSON.stringify(gen.candidates)),
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
            state.chain = state.chain.concat(block).slice().sort((a, b) => {
                return a.meta.index - b.meta.index;
            });
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
            index_1.tx_accept(tx, socket);
            index_1.send_key_block(socket);
        },
        block_accept(commit, block) {
            index_1.block_accept(block, socket).then(() => {
                const reqs_pure = block.txs.filter(tx => tx.meta.kind === "request").concat(block.natives.filter(tx => tx.meta.kind === "request")).concat(block.units.filter(tx => tx.meta.kind === "request"));
                console.log(reqs_pure);
                if (reqs_pure.length > 0) {
                    P.forEach(reqs_pure, async (pure) => {
                        console.log("refresh!");
                        const req_tx = index_1.pure_to_tx(pure, block);
                        console.log(req_tx);
                        const code = exports.store.state.code[req_tx.meta.data.token];
                        index_1.send_refresh_tx(req_tx, block.meta.index, code, socket).then(() => {
                            console.log(exports.store.state.chain);
                            index_1.send_micro_block(socket);
                        });
                    });
                }
                else
                    index_1.send_micro_block(socket);
            });
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
            to: "Vr:native:cc57286592f4029e666e4f0b589fda1d8d295248510698e45f16b4aadef7592b",
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
