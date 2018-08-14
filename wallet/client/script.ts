import * as rx from 'rxjs'
import {IO, ioEvent} from 'rxjs-socket.io'
import {tx_accept,block_accept,get_balance,send_request_tx,send_refresh_tx,send_key_block,send_micro_block,pure_to_tx, trie_ins} from './index'
import * as T from '../../core/types'
import * as CryptoSet from '../../core/crypto_set'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate} from '../con'
import Vue from 'vue'
import Vuex from 'vuex'
import AtComponents from 'at-ui'
import VueRouter from 'vue-router'
import * as gen from '../../genesis/index';
import vm from 'js-vm';
import * as P from 'p-iteration'



const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_port || "localhost";

const socket = new IO();
socket.connect('http://'+ip+':'+port);

const onTx: ioEvent = new ioEvent('tx');
const onBlock: ioEvent = new ioEvent('block');

const tx$: rx.Subscription = socket.listenToEvent(onTx).event$.subscribe(async (data:string)=>{
    const tx:T.Tx = JSON.parse(data);
    console.log(tx)
    store.dispatch("tx_accept",tx);
});

const block$: rx.Subscription = socket.listenToEvent(onBlock).event$.subscribe(async (data:string)=>{
    const block:T.Block = JSON.parse(data);
    store.dispatch("block_accept",block);
    console.log(store.state.chain)
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
    "native":"function main(){const state = vreath.states[0];const type = input[0];const other = input[1];const amount = Number(input[2]);switch (type) {case 'remit':if (tx.meta.data.type != 'scrap' || state.owner != tx.meta.data.address || amount >= 0) return 0; const remited = vreath.create_state(state.nonce + 1, state.owner, state.token, state.amount + amount, state.data, state.product);console.log(remited);vreath.change_states([state], [remited]);}}"
}

localStorage.removeItem("data");
localStorage.removeItem("apps");
localStorage.removeItem("code");
localStorage.removeItem("pool");
localStorage.removeItem("chain");
localStorage.removeItem("roots");
localStorage.removeItem("candidates");

(async ()=>{
    const S_Trie = trie_ins("");
    await P.forEach(gen.state,async (s:T.State)=>{
        if(s.kind==="state") await S_Trie.put(s.owner,s);
        else await S_Trie.put(s.token,s);
    });
    console.log(S_Trie.now_root());
})();

export const store = new Vuex.Store({
    state:{
        data:JSON.parse(localStorage.getItem("data")||"{}"),
        apps:JSON.parse(localStorage.getItem("apps")||JSON.stringify(def_apps)),
        code:JSON.parse(localStorage.getItem("code")||JSON.stringify(codes)),
        pool:JSON.parse(localStorage.getItem("pool")||"{}"),
        chain:JSON.parse(localStorage.getItem("chain")||JSON.stringify([gen.block])),
        roots:JSON.parse(localStorage.getItem("roots")||JSON.stringify(gen.roots)),
        candidates:JSON.parse(localStorage.getItem("candidates")||JSON.stringify(gen.candidates)),
        secret:"f836d7c5aa3f9fcf663d56e803972a573465a988d6457f1111e29e43ed7a1041"
    },
    mutations:{
        add_app(state,obj:Installed){
            state.apps[obj.name] = obj;
            localStorage.setItem("apps",JSON.stringify(state.apps));
        },
        del_app(state,key:string){
            delete state.apps[key];
            localStorage.setItem("apps",JSON.stringify(state.apps));
        },
        refresh_pool(state,pool:T.Pool){
            state.pool = pool;
            localStorage.setItem("pool",JSON.stringify(state.pool));
        },
        add_block(state,block:T.Block){
            state.chain = state.chain.concat(block).slice().sort((a:T.Block,b:T.Block)=>{
                return a.meta.index - b.meta.index;
            });
            localStorage.setItem("chain",state.chain);
        },
        refresh_roots(state,roots:{[key:string]:string}){
            state.roots = roots;
            localStorage.setItem("roots",state.roots);
        },
        refresh_candidates(state,candidates:T.Candidates[]){
            state.candidates = candidates;
            localStorage.setItem("candidates",state.candidates);
        },
        refresh_secret(state,secret:string){
            state.secret = secret;
        }
    },
    getters:{
        my_address:(state) => CryptoSet.GenereateAddress(native,CryptoSet.PublicFromPrivate(state.secret)) || ""
    },
    actions:{
        tx_accept(commit,tx:T.Tx){
            tx_accept(tx,socket);
            send_key_block(socket);
        },
        block_accept(commit,block:T.Block){
            block_accept(block,socket).then(()=>{
                const reqs_pure = block.txs.filter(tx=>tx.meta.kind==="request").concat(block.natives.filter(tx=>tx.meta.kind==="request")).concat(block.units.filter(tx=>tx.meta.kind==="request"));
                console.log(reqs_pure);
                if(reqs_pure.length>0){
                    P.forEach(reqs_pure,async (pure:T.TxPure)=>{
                        console.log("refresh!")
                        const req_tx = pure_to_tx(pure,block);
                        console.log(req_tx);
                        const code:string = store.state.code[req_tx.meta.data.token]
                        send_refresh_tx(req_tx,block.meta.index,code,socket).then(()=>{
                            console.log(store.state.chain);
                            send_micro_block(socket);
                        });
                    })
                }
                else send_micro_block(socket);
            });
        }
    }
})

const Home = {
    data:function(){
        return{
            installed:this.$store.state.apps
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
            from:this.$store.getters.my_address,
            to:"Vr:native:cc57286592f4029e666e4f0b589fda1d8d295248510698e45f16b4aadef7592b",
            amount:"100",
            secret:this.$store.state.secret,
            balance:0
        }
    },
    created:async function(){
        this.balance = await get_balance(this.from)
    },
    methods:{
        remit:async function(){
            try{
                await send_request_tx(this.to,this.amount,socket);
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
}).$mount('#app')