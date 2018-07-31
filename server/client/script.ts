import io from 'socket.io-client'
import level from 'level-browserify'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate} from '../con'
import * as _ from '../../core/basic'
import * as T from '../../core/types'
import * as CryptoSet from '../../core/crypto_set'
import {Trie} from '../../core/merkle_patricia'
import {Tx_to_Pool} from '../../core/tx_pool'
import * as BlockSet from '../../core/block'
import Vue from 'vue'
import AtComponents from 'at-ui'
import VueRouter from 'vue-router'
//import 'at-ui-style'

let db = level('./trie');

type Roots = {
    stateroot:string;
    locationroot:string;
};
const empty_root:Roots = {
    stateroot:_.toHash(''),
    locationroot:_.toHash('')
}
const getted = {
    roots:localStorage.getItem('root')||JSON.stringify(empty_root),
    pool:localStorage.getItem("tx_pool")||"{}",
    chain:localStorage.getItem("blockchain")||"[]",
    candidates:localStorage.getItem("candidates")||"[]"
}

let roots:Roots = JSON.parse(getted.roots);
let StateData:Trie;
if(roots.stateroot!=_.toHash('')) StateData = new Trie(db,roots.stateroot);
else StateData = new Trie(db);
let LocationData:Trie;
if(roots.locationroot!=_.toHash('')) LocationData = new Trie(db,roots.locationroot);
else LocationData = new Trie(db);
let pool:T.Pool = JSON.parse(getted.pool);
let chain:T.Block[] = JSON.parse(getted.chain);
let candidates:T.Candidates[] = JSON.parse(getted.candidates);

const my_shard_id = 0;

const port = "57750";
const ip = "localhost";
/*const option = {
    'force new connection':true,
    port:port
};*/

const socket = io.connect("http://"+ip+":"+port);
socket.on('tx',async (msg:string)=>{
    const tx:T.Tx = JSON.parse(msg);
    const new_pool = await Tx_to_Pool(pool,tx,my_version,native,unit,chain,token_name_maxsize,StateData,LocationData);
    pool = new_pool;
});

socket.on('block',async (msg:string)=>{
    const block:T.Block = JSON.parse(msg);
    let code:string = "";
    let pre_StateData:Trie = StateData;
    const fraud = block.meta.fraud
    if(fraud.flag===true){
        const target_tx = chain[fraud.index].txs.filter(tx=>tx.hash===fraud.hash)[0];
        code = localStorage.getItem("contract_modules/"+target_tx.meta.data.token) || "";
        pre_StateData = new Trie(db,chain[fraud.index].meta.stateroot);
    }
    const checked = await BlockSet.AcceptBlock(block,chain,my_shard_id,my_version,block_time,max_blocks,block_size,candidates,roots.stateroot,roots.locationroot,code,gas_limit,native,unit,rate,token_name_maxsize,StateData,pre_StateData,LocationData);
    StateData = checked.state;
    LocationData = checked.location;
    candidates = checked.candidates;
    chain = checked.chain;
});

type Installed = {
    name:string;
    icon:string;
    states:string[];
    pub_keys:string[][];
    deposited:number;
}
const setting:Installed = {
    name:"setting",
    icon:"./setting_icon.png",
    states:[],
    pub_keys:[],
    deposited:0
}
localStorage.setItem("installed_tokens",JSON.stringify([setting]));
let installed_tokens:Installed[] = JSON.parse(localStorage.getItem("installed_tokens")||"[setting]");

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
            secret:""
        }
    },
    computed:{
        address:function():string{
            try{
                return CryptoSet.GenereateAddress(native,CryptoSet.PublicFromPrivate(this.secret))
            }
            catch(e){return ""}
        }
    },
    template:`
    <div>
        <h2>Account</h2>
        <at-input v-model="secret" placeholder="secret" type="passowrd" size="large" status="info"></at-input><br>
        <p>address:{{address}}</p>
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
