import * as rx from 'rxjs'
import {IO, ioEvent} from 'rxjs-socket.io'
import {tx_accept,block_accept,get_balance,send_request_tx,trie_ins,check_chain,send_key_block} from './index'
import * as T from '../../core/types'
import * as CryptoSet from '../../core/crypto_set'
import * as  _ from '../../core/basic'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate,compatible_version} from '../con'
import Vue from 'vue'
import Vuex from 'vuex'
import AtComponents from 'at-ui'
import VueRouter from 'vue-router'
import * as gen from '../../genesis/index';
import vm from 'js-vm';
import * as P from 'p-iteration'
import { Trie } from '../../core_arc2/merkle_patricia';



const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_ip || "localhost";
console.log(ip)

const socket = new IO();
socket.connect('http://'+ip+':'+port);

const onTx: ioEvent = new ioEvent('tx');
const onBlock: ioEvent = new ioEvent('block');
const checkChain: ioEvent = new ioEvent('checkchain');
const replaceChain: ioEvent = new ioEvent('replacechain');

const tx$: rx.Subscription = socket.listenToEvent(onTx).event$.subscribe(async (data:string)=>{
    try{
        const tx:T.Tx = JSON.parse(data);
        console.log(tx)
        await store.dispatch("tx_accept",_.copy(tx));
    }
    catch(e){console.log(e);}
});

const block$: rx.Subscription = socket.listenToEvent(onBlock).event$.subscribe(async (data:string)=>{
    try{
        const block:T.Block = JSON.parse(data);
        const chain:T.Block[] = store.state.chain;
        if(block.meta.version>=compatible_version){
            if(block.meta.index>chain.length) socket.emit("checkchain");
            else if(block.meta.index===chain.length) await store.dispatch("block_accept",_.copy(block));
            console.log(block)
        }
    }
    catch(e){console.log(e);}
});

const checkchain$: rx.Subscription = socket.listenToEvent(checkChain).event$.subscribe(async (data:string)=>{
    socket.emit('replacechain',JSON.stringify(store.state.chain.slice()));
});

const replacehain$: rx.Subscription = socket.listenToEvent(replaceChain).event$.subscribe(async (data:string)=>{
    try{
        const chain:T.Block[] = JSON.parse(data);
        console.log("replace:")
        console.log(chain)
        await check_chain(chain.slice(),JSON.parse(localStorage.getItem("chain")||JSON.stringify([gen.block])),_.copy(store.state.pool),_.copy(store.state.roots),store.state.candidates.slice(),_.copy(store.state.code),store.state.secret,store.state.validator_mode,store.state.unit_store,socket);
        const S_Trie = trie_ins(store.state.roots.stateroot);
        const unit_state:T.State = await S_Trie.get(CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.state.secret)));
        if(chain.length===1&&unit_state!=null&&unit_state.amount>0) await send_key_block(JSON.parse(localStorage.getItem("chain")||JSON.stringify([gen.block])),store.state.secret,store.state.candidates.slice(),_.copy(store.state.roots),_.copy(store.state.pool),_.copy(store.state.code),store.state.validator_mode,socket);
    }
    catch(e){console.log(e);}
});

Vue.use(Vuex)
Vue.use(VueRouter)
Vue.use(AtComponents)

type Installed = {
    name:string;
    icon:string;
    pub_keys:string[][];
    deposited:number;
}

const wallet:Installed = {
    name:"wallet",
    icon:"./img/vreathrogoi.jpg",
    pub_keys:[],
    deposited:0
}
const setting:Installed = {
    name:"setting",
    icon:"./img/setting_icon.png",
    pub_keys:[],
    deposited:0
}

const def_apps:{[key:string]:Installed} = {
    wallet:wallet,
    setting:setting
}

const codes = {
    "native":"const main = () => {};",//"function main(){const state = vreath.states[0];const type = input[0];const other = input[1];const amount = Number(input[2]);switch (type) {case 'remit':if (tx.meta.data.type != 'scrap' || state.owner != tx.meta.data.address || amount >= 0 || state.amount < amount) {console.log('error'); return 0;} const remited = vreath.create_state(state.nonce + 1, state.owner, state.token, state.amount + amount, state.data, state.product);console.log(remited);vreath.change_states([state], [remited]);}}",
    "unit":"const main = () => {};"
}

localStorage.removeItem("data");
localStorage.removeItem("apps");
localStorage.removeItem("code");
localStorage.removeItem("pool");
localStorage.removeItem("chain");
localStorage.removeItem("roots");
localStorage.removeItem("candidates");
localStorage.removeItem("unit_store");

const test_secret = "f836d7c5aa3f9fcf663d56e803972a573465a988d6457f1111e29e43ed7a1041"

export const store = new Vuex.Store({
    state:{
        data:JSON.parse(localStorage.getItem("data")||"{}"),
        apps:JSON.parse(localStorage.getItem("apps")||JSON.stringify(def_apps)),
        code:JSON.parse(localStorage.getItem("code")||JSON.stringify(codes)),
        pool:JSON.parse(localStorage.getItem("pool")||"{}"),
        chain:JSON.parse(localStorage.getItem("chain")||JSON.stringify([gen.block])),
        roots:JSON.parse(localStorage.getItem("roots")||JSON.stringify(gen.roots)),
        candidates:JSON.parse(localStorage.getItem("candidates")||JSON.stringify(gen.candidates)),
        unit_store:JSON.parse(localStorage.getItem("unit_store")||JSON.stringify({})),
        secret:localStorage.getItem("secret")||CryptoSet.GenerateKeys(),
        balance:0,
        validator_mode:false
    },
    mutations:{
        add_app(state,obj:Installed){
            state.apps[obj.name] = _.copy(obj);
            localStorage.setItem("apps",JSON.stringify(_.copy(state.apps)));
        },
        del_app(state,key:string){
            delete state.apps[key];
            localStorage.setItem("apps",JSON.stringify(_.copy(state.apps)));
        },
        refresh_pool(state,pool:T.Pool){
            state.pool = _.copy(pool);
            localStorage.setItem("pool",JSON.stringify(_.copy(state.pool)));
        },
        add_block(state,block:T.Block){
            state.chain = state.chain.concat(block).sort((a:T.Block,b:T.Block)=>{
                return a.meta.index - b.meta.index;
            });
            localStorage.setItem("chain",JSON.stringify(state.chain.slice()));
        },
        replace_chain(state,chain:T.Block[]){
            state.chain = chain.slice().sort((a:T.Block,b:T.Block)=>{
                return a.meta.index - b.meta.index;
            });
            localStorage.setItem("chain",JSON.stringify(state.chain.slice()));
        },
        refresh_roots(state,roots:{[key:string]:string}){
            state.roots = _.copy(roots);
            localStorage.setItem("roots",_.copy(state.roots));
        },
        refresh_candidates(state,candidates:T.Candidates[]){
            state.candidates = candidates.slice();
            localStorage.setItem("candidates",JSON.stringify(state.candidates.slice()));
        },
        refresh_unit_store(state,store:{[key:string]:T.Unit[]}){
            state.unit_store = _.copy(store);
            localStorage.setItem("unit_store",JSON.stringify(_.copy(state.unit_store)));
        },
        refresh_secret(state,secret:string){
            state.secret = secret;
            localStorage.setItem("secret",state.secret);
        },
        refresh_balance(state,amount:number){
            state.balance = amount;
        },
        validator_time(state){
            state.validator_mode = true;
            setTimeout(() => {
                state.validator_mode = false;
            }, block_time*max_blocks);
        }
    },
    getters:{
        my_address:(state) => CryptoSet.GenereateAddress(native,CryptoSet.PublicFromPrivate(state.secret)) || ""
    },
    actions:{
        tx_accept(commit,tx:T.Tx){
            try{
                tx_accept(tx,store.state.chain.slice(),_.copy(store.state.roots),_.copy(store.state.pool),store.state.secret,store.state.validator_mode,store.state.candidates.slice(),store.state.code,_.copy(store.state.unit_store),socket).then(()=>{
                    console.log("tx accept");
                })
            }
            catch(e){console.log(e)}
        },
        block_accept(commit,block:T.Block){
            try{
                block_accept(block,store.state.chain.slice(),store.state.candidates.slice(),_.copy(store.state.roots),_.copy(store.state.pool),_.copy(store.state.code),store.state.secret,_.copy(store.state.code),_.copy(store.state.unit_store),socket).then(()=>{
                    console.log("block accept");
                    get_balance(store.getters.my_address).then((amount)=>{
                        commit.commit("refresh_balance",amount);
                    });

                })
            }
            catch(e){console.log(e);}
        },
    }
});

(async ()=>{
    const S_Trie = trie_ins("");
    await P.forEach(gen.state,async (s:T.State)=>{
        if(s.kind==="state") await S_Trie.put(s.owner,s);
        else await S_Trie.put(s.token,s);
    });
    console.log("stateroot:")
    console.log(S_Trie.now_root());
    socket.emit("checkchain");
    let pre_length = 0;
    let new_length = store.state.chain.length;
    setInterval(async ()=>{
        pre_length = new_length;
        new_length = store.state.chain.length;
        console.log(pre_length)
        console.log(new_length);
        if(pre_length===new_length) await send_key_block(store.state.chain,store.state.secret,store.state.candidates,store.state.roots,store.state.pool,store.state.code,store.state.validator_mode,socket);
    },block_time*max_blocks*10);
})();

const Home = {
    data:function(){
        return{
            installed:_.copy(this.$store.state.apps)
        }
    },
    store,
    template:`
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
}

const Wallet = {
    store,
    data:function(){
        return{
            to:"Vr:native:cc57286592f4029e666e4f0b589fda1d8d295248510698e45f16b4aadef7592b",
            amount:"0.01"
        }
    },
    created:async function(){
        socket.emit("checkchain");
        const balance = await get_balance(this.from);
        console.log(balance);
        store.commit("refresh_balance",balance);
    },
    watch:{
        refresh_balance:async function(){
            const balance = await get_balance(this.from);
            console.log(balance);
            store.commit("refresh_balance",balance);
        }
    },
    computed:{
        from:function():string{
            return this.$store.getters.my_address
        },
        balance:function():number{
            return this.$store.state.balance.toFixed(18);
        },
        secret:function():string{
            return this.$store.state.secret;
        }
    },
    methods:{
        remit:async function(){
            try{
                console.log("request");
                await send_request_tx(this.$store.state.secret,this.to,this.amount,_.copy(this.$store.state.roots),this.$store.state.chain.slice(),_.copy(this.$store.state.pool),this.$store.state.validator_mode,this.$store.state.candidates.slice(),this.$store.state.code,socket);
            }
            catch(e){console.log(e)}
        }
    },
    template:`
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
}

const Setting = {
    computed:{
        menu_flag:function():boolean{
            return this.$route.path==="/setting"
        }
    },
    methods:{
        back:function(){
            router.go(-1);
        }
    },
    template:`
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
    data:function(){
        return{
            secret:this.$store.state.secret
        }
    },
    computed:{
        pub_key:function():string{
            try{
                console.log(CryptoSet.PublicFromPrivate(this.secret));
                return CryptoSet.PublicFromPrivate(this.secret);
            }
            catch(e){return ""}
        },
        address:function():string{
            if(this.pub_key==="") return "";
            try{
                console.log(CryptoSet.GenereateAddress(native,this.pub_key))
                return CryptoSet.GenereateAddress(native,this.pub_key);
            }
            catch(e){return ""}
        }
    },
    methods:{
        save:function(){
            this.$store.commit('refresh_secret',this.secret)
        }
    },
    template:`
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
    computed:{
        installed:function(){
            console.log(this.$store.state.apps)
            return this.$store.state.apps
        }
    },
    methods:{
        uninstall:function(key:string){
            this.$store.commit('del_app',key)
        }
    },
    template:`
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
}


let routes = [
    { path: '/', component:Home},
    { path: '/wallet', component:Wallet},
    { path: '/setting', component:Setting,
      children: [
        { path: 'account', component: Account },
        { path: 'deposit', component: Deposit }
      ]
    }
]

const router = new VueRouter({
    routes:routes
});

const app = new Vue({
    router: router
}).$mount('#app');


