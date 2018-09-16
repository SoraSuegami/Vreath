import {tx_accept,block_accept,get_balance,send_request_tx,send_refresh_tx,trie_ins,check_chain,send_key_block,send_micro_block,random_chose,unit_buying} from './index'
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
import faye from 'faye'
import { setInterval } from 'timers';
import * as TxSet from '../../core/tx'
import * as BlockSet from '../../core/block'
import * as StateSet from '../../core/state'

type Data = {
    type:'tx'|'block';
    tx:T.Tx[];
    block:T.Block[];
}

type Installed = {
    name:string;
    icon:string;
    pub_keys:string[][];
    deposited:number;
}


const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_ip || "localhost";
console.log(ip)

/*const socket = new IO();
socket.connect('http://'+ip+':'+port);*/

export const client = new faye.Client('http://'+ip+':'+port+'/vreath');

localStorage.removeItem("data");
localStorage.removeItem("apps");
localStorage.removeItem("code");
localStorage.removeItem("pool");
localStorage.removeItem("chain");
localStorage.removeItem("roots");
localStorage.removeItem("candidates");
localStorage.removeItem("unit_store");
localStorage.removeItem("yet_data");


const send_blocks = async ()=>{
    const S_Trie = trie_ins(store.state.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.state.secret));
    const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0);
    const unit_amount = unit_state.amount || 0;
    const last_key = BlockSet.search_key_block(store.state.chain.slice());
    const last_micros = BlockSet.search_micro_block(store.state.chain.slice(),last_key);
    const date = new Date();

    if(!store.state.replace_mode&&_.reduce_pub(last_key.meta.validatorPub)===CryptoSet.PublicFromPrivate(store.state.secret)&&last_micros.length<=max_blocks) await send_micro_block(_.copy(store.state.pool),store.state.secret,store.state.chain.slice(),store.state.candidates.slice(),_.copy(store.state.roots),store.state.unit_store);
    else if(!store.state.replace_mode&&unit_state!=null&&unit_amount>0&&date.getTime()-last_key.meta.timestamp>block_time*max_blocks) await send_key_block(store.state.chain.slice(),store.state.secret,store.state.candidates.slice(),_.copy(store.state.roots));
}

const compute_yet = async ()=>{
    const data:Data = store.state.yet_data[0];
    if(data==null){
        await send_blocks();
        return 0;
    }
    else if(data.type==="tx"&&data.tx.length>0){
        const target:T.Tx = store.state.yet_data[0].tx[0];
        //if(target.meta.kind==="request"||target.meta.data.index<store.state.chain.length){
        await tx_accept(_.copy(target),store.state.chain.slice(),_.copy(store.state.roots),_.copy(store.state.pool),store.state.secret,store.state.candidates.slice(),_.copy(store.state.unit_store));
        const txs:Data[] = store.state.yet_data.filter((d:Data)=>d.type==="tx"&&d.tx[0]!=null&&d.tx[0].hash!=target.hash);
        const blocks:Data[] = store.state.yet_data.filter((d:Data)=>d.type==="block");
        const reduced = txs.concat(blocks);
        store.commit("refresh_yet_data",reduced);
        console.log(reduced);
        await send_blocks();
        return 1;
        /*}
        else{
            const txs:Data[] = store.state.yet_data.filter((d:Data)=>d.type==="tx"&&d.tx[0]!=null&&d.tx[0].hash!=target.hash);
            const blocks:Data[] = store.state.yet_data.filter((d:Data)=>d.type==="block");
            const reduced = txs.concat(blocks);
            const concated = reduced.concat(store.state.yet_data[0]);
            store.commit("refresh_yet_data",concated);
        }*/
    }
    else if(data.type==="block"&&data.block.length>0){
        const block = data.block[0];
        console.log(block);
        const chain:T.Block[] = store.state.chain;
        if(block.meta.version>=compatible_version){
            if(block.meta.index>chain.length){
                store.commit('checking',true);
                client.publish("/checkchain","");
            }
            else if(block.meta.index===chain.length){
                if(store.state.replace_mode&&block.meta.index>=store.state.replace_index) store.commit('replaceing',false);
                const pre_chain_index:number = store.state.chain.length;
                await block_accept(block,chain.slice(),store.state.candidates.slice(),_.copy(store.state.roots),_.copy(store.state.pool),_.copy(store.state.code),store.state.secret,_.copy(store.state.unit_store))
                const txs = store.state.yet_data.filter((d:Data)=>d.type==="tx");
                const blocks= store.state.yet_data.filter((d:Data)=>d.type==="block"&&d.block[0]!=null&&d.block[0].meta.index!=block.meta.index)/*.sort((a:Data,b:Data)=>{
                    return a.block[0].meta.index - b.block[0].meta.index;
                });*/
                const reduced = txs.concat(blocks);
                console.log(reduced);
                store.commit("refresh_yet_data",reduced);
                const balance = await get_balance(store.getters.my_address);
                store.commit("refresh_balance",balance);

                const new_chain_index:number = store.state.chain.length;
                if(new_chain_index===pre_chain_index+1){
                    const reqs_pure = block.txs.filter(tx=>tx.meta.kind==="request").concat(block.natives.filter(tx=>tx.meta.kind==="request")).concat(block.units.filter(tx=>tx.meta.kind==="request"));
                    const refs_pure = block.txs.filter(tx=>tx.meta.kind==="refresh").concat(block.natives.filter(tx=>tx.meta.kind==="refresh")).concat(block.units.filter(tx=>tx.meta.kind==="refresh"));

                    reqs_pure.forEach(pure=>{
                        const full_tx = TxSet.pure_to_tx(pure,block)
                        console.log(full_tx);
                        store.commit('add_not_refreshed',full_tx);
                    });
                    if(refs_pure.length>0){
                        console.log(refs_pure)
                        store.commit('del_not_refreshed',refs_pure.map(pure=>pure.meta.data.request));
                    }
                }


                if(store.state.not_refreshed_tx.length>0&&!store.state.replace_mode){
                    const req_tx:T.Tx = store.state.not_refreshed_tx[0];
                    const chain:T.Block[] = store.state.chain.slice();
                    const index = (()=>{
                        for(let block of chain.slice().reverse()){
                            const txs = block.txs.concat(block.natives).concat(block.units);
                            for(let tx of txs){
                                if(tx.hash===req_tx.hash) return block.meta.index;
                            }
                        }
                        return 0;
                    })();
                    const code:string = store.state.code[req_tx.meta.data.token]
                    await send_refresh_tx(_.copy(store.state.roots),store.state.secret,req_tx,index,code,store.state.chain.slice());
                    await send_blocks();
                }
                /*if(refs_pure.length>0){
                    await P.forEach(refs_pure, async (pure:T.TxPure)=>{
                        const req = pure.meta.data.request;
                        const buy_units:T.Unit[] = store.state.unit_store[req];
                        await unit_buying(store.state.secret,buy_units.slice(),_.copy(store.state.roots),store.state.chain.slice());
                    })
                }*/
                const bought_units = block.units.reduce((result:T.Unit[],u)=>{
                    if(u.meta.kind==="request") return result;
                    const ref_tx = TxSet.pure_to_tx(u,block);
                    const req_tx = TxSet.find_req_tx(ref_tx,chain);
                    const raw = req_tx.raw || TxSet.empty_tx().raw;
                    const this_units:T.Unit[] = JSON.parse(raw.raw[2]||"[]")||[];
                    return result.concat(this_units);
                },[]);
                if(bought_units.some(unit=>unit.request===store.state.now_buying)) store.commit('unit_buying',"");
                const new_unit_store = _.new_obj(
                    store.state.unit_store,
                    (store:{[key:string]:T.Unit[]})=>{
                        bought_units.forEach(unit=>{
                            const com = store[unit.request] || [];
                            const deleted = com.filter(c=>_.ObjectHash(c)!=_.ObjectHash(unit))
                            store[unit.request] = deleted;
                        });
                        return store;
                    }
                )
                store.commit("refresh_unit_store",new_unit_store);

                const unit_store_values:T.Unit[][] = Object.values(store.state.unit_store);
                const units_sum = unit_store_values.reduce((sum,us)=>sum+us.length,0);
                if(unit_store_values.length>0&&store.state.now_buying===""&&!store.state.replace_mode){
                    const reversed_chain:T.Block[] = store.state.chain.slice().reverse();
                    const refreshed = (()=>{
                        let result:T.Unit[] = [];
                        for(let block of reversed_chain){
                            for(let tx of block.txs.concat(block.natives).concat(block.units)){
                                if(tx.meta.kind==="refresh"){
                                    result = result.concat(unit_store_values.reduce((result,us)=>{
                                        if(us.length>0&&us[0].request===tx.meta.data.request) return result.concat(us);
                                        else return result;
                                    },[]));
                                }
                                if(result.length===units_sum) break;
                            }
                        }
                        return result;
                    })();
                    const validatorPub = BlockSet.search_key_block(reversed_chain.slice().reverse()).meta.validatorPub;
                    const validator_address = CryptoSet.GenereateAddress(native,_.reduce_pub(validatorPub));
                    const buy_units = random_chose(refreshed,10);
                    await unit_buying(store.state.secret,buy_units.slice(),_.copy(store.state.roots),store.state.chain.slice());
                    await send_blocks();
                }
                return 1;
            }
            else{
                const txs = store.state.yet_data.filter((d:Data)=>d.type==="tx");
                const blocks= store.state.yet_data.filter((d:Data)=>d.type==="block"&&d.block[0]!=null&&d.block[0].meta.index!=block.meta.index)/*.sort((a:Data,b:Data)=>{
                    return a.block[0].meta.index - b.block[0].meta.index;
                });*/
                const reduced = txs.concat(blocks);
                console.log(reduced);
                store.commit("refresh_yet_data",reduced);
            }
        }
    }
}

client.subscribe('/data',async (data:Data)=>{
    console.log('data!');
    store.commit('push_yet_data',data);
});

/*client.subscribe('/block',async (block:T.Block)=>{
    console.log('block_sub');
    console.log(store.state.yet_block);
    try{
        const chain:T.Block[] = store.state.chain;
        if(block.meta.version>=compatible_version){
            const last_yet:T.Block = store.state.yet_block[store.state.yet_block.length-1] || store.state.chain[store.state.chain.length-1];
            if(block.meta.index>last_yet.meta.index+1) client.publish("/checkchain","");
            else if(block.meta.index===last_yet.meta.index+1){
                store.commit('push_yet_block',block);
                const target:T.Block = store.state.yet_block[0];
                await block_accept(target,store.state.chain.slice(),store.state.candidates.slice(),_.copy(store.state.roots),_.copy(store.state.pool),_.copy(store.state.code),store.state.secret,_.copy(store.state.unit_store))
                const reduced= store.state.yet_block.filter((b:T.Block)=>b.hash!=target.hash).sort((a:T.Block,b:T.Block)=>{
                    return a.meta.index - b.meta.index;
                });
                console.log(reduced);
                store.commit("refresh_yet_block",reduced);
                const balance = await get_balance(store.getters.my_address);
                store.commit("refresh_balance",balance);
                if(store.state.yet_tx.length>0) client.publish('/tx',store.state.yet_tx[0]);
                if(reduced.length>0) client.publish('/block',reduced[0]);
            }
        }
    }
    catch(e){console.log(e);}
})*/

client.subscribe('/checkchain',(data:string)=>{
    console.log('checked')
    client.publish('/replacechain',store.state.chain.slice());
});

client.subscribe('/replacechain',async (chain:T.Block[])=>{
    try{
        console.log("replace:")
        console.log(chain);
        if(store.state.check_mode){
            await check_chain(chain.slice(),JSON.parse(localStorage.getItem("chain")||JSON.stringify([gen.block])),_.copy(store.state.pool),_.copy(store.state.code),store.state.secret,_.copy(store.state.unit_store));
            store.commit('checking',false);
            const S_Trie = trie_ins(store.state.roots.stateroot);
            const unit_state:T.State = await S_Trie.get(CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.state.secret)));
            console.log(await S_Trie.filter());
            if(chain.length===1&&unit_state!=null&&unit_state.amount>0) await send_key_block(JSON.parse(localStorage.getItem("chain")||JSON.stringify([gen.block])),store.state.secret,store.state.candidates.slice(),_.copy(store.state.roots));
        }
    }
    catch(e){throw new Error(e);}
});

Vue.use(Vuex)
Vue.use(VueRouter)
Vue.use(AtComponents)


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
        yet_data:JSON.parse(localStorage.getItem("yet_data")||"[]"),
        check_mode:false,
        replace_mode:false,
        replace_index:0,
        not_refreshed_tx:[],
        now_buying:""
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
            }).filter((b:T.Block,i:number)=>b.meta.index===i);
            localStorage.setItem("chain",JSON.stringify(state.chain.slice()));
        },
        replace_chain(state,chain:T.Block[]){
            state.chain = chain.slice().sort((a:T.Block,b:T.Block)=>{
                return a.meta.index - b.meta.index;
            }).filter((b:T.Block,i:number)=>b.meta.index===i);
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
        push_yet_data(state,data:Data){
            state.yet_data.push(data);
            localStorage.setItem('yet_data',state.yet_data);
        },
        unshift_yet_data(state,data:Data){
            state.yet_data.unshift(data);
            localStorage.setItem('yet_data',state.yet_data);
        },
        refresh_yet_data(state,data:Data[]){
            state.yet_data = data.slice();
            localStorage.setItem('yet_data',state.yet_data);
        },
        checking(state,bool:boolean){
            state.check_mode = bool;
        },
        replaceing(state,bool:boolean){
            state.replace_mode = bool;
        },
        rep_limit(state,index:number){
            state.replace_index = index;
        },
        add_not_refreshed(state,tx:T.Tx){
            state.not_refreshed_tx = state.not_refreshed_tx.concat(tx);
        },
        del_not_refreshed(state,hashes:string[]){
            state.not_refreshed_tx = state.not_refreshed_tx.filter((tx:T.Tx)=>hashes.indexOf(tx.hash)===-1);
        },
        buying_unit(state,hash:string){
            state.now_buying = hash;
        }
    },
    getters:{
        my_address:(state) => CryptoSet.GenereateAddress(native,CryptoSet.PublicFromPrivate(state.secret)) || ""
    },
    actions:{
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
                if(!store.state.check_mode){
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
        const gen_S_Trie = trie_ins("");
        await P.forEach(gen.state,async (s:T.State)=>{
            await gen_S_Trie.put(s.owner,s);
        });
        store.commit('checking',true);
        client.publish("/checkchain","");
        const balance = await get_balance(this.from);
        console.log(balance);
        this.$store.commit("refresh_balance",balance);
        client.bind('transport:down', ()=>{
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
        setInterval(async ()=>{
            await compute_yet();
            console.log('yet:')
            console.log(store.state.yet_data.filter(data=>data.block.length>0));
        },block_time);
       /* setInterval(async ()=>{
            pre_length = new_length;
            new_length = this.$store.state.chain.length;
            const S_Trie = trie_ins(this.$store.state.roots.stateroot);
            const my_unit_state:T.State = await S_Trie.get(CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(this.$store.state.secret)));
            console.log(my_unit_state)
            //await P.forEach(store.state.yet_block,async (block:T.Block)=>await block_accept(block,store.state.chain.slice(),store.state.candidates.slice(),_.copy(store.state.roots),_.copy(store.state.pool),_.copy(store.state.code),store.state.secret,_.copy(store.state.unit_store)));
            console.log('yet_block:')
            console.log(this.$store.state.yet_block);
            //store.commit("refresh_yet_block",[]);
            //await P.forEach(store.state.yet_tx,async (tx:T.Tx)=>await tx_accept(tx,store.state.chain.slice(),_.copy(store.state.roots),_.copy(store.state.pool),store.state.secret,_.copy(store.state.unit_store)));
            //store.commit("refresh_yet_tx",[]);
            const now_units:{[key:string]:T.Unit[]} = this.$store.state.unit_store;
            const unit_array:T.Unit[] = Object.values(now_units).reduce((result,us)=>result.concat(us),[]).filter(u=>{
                for(let block of this.$store.state.chain.slice(u.index).reverse()){
                    for(let tx of block.txs.concat(block.natives).concat(block.units)){
                        if(tx.meta.kind==="refresh"&&tx.meta.data.request===u.request&&tx.meta.data.index===u.index) return true;
                    }
                }
                return false;
            });
            const buy_units:T.Unit[] = random_chose(unit_array,10);
            console.log("buy_units:");
            console.log(buy_units);
            console.log(["Vr:native:35bb582aaadec913443bf0370dd17c22fd53c7096538951bf58cd20dae460f75","Vr:native:cc57286592f4029e666e4f0b589fda1d8d295248510698e45f16b4aadef7592b"].indexOf(store.getters.my_address))
            if(buy_units.length>=1&&["Vr:native:35bb582aaadec913443bf0370dd17c22fd53c7096538951bf58cd20dae460f75","Vr:native:cc57286592f4029e666e4f0b589fda1d8d295248510698e45f16b4aadef7592b"].indexOf(store.getters.my_address)===-1){
                console.log("unit mode")
                await unit_buying(this.$store.state.secret,buy_units.slice(),_.copy(this.$store.state.roots),this.$store.state.chain.slice());
            }
            const last_key = BlockSet.search_key_block(this.$store.state.chain.slice());
            const last_micros = BlockSet.search_micro_block(this.$store.state.chain.slice(),last_key);
            const date = new Date();
            if(!this.$store.state.check_mode&&_.reduce_pub(last_key.meta.validatorPub)===CryptoSet.PublicFromPrivate(this.$store.state.secret)&&last_micros.length<=max_blocks) await send_micro_block(_.copy(this.$store.state.pool),this.$store.state.secret,this.$store.state.chain.slice(),this.$store.state.candidates.slice(),_.copy(this.$store.state.roots),this.$store.state.unit_store);
            else if(!this.$store.state.check_mode&&my_unit_state!=null&&my_unit_state.amount>0&&date.getTime()-last_key.meta.timestamp>block_time*max_blocks) await send_key_block(this.$store.state.chain.slice(),this.$store.state.secret,this.$store.state.candidates.slice(),_.copy(this.$store.state.roots));
        },block_time);*/
    },
    watch:{
        refresh_balance:async function(){
            const balance = await get_balance(this.from);
            console.log(balance);
            this.$store.commit("refresh_balance",balance);
        }
    },
    computed:{
        from:function():string{
            return this.$store.getters.my_address
        },
        balance:function():number{
            const balance = this.$store.state.balance || 0;
            return balance.toFixed(18);
        },
        secret:function():string{
            return this.$store.state.secret;
        }
    },
    methods:{
        remit:async function(){
            try{
                console.log("request");
                await send_request_tx(this.$store.state.secret,"issue",native,[this.from,this.to],["remit",JSON.stringify([this.amount])],[],_.copy(this.$store.state.roots),this.$store.state.chain.slice());
                alert('remit!');
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


