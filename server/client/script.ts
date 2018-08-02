import io from 'socket.io-client'
import level from 'level-browserify'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate} from '../con'
import * as _ from '../../core/basic'
import * as T from '../../core/types'
import * as CryptoSet from '../../core/crypto_set'
import {Trie} from '../../core/merkle_patricia'
import {Tx_to_Pool} from '../../core/tx_pool'
import * as TxSet from '../../core/tx'
import * as BlockSet from '../../core/block'
import {RunVM} from '../../core/code'
import * as Genesis from '../../genesis/index'
import Vue from 'vue'
import AtComponents from 'at-ui'
import VueRouter from 'vue-router'
import {map,forEach} from 'p-iteration'
//import 'at-ui-style'

(async ()=>{
let db = level('./trie');


type Roots = {
    stateroot:string;
    locationroot:string;
};
const empty_root:Roots = {
    stateroot:_.toHash(''),
    locationroot:_.toHash('')
}

localStorage.setItem("candidates",JSON.stringify([{"address":["Vr:native:bb8461713e14cc28126de8d0d42139a7984e8ceea0d560a4e0caa6d1a6fe66bb"],"amount":100000000000000}]));
localStorage.setItem("codes",JSON.stringify({"native":"'use strict';const main = () => {const this_step = step;if (this_step != 0)vreath.end();const state = vreath.states[0];const type = input[0];const other = input[1];const amount = Number(input[2]);switch (type) {case 'remit':if (tx.meta.data.kind != 'scrap' || state.contents.owner != tx.meta.data.address || amount >= 0)vreath.end();const remited = vreath.create_state(state.contents.nonce + 1, state.contents.owner, state.contents.token, state.contents.amount + amount, state.contents.data, state.contents.product);vreath.change_states([state], [remited]);vreath.end();}};"}))

const getted = {
    roots:localStorage.getItem('root')||JSON.stringify(empty_root),
    pool:localStorage.getItem("tx_pool")||"{}",
    chain:localStorage.getItem("blockchain")||"[]",
    candidates:localStorage.getItem("candidates")||JSON.stringify([{"address":["Vr:native:bb8461713e14cc28126de8d0d42139a7984e8ceea0d560a4e0caa6d1a6fe66bb"],"amount":100000000000000}]),
    codes:localStorage.getItem("codes")||JSON.stringify({"native":"'use strict';const main = () => {const this_step = step;if (this_step != 0)vreath.end();const state = vreath.states[0];const type = input[0];const other = input[1];const amount = Number(input[2]);switch (type) {case 'remit':if (tx.meta.data.kind != 'scrap' || state.contents.owner != tx.meta.data.address || amount >= 0)vreath.end();const remited = vreath.create_state(state.contents.nonce + 1, state.contents.owner, state.contents.token, state.contents.amount + amount, state.contents.data, state.contents.product);vreath.change_states([state], [remited]);vreath.end();}};"})
}


localStorage.setItem("genesis_state",JSON.stringify(Genesis.state));

let roots:Roots = JSON.parse(getted.roots);
let StateData:Trie;
if(roots.stateroot!=_.toHash('')) StateData = new Trie(db,roots.stateroot);
else{
    StateData = new Trie(db);
    await StateData.put(JSON.stringify(Genesis.state[0].contents.owner),Genesis.state[0]);
    await StateData.put(JSON.stringify(Genesis.state[1].contents.owner),Genesis.state[1]);
    await StateData.put(Genesis.state[2].token,Genesis.state[2]);
    await StateData.put(Genesis.state[3].token,Genesis.state[3]);
    roots.stateroot = StateData.now_root();
}

let LocationData:Trie;
if(roots.locationroot!=_.toHash('')) LocationData = new Trie(db,roots.locationroot);
else{
    LocationData = new Trie(db);
    roots.locationroot = LocationData.now_root();
}
let pool:T.Pool = JSON.parse(getted.pool);
let chain:T.Block[] = JSON.parse(getted.chain);
let candidates:T.Candidates[] = JSON.parse(getted.candidates);
let codes = JSON.parse(getted.codes);

const my_shard_id = 0;

const port = "57750";
const ip = "localhost";
/*const option = {
    'force new connection':true,
    port:port
};*/
const pow_target = 100000000000000000000000000000000;
const pos_diff = 10000000
let processing:string[] = [];

const block_accepting = async (msg:string)=>{
    const block:T.Block = JSON.parse(msg);
    let code:string = "";
    let pre_StateData:Trie = StateData;
    const fraud = block.meta.fraud
    if(fraud.flag===true){
        const target_tx = chain[fraud.index].txs.filter(tx=>tx.hash===fraud.hash)[0];
        code = localStorage.getItem("contract_modules/"+target_tx.meta.data.token) || "";
        pre_StateData = new Trie(db,chain[fraud.index].meta.stateroot);
    }
    const accepted = await BlockSet.AcceptBlock(block,chain,my_shard_id,my_version,block_time,max_blocks,block_size,candidates,roots.stateroot,roots.locationroot,code,gas_limit,native,unit,rate,token_name_maxsize,StateData,pre_StateData,LocationData);
    if(accepted.chain.length===0){console.log("receive invalid block"); return 0;}
    block.txs.forEach(tx=>delete pool[tx.hash]);
    StateData = accepted.state;
    LocationData = accepted.location;
    candidates = accepted.candidates;
    chain = chain.concat(accepted.chain);
    const reqs_pure = block.txs.filter(tx=>tx.meta.kind==="request").concat(block.natives.filter(tx=>tx.meta.kind==="request")).concat(block.units.filter(tx=>tx.meta.kind==="request"));
    if(reqs_pure.length>0){
        const reqs_raw = reqs_pure.map((req,i)=>block.raws[i]);
        const reqs = reqs_pure.map((pure,i):T.Tx=>{
            return{
                hash:pure.hash,
                meta:pure.meta,
                raw:reqs_raw[i]
            }
        });
        await forEach(reqs,async (req:T.Tx)=>{
            const my_private = localStorage.getItem('my_secret') || "";
            const my_public = localStorage.getItem('my_pub') || "";
            const my_address = localStorage.getItem('my_address') || "";
            const code = codes[req.meta.data.token];
            const base_states:T.State[] = await map(req.meta.data.base,async (base:string)=>{return await StateData.get(base)});
            const runed = await RunVM(0,code,base_states,0,req.raw.raw,req,[],gas_limit);
            const output = runed.states.map(s=>JSON.stringify(s));
            const created = TxSet.CreateRefreshTx(my_version,10,[my_public],pow_target,10,req.hash,block.meta.index,JSON.stringify([my_address]),output,runed.traced,[],chain);
            const ref = TxSet.SignTx(created,my_private,my_address);
            console.log(ref);
            if(!await TxSet.ValidRefreshTx(ref,chain,my_version,native,unit,token_name_maxsize,StateData,LocationData)){console.log("fail to create valid refresh tx"); return 0;}
            pool[ref.hash] = ref;
            socket.emit('tx',JSON.stringify(ref));
        })
    }
}

const socket = io.connect("http://"+ip+":"+port);
socket.on('tx',async (msg:string)=>{
    const tx:T.Tx = JSON.parse(msg);
    const new_pool = await Tx_to_Pool(pool,tx,my_version,native,unit,chain,token_name_maxsize,StateData,LocationData);
    pool = new_pool;
});

socket.on('block',async (msg:string)=>{
    processing.push(msg);
    if(processing.length===1){
        await block_accepting(msg);
        processing = processing.filter(p=>p!=msg);
    }
    else{
        setInterval(async ()=>{
            if(processing.length===1){
                clearInterval();
                await block_accepting(msg);
                processing = processing.filter(p=>p!=msg);
            }
        },5000);
    }
});

type Installed = {
    name:string;
    icon:string;
    pub_keys:string[][];
    deposited:number;
}
const wallet:Installed = {
    name:"wallet",
    icon:"./vreathrogoi.jpg",
    pub_keys:[],
    deposited:0
}
const setting:Installed = {
    name:"setting",
    icon:"./setting_icon.png",
    pub_keys:[],
    deposited:0
}

localStorage.setItem("installed_tokens",JSON.stringify([wallet,setting]));
let installed_tokens:Installed[] = JSON.parse(localStorage.getItem("installed_tokens")||"[wallet,setting]");

Vue.use(VueRouter)
Vue.use(AtComponents)

const Home = {
    data:function(){
        return{
            installed:installed_tokens
        }
    },
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
    data:function(){
        return{
            from:localStorage.getItem("my_address"),
            to:"Vr:native:1181567ccfa945016eccca505107ec3b43f9541e158f87d8c9be0a678593995d",
            amount:"100",
            secret:"a611b2b5da5da90b280475743675dd36444fde49d3166d614f5d9d7e1763768a",
            balance:0
        }
    },
    created:async function(){
        try{
            const state:T.State = await StateData.get(JSON.stringify([this.from]));
            if(state!=null){
                this.balance = state.contents.amount;
            }
        }
        catch(e){
            console.log(e);
        }
    },
    methods:{
        remit:async function(){
            try{
                const pub_key:string[] = [localStorage.getItem("my_pub")]
                const from:string[] = [this.from];
                const to:string[] = this.to.split(',');
                const amount = this.amount;
                const pre_tx = TxSet.CreateRequestTx(pub_key,JSON.stringify(from),10,"scrap",native,[JSON.stringify(from)],["remit",JSON.stringify(to),"-"+amount],[],my_version,TxSet.empty_tx_pure().meta.pre,TxSet.empty_tx_pure().meta.next,10);
                const tx = TxSet.SignTx(pre_tx,this.secret,this.from);
                if(!await TxSet.ValidRequestTx(tx,my_version,native,unit,StateData,LocationData)) alert("invalid infomations");
                else{
                    alert("remit!")
                    socket.emit('tx', JSON.stringify(tx));
                    pool[tx.hash] = tx;
                }
            }
            catch(e){
                console.log(e);
            }
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
    data:function(){
        return{
            secret:CryptoSet.GenerateKeys()
        }
    },
    computed:{
        pub_key:function():string{
            try{
                console.log(this.secret);
                return CryptoSet.PublicFromPrivate(this.secret);
            }
            catch(e){return ""}
        },
        address:function():string{
            if(this.pub_key==="") return "";
            try{
                return CryptoSet.GenereateAddress(native,this.pub_key);
            }
            catch(e){return ""}
        }
    },
    methods:{
        save:function(){
            localStorage.setItem('my_secret',this.secret);
            localStorage.setItem('my_pub',this.pub_key);
            localStorage.setItem('my_address',this.address);
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
    data:function(){
        return{
            installed:installed_tokens
        }
    },
    methods:{
        uninstall:function(i:number){
            installed_tokens.splice(i,1)
        }
    },
    template:`
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
})()