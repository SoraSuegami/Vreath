import * as T from '../../core/types'
import * as _ from '../../core/basic'
import * as CryptoSet from '../../core/crypto_set'
import {Trie} from '../../core/merkle_patricia'
import * as TxSet from '../../core/tx'
import * as BlockSet from '../../core/block'
import * as StateSet from '../../core/state'
import * as P from 'p-iteration'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate, pow_target} from '../con'
import { Tx_to_Pool } from '../../core/tx_pool';
import {store} from './script'
import level from 'level-browserify'
import * as gen from '../../genesis/index';
import {IO} from 'rxjs-socket.io'
import { RunVM } from '../../core/code';
import { pos_diff } from '../../server/con';
import { async } from '../../node_modules/rxjs/internal/scheduler/async';

const db = level('./db');
export const trie_ins = (root:string)=>{
    try{
        return new Trie(db,root);
    }
    catch(e){
        console.log(e);
        return new Trie(db);
    }
}


const output_keys = (tx:T.Tx)=>{
    if(tx.meta.kind==="request") return [];
    else if(tx.meta.data.type==="create"||tx.meta.data.type==="update"){
        const token:T.State = JSON.parse(tx.raw.raw[0]);
        return [token.token];
    }
    const states:T.State[] = tx.raw.raw.map(r=>JSON.parse(r));
    return states.map(s=>s.owner);
}

const pays = (tx:T.Tx,chain:T.Block[])=>{
    if(tx.meta.kind==="request"){
        return [tx.meta.data.solvency];
    }
    else if(tx.meta.kind==="refresh"){
        const req_tx = TxSet.find_req_tx(tx,chain);
        return [req_tx.meta.data.solvency,tx.meta.data.payee];
    }
    else return [];
}

export const states_for_tx = async (tx:T.Tx,chain:T.Block[],S_Trie:Trie)=>{
    const base = tx.meta.data.base;
    const outputs = output_keys(tx);
    const payes = pays(tx,chain);
    const concated = base.concat(outputs).concat(payes);
    const target = concated.reduce((result,key,index)=>{
        if(result.filter(val=>val===key).length>=2) return result.filter((key,i)=>index!=i);
        else return result;
    },concated);
    const states:T.State[] =  Object.values(await S_Trie.filter((key)=>{
        const i = target.indexOf(key);
        if(i!=-1) return true;
        else return false;
    }));
    return states;
}

export const locations_for_tx = async (tx:T.Tx,chain:T.Block[],L_Trie:Trie)=>{
    const target = (()=>{
        if(tx.meta.kind==="request") return tx;
        else return TxSet.find_req_tx(tx,chain);
    })();
    const result:T.Location[] = Object.values(await L_Trie.filter(key=>{
        if(target.meta.data.base.indexOf(key)!=-1) return true;
        else if(target.meta.data.solvency===key&&target.meta.data.base.indexOf(key)===-1) return true;
        else return false;
    }));
    return result;
}

export const states_for_block = async (block:T.Block,chain:T.Block[],S_Trie:Trie)=>{
    const native_validator = CryptoSet.GenereateAddress(native,_.reduce_pub(block.meta.validatorPub));
    const native_validator_state:T.State = await S_Trie.get(native_validator) || [];
    const unit_validator = CryptoSet.GenereateAddress(unit,_.reduce_pub(block.meta.validatorPub));
    const unit_validator_state:T.State = await S_Trie.get(unit_validator) || [];
    const targets = block.txs.concat(block.natives).concat(block.units);
    const tx_states:T.State[] = await P.reduce(targets,async (result:T.State[],tx:T.Tx)=>result.concat(await states_for_tx(tx,chain,S_Trie)),[]);
    const native_states:T.State[] = await P.map(block.natives,async (tx:T.Tx,i:number)=>await S_Trie.get(block.raws[block.txs.length+i].raw[1])||StateSet.CreateState(0,block.raws[block.txs.length+i].raw[1],native,0))
    const unit_states:T.State[] = await P.map(block.units,async (tx:T.Tx,i:number)=>{
        const remiter:T.State = await S_Trie.get(block.raws[block.txs.length+block.natives.length+i].raw[1])||StateSet.CreateState(0,block.raws[block.txs.length+block.natives.length+i].raw[1],unit,0);
        const items:T.Tx[] = JSON.parse(block.raws[block.txs.length+block.natives.length+i].raw[2]) || [TxSet.empty_tx()];
        const sellers:T.State[] = await P.map(items, async (it:T.Tx)=>await S_Trie.get(it.meta.data.payee)||StateSet.CreateState(0,it.meta.data.payee,unit,0));
        return sellers.concat(remiter);
    }) || [];
    const native_token = await S_Trie.get(native);
    const unit_token = await S_Trie.get(unit);
    const concated = tx_states.concat(native_validator_state).concat(unit_validator_state).concat(native_states).concat(unit_states).concat(native_token).concat(unit_token);
    return concated.reduce((result,state,index)=>{
        if(result.filter(val=>_.ObjectHash(val)===_.ObjectHash(state)).length>=2) return result.filter((val,i)=>index!=i)
        else return result;
    },concated);
}

export const locations_for_block = async (block:T.Block,chain:T.Block[],L_Trie:Trie)=>{
    const targets = block.txs.concat(block.natives).concat(block.units);
    const result:T.Location[] = await P.reduce(targets,async (result:T.Location[],tx:T.Tx)=>result.concat(await locations_for_tx(tx,chain,L_Trie)),[]);
    return result;
}

export const pure_to_tx = (pure:T.TxPure,block:T.Block):T.Tx=>{
    const index = block.txs.concat(block.natives).concat(block.units).indexOf(pure);
    if(index===-1) return TxSet.empty_tx();
    const raw = block.raws[index];
    return {
        hash:pure.hash,
        meta:pure.meta,
        raw:raw
    }
}

const random_chose = (array:any[], num:number)=>{
    for(let i = array.length - 1; i > 0; i--){
        let r = Math.floor(Math.random() * (i + 1));
        let tmp = array[i];
        array[i] = array[r];
        array[r] = tmp;
    }
    return array.slice(0,num);
}

export const tx_accept = async (tx:T.Tx,socket:IO)=>{
    const chain:T.Block[] = store.state.chain;
    const roots:{[key:string]:string} = store.state.roots;
    const stateroot = roots.stateroot;
    const S_Trie:Trie = trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = trie_ins(locationroot);
    const pool:T.Pool = store.state.pool;
    const states = await states_for_tx(tx,chain,S_Trie);
    const locations = await locations_for_tx(tx,chain,L_Trie);
    const new_pool = Tx_to_Pool(pool,tx,my_version,native,unit,chain,token_name_maxsize,states,locations);
    if(_.ObjectHash(new_pool)!=_.ObjectHash(pool)){
        store.commit("refresh_pool",new_pool);
        socket.emit('tx',JSON.stringify(tx))
    }
}

export const block_accept = async (block:T.Block,socket:IO)=>{
    const chain:T.Block[] = store.state.chain;
    const candidates:T.Candidates[] = store.state.candidates
    const roots:{[key:string]:string} = store.state.roots
    const stateroot = roots.stateroot;
    const S_Trie:Trie = trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = trie_ins(locationroot);
    const StateData = await states_for_block(block,chain,S_Trie);
    const LocationData = await locations_for_block(block,chain,L_Trie);
    const accepted = await BlockSet.AcceptBlock(block,chain,0,my_version,block_time,max_blocks,block_size,candidates,stateroot,locationroot,native,unit,rate,token_name_maxsize,StateData,LocationData);
    if(accepted.block.length>0){
        await P.forEach(accepted.state, async (state:T.State)=>{
            if(state.kind==="state") await S_Trie.put(state.owner,state);
            else await S_Trie.put(state.token,state);
        });
        await P.forEach(accepted.location, async (loc:T.Location)=>{
            await L_Trie.put(loc.address,loc);
        });
        const new_roots = {
            stateroot:S_Trie.now_root(),
            locationroot:L_Trie.now_root()
        }
        store.commit("refresh_roots",new_roots);
        store.commit("refresh_candidates",accepted.candidates);
        store.commit("add_block",accepted.block[0]);
        socket.emit('block',JSON.stringify(block));
    }
}

export const get_balance = async (address:string)=>{
    const S_Trie = trie_ins(store.state.roots.stateroot||"");
    const state:T.State = await S_Trie.get(address);
    if(state==null) return 0;
    return state.amount;
}

export const send_request_tx = async (to:string,amount:string,socket:IO)=>{
    try{
        const pub_key:string[] = [CryptoSet.PublicFromPrivate(store.state.secret)]
        const from:string = CryptoSet.GenereateAddress(native,_.reduce_pub(pub_key));
        const pre_tx = TxSet.CreateRequestTx(pub_key,from,10,"scrap",native,[from],["remit",to,"-"+amount],[],my_version,TxSet.empty_tx_pure().meta.pre,TxSet.empty_tx_pure().meta.next,10);
        const tx = TxSet.SignTx(pre_tx,store.state.secret,from);
        console.log(tx);
        const roots:{[key:string]:string} = store.state.roots
        const stateroot = roots.stateroot;
        const S_Trie:Trie = trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie:Trie = trie_ins(locationroot);
        const StateData = await states_for_tx(tx,store.state.chain,S_Trie);
        const LocationData = await locations_for_tx(tx,store.state.chain,L_Trie);
        if(!TxSet.ValidRequestTx(tx,my_version,native,unit,StateData,LocationData)) alert("invalid infomations");
        else{
            alert("remit!")
            /*const pool = store.state.pool;
            const new_pool = Object.assign({[tx.hash]:tx},pool);
            store.commit('refresh_pool',new_pool);*/
            socket.emit('tx',JSON.stringify(tx));
            /*await send_key_block(socket);
            await send_micro_block(socket);*/
        }
    }
    catch(e){
        console.log(e);
    }
}

export const send_refresh_tx = async (req_tx:T.Tx,index:number,code:string,socket:IO)=>{
    try{
        const roots:{[key:string]:string} = store.state.roots
        const stateroot = roots.stateroot;
        const S_Trie:Trie = trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie:Trie = trie_ins(locationroot);
        const pub_key:string[] = [CryptoSet.PublicFromPrivate(store.state.secret)]
        const payee = CryptoSet.GenereateAddress(native,_.reduce_pub(pub_key));
        const req_pure = TxSet.tx_to_pure(req_tx);
        const pre_states = await P.map(req_pure.meta.data.base,async (add:string)=>await S_Trie.get(add));
        const output_states = RunVM(code,pre_states,req_tx.raw.raw,req_pure,gas_limit);
        const output_raws = output_states.map(state=>JSON.stringify(state));
        const chain:T.Block[] = store.state.chain
        const pre_tx = TxSet.CreateRefreshTx(my_version,10,pub_key,pow_target,10,req_tx.hash,index,payee,output_raws,[],chain);
        const tx = TxSet.SignTx(pre_tx,store.state.secret,payee);
        const StateData = await states_for_tx(tx,chain,S_Trie);
        const LocationData = await locations_for_tx(tx,chain,L_Trie);
        if(!TxSet.ValidRefreshTx(tx,chain,my_version,native,unit,token_name_maxsize,StateData,LocationData)) console.log("fail to create valid refresh");
        else{
            console.log("create valid refresh tx");
            /*const pool = store.state.pool;
            const new_pool = Object.assign({[tx.hash]:tx},pool);
            store.commit('refresh_pool',new_pool);*/
            socket.emit('tx',JSON.stringify(tx));
        }
    }
    catch(e){
        console.log(e);
    }
}


export const send_key_block = async (socket:IO)=>{
    const chain:T.Block[] = store.state.chain;
    const pub_key:string[] = [CryptoSet.PublicFromPrivate(store.state.secret)];
    const candidates:T.Candidates[] = store.state.candidates;
    const roots:{[key:string]:string} = store.state.roots;
    const stateroot = roots.stateroot;
    const S_Trie:Trie = trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = trie_ins(locationroot);
    const validator_state = [await S_Trie.get(CryptoSet.GenereateAddress(unit,_.reduce_pub(pub_key)))] || [];
    const pre_block = BlockSet.CreateKeyBlock(my_version,0,chain,block_time,max_blocks,pow_target,pos_diff,unit,pub_key,_.ObjectHash(candidates),stateroot,locationroot,validator_state);
    const key_block = BlockSet.SignBlock(pre_block,store.state.secret,pub_key[0]);
    const StateData = await states_for_block(key_block,chain,S_Trie);
    const LocationData = await locations_for_block(key_block,chain,L_Trie);
    const accepted = BlockSet.AcceptBlock(key_block,chain,0,my_version,block_time,max_blocks,block_size,candidates,stateroot,locationroot,native,unit,rate,token_name_maxsize,StateData,LocationData);
    if(accepted.block.length===0) console.log("fail to create valid block");
    else{
        /*await P.forEach(accepted.state, async (state:T.State)=>{
            if(state.kind==="state") await S_Trie.put(state.owner,state);
            else await S_Trie.put(state.token,state);
        });
        await P.forEach(accepted.location, async (loc:T.Location)=>{
            await L_Trie.put(loc.address,loc);
        });
        const new_roots = {
            stateroot:S_Trie.now_root(),
            locationroot:L_Trie.now_root()
        }
        console.log("create key block");
        store.commit("refresh_roots",new_roots);
        store.commit("refresh_candidates",accepted.candidates);
        store.commit("add_block",key_block);*/
        socket.emit('block',JSON.stringify(key_block));
        //await send_micro_block(socket);
    }
}

export const send_micro_block = async (socket:IO)=>{
    const pool:T.Pool = store.state.pool;
    const splited:T.Tx[] = random_chose(Object.values(pool),block_size/100);
    const reduced = splited.reduce((result:{txs:T.Tx[],natives:T.Tx[],units:T.Tx[]},tx)=>{
        if(tx.meta.data.token===native) result.natives.push(tx);
        else if(tx.meta.data.token===unit) result.units.push(tx);
        else result.txs.push(tx);
        return result;
    },{txs:[],natives:[],units:[]});
    while(1){
        let chain:T.Block[] = store.state.chain;
        let pub_key:string[] = [CryptoSet.PublicFromPrivate(store.state.secret)];
        let candidates:T.Candidates[] = store.state.candidates;
        let roots:{[key:string]:string} = store.state.roots;
        let stateroot = roots.stateroot;
        let S_Trie:Trie = trie_ins(stateroot);
        let locationroot = roots.locationroot;
        let L_Trie:Trie = trie_ins(locationroot);
        let txs = reduced.txs;
        let natives = reduced.natives;
        let units = reduced.units;
        let pre_block = BlockSet.CreateMicroBlock(my_version,0,chain,pow_target,pos_diff,pub_key,_.ObjectHash(candidates),stateroot,locationroot,txs,natives,units,block_time);
        let micro_block = BlockSet.SignBlock(pre_block,store.state.secret,pub_key[0]);
        let StateData = await states_for_block(micro_block,chain,S_Trie);
        let LocationData = await locations_for_block(micro_block,chain,L_Trie);
        let accepted = BlockSet.AcceptBlock(micro_block,chain,0,my_version,block_time,max_blocks,block_size,candidates,stateroot,locationroot,native,unit,rate,token_name_maxsize,StateData,LocationData);
        if(accepted.block.length===0){console.log("fail to create valid block");break;};
        /*await P.forEach(accepted.state, async (state:T.State)=>{
            if(state.kind==="state") await S_Trie.put(state.owner,state);
            else await S_Trie.put(state.token,state);
        });
        await P.forEach(accepted.location, async (loc:T.Location)=>{
            await L_Trie.put(loc.address,loc);
        });

        let new_roots = {
            stateroot:S_Trie.now_root(),
            locationroot:L_Trie.now_root()
        }
        let new_pool = ((pool:T.Pool)=>{
            micro_block.txs.concat(micro_block.natives).concat(micro_block.units).forEach(tx=>{
                delete pool[tx.hash];
            });
            return pool;
        })(Object.assign({},store.state.pool));
        store.commit("refresh_pool",new_pool);
        store.commit("refresh_roots",new_roots);
        store.commit("refresh_candidates",accepted.candidates);
        store.commit("add_block",micro_block);*/
        socket.emit('block',JSON.stringify(micro_block));
        console.log("create micro block");
        /*const reqs_pure = micro_block.txs.filter(tx=>tx.meta.kind==="request").concat(micro_block.natives.filter(tx=>tx.meta.kind==="request")).concat(micro_block.units.filter(tx=>tx.meta.kind==="request"));
        if(reqs_pure.length>0){
            await P.forEach(reqs_pure,async (pure:T.TxPure)=>{
                console.log("refresh!")
                const req_tx = pure_to_tx(pure,micro_block);
                const code:string = store.state.code[req_tx.meta.data.token]
                await send_refresh_tx(req_tx,micro_block.meta.index,code,socket);
            })
        }
        if(Object.keys(new_pool).length===0){console.log("no transaction in pool");break;}*/
    }
}