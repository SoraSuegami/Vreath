import * as T from '../../core/types'
import * as _ from '../../core/basic'
import * as CryptoSet from '../../core/crypto_set'
import {Trie} from '../../core/merkle_patricia'
import * as TxSet from '../../core/tx'
import * as BlockSet from '../../core/block'
import * as P from 'p-iteration'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate} from '../con'
import { Tx_to_Pool } from '../../core/tx_pool';
import {store} from './script'
import level from 'level-browserify'
import * as gen from '../../genesis/index';
import {IO} from 'rxjs-socket.io'

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
    const target = concated.reduce((result,key,i)=>{
        if(result.filter(val=>val===key).length>=2) return result.splice(i,1);
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
    const native_validator_state:T.State = await S_Trie.get(native_validator);
    const unit_validator = CryptoSet.GenereateAddress(unit,_.reduce_pub(block.meta.validatorPub));
    const unit_validator_state:T.State = await S_Trie.get(unit_validator);
    const targets = block.txs.concat(block.natives).concat(block.units);
    const tx_states:T.State[] = P.map(targets,async (tx:T.Tx)=>await states_for_tx(tx,chain,S_Trie));
    const native_states:T.State[] = P.map(block.natives,async (tx:T.Tx)=>await S_Trie.get(tx.raw.raw[1]))
    const unit_states:T.State[] = P.map(block.units,async (tx:T.Tx)=>{
        const remiter:T.State = await S_Trie.get(tx.raw.raw[1]);
        const items:T.Tx[] = JSON.parse(tx.raw.raw[2]) || [TxSet.empty_tx()];
        const sellers:T.State[] = P.map(items, async (it:T.Tx)=>await S_Trie.get(it.meta.data.payee));
        return sellers.concat(remiter);
    });
    const native_token = await S_Trie.get(native);
    const unit_token = await S_Trie.get(unit);
    const concated = tx_states.concat(native_validator_state).concat(unit_validator_state).concat(native_states).concat(unit_states).concat(native_token).concat(unit_token);
    return concated.reduce((result,state,i)=>{
        if(result.filter(val=>val===state).length>=2) return result.splice(i,1);
        else return result;
    },concated);
}

export const locations_for_block = async (block:T.Block,chain:T.Block[],L_Trie:Trie)=>{
    const targets = block.txs.concat(block.natives).concat(block.units);
    const result:T.Location[] = P.map(targets,async (tx:T.Tx)=>await locations_for_tx(tx,chain,L_Trie));
    return result;
}

export const tx_accept = async (tx:T.Tx)=>{
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
    store.commit("pool",new_pool);
}

export const block_accept = async (block:T.Block)=>{
    const chain:T.Block[] = store.state.chain
    const candidates:T.Candidates[] = store.state.candidates
    const roots:{[key:string]:string} = store.state.roots
    const stateroot = roots.stateroot;
    const S_Trie:Trie = trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = trie_ins(locationroot);
    const StateData = await states_for_block(block,chain,S_Trie);
    const LocationData = await locations_for_block(block,chain,L_Trie);
    const accepted = await BlockSet.AcceptBlock(block,chain,0,my_version,block_time,max_blocks,block_size,candidates,stateroot,locationroot,native,unit,rate,token_name_maxsize,StateData,LocationData);
    P.forEach(accepted.state, async (state:T.State)=>{
        if(state.kind==="state") await S_Trie.put(state.owner,state);
        else await S_Trie.put(state.token,state);
    });
    P.forEach(accepted.location, async (loc:T.Location)=>{
        await L_Trie.put(loc.address,loc);
    });
    const new_roots = {
        stateroot:S_Trie.now_root(),
        locationroot:L_Trie.now_root()
    }
    store.commit("roots",new_roots);
    store.commit("candidates",accepted.candidates);
    store.commit("chain",chain.concat(accepted.block));
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
            store.commit('refresh_pool',tx);
            socket.emit('tx',JSON.stringify(tx));
        }
    }
    catch(e){
        console.log(e);
    }
}