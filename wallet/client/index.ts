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
import { Socket } from 'net';

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
    console.log(tx);
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
    const native_states:T.State[] = await P.map(block.natives,async (tx:T.Tx)=>{
        const key = (()=>{
            if(tx.meta.kind==="request") return tx.hash;
            else return tx.meta.data.request;
        })()
        const b = (()=>{
            if(tx.meta.kind==="request") return block;
            else return chain[tx.meta.data.index] || BlockSet.empty_block();
        })();
        const i = b.natives.map(t=>t.hash).indexOf(key);
        const raw = b.raws[b.txs.length+i] || TxSet.empty_tx().raw;
        return await S_Trie.get(raw.raw[1])||StateSet.CreateState(0,raw.raw[1],native,0);
    });
    const unit_states:T.State[] = await P.map(block.units,async (tx:T.Tx)=>{
        const key = (()=>{
            if(tx.meta.kind==="request") return tx.hash;
            else return tx.meta.data.request;
        })()
        const b = (()=>{
            if(tx.meta.kind==="request") return block;
            else return chain[tx.meta.data.index] || BlockSet.empty_block();
        })();
        const i = b.units.map(t=>t.hash).indexOf(key);
        const raw = b.raws[b.txs.length+b.natives.length+i] || TxSet.empty_tx().raw;
        const remiter:T.State = await S_Trie.get(raw.raw[1])||StateSet.CreateState(0,raw.raw[1],unit,0);
        const items:T.Tx[] = JSON.parse(raw.raw[2]) || [TxSet.empty_tx()];
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

export const tx_accept = async (tx:T.Tx,chain:T.Block[],roots:{[key:string]:string},pool:T.Pool,secret:string,validator_mode:boolean,candidates:T.Candidates[],socket:IO)=>{
    const stateroot = roots.stateroot;
    const S_Trie:Trie = trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = trie_ins(locationroot);
    const states = await states_for_tx(tx,chain,S_Trie) || [];
    const locations = await locations_for_tx(tx,chain,L_Trie) || [];
    const new_pool = Tx_to_Pool(pool,tx,my_version,native,unit,chain,token_name_maxsize,states,locations);
    const unit_address = CryptoSet.GenereateAddress(unit,_.reduce_pub([CryptoSet.PublicFromPrivate(secret)]));
    const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0,{},[]);
    const unit_amount = unit_state.amount;
    if(_.ObjectHash(new_pool)!=_.ObjectHash(pool)&&unit_amount>0){
        store.commit("refresh_pool",new_pool);
        if(validator_mode&&tx.meta.kind==="refresh") await send_micro_block(Object.assign({},new_pool),secret,chain.slice(),candidates.slice(),Object.assign({},roots),socket);
        else await send_key_block(chain.slice(),secret,candidates.slice(),Object.assign({},roots),socket);
        //socket.emit('tx',JSON.stringify(tx))
        return new_pool;
    }
    else return pool;
}

export const block_accept = async (block:T.Block,chain:T.Block[],candidates:T.Candidates[],roots:{[key:string]:string},pool:T.Pool,codes:{[key:string]:string},secret:string,socket:IO)=>{
    try{
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
            const new_pool = ((p)=>{
                block.txs.concat(block.natives).concat(block.units).forEach(tx=>{
                    delete p[tx.hash];
                });
                return p;
            })(pool);
            await store.commit('refresh_pool',new_pool);
            await store.commit("refresh_roots",new_roots);
            await store.commit("refresh_candidates",accepted.candidates);
            await store.commit("add_block",accepted.block[0]);
            //socket.emit('block',JSON.stringify(block));
            const reqs_pure = block.txs.filter(tx=>tx.meta.kind==="request").concat(block.natives.filter(tx=>tx.meta.kind==="request")).concat(block.units.filter(tx=>tx.meta.kind==="request"));
            await send_micro_block(Object.assign({},new_pool),secret,chain.concat(accepted.block[0]),accepted.candidates.slice(),Object.assign({},new_roots),socket);
            if(reqs_pure.length>0){
                await P.forEach(reqs_pure,async (pure:T.TxPure)=>{
                    console.log("refresh!")
                    const req_tx = pure_to_tx(pure,block);
                    const code:string = codes[req_tx.meta.data.token]
                    await send_refresh_tx(Object.assign({},new_roots),secret,req_tx,block.meta.index,code,chain.concat(accepted.block[0]),socket);
                });
            }
            return {
                pool:new_pool,
                roots:new_roots,
                candidates:accepted.candidates,
                chain:chain.concat(accepted.block[0]),
            }
        }
        else{
            console.log("receive invalid block")
            return{
                pool:pool,
                roots:roots,
                candidates:candidates,
                chain:chain
            }
        }
    }
    catch(e){console.log(e)}
}

export const tx_check = (block:T.Block,chain:T.Block[],StateData:T.State[],LocationData:T.Location[])=>{
    const txs = block.txs.map((tx,i):T.Tx=>{
        return {
            hash:tx.hash,
            meta:tx.meta,
            raw:block.raws[i]
        }
    });
    const natives:T.Tx[] = block.natives.map((n,i)=>{
        return {
            hash:n.hash,
            meta:n.meta,
            raw:block.raws[i]
        }
    });
    const units:T.Tx[] = block.units.map((u,i)=>{
        return {
            hash:u.hash,
            meta:u.meta,
            raw:block.raws[i]
        }
    });

    const target = txs.concat(natives).concat(units);
    return target.reduce((num:number,tx:T.Tx,i)=>{
        if(tx.meta.kind==="request"&&!TxSet.ValidRequestTx(tx,my_version,native,unit,StateData,LocationData)){
            return i;
        }
        else if(tx.meta.kind==="refresh"&&!TxSet.ValidRefreshTx(tx,chain,my_version,native,unit,token_name_maxsize,StateData,LocationData)){
            return i;
        }
        else return num;
    },-1);
}

export const get_balance = async (address:string)=>{
    const S_Trie = trie_ins(store.state.roots.stateroot||"");
    const state:T.State = await S_Trie.get(address);
    if(state==null) return 0;
    return state.amount;
}

export const send_request_tx = async (secret:string,to:string,amount:string,roots:{[key:string]:string},chain:T.Block[],socket:IO)=>{
    try{
        const pub_key:string[] = [CryptoSet.PublicFromPrivate(secret)]
        const from:string = CryptoSet.GenereateAddress(native,_.reduce_pub(pub_key));
        const pre_tx = TxSet.CreateRequestTx(pub_key,from,10,"scrap",native,[from],["remit",to,"-"+amount],[],my_version,TxSet.empty_tx_pure().meta.pre,TxSet.empty_tx_pure().meta.next,0.0000000001);
        const tx = TxSet.SignTx(pre_tx,secret,from);
        const stateroot = roots.stateroot;
        const S_Trie:Trie = trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie:Trie = trie_ins(locationroot);
        const StateData = await states_for_tx(tx,chain,S_Trie);
        const LocationData = await locations_for_tx(tx,chain,L_Trie);
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

export const send_refresh_tx = async (roots:{[key:string]:string},secret:string,req_tx:T.Tx,index:number,code:string,chain:T.Block[],socket:IO)=>{
    try{
        const stateroot = roots.stateroot;
        const S_Trie:Trie = trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie:Trie = trie_ins(locationroot);
        const pub_key:string[] = [CryptoSet.PublicFromPrivate(secret)]
        const payee = CryptoSet.GenereateAddress(native,_.reduce_pub(pub_key));
        const req_pure = TxSet.tx_to_pure(req_tx);
        const pre_states = await P.map(req_pure.meta.data.base,async (add:string)=>await S_Trie.get(add));
        const output_states = RunVM(code,pre_states,req_tx.raw.raw,req_pure,gas_limit);
        const output_raws = output_states.map(state=>JSON.stringify(state));
        const pre_tx = TxSet.CreateRefreshTx(my_version,10,pub_key,pow_target,0.0000000001,req_tx.hash,index,payee,output_raws,[],chain);
        const tx = TxSet.SignTx(pre_tx,secret,payee);
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


export const send_key_block = async (chain:T.Block[],secret:string,candidates:T.Candidates[],roots:{[key:string]:string},socket:IO)=>{
    const pub_key:string[] = [CryptoSet.PublicFromPrivate(secret)];
    const stateroot = roots.stateroot;
    const S_Trie:Trie = trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = trie_ins(locationroot);
    const validator_address = CryptoSet.GenereateAddress(unit,_.reduce_pub(pub_key))
    const validator_state = [await S_Trie.get(validator_address)||StateSet.CreateState(0,validator_address,unit,0,{},[])];
    const pre_block = BlockSet.CreateKeyBlock(my_version,0,chain,block_time,max_blocks,pow_target,pos_diff,unit,pub_key,_.ObjectHash(candidates),stateroot,locationroot,validator_state);
    const key_block = BlockSet.SignBlock(pre_block,secret,pub_key[0]);
    const StateData = await states_for_block(key_block,chain,S_Trie);
    const LocationData = await locations_for_block(key_block,chain,L_Trie);
    const accepted = BlockSet.AcceptBlock(key_block,chain,0,my_version,block_time,max_blocks,block_size,candidates,stateroot,locationroot,native,unit,rate,token_name_maxsize,StateData,LocationData);
    if(accepted.block.length===0) console.log("fail to create valid block");
    else{
        socket.emit('block',JSON.stringify(key_block));
    }
}

export const send_micro_block = async (pool:T.Pool,secret:string,chain:T.Block[],candidates:T.Candidates[],roots:{[key:string]:string},socket:IO)=>{
    if(Object.keys(pool).length>0){
        const stateroot = roots.stateroot;
        const S_Trie:Trie = trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie:Trie = trie_ins(locationroot);
        const splited:T.Tx[] = random_chose(Object.values(pool),block_size/100);
        const not_same = splited.reduce((result:T.Tx[],tx)=>{
            const bases = result.reduce((r:string[],t)=>{
                if(t.meta.kind==="request") return r.concat(t.meta.data.base);
                else return r;
            },[]);
            const requests = result.reduce((r:string[],t)=>{
                if(t.meta.kind==="refresh") return r.concat(t.meta.data.request);
                else return r;
            },[]);
            if(tx.meta.kind==="request"&&!bases.some(b=>tx.meta.data.base.indexOf(b)!=-1)) return result.concat(tx);
            else if(tx.meta.kind==="refresh"&&requests.indexOf(tx.meta.data.request)===-1) return result.concat(tx);
            else return result;
        },[]);
        const reduced = not_same.reduce((result:{txs:T.Tx[],natives:T.Tx[],units:T.Tx[]},tx)=>{
            if(tx.meta.data.token===native) result.natives.push(tx);
            else if(tx.meta.data.token===unit) result.units.push(tx);
            else result.txs.push(tx);
            return result;
        },{txs:[],natives:[],units:[]});
        const pub_key:string[] = [CryptoSet.PublicFromPrivate(secret)];
        chain.sort((a:T.Block,b:T.Block)=>{
            return a.meta.index - b.meta.index;
        });;
        const txs = reduced.txs;
        const natives = reduced.natives;
        const units = reduced.units;
        const pre_block = BlockSet.CreateMicroBlock(my_version,0,chain,pow_target,pos_diff,pub_key,_.ObjectHash(candidates),stateroot,locationroot,txs,natives,units,block_time);
        const micro_block = BlockSet.SignBlock(pre_block,secret,pub_key[0]);
        const StateData = await states_for_block(micro_block,chain,S_Trie);
        const LocationData = await locations_for_block(micro_block,chain,L_Trie);
        //console.log(BlockSet.ValidMicroBlock(micro_block,chain,0,my_version,candidates,stateroot,locationroot,block_time,max_blocks,block_size,native,unit,token_name_maxsize,StateData,LocationData))
        const invalid_index = tx_check(micro_block,chain,StateData,LocationData);
        const block_check = BlockSet.ValidMicroBlock(micro_block,chain,0,my_version,candidates,stateroot,locationroot,block_time,max_blocks,block_size,native,unit,token_name_maxsize,StateData,LocationData);
        if(invalid_index===-1&&block_check){
            /*const new_pool = ((p)=>{
                micro_block.txs.concat(micro_block.natives).concat(micro_block.units).forEach(tx=>{
                    delete p[tx.hash];
                });
                return p;
            })(pool);
            store.commit('refresh_pool',new_pool);*/
            socket.emit('block',JSON.stringify(micro_block));
            console.log("create micro block");
            //await send_micro_block(socket);
        }
        else if(invalid_index!=-1){
            const target_pure = micro_block.txs.concat(micro_block.natives).concat(micro_block.units)[invalid_index];
            const del_pool = ((p)=>{
                delete p[target_pure.hash];
                return p;
            })(Object.assign({},pool));
            store.commit("refresh_pool",del_pool);
            await send_micro_block(del_pool,secret,chain,candidates,roots,socket);
        }
        else{console.log("fall to create micro block;");}
    }else store.commit('validator_time');
}

export const check_chain = async (new_chain:T.Block[],my_chain:T.Block[],pool:T.Pool,roots:{[key:string]:string},candidates:T.Candidates[],codes:{[key:string]:string},secret:string,socket:IO)=>{
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
        console.log("add_block:");
        console.log(add_blocks);
        store.commit("replace_chain",back_chain);
        const info = {
            pool:pool,
            roots:roots,
            candidates:candidates,
            chain:back_chain
        }
        await P.reduce(add_blocks,async (result:{pool:T.Pool,roots:{[key:string]:string},candidates:T.Candidates[],chain:T.Block[]},block:T.Block)=>{
            const accepted = await block_accept(block,result.chain.slice(),result.candidates.slice(),result.roots,result.pool,codes,secret,socket);
            const amount = await get_balance(store.getters.my_address);
            store.commit("refresh_balance",amount);
            return accepted;
        },info);
    }else console.log("not replace")
}

