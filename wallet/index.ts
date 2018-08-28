import * as T from '../core/types'
import * as _ from '../core/basic'
import * as CryptoSet from '../core/crypto_set'
import {Trie} from '../core/merkle_patricia'
import * as StateSet from '../core/state'
import * as TxSet from '../core/tx'
import * as BlockSet from '../core/block'
import * as P from 'p-iteration'
import * as gen from '../genesis/index';
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate, all_issue} from './con'
import { Tx_to_Pool } from '../core/tx_pool';
import * as fs from 'fs'
import * as db from './db'
import { Server } from 'socket.io'

fs.writeFileSync('./json/tx_pool.json',"{}");
fs.writeFileSync('./json/root.json',JSON.stringify(gen.roots,null, '    '));
fs.writeFileSync('./json/candidates.json',JSON.stringify(gen.candidates,null, '    '));
fs.writeFileSync('./json/blockchain.json',JSON.stringify([gen.block],null, '    '));

(async ()=>{
    const S_Trie = db.trie_ins("");
    await P.forEach(gen.state, async (state:T.State)=>{
        if(state.kind==="state") await S_Trie.put(state.owner,state);
        else await S_Trie.put(state.token,state);
    });
})();

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
    const targets = block.txs.concat(block.natives).concat(block.units).map(pure=>pure_to_tx(pure,block));
    const tx_states:T.State[] = await P.reduce(targets,async (result:T.State[],tx:T.Tx)=>result.concat(await states_for_tx(tx,chain,S_Trie)),[]);
    const native_states:T.State[] = await P.map(block.natives,async (tx:T.Tx,i:number)=>{
        const b = (()=>{
            if(tx.meta.kind==="request") return block;
            else return chain[tx.meta.data.index];
        })() || BlockSet.empty_block();
        console.log(tx.meta.data.index)
        const raw = b.raws[b.txs.length+i] || TxSet.empty_tx().raw;
        return await S_Trie.get(raw.raw[1])||StateSet.CreateState(0,raw.raw[1],native,0);
    });
    const unit_states:T.State[] = await P.map(block.units,async (tx:T.Tx,i:number)=>{
        const b = (()=>{
            if(tx.meta.kind==="request") return block;
            else return chain[tx.meta.data.index];
        })() || BlockSet.empty_block();
        const remiter:T.State = await S_Trie.get(b.raws[b.txs.length+b.natives.length+i].raw[1])||StateSet.CreateState(0,b.raws[b.txs.length+b.natives.length+i].raw[1],unit,0);
        const items:T.Tx[] = JSON.parse(b.raws[b.txs.length+b.natives.length+i].raw[2]) || [TxSet.empty_tx()];
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

export const tx_accept = async (tx:T.Tx,socket:Server)=>{
    console.log(tx);
    const chain = JSON.parse(fs.readFileSync('./json/blockchain.json','utf-8')) || [gen.block];
    const roots = JSON.parse(fs.readFileSync('./json/root.json','utf-8')) || gen.roots;
    const stateroot = roots.stateroot;
    const S_Trie = db.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = db.trie_ins(locationroot);
    const pool:T.Pool = JSON.parse(fs.readFileSync('./json/tx_pool.json','utf-8')) || {};
    const states = await states_for_tx(tx,chain,S_Trie);
    const locations = await locations_for_tx(tx,chain,L_Trie);
    const new_pool = Tx_to_Pool(pool,tx,my_version,native,unit,chain,token_name_maxsize,states,locations);
    if(_.ObjectHash(new_pool)!=_.ObjectHash(pool)){
        fs.writeFileSync('./json/tx_pool.json',JSON.stringify(_.copy(new_pool),null, '    '));
        console.log("receive valid tx");
        socket.emit('tx',JSON.stringify(tx))
    }
}


export const block_accept = async (block:T.Block,socket:Server)=>{
    try{
    const chain:T.Block[] = JSON.parse(fs.readFileSync('./json/blockchain.json','utf-8')) || [gen.block];
    console.log(block);
    const candidates:T.Candidates[] = JSON.parse(fs.readFileSync('./json/candidates.json','utf-8')) || gen.candidates;
    const roots:{[key:string]:string} = JSON.parse(fs.readFileSync('./json/root.json','utf-8')) || gen.roots;
    const stateroot = roots.stateroot;
    const S_Trie:Trie = db.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = db.trie_ins(locationroot);
    const StateData = await states_for_block(block,chain,S_Trie);
    const LocationData = await locations_for_block(block,chain,L_Trie);
    const accepted = BlockSet.AcceptBlock(block,chain,0,my_version,block_time,max_blocks,block_size,candidates,stateroot,locationroot,native,unit,rate,token_name_maxsize,all_issue,StateData,LocationData);
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
        const pool:T.Pool = JSON.parse(fs.readFileSync('./json/tx_pool.json','utf-8')) || {};
        const new_pool = ((p)=>{
            block.txs.concat(block.natives).concat(block.units).forEach(tx=>{
                delete p[tx.hash];
            });
            return p;
        })(pool);
        fs.writeFileSync('./json/tx_pool.json',JSON.stringify(_.copy(new_pool),null, '    '));
        fs.writeFileSync('./json/root.json',JSON.stringify(_.copy(new_roots),null, '    '));
        fs.writeFileSync('./json/candidates.json',JSON.stringify(accepted.candidates.slice(),null, '    '));
        fs.writeFileSync('./json/blockchain.json',JSON.stringify(chain.slice().concat(accepted.block),null, '    '));
        console.log("received valid block")
        socket.emit('block',JSON.stringify(_.copy(block)));
    }
    else console.log("receive invalid block");
    }
    catch(e){console.log(e)}
}

const get_pre_info = async (block:T.Block,chain:T.Block[])=>{
    const pre_block = chain[chain.length-1];
    const S_Trie = db.trie_ins(pre_block.meta.stateroot);
    const StateData = await states_for_block(pre_block,chain,S_Trie);
    const L_Trie = db.trie_ins(pre_block.meta.locationroot);
    const LocationData = await locations_for_block(pre_block,chain,L_Trie);
    const candidates = BlockSet.NewCandidates(unit,rate,StateData);
    const accepted = await BlockSet.AcceptBlock(block,chain,0,my_version,block_time,max_blocks,block_size,candidates,S_Trie.now_root(),L_Trie.now_root(),native,unit,rate,token_name_maxsize,all_issue,StateData,LocationData);
    await P.forEach(accepted.state, async (state:T.State)=>{
        if(state.kind==="state") await S_Trie.put(state.owner,state);
        else await S_Trie.put(state.token,state);
    });
    await P.forEach(accepted.location, async (loc:T.Location)=>{
        await L_Trie.put(loc.address,loc);
    });
    const pre_root = {
        stateroot:S_Trie.now_root(),
        locationroot:L_Trie.now_root()
    }
    return [pre_root,accepted.candidates];
}

export const check_chain = async (new_chain:T.Block[],my_chain:T.Block[],socket:Server)=>{
    if(new_chain.length>my_chain.length){
        const news = new_chain.slice().reverse();
        let target:T.Block[] = [];
        for(let index in news){
            let i = Number(index);
            if(my_chain[news.length-i-1]!=null&&_.ObjectHash(my_chain[news.length-i-1])===_.ObjectHash(news[i])) break;
            else if(news[i].meta.kind==="key") target.push(news[i]);
            else if(news[i].meta.kind==="micro") target.push(news[i]);
        }
        const add_blocks = target.slice().reverse();
        const back_chain = my_chain.slice(0,add_blocks[0].meta.index);
        fs.writeFileSync('./json/blockchain.json',JSON.stringify(back_chain,null, '    '));
        const info = await (async ()=>{
            if(back_chain.length===1){
                return{
                    roots:gen.roots,
                    candidates:gen.candidates
                }
            }
            console.log(back_chain.length)
            const pre_info = await get_pre_info(back_chain[back_chain.length-1],back_chain);
            return {
                roots:pre_info[0],
                candidates:pre_info[1]
            }
        })();
        fs.writeFileSync('./json/root.json',JSON.stringify(_.copy(info).roots,null, '    '));
        fs.writeFileSync('./json/candidates.json',JSON.stringify(_.copy(info).candidates,null, '    '));
        await P.forEach(add_blocks,async (block:T.Block)=>{
            await block_accept(_.copy(block),socket);
        });
    }
}