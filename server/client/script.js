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
const TxSet = __importStar(require("../../core/tx"));
const BlockSet = __importStar(require("../../core/block"));
const code_1 = require("../../core/code");
const Genesis = __importStar(require("../../genesis/index"));
const vue_1 = __importDefault(require("vue"));
const at_ui_1 = __importDefault(require("at-ui"));
const vue_router_1 = __importDefault(require("vue-router"));
const p_iteration_1 = require("p-iteration");
//import 'at-ui-style'
(async () => {
    let db = level_browserify_1.default('./trie');
    const empty_root = {
        stateroot: _.toHash(''),
        locationroot: _.toHash('')
    };
    localStorage.setItem("candidates", JSON.stringify([{ "address": ["Vr:native:bb8461713e14cc28126de8d0d42139a7984e8ceea0d560a4e0caa6d1a6fe66bb"], "amount": 100000000000000 }]));
    localStorage.setItem("codes", JSON.stringify({ "native": "'use strict';const main = () => {const this_step = step;if (this_step != 0)vreath.end();const state = vreath.states[0];const type = input[0];const other = input[1];const amount = Number(input[2]);switch (type) {case 'remit':if (tx.meta.data.kind != 'scrap' || state.contents.owner != tx.meta.data.address || amount >= 0)vreath.end();const remited = vreath.create_state(state.contents.nonce + 1, state.contents.owner, state.contents.token, state.contents.amount + amount, state.contents.data, state.contents.product);vreath.change_states([state], [remited]);vreath.end();}};" }));
    const getted = {
        roots: localStorage.getItem('root') || JSON.stringify(empty_root),
        pool: localStorage.getItem("tx_pool") || "{}",
        chain: localStorage.getItem("blockchain") || "[]",
        candidates: localStorage.getItem("candidates") || JSON.stringify([{ "address": ["Vr:native:bb8461713e14cc28126de8d0d42139a7984e8ceea0d560a4e0caa6d1a6fe66bb"], "amount": 100000000000000 }]),
        codes: localStorage.getItem("codes") || JSON.stringify({ "native": "'use strict';const main = () => {const this_step = step;if (this_step != 0)vreath.end();const state = vreath.states[0];const type = input[0];const other = input[1];const amount = Number(input[2]);switch (type) {case 'remit':if (tx.meta.data.kind != 'scrap' || state.contents.owner != tx.meta.data.address || amount >= 0)vreath.end();const remited = vreath.create_state(state.contents.nonce + 1, state.contents.owner, state.contents.token, state.contents.amount + amount, state.contents.data, state.contents.product);vreath.change_states([state], [remited]);vreath.end();}};" })
    };
    localStorage.setItem("genesis_state", JSON.stringify(Genesis.state));
    let roots = JSON.parse(getted.roots);
    let StateData;
    if (roots.stateroot != _.toHash(''))
        StateData = new merkle_patricia_1.Trie(db, roots.stateroot);
    else {
        StateData = new merkle_patricia_1.Trie(db);
        await StateData.put(JSON.stringify(Genesis.state[0].contents.owner), Genesis.state[0]);
        await StateData.put(JSON.stringify(Genesis.state[1].contents.owner), Genesis.state[1]);
        await StateData.put(Genesis.state[2].token, Genesis.state[2]);
        await StateData.put(Genesis.state[3].token, Genesis.state[3]);
        roots.stateroot = StateData.now_root();
    }
    let LocationData;
    if (roots.locationroot != _.toHash(''))
        LocationData = new merkle_patricia_1.Trie(db, roots.locationroot);
    else {
        LocationData = new merkle_patricia_1.Trie(db);
        roots.locationroot = LocationData.now_root();
    }
    let pool = JSON.parse(getted.pool);
    let chain = JSON.parse(getted.chain);
    let candidates = JSON.parse(getted.candidates);
    let codes = JSON.parse(getted.codes);
    const my_shard_id = 0;
    const port = "57750";
    const ip = "localhost";
    /*const option = {
        'force new connection':true,
        port:port
    };*/
    const pow_target = 100000000000000000000000000000000;
    const pos_diff = 10000000;
    let processing = [];
    const block_accepting = async (msg) => {
        const block = JSON.parse(msg);
        let code = "";
        let pre_StateData = StateData;
        const fraud = block.meta.fraud;
        if (fraud.flag === true) {
            const target_tx = chain[fraud.index].txs.filter(tx => tx.hash === fraud.hash)[0];
            code = localStorage.getItem("contract_modules/" + target_tx.meta.data.token) || "";
            pre_StateData = new merkle_patricia_1.Trie(db, chain[fraud.index].meta.stateroot);
        }
        const accepted = await BlockSet.AcceptBlock(block, chain, my_shard_id, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, roots.stateroot, roots.locationroot, code, con_1.gas_limit, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, StateData, pre_StateData, LocationData);
        if (accepted.chain.length === 0) {
            console.log("receive invalid block");
            return 0;
        }
        block.txs.forEach(tx => delete pool[tx.hash]);
        StateData = accepted.state;
        LocationData = accepted.location;
        candidates = accepted.candidates;
        chain = chain.concat(accepted.chain);
        const reqs_pure = block.txs.filter(tx => tx.meta.kind === "request").concat(block.natives.filter(tx => tx.meta.kind === "request")).concat(block.units.filter(tx => tx.meta.kind === "request"));
        if (reqs_pure.length > 0) {
            const reqs_raw = reqs_pure.map((req, i) => block.raws[i]);
            const reqs = reqs_pure.map((pure, i) => {
                return {
                    hash: pure.hash,
                    meta: pure.meta,
                    raw: reqs_raw[i]
                };
            });
            await p_iteration_1.forEach(reqs, async (req) => {
                const my_private = localStorage.getItem('my_secret') || "";
                const my_public = localStorage.getItem('my_pub') || "";
                const my_address = localStorage.getItem('my_address') || "";
                const code = codes[req.meta.data.token];
                const base_states = await p_iteration_1.map(req.meta.data.base, async (base) => { return await StateData.get(base); });
                const runed = await code_1.RunVM(0, code, base_states, 0, req.raw.raw, req, [], con_1.gas_limit);
                const output = runed.states.map(s => JSON.stringify(s));
                const created = TxSet.CreateRefreshTx(con_1.my_version, 10, [my_public], pow_target, 10, req.hash, block.meta.index, JSON.stringify([my_address]), output, runed.traced, [], chain);
                const ref = TxSet.SignTx(created, my_private, my_address);
                console.log(ref);
                if (!await TxSet.ValidRefreshTx(ref, chain, con_1.my_version, con_1.native, con_1.unit, con_1.token_name_maxsize, StateData, LocationData)) {
                    console.log("fail to create valid refresh tx");
                    return 0;
                }
                pool[ref.hash] = ref;
                socket.emit('tx', JSON.stringify(ref));
            });
        }
    };
    const socket = socket_io_client_1.default.connect("http://" + ip + ":" + port);
    socket.on('tx', async (msg) => {
        const tx = JSON.parse(msg);
        const new_pool = await tx_pool_1.Tx_to_Pool(pool, tx, con_1.my_version, con_1.native, con_1.unit, chain, con_1.token_name_maxsize, StateData, LocationData);
        pool = new_pool;
    });
    socket.on('block', async (msg) => {
        processing.push(msg);
        if (processing.length === 1) {
            await block_accepting(msg);
            processing = processing.filter(p => p != msg);
        }
        else {
            setInterval(async () => {
                if (processing.length === 1) {
                    clearInterval();
                    await block_accepting(msg);
                    processing = processing.filter(p => p != msg);
                }
            }, 5000);
        }
    });
    const wallet = {
        name: "wallet",
        icon: "./vreathrogoi.jpg",
        pub_keys: [],
        deposited: 0
    };
    const setting = {
        name: "setting",
        icon: "./setting_icon.png",
        pub_keys: [],
        deposited: 0
    };
    localStorage.setItem("installed_tokens", JSON.stringify([wallet, setting]));
    let installed_tokens = JSON.parse(localStorage.getItem("installed_tokens") || "[wallet,setting]");
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
        data: function () {
            return {
                from: localStorage.getItem("my_address"),
                to: "Vr:native:1181567ccfa945016eccca505107ec3b43f9541e158f87d8c9be0a678593995d",
                amount: "100",
                secret: "a611b2b5da5da90b280475743675dd36444fde49d3166d614f5d9d7e1763768a",
                balance: 0
            };
        },
        created: async function () {
            try {
                const state = await StateData.get(JSON.stringify([this.from]));
                if (state != null) {
                    this.balance = state.contents.amount;
                }
            }
            catch (e) {
                console.log(e);
            }
        },
        methods: {
            remit: async function () {
                try {
                    const pub_key = [localStorage.getItem("my_pub")];
                    const from = [this.from];
                    const to = this.to.split(',');
                    const amount = this.amount;
                    const pre_tx = TxSet.CreateRequestTx(pub_key, JSON.stringify(from), 10, "scrap", con_1.native, [JSON.stringify(from)], ["remit", JSON.stringify(to), "-" + amount], [], con_1.my_version, TxSet.empty_tx_pure().meta.pre, TxSet.empty_tx_pure().meta.next, 10);
                    const tx = TxSet.SignTx(pre_tx, this.secret, this.from);
                    if (!await TxSet.ValidRequestTx(tx, con_1.my_version, con_1.native, con_1.unit, StateData, LocationData))
                        alert("invalid infomations");
                    else {
                        alert("remit!");
                        socket.emit('tx', JSON.stringify(tx));
                        pool[tx.hash] = tx;
                    }
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
        data: function () {
            return {
                secret: CryptoSet.GenerateKeys()
            };
        },
        computed: {
            pub_key: function () {
                try {
                    console.log(this.secret);
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
                    return CryptoSet.GenereateAddress(con_1.native, this.pub_key);
                }
                catch (e) {
                    return "";
                }
            }
        },
        methods: {
            save: function () {
                localStorage.setItem('my_secret', this.secret);
                localStorage.setItem('my_pub', this.pub_key);
                localStorage.setItem('my_address', this.address);
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
})();
