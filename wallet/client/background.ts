import {tx_accept,block_accept,get_balance,send_request_tx,send_refresh_tx,trie_ins,check_chain,send_key_block,send_micro_block,random_chose,unit_buying} from './index'
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
import * as TxSet from '../../core/tx'
import * as BlockSet from '../../core/block'
import * as StateSet from '../../core/state'
import BigNumber from 'bignumber.js';
import { read } from 'fs';
import level from 'level-browserify'

/*if('serviceWorker' in navigator){
    navigator.serviceWorker.register("sw_bundle.js").then(reg=>{
      if(reg.installing) console.log('installing');
      else if(reg.waiting) console.log('waiting');
      else if(reg.active) console.log('active');
    }).catch(error=>console.log(error));
}*/
const testdb = level('./db');



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





const storeName = 'vreath';
let db;

/*const open_req = indexedDB.open(storeName,1);
open_req.onupgradeneeded = (event)=>{
    db = open_req.result;
    db.createObjectStore(storeName,{keyPath:'id'});
}
open_req.onsuccess = (event)=>{
    console.log('db open success');
    db = open_req.result;
    db.close();
}
open_req.onerror = ()=>console.log("fail to open db");*/


export const read_db = <T>(key:string,def:T)=>{
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
        put_req.onsuccess = ()=>console.log('write data success');
        tx.oncomplete = ()=>console.log('transaction complete');
    }
}

export const delete_db = ()=>{
    const del_db = indexedDB.deleteDatabase('vreath');
    del_db.onsuccess = ()=>console.log('db delete success');
    del_db.onerror = ()=>console.log('db delete error');
}



const test_secret = "f836d7c5aa3f9fcf663d56e803972a573465a988d6457f1111e29e43ed7a1041"

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




export class Store {
    private _code:{[key:string]:string} = read_db('code',codes);
    private _pool:{[key:string]:T.Tx} = read_db('pool',{});
    private _chain:T.Block[] = read_db('chain',[gen.block]);
    private _roots:{[key:string]:string} = read_db('roots',gen.roots);
    private _candidates:T.Candidates[] = read_db('candidates',gen.candidates);
    private _unit_store:{[key:string]:T.Unit[]} = read_db('unit_store',{});
    private _secret:string = read_db('secret',CryptoSet.GenerateKeys());
    private _balance:number = read_db('balance',0);
    private _yet_data:Data[] = [];
    private _check_mode:boolean = false;
    private _replace_mode:boolean = false;
    private _replace_index:number = 0;
    private _not_refreshed_tx:T.Tx[] = [];
    private _now_buying:boolean = false;
    private _now_refreshing:string[] = [];

    get code(){
        return this._code;
    }
    get pool(){
        return this._pool;
    }
    get chain(){
        return this._chain;
    }
    get roots(){
        return this._roots;
    }
    get candidates(){
        return this._candidates;
    }
    get unit_store(){
        return this._unit_store;
    }
    get secret(){
        return this._secret;
    }
    get balance(){
        return this._balance;
    }
    get yet_data(){
        return this._yet_data;
    }
    get check_mode(){
        return this._check_mode;
    }
    get replace_mode(){
        return this._replace_mode;
    }
    get replace_index(){
        return this._replace_index;
    }
    get not_refreshed_tx(){
        return this._not_refreshed_tx;
    }
    get now_buying(){
        return this._now_buying;
    }
    get now_refreshing(){
        return this._now_refreshing;
    }
    get my_address(){
        return CryptoSet.GenereateAddress(native,CryptoSet.PublicFromPrivate(this._secret)) || ""
    }

    refresh_pool(pool:T.Pool){
        this._pool = _.copy(pool);
        write_db('pool',_.copy(this.pool));
        /*self.postMessage({
            key:'refresh_pool',
            val:_.copy(pool)
        },location.protocol+'//'+location.host);*/
    }
    add_block(block:T.Block){
        this._chain.push(block);
        write_db('chain',_.copy(this._chain));
        /*self.postMessage({
            key:'add_block',
            val:_.copy(block)
        },location.protocol+'//'+location.host);*/
    }
    replace_chain(chain:T.Block[]){
        this._chain = _.copy(chain).slice().sort((a:T.Block,b:T.Block)=>{
            return a.meta.index - b.meta.index;
        }).filter((b:T.Block,i:number)=>b.meta.index===i);
        write_db('chain',_.copy(this._chain));
        /*self.postMessage({
            key:'replace_chain',
            val:_.copy(chain)
        },location.protocol+'//'+location.host);*/
    }
    refresh_roots(roots:{[key:string]:string}){
        this._roots = _.copy(roots);
        write_db('roots',_.copy(this._roots));
        /*self.postMessage({
            key:'refresh_roots',
            val:_.copy(roots)
        },location.protocol+'//'+location.host);*/
    }
    refresh_candidates(candidates:T.Candidates[]){
        this._candidates = _.copy(candidates);
        write_db('candidates',_.copy(this._candidates));
        /*self.postMessage({
            key:'refresh_candidates',
            val:_.copy(candidates)
        },location.protocol+'//'+location.host);*/
    }
    add_unit(unit:T.Unit){
        const units:T.Unit[] = _.copy(this._unit_store)[unit.request] || [];
        if(!units.some(u=>u.index===unit.index&&u.payee===unit.payee)){
            this._unit_store[unit.request] = _.copy(units).concat(unit);
            write_db('unit_store',_.copy(this._unit_store));
            /*self.postMessage({
                key:'add_unit',
                val:_.copy(unit)
            },location.protocol+'//'+location.host);*/
        }
    }
    delete_unit(unit:T.Unit){
        const units:T.Unit[] = _.copy(this._unit_store)[unit.request] || [];
        const deleted = units.filter(u=>u.index===unit.index&&u.payee!=unit.payee&&u.output===unit.output);
        this._unit_store[unit.request] = _.copy(deleted);
        if(deleted.length<=0) delete this._unit_store[unit.request];
        write_db('unit_store',_.copy(this._unit_store));
        /*self.postMessage({
            key:'delete_unit',
            val:_.copy(unit)
        },location.protocol+'//'+location.host);*/
    }
    refresh_unit_store(store:{[key:string]:T.Unit[]}){
        this._unit_store = _.copy(store);
        write_db('unit_store',_.copy(this._unit_store));
        /*self.postMessage({
            key:'refresh_unit_store',
            val:_.copy(store)
        },location.protocol+'//'+location.host);*/
    }
    refresh_secret(secret:string){
        this._secret = secret;
        write_db('secret',this._secret);
        /*self.postMessage({
            key:'refresh_secret',
            val:secret
        },location.protocol+'//'+location.host);*/
    }
    refresh_balance(amount:number){
        this._balance = amount;
        write_db('balance',this._balance);
        /*self.postMessage({
            key:'refresh_balance',
            val:amount
        },location.protocol+'//'+location.host);*/
    }
    push_yet_data(data:Data){
        this._yet_data.push(data);
        /*self.postMessage({
            key:'push_yet_data',
            val:data
        },location.protocol+'//'+location.host);*/
    }
    unshift_yet_data(data:Data){
        this._yet_data.unshift(data);
        /*self.postMessage({
            key:'unshift_yet_data',
            val:data
        },location.protocol+'//'+location.host);*/
    }
    refresh_yet_data(data:Data[]){
        this._yet_data = _.copy(data);
        /*self.postMessage({
            key:'refresh_yet_data',
            val:data
        },location.protocol+'//'+location.host);*/
    }
    checking(bool:boolean){
        this._check_mode = bool;
        if(bool===true){
            setTimeout(()=>{
                this._check_mode = false;
            },block_time*10);
        }
        /*self.postMessage({
            key:'checking',
            val:bool
        },location.protocol+'//'+location.host);*/
    }
    replaceing(bool:boolean){
        this._replace_mode = bool;
        /*self.postMessage({
            key:'replaceing',
            val:bool
        },location.protocol+'//'+location.host);*/
    }
    rep_limit(index:number){
        this._replace_index = index;
        /*self.postMessage({
            key:'rep_limit',
            val:index
        },location.protocol+'//'+location.host);*/
    }
    add_not_refreshed(tx:T.Tx){
        this._not_refreshed_tx = this._not_refreshed_tx.concat(_.copy(tx));
        /*self.postMessage({
            key:'add_not_refreshed',
            val:_.copy(tx)
        },location.protocol+'//'+location.host);*/
    }
    del_not_refreshed(hashes:string[]){
        this._not_refreshed_tx = this._not_refreshed_tx.filter((tx:T.Tx)=>hashes.indexOf(tx.hash)===-1);
        /*self.postMessage({
            key:'del_not_refreshed',
            val:_.copy(hashes)
        },location.protocol+'//'+location.host);*/
    }
    buying_unit(bool:boolean){
        this._now_buying =bool;
        /*self.postMessage({
            key:'buying_unit',
            val:bool
        },location.protocol+'//'+location.host);*/
    }
    new_refreshing(requests:string[]){
        this._now_refreshing = requests;
        /*self.postMessage({
            key:'new_refreshing',
            val:_.copy(requests)
        },location.protocol+'//'+location.host);*/
    }

}

export const store = new Store();


const sleep = (msec:number)=>{
    return new Promise(function(resolve) {
        setTimeout(function() {resolve()}, msec);
     });
}

const send_blocks = async ()=>{
    const S_Trie = trie_ins(store.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.secret));
    const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0);
    const unit_amount = unit_state.amount || 0;
    const last_key = BlockSet.search_key_block(_.copy(store.chain));
    const last_micros = BlockSet.search_micro_block(_.copy(store.chain),_.copy(last_key));
    const date = new Date();

    if(!store.replace_mode&&_.reduce_pub(last_key.meta.validatorPub)===CryptoSet.PublicFromPrivate(store.secret)&&last_micros.length<=max_blocks) await send_micro_block(_.copy(store.pool),store.secret,_.copy(store.chain),_.copy(store.candidates),_.copy(store.roots),store.unit_store);
    else if(!store.replace_mode&&unit_state!=null&&unit_amount>0&&date.getTime()-last_key.meta.timestamp>block_time*max_blocks) await send_key_block(_.copy(store.chain),store.secret,_.copy(store.candidates),_.copy(store.roots));
}

export const compute_yet = async ():Promise<void>=>{
    const data:Data = _.copy(store.yet_data[0]);
    if(data==null){
        store.replaceing(false);
        await send_blocks();
        console.log('yet:')
        console.log(store.yet_data);
        await sleep(block_time);
        return await compute_yet();
    }
    else if(data.type==="tx"&&data.tx.length>0){
        const target:T.Tx = _.copy(data.tx[0]);
        console.log(target);
        //if(target.meta.kind==="request"||target.meta.data.index<store.state.chain.length){
        await tx_accept(_.copy(target),_.copy(store.chain),_.copy(store.roots),_.copy(store.pool),store.secret,_.copy(store.candidates),_.copy(store.unit_store));
        const now_yets:Data[] = _.copy(store.yet_data);
        const reduced = now_yets.filter(d=>{
            if(d.type==="tx"&&d.tx[0]!=null) return d.tx[0].hash!=target.hash;
            else if(d.type==="block"&&d.block[0]!=null) return true;
            else return false;
        });
        store.refresh_yet_data(_.copy(reduced));
        console.log(reduced);
        console.log('yet:')
        console.log(store.yet_data);
        await sleep(block_time);
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
    else if(data.type==="block"&&data.block.length>0){
        const block = data.block[0];
        const chain:T.Block[] = _.copy(store.chain);
        console.log(block);
        if(block.meta.version>=compatible_version){
            if(block.meta.index>chain.length){
                if(!store.replace_mode){
                    const address = CryptoSet.GenereateAddress(native,_.reduce_pub(block.meta.validatorPub));
                    if(address!=store.my_address){
                        store.checking(true);
                        client.publish("/checkchain",address);
                    }
                }
                else store.replaceing(false);
                //await send_blocks();
                await sleep(block_time);
                return await compute_yet();
            }
            else if(block.meta.index===chain.length){
                if(store.replace_mode&&chain[chain.length-1].meta.index>=store.replace_index) store.replaceing(false);
                await block_accept(_.copy(block),_.copy(store.chain),_.copy(store.candidates),_.copy(store.roots),_.copy(store.pool),_.copy(store.not_refreshed_tx),store.now_buying,_.copy(store.unit_store))
                const new_chain:T.Block[] = _.copy(store.chain);
                console.log(store.replace_mode)
                console.log(chain.length)
                console.log(new_chain.length)
                if(store.replace_mode&&chain.length===new_chain.length) store.replaceing(false);
                if(new_chain.length===chain.length+1){
                    const refs = _.copy(block.txs.concat(block.natives).concat(block.units)).filter(tx=>tx.meta.kind==="refresh");
                    const now_yets:Data[] = _.copy(store.yet_data);
                    let units:T.Unit[] = [];
                    const reduced = now_yets.filter(d=>{
                        if(d.type==="tx"&&d.tx[0]!=null){
                            const t = _.copy(d.tx[0]);
                            return !refs.some(tx=>{
                                if(t.meta.kind==="refresh"&&t.meta.data.index===tx.meta.data.index&&t.meta.data.request===tx.meta.data.request){
                                    const unit:T.Unit = {
                                        request:t.meta.data.request,
                                        index:t.meta.data.index,
                                        nonce:t.meta.nonce,
                                        payee:t.meta.data.payee,
                                        output:t.meta.data.output,
                                        unit_price:t.meta.unit_price
                                    }
                                    units.push(_.copy(unit));
                                    return true;
                                }
                                //else if(t.meta.kind==="request"&&t.hash===tx.meta.data.request) return true;
                                else return false;
                            });
                        }
                        else if(d.type==="block"&&d.block[0]!=null) return d.block[0].meta.index>block.meta.index;
                        else return false;
                    });
                    store.refresh_yet_data(_.copy(reduced));
                    /*const pre_unit_store:{[key:string]:T.Unit[]} = _.copy(store.state.unit_store);
                    const new_unit_store:{[key:string]:T.Unit[]} = _.new_obj(
                        pre_unit_store,
                        (store)=>{
                            units.forEach(unit=>{
                                const pre = store[unit.request] || [];
                                if(store[unit.request]!=null&&store[unit.request].some(u=>_.toHash(u.payee+u.request+u.index.toString())===_.toHash(unit.payee+unit.request+unit.index.toString())||u.output!=unit.output)) return store;
                                store[unit.request] = pre.concat(unit);
                            });
                            return store;
                        }
                    );
                    store.commit("refresh_unit_store",new_unit_store);*/
                }
                else{
                    const now_yets:Data[] = _.copy(store.yet_data);
                    const reduced = now_yets.filter(d=>{
                        if(d.type==="tx"&&d.tx[0]!=null) return true;
                        else if(d.type==="block"&&d.block[0]!=null) return d.block[0].meta.index>block.meta.index
                        else return false;
                    });
                    store.refresh_yet_data(reduced);
                }
                const balance = await get_balance(store.my_address);
                store.refresh_balance(balance);
                postMessage(balance);

                let refreshed_hash:string[] = [];
                let get_not_refresh:T.Tx[] = [];
                for(let block of _.copy(new_chain).slice().reverse()){
                    for(let tx of _.copy(block.txs.concat(block.natives).concat(block.units))){
                        if(_.copy(tx).meta.kind==="request"&&refreshed_hash.indexOf(_.copy(tx).hash)===-1) get_not_refresh.push(_.copy(TxSet.pure_to_tx(_.copy(tx),_.copy(block))));
                        else if(_.copy(tx).meta.kind==="refresh") refreshed_hash.push(_.copy(tx).meta.data.request);
                        else if(get_not_refresh.length>=10) break;
                    }
                }
                const refreshes:T.Tx[] = _.copy(get_not_refresh);
                const related = refreshes.filter(tx=>{
                    if(tx.meta.pre.flag===true){
                        const pres = TxSet.list_up_related(new_chain,TxSet.tx_to_pure(tx).meta,"pre");
                        return pres.length>0;
                    }
                    else if(tx.meta.next.flag===true){
                        const nexts = TxSet.list_up_related(new_chain,TxSet.tx_to_pure(tx).meta,"next");
                        return nexts.length>0;
                    }
                    else return true;
                });
                console.log('not refreshed:')
                console.log(related);
                if(related.length>0){
                    const req_tx:T.Tx = related[0];
                    const index = (()=>{
                        for(let block of _.copy(new_chain).slice().reverse()){
                            let txs = block.txs.concat(block.natives).concat(block.units);
                            let i = txs.map(tx=>tx.hash).indexOf(req_tx.hash);
                            if(i!=-1) return block.meta.index;
                        }
                        return 0;
                    })();
                    const code:string = store.code[req_tx.meta.data.token];
                    await send_refresh_tx(_.copy(store.roots),store.secret,_.copy(req_tx),index,code,_.copy(new_chain));
                    //await send_blocks();
                }
                /*if(refs_pure.length>0){
                    await P.forEach(refs_pure, async (pure:T.TxPure)=>{
                        const req = pure.meta.data.request;
                        const buy_units:T.Unit[] = store.state.unit_store[req];
                        await unit_buying(store.state.secret,buy_units.slice(),_.copy(store.state.roots),store.state.chain.slice());
                    })
                }*/

                const unit_store_values:T.Unit[][] = Object.values(store.unit_store);
                const units_sum = unit_store_values.reduce((sum,us)=>sum+us.length,0);
                const reversed_chain:T.Block[] = _.copy(new_chain).slice().reverse();
                const refreshed = (()=>{
                    let result:T.Unit[] = [];
                    let price_sum:number;
                    let flag = false;
                    for(let block of reversed_chain){
                        const txs = _.copy(block).txs.concat(block.natives).concat(block.units).slice();
                        for(let tx of txs){
                            if(tx.meta.kind==="refresh"){
                                result = result.concat(unit_store_values.reduce((result,us)=>{
                                    if(us.length>0&&us[0].request===tx.meta.data.request){
                                        price_sum = result.reduce((sum,unit)=>new BigNumber(sum).plus(unit.unit_price).toNumber(),0);
                                        us.forEach(u=>{
                                            if(new BigNumber(price_sum).plus(u.unit_price).isGreaterThanOrEqualTo(new BigNumber(balance).times(0.99))){
                                                flag = true;
                                                return result;
                                            }
                                            else{
                                                price_sum = new BigNumber(price_sum).plus(u.unit_price).toNumber();
                                                result.push(u);
                                            }
                                        });
                                        return result;
                                    }
                                    else return result;
                                },[]));
                            }
                            if(result.length===units_sum||flag) break;
                        }
                    }
                    return result;
                })();
                console.log(unit_store_values);
                console.log('buy_units are:')
                console.log(refreshed)
                console.log(store.now_buying)
                if(refreshed.length>0&&!store.now_buying&&!store.replace_mode){
                    const validatorPub = BlockSet.search_key_block(_.copy(reversed_chain)).meta.validatorPub;
                    const validator_address = CryptoSet.GenereateAddress(native,_.reduce_pub(validatorPub));
                    const buy_units = refreshed;
                    await unit_buying(store.secret,_.copy(buy_units),_.copy(store.roots),_.copy(new_chain));
                    //await send_blocks();
                }
                console.log('yet:')
                console.log(store.yet_data);
                await send_blocks();
                await sleep(block_time);
                return await compute_yet();
            }
            else{
                const now_yets:Data[] = _.copy(store.yet_data);
                const reduced = now_yets.filter(d=>{
                    if(d.type==="tx"&&d.tx[0]!=null) return true;
                    else if(d.type==="block"&&d.block[0]!=null) return d.block[0].meta.index!=block.meta.index;
                    else return false;
                });
                console.log(reduced);
                store.refresh_yet_data(_.copy(reduced));
                console.log('yet:')
                console.log(store.yet_data);
                await sleep(block_time);
                return await compute_yet();
            }
        }
    }
}



//Vue.use(Vuex)


//delete_db();


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
            write_db('apps',_.copy(state.apps));
            self.postMessage({
                key:'add_app',
                val:_.copy(obj)
            },location.protocol+'//'+location.host);
        },
        del_app(state,key:string){
            delete state.apps[key];
            write_db('apps',_.copy(state.apps));
            self.postMessage({
                key:'del_app',
                val:key
            },location.protocol+'//'+location.host);
        },
        refresh_pool(state,pool:T.Pool){
            state.pool = _.copy(pool);
            write_db('pool',_.copy(state.pool));
            self.postMessage({
                key:'refresh_pool',
                val:_.copy(pool)
            },location.protocol+'//'+location.host);
        },
        add_block(state,block:T.Block){
            state.chain.push(block);
            write_db('chain',_.copy(state.chain));
            self.postMessage({
                key:'add_block',
                val:_.copy(block)
            },location.protocol+'//'+location.host);
        },
        replace_chain(state,chain:T.Block[]){
            state.chain = _.copy(chain).slice().sort((a:T.Block,b:T.Block)=>{
                return a.meta.index - b.meta.index;
            }).filter((b:T.Block,i:number)=>b.meta.index===i);
            write_db('chain',_.copy(state.chain));
            self.postMessage({
                key:'replace_chain',
                val:_.copy(chain)
            },location.protocol+'//'+location.host);
        },
        refresh_roots(state,roots:{[key:string]:string}){
            state.roots = _.copy(roots);
            write_db('roots',_.copy(state.roots));
            self.postMessage({
                key:'refresh_roots',
                val:_.copy(roots)
            },location.protocol+'//'+location.host);
        },
        refresh_candidates(state,candidates:T.Candidates[]){
            state.candidates = _.copy(candidates);
            write_db('candidates',_.copy(state.candidates));
            self.postMessage({
                key:'refresh_candidates',
                val:_.copy(candidates)
            },location.protocol+'//'+location.host);
        },
        add_unit(state,unit:T.Unit){
            const units:T.Unit[] = _.copy(state.unit_store)[unit.request] || [];
            if(!units.some(u=>u.index===unit.index&&u.payee===unit.payee)){
                state.unit_store[unit.request] = _.copy(units).concat(unit);
                write_db('unit_store',_.copy(state.unit_store));
                self.postMessage({
                    key:'add_unit',
                    val:_.copy(unit)
                },location.protocol+'//'+location.host);
            }
        },
        delete_unit(state,unit:T.Unit){
            const units:T.Unit[] = _.copy(state.unit_store)[unit.request] || [];
            const deleted = units.filter(u=>u.index===unit.index&&u.payee!=unit.payee&&u.output===unit.output);
            state.unit_store[unit.request] = _.copy(deleted);
            if(deleted.length<=0) delete state.unit_store[unit.request];
            write_db('unit_store',_.copy(state.unit_store));
            self.postMessage({
                key:'delete_unit',
                val:_.copy(unit)
            },location.protocol+'//'+location.host);
        },
        refresh_unit_store(state,store:{[key:string]:T.Unit[]}){
            state.unit_store = _.copy(store);
            write_db('unit_store',_.copy(state.unit_store));
            self.postMessage({
                key:'refresh_unit_store',
                val:_.copy(store)
            },location.protocol+'//'+location.host);
        },
        refresh_secret(state,secret:string){
            state.secret = secret;
            write_db('secret',state.secret);
            self.postMessage({
                key:'refresh_secret',
                val:secret
            },location.protocol+'//'+location.host);
        },
        regist(state){
            state.registed = 1;
            write_db('registed',1);
            self.postMessage({
                key:'regist',
                val:null
            },location.protocol+'//'+location.host);
        },
        refresh_balance(state,amount:number){
            state.balance = amount;
            self.postMessage({
                key:'refresh_balance',
                val:amount
            },location.protocol+'//'+location.host);
        },
        push_yet_data(state,data:Data){
            state.yet_data.push(data);
            self.postMessage({
                key:'push_yet_data',
                val:data
            },location.protocol+'//'+location.host);
        },
        unshift_yet_data(state,data:Data){
            state.yet_data.unshift(data);
            self.postMessage({
                key:'unshift_yet_data',
                val:data
            },location.protocol+'//'+location.host);
        },
        refresh_yet_data(state,data:Data[]){
            state.yet_data = _.copy(data);
            self.postMessage({
                key:'refresh_yet_data',
                val:data
            },location.protocol+'//'+location.host);
        },
        checking(state,bool:boolean){
            state.check_mode = bool;
            if(bool===true){
                setTimeout(()=>{
                    state.check_mode = false;
                },block_time*10);
            }
            self.postMessage({
                key:'checking',
                val:bool
            },location.protocol+'//'+location.host);
        },
        replaceing(state,bool:boolean){
            state.replace_mode = bool;
            self.postMessage({
                key:'replaceing',
                val:bool
            },location.protocol+'//'+location.host);
        },
        rep_limit(state,index:number){
            state.replace_index = index;
            self.postMessage({
                key:'rep_limit',
                val:index
            },location.protocol+'//'+location.host);
        },
        add_not_refreshed(state,tx:T.Tx){
            state.not_refreshed_tx = state.not_refreshed_tx.concat(_.copy(tx));
            self.postMessage({
                key:'add_not_refreshed',
                val:_.copy(tx)
            },location.protocol+'//'+location.host);
        },
        del_not_refreshed(state,hashes:string[]){
            state.not_refreshed_tx = state.not_refreshed_tx.filter((tx:T.Tx)=>hashes.indexOf(tx.hash)===-1);
            self.postMessage({
                key:'del_not_refreshed',
                val:_.copy(hashes)
            },location.protocol+'//'+location.host);
        },
        buying_unit(state,bool:boolean){
            state.now_buying =bool;
            self.postMessage({
                key:'buying_unit',
                val:bool
            },location.protocol+'//'+location.host);
        },
        new_refreshing(state,requests:string[]){
            state.now_refreshing = requests;
            self.postMessage({
                key:'new_refreshing',
                val:_.copy(requests)
            },location.protocol+'//'+location.host);
        }
    },
    getters:{
        my_address:(state) => CryptoSet.GenereateAddress(native,CryptoSet.PublicFromPrivate(state.secret)) || ""
    }
});*/


const port = peer_list[0].port || "57750";
const ip = peer_list[0].ip || "localhost";
console.log(ip)


export const client = new faye.Client('http://'+ip+':'+port+'/vreath');

client.subscribe('/data',async (data:Data)=>{
    if(data.type==="block") store.push_yet_data(_.copy(data));
    const S_Trie = trie_ins(store.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.secret));
    const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0);
    const unit_amount = unit_state.amount || 0;
    if(data.type==="tx"&&unit_amount>0) store.push_yet_data(_.copy(data));
});

client.subscribe('/checkchain',(address:string)=>{
    console.log('checked')
    console.log(store.check_mode)
    if(store.my_address===address) client.publish('/replacechain',_.copy(store.chain));
    return 0;
});

client.subscribe('/replacechain',async (chain:T.Block[])=>{
    console.log("replace:")
    if(!store.replace_mode&&store.check_mode){
        console.log(chain);
        await check_chain(_.copy(chain),_.copy(store.chain),_.copy(store.pool),_.copy(store.code),store.secret,_.copy(store.unit_store));
    }
    store.checking(false);
    console.log(store.yet_data);
    return 0;
});

client.bind('transport:down', ()=>{
    console.log('lose connection');
    delete_db();
});


/*(async ()=>{
    const gen_S_Trie = trie_ins("");
    await P.forEach(gen.state,async (s:T.State)=>{
        await gen_S_Trie.put(s.owner,s);
    });
    const last_block:T.Block = _.copy(store.state.chain[store.state.chain.length-1]) || _.copy(gen.block);
    const last_address = CryptoSet.GenereateAddress(native,_.reduce_pub(last_block.meta.validatorPub));
    console.log(last_address);
    if(last_address!=store.getters.my_address){
        store.commit('checking',true);
        client.publish("/checkchain",last_address);
    }
    const balance = await get_balance(store.getters.my_address);
    console.log(balance);
    store.commit("refresh_balance",balance);
    console.log('yet:')
    console.log(store.state.yet_data);;
    await compute_yet();
})()*/


self.onmessage = async (event)=>{
    try{
        const key:string = event.data.key;
        const val:any = event.data.val;
        if(key!=null) store[key](val);
        else if(event.data==="start"){
            const gen_S_Trie = trie_ins("");
            await P.forEach(gen.state,async (s:T.State)=>{
                await gen_S_Trie.put(s.owner,s);
            });
            const chain = read_db('chain',[gen.block]);
            const last_block:T.Block = _.copy(chain[chain.length-1]) || _.copy(gen.block);
            const last_address = CryptoSet.GenereateAddress(native,_.reduce_pub(last_block.meta.validatorPub));
            console.log(last_address);
            if(last_address!=store.my_address){
                store.checking(true);
                client.publish("/checkchain",last_address);
            }
            const balance =  await get_balance(store.my_address);
            store.refresh_balance(balance);
            console.log(balance);
            await compute_yet();
        }
    }
    catch(e){console.log(e)}
}