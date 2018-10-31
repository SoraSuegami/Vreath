import * as T from '../../core/types'
import * as CryptoSet from '../../core/crypto_set'
import * as  _ from '../../core/basic'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate,compatible_version} from '../con'
import {peer_list} from './peer_list'
import Vue from 'vue'
import Vuex from 'vuex'
import AtComponents from 'at-ui'
import VueRouter from 'vue-router'
import * as gen from '../../genesis/index';
import vm from 'js-vm';
import * as P from 'p-iteration'
import faye from 'faye'
import { setInterval } from 'timers';
import * as TxSet from '../../core/tx'
import * as BlockSet from '../../core/block'
import * as StateSet from '../../core/state'
import BigNumber from 'bignumber.js';
import {Chart} from 'chart.js'
import {Bar, mixins} from 'vue-chartjs'
import {get,put} from './db'
import { read } from 'fs';

const worker = new Worker('bg-bundle.js');

export type Data = {
    type:'tx'|'block';
    tx:T.Tx[];
    block:T.Block[];
}

export type Installed = {
    name:string;
    icon:string;
    pub_keys:string[][];
    deposited:number;
};

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

const best_lang:Installed = {
    name:"best-lang",
    icon:"./img/best_lang_icon.jpg",
    pub_keys:[],
    deposited:0
}

const def_apps:{[key:string]:Installed} = {
    wallet:wallet,
    setting:setting,
    best_lang:best_lang
}

const codes = {
    "native":"const main = () => {};",//"function main(){const state = vreath.states[0];const type = input[0];const other = input[1];const amount = Number(input[2]);switch (type) {case 'remit':if (tx.meta.data.type != 'scrap' || state.owner != tx.meta.data.address || amount >= 0 || state.amount < amount) {console.log('error'); return 0;} const remited = vreath.create_state(state.nonce + 1, state.owner, state.token, state.amount + amount, state.data, state.product);console.log(remited);vreath.change_states([state], [remited]);}}",
    "unit":"const main = () => {};"
}

const storeName = 'vreath';
let db;

/*export const read_db = <T>(key:string,def:T)=>{
    const req = indexedDB.open('vreath',2);
    let result = def;
    req.onerror = ()=>console.log('fail to open db');
    req.onupgradeneeded = (event)=>{
        db = req.result;
        db.createObjectStore(storeName,{keyPath:'id'});
    }
    req.onsuccess = (event)=>{
        db = req.result;
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const get_req = store.get(key);
        get_req.onsuccess = ()=>{
            result = get_req.source.val
        }
        db.close();
    }
    return result;
}

export const write_db = <T>(key:string,val:T)=>{
    const req = indexedDB.open('vreath',2);
    req.onerror = ()=>console.log('fail to open db');
    req.onupgradeneeded = (event)=>{
        db = req.result;
        db.createObjectStore(storeName,{keyPath:'id'});
    }
    req.onsuccess = (event)=>{
        db = req.result;
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const data = {
            id:key,
            val:val
        };
        const put_req = store.put(data);
    }
}

export const delete_db = ()=>{
    const del_db = indexedDB.deleteDatabase('vreath');
    del_db.onsuccess = ()=>console.log('db delete success');
    del_db.onerror = ()=>console.log('db delete error');
}*/


const commit = <T>(key:string,val:T)=>{
    worker.postMessage({
        type:'commit',
        key:key,
        val:val
    });
}

Vue.use(Vuex)
Vue.use(VueRouter)
Vue.use(AtComponents)

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


const store = new Vuex.Store({
    state:{
        apps:def_apps,
        registed:false,
        secret:CryptoSet.GenerateKeys(),
        balance:0,
        replace_mode:false
    },
    getters:{
        my_address:(state) => CryptoSet.GenereateAddress(native,CryptoSet.PublicFromPrivate(state.secret)) || ""
    },
    mutations:{
        add_app(state,obj:Installed){
            state.apps[obj.name] = _.copy(obj);
            write_db('app',state.apps);
        },
        del_app(state,key:string){
            delete state.apps[key];
            write_db('app',state.apps);
        },
        refresh_secret(state,secret:string){
            state.secret = secret;
            commit('refresh_secret',secret);
        },
        regist(state){
            state.registed = true;
        },
        refresh_balance(state,amount:number){
            state.balance = amount;
        },
        replaceing(state,bool:boolean){
            state.replace_mode = bool;
        }
    },
    actions:{
        async read({state,commit}){
            const secret:string = await get('secret',state.secret);
            const balance = await get('balance',0);
            commit('refresh_secret',secret);
            commit('refresh_balance',balance);
        },
        async write({state}){
            await put('secret',state.secret);
            await put('balance',state.balance);
        }
    }
});


(async ()=>{
    await store.dispatch('read');
})()

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

const Registration = {
    computed:{
        secret:function(){
            return this.$store.state.secret;
        },
        registed:function(){
            return this.$store.state.registed;
        }
    },
    store,
    methods:{
        regist:function(){
            try{
                store.commit('refresh_secret',this.secret);
                store.commit('regist');
                store.dispatch('read');
                router.push({ path: '/' });
            }
            catch(e){
                console.log(e);
            }
        }
    },
    template:`
    <div>
        <h1 id="front_title">Welcome to Vreath</h1><br>
        <at-input placeholder="secret" type="password" v-model="secret"></at-input><br>
        <a href="/#" id="square_btn"><at-button v-on:click="regist" type="default">Start</at-button></a>
    </div>
    `
}

const Wallet = {
    data:function(){
        return{
            to:"",
            amount:""
        }
    },
    store,
    computed:{
        from:function():string{
            return this.$store.getters.my_address;
        },
        balance:function():number{
            return new BigNumber(this.$store.state.balance).toNumber();
        },
        secret:function():string{
            return this.$store.state.secret;
        },
        replace_mode:function():boolean{
            return this.$store.state.replace_mode;
        }
    },
    created:function(){
        worker.postMessage({
            type:'get_balance',
            address:store.getters.my_address
        })
        worker.addEventListener('message',(event)=>{
            const key:string = event.data.key;
            const val:any = event.data.val;
            if(key!=null) store.commit(key,val);
            store.dispatch('read');
        });
    },
    methods:{
        remit:async function(){
            try{
                console.log("request");
                /*const roots = read_db('roots',gen.roots);
                const chain = read_db('chain',[gen.block]);
                await send_request_tx(this.secret,"issue",native,[this.from,this.to],["remit",JSON.stringify([this.amount])],[],_.copy(roots),_.copy(chain));*/
                worker.postMessage({
                    type:'send_request',
                    tx_type:"issue",
                    token:native,
                    base:[this.from,this.to],
                    input_raw:["remit",JSON.stringify([this.amount])],
                    log:[]
                })
                alert('remit!');
            }
            catch(e){console.log(e)}
        },
        rebuild:async function(){
            try{
                worker.postMessage({
                    type:'rebuild'
                });
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
        <h3 v-if="replace_mode">Syncing...</h3>
        <at-button v-on:click="rebuild">Sync Quickly</at-button>
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
                return CryptoSet.PublicFromPrivate(this.secret);
            }
            catch(e){return ""}
        },
        address:function():string{
            if(this.pub_key==="") return "";
            try{
                return CryptoSet.GenereateAddress(native,this.pub_key)
            }
            catch(e){return ""}
        }
    },
    methods:{
        save:function(){
            store.commit('refresh_secret',this.secret);
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
            return this.$store.state.apps
        }
    },
    methods:{
        uninstall:function(key:string){
            store.commit('del_app',key);
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

const Bar_Chart = {
    name:'Bar_Chart',
    extends: Bar,
    mixins: [mixins.reactiveProp],
    props: ['chartData','options'],
    mounted(){
        this.renderChart(this.chartData,this.options)
    },
    watch:{
        data:function(val){
            this.renderChart(this.chartData,this.options)
        },
        options:function(val){
            this.renderChart(this.chartData,this.options)
        }
    }
};
Vue.component('Bar_Chart',Bar_Chart);


const Best_lang = {
    component:{
        Bar_Chart
    },
    store,
    data:function(){
        return{
            langs:[
                {
                    name:'assembler',
                    pub_key:'03aa38de946e77a2e3d05b8a54233832d6eeef7c14a81547e51595006663c9c00d',
                    address:'Vr:native:f6b717219a0a3af7647f2b2f5a3d9b6aa35db636a6151ec222f1b436aec259cc'
                },
                {
                    name:'C (C++)',
                    pub_key:'0228bedacb6119552db1d1030185d5168ebee3a4d6b95491a49364acbe06643828',
                    address:'Vr:native:2d6226fc297fd848009a323109d13adda069a348b4498caa2f34d52a71244393'
                },
                {
                    name:'Lisp',
                    pub_key:'033f73f651a79354799c916619a8dac9277b447733acadbb597488720c7fbf122c',
                    address:'Vr:native:5ce2b23cf74c0dfc332e5b02f54a1ce7d8aa9357eff4506545edbaa8267281be'
                },
                {
                    name:'Java',
                    pub_key:'03ec193dc65db101a2f639135c3b043de5f979421a8911378fb405bddf0e132dd3',
                    address:'Vr:native:a6b7f01f9d344d26c141ea34b54e7ed1daf7b260737e5c6f5188fcb0807e7e97'
                },
                {
                    name:'Python',
                    pub_key:'027a8944b06fa1f10a6c35c01459a54e42cb2cd6cb6253bfd8e3d2e67866d621eb',
                    address:'Vr:native:fd490acc1a034c7756d513b9d3ef8cb2029a6860516931fa181aa1632e15e26e'
                },
                {
                    name:'Ruby',
                    pub_key:'02b66c22c749eac27da3a5f6861fed4d89383fa630e4eac11b2cadcac24a0309ff',
                    address:'Vr:native:94eabdd12d27139d0680dc548374d499cbc62009c9bd50e0bbacaeba613f73c4'
                },
                {
                    name:'PHP',
                    pub_key:'02414c2fb9602db603d055e7331b0ce1a2934f63c153c6b5819222c8c775979406',
                    address:'Vr:native:2abab3d305c2ee83200b96ac2c2ad31afcbb0d69d5dbec7587642c38f1baa73c'
                },
                {
                    name:'Javascript',
                    pub_key:'03a14288fb828a3ea2afcc569d37484dff4feff86d5ed3a7ceece259b8b73c526e',
                    address:'Vr:native:de3bbcf59ba41457ebce6a8d91d700be57d50343c86840fc80c010d20421ddbf'
                },
                {
                    name:'Swift',
                    pub_key:'0281ea491d77d42afafe971d8d7e5728472b8b69f39044c8d577f8360915852da9',
                    address:'Vr:native:c93e2f4ac4a4d4e4fd8b9dcf4eb8e61d1dd974b03ed0f6553f750b540c45799a'
                },
                {
                    name:'Go',
                    pub_key:'03f97b8992697b80d520d6400b032b0edc4795509d018b508d4a4d4c53f168ff61',
                    address:'Vr:native:fd6b6cfc8be436a2db999ae24a107a54542af251093fd120ff7f56c1723070f8'
                },
                {
                    name:'Rust',
                    pub_key:'02c48de4ec759e9d32c58ffa06ecaa646ef54ff40d1c3ee9567d744d1fc0a133d2',
                    address:'Vr:native:da9dd3e850459ed450f6ff942c879f60d721a6eacaff050b985cfefafaf4ba81'
                },
                {
                    name:'Haskell',
                    pub_key:'0308536b7cb90d58a40a6ae76950c7416268ad34eb3a28cfa33b64e8fafa5c8b97',
                    address:'Vr:native:7435451c51790ef2bfaa4d1b9b7742eee8feba5a0b9bca8bb6bfc674fe4af562'
                },
                {
                    name:'Elixir',
                    pub_key:'0265e0f265855277b985294d3265bb5ca9d73e2ae308adeae09d0e6e476ce2b355',
                    address:'Vr:native:ce3cdd38ed1817f54b4f6865510ba1d35b322ed7cc9bb1479480fc9788fad4bb'
                },
                {
                    name:'Solidity',
                    pub_key:'03cd869c99371faae8cd3185b61f196683e1595d42139502a5af9282481de2e67a',
                    address:'Vr:native:7ed085230d7f4de84ecc7452ed4643f8aeac5ca3a6f0ed1dc1f02546f0a99a2d'
                }
            ],
            balances:[0,0,0,0,0,0,0,0,0,0,0,0,0,0]
        }
    },
    computed:{
        bar_data:function(){
            const names:string[] = this.langs.map(lang=>lang.name);
            const balances:number[] = this.balances;
            return {
                labels:names,
                datasets:[{
                    label:'vote',
                    data:balances,
                    backgroundColor: '#f87979',
                }]
            }
        },
        bar_options:function(){
            return {
                title:{
                    display:true,
                    text:'best-lang'
                }
            }
        }
    },
    /*computed:{
        graph:function(){
            const ctx:HTMLElement = document.getElementById("Chart");
            console.error(ctx);
            const names:string[] = this.langs.map(lang=>lang.name);
            const balances:number[] = this.balances;
            return new Chart(ctx,{
                type:'bar',
                data:{
                    labels:names,
                    datasets:[{
                        label:'lang',
                        data:balances
                    }]
                }
            });
        }
    },*/
    methods:{
        vote:async function(address:string){
            /*const roots = read_db('roots',gen.roots);
            const chain = read_db('chain',[gen.block]);
            await send_request_tx(this.$store.state.secret,'issue',native,[this.$store.getters.my_address,address],["remit",JSON.stringify([0.01])],[],_.copy(roots),_.copy(chain))*/
            worker.postMessage({
                type:'send_request',
                tx_type:"issue",
                token:native,
                base:[this.$store.getters.my_address,address],
                input_raw:["remit",JSON.stringify([0.01])],
                log:[]
            });
            alert('vote!');
        }
    },
    created:async function(){
        setInterval(()=>{
            this.langs.forEach((lang:{name:string,pub_key:string,address:string})=>{
                worker.postMessage({
                    type:'get_balance',
                    address:lang.address
                });
            });
        },block_time);
        worker.addEventListener('message',(event)=>{
            const index = this.langs.map((lang:{name:string,pub_key:string,address:string})=>lang.address).indexOf(event.data.address);
            if(index!=-1){
                this.balances = _.new_obj(
                    this.balances,
                    (bs:number[])=>{
                        bs[index] = new BigNumber(event.data.amount).times(100).toNumber() || 0;
                        return bs;
                    }
                );
            }
        });
    },
    template:`
    <div>
        <h2>Best-Lang!</h2>
        <Bar_Chart :width="900" :height="300" :chartData="bar_data" :options="bar_options"></Bar_Chart>
        <h3>You need 0.01 VRH/vote</h3>
        <ul id="best_langs_ul" style="list-style: none;">
            <li v-for="(lang,i) in langs">
            <h4>{{lang.name}}</h4>
            <at-button v-on:click="vote(lang.address)">vote</at-button>
            </li>
        </ul>
    </div>
    `
}


let routes = [
    { path: '/', component:Home},
    { path:'/regist', component:Registration},
    { path: '/wallet', component:Wallet},
    { path: '/best-lang', component:Best_lang},
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

if(store.state.registed===false) router.push({ path: '/regist' });

const app = new Vue({
    router: router
}).$mount('#app');

worker.postMessage({
    type:'start'
});

