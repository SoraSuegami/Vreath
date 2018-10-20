import * as http from 'http'
import express from 'express'
import faye from 'faye'
import {tx_accept,block_accept,check_chain,unit_buying,send_key_block,send_micro_block,get_balance,send_request_tx,send_refresh_tx} from './index'
import * as T from '../core/types'
import * as fs from 'fs'
import * as gen from '../genesis/index'
import deflate from 'permessage-deflate'
import Vue from 'vue'
import Vuex from 'vuex'
import * as _ from '../core/basic'
import * as CryptoSet from '../core/crypto_set'
import * as StateSet from '../core/state'
import * as TxSet from '../core/tx'
import * as BlockSet from '../core/block'
import BigNumber from 'bignumber.js';
import {trie_ins} from './client/db'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate,compatible_version} from './con'
import * as P from 'p-iteration'
import readlineSync from 'readline-sync'
import * as cluster from 'cluster'
import { async } from 'rxjs/internal/scheduler/async';

export const port = process.env.vreath_port || "57750";
export const ip = process.env.vreath_ip || "localhost";


const app = express();
const server = http.createServer(app);
const bayeux = new faye.NodeAdapter({mount: '/vreath'});
bayeux.addWebsocketExtension(deflate);
bayeux.attach(server);

type Data = {
    type:'tx'|'block';
    tx:T.Tx[];
    block:T.Block[];
};

const codes = {
    "native":"const main = () => {};",//"function main(){const state = vreath.states[0];const type = input[0];const other = input[1];const amount = Number(input[2]);switch (type) {case 'remit':if (tx.meta.data.type != 'scrap' || state.owner != tx.meta.data.address || amount >= 0 || state.amount < amount) {console.log('error'); return 0;} const remited = vreath.create_state(state.nonce + 1, state.owner, state.token, state.amount + amount, state.data, state.product);console.log(remited);vreath.change_states([state], [remited]);}}",
    "unit":"const main = () => {};"
}


export const json_read = <T>(key:string,def:T):T=>{
    try{
        const get:T = JSON.parse(fs.readFileSync(key,'utf-8')||JSON.stringify(def));
        return get;
    }
    catch(e){
        console.log(e);
        return def;
    }
}

export const json_write = <T>(key:string,val:T):void=>{
    try{
        fs.writeFileSync(key,JSON.stringify(val,null, '    '));
    }
    catch(e){
        console.log(e);
    }
}

app.use(express.static(__dirname+'/client'));
app.get('/',(req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});

export const client = new faye.Client('http://'+ip+':'+port+'/vreath');

server.on('close',()=>{
    console.log('lose connection');
    json_write("./wallet/json/code.json",{});
    json_write("./wallet/json/pool.json",{});
    json_write("./wallet/json/chain.json",[gen.block]);
    json_write("./wallet/json/roots.json",gen.roots);
    json_write("./wallet/json/candidates.json",gen.candidates);
    json_write("./wallet/json/unit_store.json",{});
    json_write('./wallet/json/yet_data.json',[]);
});

server.on('error',(e)=>console.log(e));

process.on('SIGINT',()=>{
    console.log('lose connection');
    json_write("./wallet/json/code.json",{});
    json_write("./wallet/json/pool.json",{});
    json_write("./wallet/json/chain.json",[gen.block]);
    json_write("./wallet/json/roots.json",gen.roots);
    json_write("./wallet/json/candidates.json",gen.candidates);
    json_write("./wallet/json/unit_store.json",{});
    json_write('./wallet/json/yet_data.json',[]);
    process.exit(1);
});

client.subscribe('/data',async (data:Data)=>{
    if(data.type==="block") store.commit('push_yet_data',_.copy(data));
    const S_Trie = trie_ins(store.state.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.state.secret));
    const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0);
    const unit_amount = unit_state.amount || 0;
    if(data.type==="tx"&&unit_amount>0) store.commit('push_yet_data',_.copy(data));
});

client.subscribe('/checkchain',(address:string)=>{
    console.log('checked')
    console.log(store.state.check_mode)
    if(store.getters.my_address===address) client.publish('/replacechain',_.copy(store.state.chain));
    return 0;
});

client.subscribe('/replacechain',async (chain:T.Block[])=>{
    try{
        console.log("replace:")
        if(!store.state.replace_mode&&store.state.check_mode){
            await check_chain(_.copy(chain),_.copy(store.state.chain),_.copy(store.state.pool),_.copy(store.state.code),store.state.secret,_.copy(store.state.unit_store));
        }
        store.commit('checking',false);
        return 0;
    }
    catch(e){throw new Error(e);}
});


server.listen(port);




Vue.use(Vuex);

export const store = new Vuex.Store({
    state:{
        code:json_read("./wallet/json/code.json",codes),
        pool:json_read("./wallet/json/pool.json",{}),
        chain:json_read("./wallet/json/chain.json",[gen.block]),
        roots:json_read("./wallet/json/roots.json",gen.roots),
        candidates:json_read("./wallet/json/candidates.json",gen.candidates),
        unit_store:json_read("./wallet/json/unit_store.json",{}),
        secret:CryptoSet.GenerateKeys(),
        balance:0,
        yet_data:[],
        check_mode:false,
        replace_mode:false,
        replace_index:0,
        not_refreshed_tx:[],
        now_buying:false,
        now_refreshing:[],
        first_request:true
    },
    mutations:{
        refresh_pool(state,pool:T.Pool){
            state.pool = _.copy(pool);
            json_write("./wallet/json/pool.json",_.copy(state.pool));
        },
        add_block(state,block:T.Block){
            state.chain.push(block);
            json_write("./wallet/json/chain.json",_.copy(state.chain));
        },
        replace_chain(state,chain:T.Block[]){
            state.chain = _.copy(chain).slice().sort((a:T.Block,b:T.Block)=>{
                return a.meta.index - b.meta.index;
            }).filter((b:T.Block,i:number)=>b.meta.index===i);
            json_write("./wallet/json/chain.json",_.copy(state.chain));
        },
        refresh_roots(state,roots:{stateroot:string,locationroot:string}){
            state.roots = _.copy(roots);
            json_write("./wallet/json/roots.json",_.copy(state.roots));
        },
        refresh_candidates(state,candidates:T.Candidates[]){
            state.candidates = _.copy(candidates);
            json_write("./wallet/json/candidates.json",_.copy(state.candidates));
        },
        add_unit(state,unit:T.Unit){
            const units:T.Unit[] = _.copy(state.unit_store)[unit.request] || [];
            if(!units.some(u=>u.index===unit.index&&u.payee===unit.payee)){
                state.unit_store[unit.request] = _.copy(units).concat(unit);
                json_write("./wallet/json/unit_store.json",_.copy(state.unit_store));
            }
        },
        delete_unit(state,unit:T.Unit){
            const pre_unit:{[key:string]:T.Unit[]} = _.copy(state.unit_store);
            const units:T.Unit[] = pre_unit[unit.request] || [];
            const deleted = units.filter(u=>u.index===unit.index&&u.payee!=unit.payee&&u.output===unit.output);
            state.unit_store[unit.request] = _.copy(deleted);
            if(deleted.length<=0) delete state.unit_store[unit.request];
            json_write("./wallet/json/unit_store.json",_.copy(state.unit_store));
        },
        refresh_unit_store(state,store:{[key:string]:T.Unit[]}){
            state.unit_store = _.copy(store);
            json_write("./wallet/json/unit_store.json",_.copy(state.unit_store));
        },
        refresh_secret(state,secret:string){
            state.secret = secret;
        },
        refresh_balance(state,amount:number){
            state.balance = amount;
        },
        push_yet_data(state,data:Data){
            state.yet_data.push(data);
            json_write('./wallet/json/yet_data.json',_.copy(state.yet_data));
        },
        unshift_yet_data(state,data:Data){
            state.yet_data.unshift(data);
            json_write('./wallet/json/yet_data.json',_.copy(state.yet_data));
        },
        refresh_yet_data(state,data:Data[]){
            state.yet_data = _.copy(data);
            json_write('./wallet/json/yet_data.json',_.copy(state.yet_data));
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
        },
        requested(state){
            state.first_request = false;
        }
    },
    getters:{
        my_address:(state) => CryptoSet.GenereateAddress(native,CryptoSet.PublicFromPrivate(state.secret)) || ""
    }
});

const sleep = (msec:number)=>{
    return new Promise(function(resolve) {
        setTimeout(function() {resolve()}, msec);
     });
}

const send_blocks = async ()=>{
    const S_Trie = trie_ins(store.state.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.state.secret));
    const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0);
    const unit_amount = unit_state.amount || 0;
    const last_key = BlockSet.search_key_block(_.copy(store.state.chain));
    const last_micros = BlockSet.search_micro_block(_.copy(store.state.chain),_.copy(last_key));
    const date = new Date();

    if(!store.state.replace_mode&&_.reduce_pub(last_key.meta.validatorPub)===CryptoSet.PublicFromPrivate(store.state.secret)&&last_micros.length<=max_blocks) await send_micro_block(_.copy(store.state.pool),store.state.secret,_.copy(store.state.chain),_.copy(store.state.candidates),_.copy(store.state.roots),store.state.unit_store);
    else if(!store.state.replace_mode&&unit_state!=null&&unit_amount>0&&date.getTime()-last_key.meta.timestamp>block_time*max_blocks) await send_key_block(_.copy(store.state.chain),store.state.secret,_.copy(store.state.candidates),_.copy(store.state.roots));

    if(store.state.first_request&&!store.state.replace_mode&&unit_state!=null&&unit_amount>0&&_.copy(store.state.chain).filter(b=>b.natives.length>0).length===0) {
        await send_request_tx(store.state.secret,"issue",native,[store.getters.my_address,store.getters.my_address],["remit",JSON.stringify([0])],[],_.copy(store.state.roots),_.copy(store.state.chain));
    }
}

const compute_tx = async ():Promise<void>=>{
    const now_yets:Data[] = _.copy(store.state.yet_data)
    const data:Data = now_yets.filter(d=>d.type==="tx"&&d.tx[0]!=null)[0];
    if(data!=null){
        const target:T.Tx = _.copy(data.tx[0]);
        //if(target.meta.kind==="request"||target.meta.data.index<store.state.chain.length){
        await tx_accept(_.copy(target),_.copy(store.state.chain),_.copy(store.state.roots),_.copy(store.state.pool),store.state.secret,_.copy(store.state.candidates),_.copy(store.state.unit_store));
    }
    let units:T.Unit[] = [];
    const reduced = now_yets.filter(d=>{
        if(d.type==="tx"&&d.tx[0]!=null&&data!=null&&d.tx[0].hash===data.tx[0].hash) return false;
        else if(d.type==="tx"&&d.tx[0]!=null){
            const t = _.copy(d.tx[0]);
            if(t.meta.kind==="request") return true;
            for(let block of _.copy(store.state.chain).slice(t.meta.data.index)){
                for(let tx of _.copy(block.txs.concat(block.natives).concat(block.units))){
                    if(tx.meta.kind==="refresh"&&tx.meta.data.index===t.meta.data.index&&tx.meta.data.request===t.meta.data.request){
                        console.log('remove')
                        const unit:T.Unit = {
                            request:t.meta.data.request,
                            index:t.meta.data.index,
                            nonce:t.meta.nonce,
                            payee:t.meta.data.payee,
                            output:t.meta.data.output,
                            unit_price:t.meta.unit_price
                        }
                        units.push(_.copy(unit));
                        return false;
                    }
                }
            }
            return true;
        }
        else if(d.type==="block"&&d.block[0]!=null) return true;
        else return false;
    });
    store.commit("refresh_yet_data",_.copy(reduced));
    const pre_unit_store:{[key:string]:T.Unit[]} = _.copy(store.state.unit_store);
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
    store.commit("refresh_unit_store",new_unit_store);
    await sleep(block_time);
    setImmediate(compute_yet);
}

const compute_yet = async ():Promise<void>=>{
    const data:Data = _.copy(store.state.yet_data[0]);
    if(data==null){
        store.commit('replaceing',false);
        await send_blocks();
        await sleep(block_time);
        //return await compute_yet();
    }
    /*else if(data.type==="tx"&&data.tx.length>0){
        const target:T.Tx = _.copy(data.tx[0]);
        //if(target.meta.kind==="request"||target.meta.data.index<store.state.chain.length){
        await tx_accept(_.copy(target),_.copy(store.state.chain),_.copy(store.state.roots),_.copy(store.state.pool),store.state.secret,_.copy(store.state.candidates),_.copy(store.state.unit_store));
        const now_yets:Data[] = _.copy(store.state.yet_data);
        let units:T.Unit[] = [];
        const reduced = now_yets.filter((d,i)=>{
            if(i===0) return false;
            else if(d.type==="tx"&&d.tx[0]!=null){
                const t = _.copy(d.tx[0]);
                if(t.meta.kind==="request") return true;
                for(let block of _.copy(store.state.chain).slice(t.meta.data.index)){
                    for(let tx of _.copy(block.txs.concat(block.natives).concat(block.units))){
                        if(tx.meta.kind==="refresh"&&tx.meta.data.index===t.meta.data.index&&tx.meta.data.request===t.meta.data.request){
                            console.log('remove')
                            const unit:T.Unit = {
                                request:t.meta.data.request,
                                index:t.meta.data.index,
                                nonce:t.meta.nonce,
                                payee:t.meta.data.payee,
                                output:t.meta.data.output,
                                unit_price:t.meta.unit_price
                            }
                            units.push(_.copy(unit));
                            return false;
                        }
                    }
                }
                return true;
            }
            else if(d.type==="block"&&d.block[0]!=null) return true;
            else return false;
        });
        store.commit("refresh_yet_data",_.copy(reduced));
        const pre_unit_store:{[key:string]:T.Unit[]} = _.copy(store.state.unit_store);
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
        store.commit("refresh_unit_store",new_unit_store);
        await sleep(block_time);
        //return await compute_yet();
        /*}
        else{
            const txs:Data[] = store.state.yet_data.filter((d:Data)=>d.type==="tx"&&d.tx[0]!=null&&d.tx[0].hash!=target.hash);
            const blocks:Data[] = store.state.yet_data.filter((d:Data)=>d.type==="block");
            const reduced = txs.concat(blocks);
            const concated = reduced.concat(store.state.yet_data[0]);
            store.commit("refresh_yet_data",concated);
        }*/
    /*}*/
    else if(data.type==="block"&&data.block.length>0){
        const block = data.block[0];
        const chain:T.Block[] = _.copy(store.state.chain);
        if(block.meta.version>=compatible_version){
            if(block.meta.index>chain.length){
                if(!store.state.replace_mode){
                    const address = CryptoSet.GenereateAddress(native,_.reduce_pub(block.meta.validatorPub));
                    if(address!=store.getters.my_address){
                        store.commit('checking',true);
                        client.publish("/checkchain",address);
                    }
                    else{
                        const del_yet = _.copy(store.state.yet_data).slice(1);
                        store.commit('refresh_yet_data',del_yet);
                    }
                }
                else store.commit('replaceing',false);
                //await send_blocks();
                await sleep(block_time);
                //return await compute_yet();
            }
            else if(block.meta.index===chain.length){
                if(store.state.replace_mode&&chain[chain.length-1].meta.index>=store.state.replace_index) store.commit('replaceing',false);
                await block_accept(_.copy(block),_.copy(store.state.chain),_.copy(store.state.candidates),_.copy(store.state.roots),_.copy(store.state.pool),_.copy(store.state.not_refreshed_tx),store.state.now_buying,_.copy(store.state.unit_store))
                const new_chain:T.Block[] = _.copy(store.state.chain);
                if(store.state.replace_mode&&chain.length===new_chain.length) store.commit('replaceing',false);
                if(new_chain.length===chain.length+1){
                    const refs = _.copy(block.txs.concat(block.natives).concat(block.units)).filter(tx=>tx.meta.kind==="refresh");
                    const now_yets:Data[] = _.copy(store.state.yet_data);
                    let units:T.Unit[] = [];
                    const reduced = now_yets.filter(d=>{
                        if(d.type==="tx"&&d.tx[0]!=null){
                            const t = _.copy(d.tx[0]);
                            console.log('tx')
                            return !refs.some(tx=>{
                                if(t.meta.kind==="refresh"&&t.meta.data.index===tx.meta.data.index&&t.meta.data.request===tx.meta.data.request){
                                    console.log('remove')
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
                    console.log('remove_tx:')
                    console.log(refs);
                    console.log(reduced)
                    store.commit("refresh_yet_data",_.copy(reduced));
                    const pre_pool:T.Pool = _.copy(store.state.pool)
                    /*const new_pool = Object.values(pre_pool).filter(t=>{
                        return !refs.some(tx=>{
                            if(t.meta.kind==="refresh"&&t.meta.data.index===tx.meta.data.index&&t.meta.data.request===tx.meta.data.request){
                                console.log('remove')
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
                    });
                    store.commit('refresh_pool',_.copy(new_pool));*/
                    const new_pool = _.new_obj(
                        pre_pool,
                        p=>{
                            block.txs.concat(block.natives).concat(block.units).forEach(tx=>{
                                Object.values(p).forEach(t=>{
                                    if(t.meta.kind==="refresh"&&t.meta.data.index===tx.meta.data.index&&t.meta.data.request===tx.meta.data.request){
                                        delete p[t.hash];
                                        delete p[t.meta.data.request];
                                        const unit:T.Unit = {
                                            request:t.meta.data.request,
                                            index:t.meta.data.index,
                                            nonce:t.meta.nonce,
                                            payee:t.meta.data.payee,
                                            output:t.meta.data.output,
                                            unit_price:t.meta.unit_price
                                        }
                                        units.push(_.copy(unit));
                                    }
                                });
                            });
                            return p;
                        }
                    );
                    store.commit('refresh_pool',_.copy(new_pool));
                    const pre_unit_store:{[key:string]:T.Unit[]} = _.copy(store.state.unit_store);
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
                    store.commit("refresh_unit_store",new_unit_store);
                }
                else{
                    const now_yets:Data[] = _.copy(store.state.yet_data);
                    const reduced = now_yets.filter(d=>{
                        if(d.type==="tx"&&d.tx[0]!=null) return true;
                        else if(d.type==="block"&&d.block[0]!=null) return d.block[0].meta.index>block.meta.index
                        else return false;
                    });
                    store.commit("refresh_yet_data",reduced)
                }
                const balance = await get_balance(store.getters.my_address);
                store.commit("refresh_balance",balance);

                /*let refreshed_hash:string[] = [];
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
                    const code:string = store.state.code[req_tx.meta.data.token];
                    //await send_refresh_tx(_.copy(store.state.roots),store.state.secret,_.copy(req_tx),index,code,_.copy(new_chain));
                    //await send_blocks();
                }*/
                /*if(refs_pure.length>0){
                    await P.forEach(refs_pure, async (pure:T.TxPure)=>{
                        const req = pure.meta.data.request;
                        const buy_units:T.Unit[] = store.state.unit_store[req];
                        await unit_buying(store.state.secret,buy_units.slice(),_.copy(store.state.roots),store.state.chain.slice());
                    })
                }*/

                const unit_store_values:T.Unit[][] = Object.values(store.state.unit_store);
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
                if(refreshed.length>0&&!store.state.now_buying&&!store.state.replace_mode){
                    const validatorPub = BlockSet.search_key_block(_.copy(reversed_chain)).meta.validatorPub;
                    const validator_address = CryptoSet.GenereateAddress(native,_.reduce_pub(validatorPub));
                    const buy_units = refreshed;
                    await unit_buying(store.state.secret,_.copy(buy_units),_.copy(store.state.roots),_.copy(new_chain));
                    //await send_blocks();
                }
                await send_blocks();
                await sleep(block_time);
                //return await compute_yet();
            }
            else{
                const now_yets:Data[] = _.copy(store.state.yet_data);
                const reduced = now_yets.filter(d=>{
                    if(d.type==="tx"&&d.tx[0]!=null) return true;
                    else if(d.type==="block"&&d.block[0]!=null) return d.block[0].meta.index!=block.meta.index;
                    else return false;
                });
                store.commit("refresh_yet_data",_.copy(reduced));
                await sleep(block_time);
                //return await compute_yet();
            }
        }
    }
    setImmediate(compute_tx);
}

(async ()=>{
    json_write("./wallet/json/code.json",{});
    json_write("./wallet/json/pool.json",{});
    json_write("./wallet/json/chain.json",[gen.block]);
    json_write("./wallet/json/roots.json",gen.roots);
    json_write("./wallet/json/candidates.json",gen.candidates);
    json_write("./wallet/json/unit_store.json",{});
    json_write('./wallet/json/yet_data.json',[]);
    const secret = readlineSync.question("What is your secret?");
    store.commit('refresh_secret',secret);
    const gen_S_Trie = trie_ins("");
    await P.forEach(gen.state,async (s:T.State)=>{
        await gen_S_Trie.put(s.owner,s);
    });
    const last_block:T.Block = _.copy(store.state.chain[store.state.chain.length-1]) || _.copy(gen.block);
    const last_address = CryptoSet.GenereateAddress(native,_.reduce_pub(last_block.meta.validatorPub));
    if(last_address!=store.getters.my_address){
        store.commit('checking',true);
        client.publish("/checkchain",last_address);
    }
    const balance = await get_balance(store.getters.my_address);
    store.commit("refresh_balance",balance);
    setImmediate(compute_tx);
    //setImmediate(compute_yet);
})()


/*if(cluster.isMaster){
    (async ()=>{
        json_write("./wallet/json/code.json",{});
        json_write("./wallet/json/pool.json",{});
        json_write("./wallet/json/chain.json",[gen.block]);
        json_write("./wallet/json/roots.json",gen.roots);
        json_write("./wallet/json/candidates.json",gen.candidates);
        json_write("./wallet/json/unit_store.json",{});
        const secret = readlineSync.question("What is your secret?");
        console.log(secret);
        store.commit('refresh_secret',secret);
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
        console.log(store.state.yet_data);
        for(let i=0; i<2; i++){
            cluster.fork();
        }
        cluster.workers[1].on('message',(msg)=>{
            console.log('receive-msg')
            if(msg.to===-1&&msg.kind==="new_block"&&msg.val!=null){
                store.commit('push_yet_data',_.copy(msg.val));
                await compute_yet();
            }
        });

        while(1){
            await compute_yet();
        }
    })()
}
else if(cluster.isWorker&&cluster.worker.id===0){

}
else if(cluster.isWorker&&cluster.worker.id===1){
    client.subscribe('/data',async (data:Data)=>{
        if(data.type==="tx") console.log(data.tx[0]);
        else if(data.type==="block") console.log(data.block[0]);
        if(data.type==="block"){
            process.send({
                to:-1,
                kind:'new_block',
                val:_.copy(data.block[0])
            })
        }
        const S_Trie = trie_ins(store.state.roots.stateroot);
        const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.state.secret));
        const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0);
        const unit_amount = unit_state.amount || 0;
        if(data.type==="tx"&&unit_amount>0) store.commit('push_yet_data',_.copy(data));
    });

    client.subscribe('/checkchain',(address:string)=>{
        console.log('checked')
        console.log(store.state.check_mode)
        if(store.getters.my_address===address) client.publish('/replacechain',_.copy(store.state.chain));
        return 0;
    });

    client.subscribe('/replacechain',async (chain:T.Block[])=>{
        try{
            console.log("replace:")
            if(!store.state.replace_mode&&store.state.check_mode){
                console.log(chain);
                await check_chain(_.copy(chain),_.copy(store.state.chain),_.copy(store.state.pool),_.copy(store.state.code),store.state.secret,_.copy(store.state.unit_store));
            }
            store.commit('checking',false);
            console.log(store.state.yet_data);
            return 0;
        }
        catch(e){throw new Error(e);}
    });
}*/
