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
const vue_1 = __importDefault(require("vue"));
const vuex_1 = __importDefault(require("vuex"));
const at_ui_1 = __importDefault(require("at-ui"));
const vue_router_1 = __importDefault(require("vue-router"));
const gen = __importStar(require("../../genesis/index"));
const P = __importStar(require("p-iteration"));
const faye_1 = __importDefault(require("faye"));
const TxSet = __importStar(require("../../core/tx"));
const BlockSet = __importStar(require("../../core/block"));
const StateSet = __importStar(require("../../core/state"));
const bignumber_js_1 = __importDefault(require("../../node_modules/bignumber.js"));
const port = peer_list_1.peer_list[0].port || "57750";
const ip = peer_list_1.peer_list[0].ip || "localhost";
console.log(ip);
/*const socket = new IO();
socket.connect('http://'+ip+':'+port);*/
exports.client = new faye_1.default.Client('http://' + ip + ':' + port + '/vreath');
localStorage.removeItem("data");
localStorage.removeItem("apps");
localStorage.removeItem("code");
localStorage.removeItem("pool");
localStorage.removeItem("chain");
localStorage.removeItem("roots");
localStorage.removeItem("candidates");
localStorage.removeItem("unit_store");
localStorage.removeItem("yet_data");
const sleep = (msec) => {
    return new Promise(function (resolve) {
        setTimeout(function () { resolve(); }, msec);
    });
};
const send_blocks = async () => {
    const S_Trie = index_1.trie_ins(exports.store.state.roots.stateroot);
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
        const new_pool = await index_1.tx_accept(_.copy(target), _.copy(exports.store.state.chain), _.copy(exports.store.state.roots), _.copy(exports.store.state.pool), exports.store.state.secret, _.copy(exports.store.state.candidates), _.copy(exports.store.state.unit_store));
        const txs = exports.store.state.yet_data.filter((d) => d.type === "tx" && d.tx[0] != null && d.tx[0].hash != target.hash);
        const blocks = exports.store.state.yet_data.filter((d) => d.type === "block");
        const reduced = txs.concat(blocks);
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
                const txs = _.copy(exports.store.state.yet_data).filter((d) => d.type === "tx");
                const blocks = _.copy(exports.store.state.yet_data).filter((d) => d.type === "block" && d.block[0] != null && d.block[0].meta.index > block.meta.index); /*.sort((a:Data,b:Data)=>{
                    return a.block[0].meta.index - b.block[0].meta.index;
                });*/
                const reduced = txs.concat(blocks);
                console.log(reduced);
                exports.store.commit("refresh_yet_data", reduced);
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
                    await index_1.send_refresh_tx(_.copy(exports.store.state.roots), exports.store.state.secret, _.copy(req_tx), index, code, _.copy(new_chain));
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
                const txs = exports.store.state.yet_data.filter((d) => d.type === "tx");
                const blocks = exports.store.state.yet_data.filter((d) => d.type === "block" && d.block[0] != null && d.block[0].meta.index != block.meta.index); /*.sort((a:Data,b:Data)=>{
                    return a.block[0].meta.index - b.block[0].meta.index;
                });*/
                const reduced = txs.concat(blocks);
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
exports.client.subscribe('/data', async (data) => {
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
        //return await compute_yet(_.copy(store.state.roots),_.copy(store.state.chain),_.copy(store.state.pool),_.copy(store.state.candidates),_.copy(store.state.unit_store),_.copy(store.state.not_refreshed_tx),store.state.now_buying);
        /*const S_Trie = trie_ins(store.state.roots.stateroot);
        const unit_state:T.State = await S_Trie.get(CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.state.secret)));
        console.log(await S_Trie.filter());*/
        //if(chain.length===1&&unit_state!=null&&unit_state.amount>0) await send_key_block(JSON.parse(localStorage.getItem("chain")||JSON.stringify([gen.block])),store.state.secret,_.copy(store.state.candidates),_.copy(store.state.roots));
    }
    catch (e) {
        throw new Error(e);
    }
});
exports.client.bind('transport:down', () => {
    console.log('lose connection');
    localStorage.removeItem("data");
    localStorage.removeItem("apps");
    localStorage.removeItem("code");
    localStorage.removeItem("pool");
    localStorage.removeItem("chain");
    localStorage.removeItem("roots");
    localStorage.removeItem("candidates");
    localStorage.removeItem("unit_store");
    localStorage.removeItem("yet_data");
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
    "native": "const main = () => {};",
    "unit": "const main = () => {};"
};
const test_secret = "f836d7c5aa3f9fcf663d56e803972a573465a988d6457f1111e29e43ed7a1041";
exports.store = new vuex_1.default.Store({
    state: {
        data: JSON.parse(localStorage.getItem("data") || "{}"),
        apps: JSON.parse(localStorage.getItem("apps") || JSON.stringify(def_apps)),
        code: JSON.parse(localStorage.getItem("code") || JSON.stringify(codes)),
        pool: JSON.parse(localStorage.getItem("pool") || "{}"),
        chain: JSON.parse(localStorage.getItem("chain") || JSON.stringify([gen.block])),
        roots: JSON.parse(localStorage.getItem("roots") || JSON.stringify(gen.roots)),
        candidates: JSON.parse(localStorage.getItem("candidates") || JSON.stringify(gen.candidates)),
        unit_store: JSON.parse(localStorage.getItem("unit_store") || JSON.stringify({})),
        secret: localStorage.getItem("secret") || CryptoSet.GenerateKeys(),
        balance: 0,
        yet_data: JSON.parse(localStorage.getItem("yet_data") || "[]"),
        check_mode: false,
        replace_mode: false,
        replace_index: 0,
        not_refreshed_tx: [],
        now_buying: false,
        now_refreshing: []
    },
    mutations: {
        add_app(state, obj) {
            state.apps[obj.name] = _.copy(obj);
            localStorage.setItem("apps", JSON.stringify(_.copy(state.apps)));
        },
        del_app(state, key) {
            delete state.apps[key];
            localStorage.setItem("apps", JSON.stringify(_.copy(state.apps)));
        },
        refresh_pool(state, pool) {
            state.pool = _.copy(pool);
            localStorage.setItem("pool", JSON.stringify(_.copy(state.pool)));
        },
        add_block(state, block) {
            state.chain.push(block);
            localStorage.setItem("chain", JSON.stringify(_.copy(state.chain)));
        },
        replace_chain(state, chain) {
            state.chain = _.copy(chain).slice().sort((a, b) => {
                return a.meta.index - b.meta.index;
            }).filter((b, i) => b.meta.index === i);
            localStorage.setItem("chain", JSON.stringify(_.copy(state.chain)));
        },
        refresh_roots(state, roots) {
            state.roots = _.copy(roots);
            localStorage.setItem("roots", _.copy(state.roots));
        },
        refresh_candidates(state, candidates) {
            state.candidates = _.copy(candidates);
            localStorage.setItem("candidates", JSON.stringify(_.copy(state.candidates)));
        },
        refresh_unit_store(state, store) {
            state.unit_store = _.copy(store);
            localStorage.setItem("unit_store", JSON.stringify(_.copy(state.unit_store)));
        },
        refresh_secret(state, secret) {
            state.secret = secret;
            localStorage.setItem("secret", state.secret);
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
        }
    },
    getters: {
        my_address: (state) => CryptoSet.GenereateAddress(con_1.native, CryptoSet.PublicFromPrivate(state.secret)) || ""
    },
    actions: {
    /*tx_accept(commit,tx:T.Tx){
        try{
            console.log(store.state.yet_tx)
            console.log(store.state.check_mode)
            if(!store.state.check_mode){
                commit.commit("check",true);
                tx_accept(tx,store.state.chain.slice(),_.copy(store.state.roots),_.copy(store.state.pool),store.state.secret,store.state.validator_mode,store.state.candidates.slice(),store.state.code,_.copy(store.state.unit_store)).then(()=>{
                    console.log("tx accept");
                    if(tx.meta.kind==="request"||tx.meta.data.index<=store.state.chain.length-1){
                        const reduced:T.Tx[] = store.state.yet_tx.filter((t:T.Tx)=>t.hash!=tx.hash);
                        commit.commit("refresh_yet_tx",reduced);
                        commit.commit("check",false);
                        if(store.state.yet_block.length>0) store.dispatch("block_accept",store.state.yet_block[0]).then(()=>{
                            if(reduced.length>0) store.dispatch("tx_accept",reduced[0]);
                        });
                    }
                    else{
                        commit.commit("check",false);
                        client.publish("/checkchain","");
                    }
                })
            }
            else commit.commit("refresh_yet_tx",store.state.yet_tx.concat(tx));
        }
        catch(e){console.log(e)}
    },
    block_accept(commit,block:T.Block){
        try{
            if(!store.state.
            ){
                commit.commit("check",true);
                block_accept(block,store.state.chain.slice(),store.state.candidates.slice(),_.copy(store.state.roots),_.copy(store.state.pool),_.copy(store.state.code),store.state.secret,_.copy(store.state.code),_.copy(store.state.unit_store)).then(()=>{
                    console.log("block accept");
                    get_balance(store.getters.my_address).then((amount)=>{
                        commit.commit("refresh_balance",amount);
                        commit.commit("check",false);
                        console.log(store.state.yet_block);
                        console.log(store.state.check_mode)
                        const reduced = store.state.yet_block.filter((b:T.Block)=>b.hash!=block.hash);
                        commit.commit("refresh_yet_block",reduced);
                        if(store.state.yet_tx.length>0) store.dispatch("tx_accept",store.state.yet_tx[0]).then(()=>{
                            if(reduced.length>0) store.dispatch("block_accept",reduced[0]).then(()=>console.log("block reduced"));
                        })
                    });
                });
            }
            else commit.commit("refresh_yet_block",store.state.yet_block.concat(block));
            console.log(store.state.yet_block);
            console.log(store.state.check_mode)
        }
        catch(e){console.log(e);}
    },*/
    }
});
const Home = {
    data: function () {
        return {
            installed: _.copy(this.$store.state.apps)
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
            to: "",
            amount: ""
        };
    },
    created: async function () {
        const gen_S_Trie = index_1.trie_ins("");
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
        const balance = await index_1.get_balance(this.from);
        console.log(balance);
        this.$store.commit("refresh_balance", balance);
        console.log('yet:');
        console.log(exports.store.state.yet_data);
        ;
        await compute_yet();
    },
    watch: {
        refresh_balance: async function () {
            const balance = await index_1.get_balance(this.from);
            console.log(balance);
            this.$store.commit("refresh_balance", balance);
        }
    },
    computed: {
        from: function () {
            return this.$store.getters.my_address;
        },
        balance: function () {
            const balance = this.$store.state.balance || 0;
            return balance.toFixed(18);
        },
        secret: function () {
            return this.$store.state.secret;
        }
    },
    methods: {
        remit: async function () {
            try {
                console.log("request");
                await index_1.send_request_tx(this.$store.state.secret, "issue", con_1.native, [this.from, this.to], ["remit", JSON.stringify([this.amount])], [], _.copy(this.$store.state.roots), _.copy(this.$store.state.chain));
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
