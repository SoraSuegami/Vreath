import {Store,Data,set_config,compute_tx,get_balance,send_request_tx,trie_ins,check_chain} from './index'
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
import axios from 'axios'


/*if('serviceWorker' in navigator){
    navigator.serviceWorker.register("sw_bundle.js").then(reg=>{
      if(reg.installing) console.log('installing');
      else if(reg.waiting) console.log('waiting');
      else if(reg.active) console.log('active');
    }).catch(error=>console.log(error));
}*/





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
    const del_db_vreath = indexedDB.deleteDatabase('vreath');
    del_db_vreath.onsuccess = ()=>console.log('db delete success');
    del_db_vreath.onerror = ()=>console.log('db delete error');
    const del_db_level = indexedDB.deleteDatabase('level-js-./db');
    del_db_level.onsuccess = ()=>console.log('db delete success');
    del_db_level.onerror = ()=>console.log('db delete error');
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





const level_db = level('./db')


export const store = new Store(false,read_db,write_db);







const port = peer_list[0].port || "57750";
const ip = peer_list[0].ip || "localhost";
console.log(ip)


export let client = new faye.Client('http://'+ip+':'+port+'/vreath');

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
    if(!store.check_mode&&!store.replace_mode&&!store.return_chain) store.refresh_return_chain(true);//client.publish('/replacechain',_.copy(store.chain));
    return 0;
});

client.subscribe('/replacechain',async (chain:T.Block[])=>{
    if(!store.replace_mode&&store.check_mode&&!store.return_chain){
        console.log("replace:")
        await check_chain(_.copy(chain),_.copy(store.chain),_.copy(store.pool),_.copy(store.code),store.secret,_.copy(store.unit_store));
    }
    store.checking(false);
    console.log(store.yet_data.length);
    return 0;
});

client.bind('transport:down', ()=>{
    console.log('lose connection');
    delete_db();
    client = new faye.Client('http://'+ip+':'+port+'/vreath');
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
        const type = event.data.type;
        switch(type){
            case 'commit':
                const key:string = event.data.key;
                const val:any = event.data.val;
                if(key!=null) store[key](val);
            case 'start':
                delete_db();
                set_config(level_db,store,client);
                const gen_S_Trie = trie_ins("");
                await P.forEach(gen.state,async (s:T.State)=>{
                    await gen_S_Trie.put(s.owner,s);
                });
                const chain = read_db('chain',[gen.block]);
                const last_block:T.Block = _.copy(chain[chain.length-1]) || _.copy(gen.block);
                const last_address = CryptoSet.GenereateAddress(native,_.reduce_pub(last_block.meta.validatorPub));
                if(last_address!=store.my_address){
                    store.checking(true);
                    client.publish("/checkchain",last_address);
                }
                const balance =  await get_balance(store.my_address);
                store.refresh_balance(balance);
                postMessage({
                    key:'refresh_balance',
                    val:balance
                });
                setImmediate(compute_tx);
            case 'send_request':
                const options = event.data;
                await send_request_tx(store.secret,options.tx_type,options.token,options.base,options.input_raw,options.log,_.copy(store.roots),_.copy(store.chain));
            case 'get_balance':
                const got_balance = await get_balance(event.data.address) || 0;
                postMessage({
                    address:event.data.address,
                    amount:got_balance
                });
        }
    }
    catch(e){
        console.log(e)
    }
}