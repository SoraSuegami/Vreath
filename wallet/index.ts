import * as T from '../core/types'
import * as _ from '../core/basic'
import * as CryptoSet from '../core/crypto_set'
import {Trie} from '../core/merkle_patricia'
import * as StateSet from '../core/state'
import * as TxSet from '../core/tx'
import * as BlockSet from '../core/block'
import * as P from 'p-iteration'
import { state } from '../genesis';
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate} from './con'
import { Tx_to_Pool } from '../core/tx_pool';
import * as db from './db'


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
    const target = base.concat(outputs).concat(payes);
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
    return concated.reduce((result:T.State[],state)=>{
        if(concated.indexOf(state)!=-1) return result.concat(state);
        else return result;
    },[]);
}

export const locations_for_block = async (block:T.Block,chain:T.Block[],L_Trie:Trie)=>{
    const targets = block.txs.concat(block.natives).concat(block.units);
    const result:T.Location[] = P.map(targets,async (tx:T.Tx)=>await locations_for_tx(tx,chain,L_Trie));
    return result;
}

export const tx_accept = async (tx:T.Tx)=>{
    const chain:T.Block[] = await db.get('chain');
    const roots:{[key:string]:string} = await db.get('roots');
    const stateroot = roots.stateroot;
    const S_Trie:Trie = db.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = db.trie_ins(locationroot);
    const pool:T.Pool = await db.get('pool');
    const states = await states_for_tx(tx,chain,S_Trie);
    const locations = await locations_for_tx(tx,chain,L_Trie);
    const new_pool = Tx_to_Pool(pool,tx,my_version,native,unit,chain,token_name_maxsize,states,locations);
    await db.put('pool',new_pool);
}

export const block_accept = async (block:T.Block)=>{
    const chain:T.Block[] = await db.get('chain');
    const candidates:T.Candidates[] = await db.get('candidates');
    const roots:{[key:string]:string} = await db.get('roots');
    const stateroot = roots.stateroot;
    const S_Trie:Trie = db.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = db.trie_ins(locationroot);
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
    await db.put('roots',new_roots);
    await db.put('candidates',accepted.candidates);
    await db.put('chain',chain.concat(accepted.block));
}