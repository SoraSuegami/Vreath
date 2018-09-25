import * as T from '../../core/types'
import * as _ from '../../core/basic'
import * as CryptoSet from '../../core/crypto_set'
import {Trie} from '../../core/merkle_patricia'
import * as TxSet from '../../core/tx'
import * as BlockSet from '../../core/block'
import * as StateSet from '../../core/state'
import * as P from 'p-iteration'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate, pow_target,pos_diff,all_issue} from '../con'
import { Tx_to_Pool } from '../../core/tx_pool';
import {store} from './script'
import level from 'level-browserify'
import * as gen from '../../genesis/index';
import { RunVM } from '../../core/code';
import { client } from './script'
import {BigNumber} from 'bignumber.js'



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
    const base_states:T.State[] = await P.reduce(base, async (result:T.State[],key:string)=>{
        const getted:T.State = await S_Trie.get(key);
        if(getted==null){
            const token = key.split(':')[1];
            //if(_.address_form_check(key,token_name_maxsize)) return result.concat(StateSet.CreateToken(0,token));
            return result.concat(StateSet.CreateState(0,key,token,0));
        }
        else return result.concat(getted);
    },[]);
    const outputs = output_keys(tx);
    const output_states:T.State[] = await P.reduce(outputs, async (result:T.State[],key:string)=>{
        const getted:T.State = await S_Trie.get(key);
        if(getted==null) return result;
        else return result.concat(getted);
    },[]);
    const payes = pays(tx,chain);
    const pay_states:T.State[] = await P.reduce(payes, async (result:T.State[],key:string)=>{
        const getted:T.State = await S_Trie.get(key);
        if(getted==null) return result.concat(StateSet.CreateState(0,key,native,0));
        else return result.concat(getted);
    },[]);
    console.log(pay_states);
    const concated = base_states.concat(output_states).concat(pay_states);
    console.log(concated);
    const hashes = concated.map(state=>_.ObjectHash(state));
    return concated.filter((val,i)=>hashes.indexOf(_.ObjectHash(val))===i);
}

export const locations_for_tx = async (tx:T.Tx,chain:T.Block[],L_Trie:Trie)=>{
    const target = (()=>{
        if(tx.meta.kind==="request") return tx;
        else return TxSet.find_req_tx(tx,chain);
    })();
    const keys = target.meta.data.base.filter((val,i,array)=>array.indexOf(val)===i);
    const result:T.Location[] = await P.reduce(keys, async (array:T.Location[],key:string)=>{
        if(key.split(':')[2]===_.toHash('')) return array;
        const getted:T.Location = await L_Trie.get(key);
        if(getted==null){
            const new_loc:T.Location = {
                address:key,
                state:'yet',
                index:0,
                hash:_.toHash('')
            }
            return array.concat(new_loc);
        }
        else return array.concat(getted);
    },[]);
    /*Object.values(await L_Trie.filter(key=>{
        if(target.meta.data.base.indexOf(key)!=-1) return true;
        else if(target.meta.data.solvency===key&&target.meta.data.base.indexOf(key)===-1) return true;
        else return false;
    }));*/
    return result;
}

export const states_for_block = async (block:T.Block,chain:T.Block[],S_Trie:Trie)=>{
    const native_validator = CryptoSet.GenereateAddress(native,_.reduce_pub(block.meta.validatorPub));
    const native_validator_state:T.State = await S_Trie.get(native_validator) || StateSet.CreateState(0,native_validator,native);
    const unit_validator = CryptoSet.GenereateAddress(unit,_.reduce_pub(block.meta.validatorPub));
    const unit_validator_state:T.State = await S_Trie.get(unit_validator) || StateSet.CreateState(0,unit_validator,unit);
    const targets = block.txs.concat(block.natives).concat(block.units).map(pure=>TxSet.pure_to_tx(pure,block));
    const tx_states:T.State[] = await P.reduce(targets,async (result:T.State[],tx:T.Tx)=>result.concat(await states_for_tx(tx,chain,S_Trie)),[]);
    /*const native_states:T.State[] = await P.map(block.natives,async (tx:T.Tx)=>{
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
    const unit_states:T.State[] = await P.reduce(block.units,async (result:T.State[],tx:T.Tx)=>{
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
        const remiter:T.State = await S_Trie.get(raw.raw[1])||StateSet.CreateState(0,raw.raw[1],native,0);
        const units:T.Unit[] = JSON.parse(raw.raw[2]||"[]");
        const sellers:T.State[] = await P.map(units, async (u:T.Unit)=>await S_Trie.get(u.payee)||StateSet.CreateState(0,u.payee,native,0));
        return result.concat(sellers).concat(remiter);
    },[]) || [];*/
    const all_units:T.State[] = Object.values(await S_Trie.filter((key,state:T.State)=>{
        return state.kind==="state"&&state.token===unit;
    }));
    const native_token = await S_Trie.get("Vr:"+native+":"+_.toHash('')) || StateSet.CreateToken(0,native);
    const unit_token = await S_Trie.get("Vr:"+unit+":"+_.toHash('')) || StateSet.CreateToken(0,unit);
    const concated = tx_states.concat(native_validator_state).concat(unit_validator_state).concat(all_units).concat(native_token).concat(unit_token);
    return concated.filter((val,i,array)=>array.map(s=>_.ObjectHash(s)).indexOf(_.ObjectHash(val))===i);
}

export const locations_for_block = async (block:T.Block,chain:T.Block[],L_Trie:Trie)=>{
    const targets = block.txs.concat(block.natives).concat(block.units);
    const tx_loc:T.Location[] = await P.reduce(targets,async (result:T.Location[],tx:T.Tx)=>result.concat(await locations_for_tx(tx,chain,L_Trie)),[]);
    const native_validator:T.Location = await L_Trie.get(CryptoSet.GenereateAddress(native,_.reduce_pub(block.meta.validatorPub)));
    const unit_validator:T.Location = await L_Trie.get(CryptoSet.GenereateAddress(unit,_.reduce_pub(block.meta.validatorPub)));
    const concated = (()=>{
        let array = _.copy(tx_loc);
        if(native_validator!=null) array.push(native_validator);
        if(unit_validator!=null) array.push(unit_validator);
        return array;
    })();
    return concated.filter((val,i,array)=>array.map(l=>_.ObjectHash(l)).indexOf(_.ObjectHash(val))===i);
}


export const random_chose = (array:any[], num:number)=>{
    for(let i = array.length - 1; i > 0; i--){
        let r = Math.floor(Math.random() * (i + 1));
        let tmp = array[i];
        array[i] = array[r];
        array[r] = tmp;
    }
    return array.slice(0,num);
}

export const tx_accept = async (tx:T.Tx,chain:T.Block[],roots:{[key:string]:string},pool:T.Pool,secret:string,candidates:T.Candidates[],unit_store:{[key:string]:T.Unit[]})=>{
    console.log("tx_accept");
    const stateroot = roots.stateroot;
    const S_Trie:Trie = trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = trie_ins(locationroot);
    const states = await states_for_tx(tx,chain,S_Trie) || [];
    const locations = await locations_for_tx(tx,chain,L_Trie) || [];
    const new_pool = Tx_to_Pool(pool,tx,my_version,native,unit,chain,token_name_maxsize,states,locations);
    if(tx.meta.kind==="refresh"){
        const new_unit:T.Unit = {
            request:tx.meta.data.request,
            index:tx.meta.data.index,
            nonce:tx.meta.nonce,
            payee:tx.meta.data.payee,
            output:tx.meta.data.output,
            unit_price:tx.meta.unit_price
        }
        const new_unit_store = _.new_obj(
            unit_store,
            (store)=>{
                const pre = store[tx.meta.data.request] || [];
                if(store[tx.meta.data.request]!=null&&store[tx.meta.data.request].some(u=>_.ObjectHash(u)===_.ObjectHash(new_unit))) return store;
                store[tx.meta.data.request] = pre.concat(new_unit);
                return store;
            }
        )
        store.commit("refresh_unit_store",new_unit_store);
        /*const already = (()=>{
            for(let block of chain.slice().reverse()){
                for(let tx of block.txs.concat(block.natives).concat(block.units)){
                    if(tx.meta.kind==="refresh"&&tx.meta.data.request===new_unit.request&&tx.meta.data.index===new_unit.index) return true;
                }
            }
            return false;
        })();
        console.log("already:")
        console.log(already);*/
    }
    if(_.ObjectHash(new_pool)!=_.ObjectHash(pool)){
        store.commit("refresh_pool",_.copy(new_pool));
        /*if(Object.keys(new_pool).length>=1&&unit_amount>0){
            await send_key_block(chain.slice(),secret,candidates.slice(),_.copy(roots),_.copy(new_pool),codes,validator_mode);
        }*/
        return _.copy(new_pool);
    }
    else return _.copy(pool);
}

export const block_accept = async (block:T.Block,chain:T.Block[],candidates:T.Candidates[],roots:{[key:string]:string},pool:T.Pool,not_refreshed:T.Tx[],now_buying:boolean,unit_store:{[key:string]:T.Unit[]})=>{
        console.log("block_accept");
        const stateroot = roots.stateroot;
        const S_Trie:Trie = trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie:Trie = trie_ins(locationroot);
        const StateData = await states_for_block(block,chain,S_Trie);
        const LocationData = await locations_for_block(block,chain,L_Trie);
        const accepted = await BlockSet.AcceptBlock(block,chain,0,my_version,block_time,max_blocks,block_size,candidates,stateroot,locationroot,native,unit,rate,token_name_maxsize,all_issue,StateData,LocationData);
        const request_hashes = block.txs.concat(block.natives).concat(block.units).reduce((result:string[],tx)=>{
            if(tx.meta.kind==="request") return result;
            return result.concat(tx.meta.data.request);
        },[]);
        const requested_index_min = block.txs.concat(block.natives).concat(block.units).reduce((min,tx)=>{
            if(tx.meta.kind==="request") return min;
            else if(new BigNumber(tx.meta.data.index).isGreaterThanOrEqualTo(min)) return min;
            else return tx.meta.data.index;
        },_.copy(chain).length-1);
        const reqested = (()=>{
            for(let block of _.copy(chain).slice(requested_index_min)){
                const txs = block.txs.concat(block.natives).concat(block.units);
                for(let tx of _.copy(txs)){
                    if(tx.meta.kind==="refresh"&&request_hashes.indexOf(tx.meta.data.request)!=-1) return true;
                }
            }
            return false;
        })();
        if(accepted.block.length>0&&!reqested){
            await P.forEach(accepted.state, async (state:T.State)=>{
                await S_Trie.put(state.owner,state);
            });
            await P.forEach(accepted.location, async (loc:T.Location)=>{
                await L_Trie.put(loc.address,loc);
            });
            console.log(await S_Trie.filter());
            console.log(await L_Trie.filter());
            const new_roots = {
                stateroot:S_Trie.now_root(),
                locationroot:L_Trie.now_root()
            }
            const new_pool = _.new_obj(
                pool,
                p=>{
                    block.txs.concat(block.natives).concat(block.units).forEach(tx=>{
                        delete p[tx.hash];
                    });
                    return p;
                }
            );
            const new_chain = _.copy(chain).concat(_.copy(accepted.block[0]));
            await store.commit('refresh_pool',_.copy(new_pool));
            await store.commit("refresh_roots",_.copy(new_roots));
            await store.commit("refresh_candidates",_.copy(accepted.candidates));
            await store.commit("add_block",_.copy(accepted.block[0]));
            console.log(new_chain);

            const reqs_pure = block.txs.filter(tx=>tx.meta.kind==="request").concat(block.natives.filter(tx=>tx.meta.kind==="request")).concat(block.units.filter(tx=>tx.meta.kind==="request"));
            const refs_pure = block.txs.filter(tx=>tx.meta.kind==="refresh").concat(block.natives.filter(tx=>tx.meta.kind==="refresh")).concat(block.units.filter(tx=>tx.meta.kind==="refresh"));

            const added_not_refresh_tx = reqs_pure.reduce((result,pure)=>{
                const full_tx = TxSet.pure_to_tx(pure,block)
                store.commit('add_not_refreshed',_.copy(full_tx));
                return result.concat(full_tx);
            },not_refreshed);
            if(refs_pure.length>0){
                console.log(refs_pure)
                store.commit('del_not_refreshed',_.copy(refs_pure).map(pure=>pure.meta.data.request));
            }
            const now_refreshing:string[] = _.copy(store.state.now_refreshing);
            const refreshed = refs_pure.map(pure=>pure.meta.data.request);
            const new_refreshing = now_refreshing.filter(key=>refreshed.indexOf(key)===-1);
            store.commit('new_refreshing',new_refreshing)
            const new_not_refreshed_tx = refs_pure.reduce((result,pure)=>{
                return result.filter(tx=>tx.meta.kind==="request"&&tx.hash!=pure.meta.data.request);
            },_.copy(added_not_refresh_tx));
            console.log(refs_pure);

            const bought_units = block.units.reduce((result:T.Unit[],u)=>{
                if(u.meta.kind==="request") return result;
                const ref_tx = TxSet.pure_to_tx(u,block);
                const req_tx = TxSet.find_req_tx(ref_tx,chain);
                const raw = req_tx.raw || TxSet.empty_tx().raw;
                const this_units:T.Unit[] = JSON.parse(raw.raw[2]||"[]")||[];
                return result.concat(this_units);
            },[]);
            const my_unit_buying = block.units.some(tx=>{
                if(tx.meta.kind==="request") return false;
                const ref_tx = _.copy(TxSet.pure_to_tx(_.copy(tx),_.copy(block)));
                const req_tx = _.copy(TxSet.find_req_tx(_.copy(ref_tx),_.copy(chain)));
                const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.state.secret));
                return _.copy(req_tx).meta.data.address===unit_address
            })
            console.log("my_unit_buying");
            console.log(my_unit_buying);
            const new_now_buying = store.state.now_buying||!my_unit_buying
            if(my_unit_buying) store.commit('buying_unit',false);
            const new_unit_store = _.new_obj(
                unit_store,
                (store:{[key:string]:T.Unit[]})=>{
                    bought_units.forEach(unit=>{
                        const com = store[unit.request] || [];
                        const deleted = com.filter(c=>_.ObjectHash(c)!=_.ObjectHash(unit))
                        store[unit.request] = deleted;
                    });
                    return store;
                }
            )
            store.commit("refresh_unit_store",_.copy(new_unit_store));


            return {
                pool:_.copy(new_pool),
                roots:_.copy(new_roots),
                candidates:_.copy(accepted.candidates),
                chain:_.copy(new_chain),
                not_refreshed_tx:_.copy(new_not_refreshed_tx),
                now_buying:new_now_buying,
                unit_store:_.copy(new_unit_store)
            }
        }
        else{
            console.log("receive invalid block");
            const valids = _.copy(block.txs.concat(block.natives).concat(block.units)).map(pure=>{
                const tx = TxSet.pure_to_tx(_.copy(pure),_.copy(block));
                if(tx.meta.kind==="request") return TxSet.ValidRequestTx(_.copy(tx),my_version,native,unit,false,_.copy(StateData),_.copy(LocationData));
                else return TxSet.ValidRefreshTx(_.copy(tx),_.copy(chain),my_version,native,unit,true,token_name_maxsize,_.copy(StateData),_.copy(LocationData));
            })
            console.log(valids);
            const deleted_pool = _.copy(block.txs.concat(block.natives).concat(block.units)).reduce((pool:T.Pool,tx,i)=>{
                const target_tx = pool[tx.hash];
                if(target_tx==null) return pool;
                const valid = _.copy(valids[i]);
                if(valid) return pool;
                return _.new_obj(
                    pool,
                    p=>{
                        delete p[tx.hash];
                        return p;
                    }
                )
            },_.copy(pool));
            store.commit('refresh_pool',_.copy(deleted_pool));

            const now_refreshing:string[] = _.copy(store.state.now_refreshing);
            const refreshed = _.copy(block.txs.concat(block.natives).concat(block.units)).filter((pure,i)=>pure.meta.kind==="refresh"&&!valids[i]).map(pure=>pure.meta.data.request);
            const new_refreshing = now_refreshing.filter(key=>refreshed.indexOf(key)===-1);
            store.commit('new_refreshing',_.copy(new_refreshing));
            /*const last_key = BlockSet.search_key_block(chain);
            const last_micros = BlockSet.search_micro_block(chain,last_key);

            const my_unit_state:T.State = await S_Trie.get(CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(secret)));
            const date = new Date();

            if(!store.state.check_mode&&_.reduce_pub(last_key.meta.validatorPub)===CryptoSet.PublicFromPrivate(store.state.secret)&&last_micros.length<=max_blocks) await send_micro_block(_.copy(pool),secret,chain.slice(),accepted.candidates.slice(),_.copy(roots),unit_store);
            else if(!store.state.check_mode&&my_unit_state!=null&&my_unit_state.amount>0&&date.getTime()-last_key.meta.timestamp>block_time*max_blocks) await send_key_block(chain.slice(),secret,accepted.candidates.slice(),_.copy(roots));*/
            return{
                pool:_.copy(pool),
                roots:_.copy(roots),
                candidates:_.copy(candidates),
                chain:_.copy(chain),
                not_refreshed_tx:_.copy(not_refreshed),
                now_buying:now_buying,
                unit_store:_.copy(unit_store)
            }
        }
}

export const tx_check = (block:T.Block,chain:T.Block[],StateData:T.State[],LocationData:T.Location[])=>{
    const txs:T.Tx[] = block.txs.map((tx,i)=>{
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
            raw:block.raws[txs.length+i]
        }
    });
    const units:T.Tx[] = block.units.map((u,i)=>{
        return {
            hash:u.hash,
            meta:u.meta,
            raw:block.raws[txs.length+natives.length+i]
        }
    });

    const target = txs.concat(natives).concat(units);
    return target.reduce((num:number,tx:T.Tx,i)=>{
        if(tx.meta.kind==="request"&&!TxSet.ValidRequestTx(tx,my_version,native,unit,true,StateData,LocationData)){
            return i;
        }
        else if(tx.meta.kind==="refresh"&&!TxSet.ValidRefreshTx(tx,chain,my_version,native,unit,true,token_name_maxsize,StateData,LocationData)){
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

export const send_request_tx = async (secret:string,type:T.TxTypes,token:string,base:string[],input_raw:string[],log:string[],roots:{[key:string]:string},chain:T.Block[],pre=TxSet.empty_tx_pure().meta.pre,next=TxSet.empty_tx_pure().meta.next)=>{
    try{
        console.log("send_request_tx");
        const pub_key:string[] = [CryptoSet.PublicFromPrivate(secret)]
        const solvency:string = CryptoSet.GenereateAddress(native,_.reduce_pub(pub_key));
        const pre_tx = TxSet.CreateRequestTx(pub_key,solvency,Math.pow(2,-3),type,token,base,input_raw,log,my_version,pre,next,Math.pow(2,-18));
        const tx = TxSet.SignTx(pre_tx,secret,pub_key[0]);
        const stateroot = roots.stateroot;
        const S_Trie:Trie = trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie:Trie = trie_ins(locationroot);
        const StateData = await states_for_tx(tx,chain,S_Trie);
        const LocationData = await locations_for_tx(tx,chain,L_Trie);
        if(!TxSet.ValidRequestTx(tx,my_version,native,unit,false,StateData,LocationData)) console.log("invalid infomations");
        else{
            console.log('remit!');
            client.publish('/data',{type:'tx',tx:[tx],block:[]});
            //await store.dispatch("tx_accept",_.copy(tx));
            //await tx_accept(tx,chain,roots,pool,secret,mode,candidates,codes,socket);
            /*const pool = store.state.pool;
            const new_pool = Object.assign({[tx.hash]:tx},pool);
            store.commit('refresh_pool',new_pool);*/
            /*await send_key_block(socket);
            await send_micro_block(socket);*/
        }
    }
    catch(e){
        throw new Error(e);
    }
}

export const send_refresh_tx = async (roots:{[key:string]:string},secret:string,req_tx:T.Tx,index:number,code:string,chain:T.Block[])=>{

        console.log("send_refresh_tx");
        const stateroot = roots.stateroot;
        const S_Trie:Trie = trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie:Trie = trie_ins(locationroot);
        const pub_key:string[] = [CryptoSet.PublicFromPrivate(secret)]
        const payee = CryptoSet.GenereateAddress(native,_.reduce_pub(pub_key));
        const req_pure = TxSet.tx_to_pure(req_tx);
        const pre_states:T.State[] = await P.map(req_pure.meta.data.base,async (add:string)=>await S_Trie.get(add));
        const token = req_tx.meta.data.token || "";
        const token_state:T.State = await S_Trie.get(token) || StateSet.CreateToken(0,token);
        const pure_chain = _.copy(chain).map(b=>{
            return {
                hash:_.copy(b).hash,
                meta:_.copy(b).meta
            }
        })
        const relate_pre_tx = (()=>{
            if(req_tx.meta.pre.flag===false) return TxSet.empty_tx();
            for(let block of _.copy(chain).slice().reverse()){
                let txs = _.copy(_.copy(block).txs.concat(_.copy(block).natives).concat(_.copy(block).units));
                let hashes = _.copy(txs).map(tx=>tx.meta.purehash);
                let i = hashes.indexOf(req_tx.meta.pre.hash);
                if(i!=-1){
                    let tx = _.copy(_.copy(txs)[i]);
                    if(tx.meta.kind=="request"&&tx.meta.next.flag===true&&tx.meta.next.hash===req_tx.meta.purehash){
                        return TxSet.pure_to_tx(_.copy(tx),_.copy(block));
                    }
                }
            }
            return TxSet.empty_tx();
        })();
        const relate_next_tx = (()=>{
            if(req_tx.meta.next.flag===false) return TxSet.empty_tx();
            for(let block of _.copy(chain).slice().reverse()){
                let txs =_.copy(_.copy(block).txs.concat(_.copy(block).natives).concat(_.copy(block).units));
                let hashes = _.copy(txs).map(tx=>tx.meta.purehash);
                let i = hashes.indexOf(req_tx.meta.next.hash);
                if(i!=-1){
                    let tx = _.copy(_.copy(txs)[i]);
                    if(tx.meta.kind=="request"&&tx.meta.pre.flag===true&&tx.meta.pre.hash===req_tx.meta.purehash){
                        return TxSet.pure_to_tx(_.copy(tx),_.copy(block));
                    }
                }
            }
            return TxSet.empty_tx();
        })();
        const output_states = (()=>{
            if(req_tx.meta.data.token===native) return TxSet.native_code(_.copy(pre_states),_.copy(req_tx),native);
            else if(req_tx.meta.data.token===unit) return TxSet.unit_code(_.copy(pre_states),_.copy(req_tx),_.copy(relate_pre_tx),native,unit,_.copy(chain));
            else return RunVM(code,_.copy(pre_states),_.copy(req_tx.raw.raw),_.copy(req_pure),token_state,_.copy(pure_chain),_.copy(relate_pre_tx),_.copy(relate_next_tx),gas_limit);
        })();
        const output_raws = output_states.map(state=>JSON.stringify(state));
        const pre_tx = TxSet.CreateRefreshTx(my_version,0.01,pub_key,pow_target,Math.pow(2,-18),req_tx.hash,index,payee,output_raws,[],chain);
        const tx = TxSet.SignTx(pre_tx,secret,pub_key[0]);
        const StateData = await states_for_tx(tx,chain,S_Trie);
        const LocationData = await locations_for_tx(tx,chain,L_Trie);
        if(!TxSet.ValidRefreshTx(tx,chain,my_version,native,unit,false,token_name_maxsize,StateData,LocationData)) console.log("fail to create valid refresh");
        else{
            //store.commit('del_not_refreshed',[tx.meta.data.request]);
            console.log("create valid refresh tx");
            client.publish('/data',{type:'tx',tx:[tx],block:[]});
            //await store.dispatch("tx_accept",_.copy(tx));
            //await tx_accept(tx,chain,roots,pool,secret,mode,candidates,codes,socket);
            /*const pool = store.state.pool;
            const new_pool = Object.assign({[tx.hash]:tx},pool);
            store.commit('refresh_pool',new_pool);*/
        }

}


export const send_key_block = async (chain:T.Block[],secret:string,candidates:T.Candidates[],roots:{[key:string]:string})=>{
    console.log("send_key_block");
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
    const check = BlockSet.ValidKeyBlock(key_block,chain,0,my_version,candidates,stateroot,locationroot,block_size,native,unit,StateData,LocationData);
    if(!check) console.log("fail to create valid block");
    else{
        console.log('create valid key block');
        client.publish('/data',{type:'block',tx:[],block:[key_block]});
        //await store.dispatch("block_accept",_.copy(key_block));
        //await block_accept(key_block,chain,candidates,roots,pool,codes,secret,mode,socket);
    }
}

export const send_micro_block = async (pool:T.Pool,secret:string,chain:T.Block[],candidates:T.Candidates[],roots:{[key:string]:string},unit_store:{[key:string]:T.Unit[]})=>{
    console.log("send_micro_block");
    const stateroot = roots.stateroot;
    const S_Trie:Trie = trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie:Trie = trie_ins(locationroot);
    const pub_key:string[] = [CryptoSet.PublicFromPrivate(secret)];
    const native_validator = CryptoSet.GenereateAddress(native,_.reduce_pub(pub_key));
    const unit_validator = CryptoSet.GenereateAddress(unit,_.reduce_pub(pub_key));
    console.log(Object.values(pool))
    const pool_txs:T.Tx[] = Object.values(_.copy(pool))
    const requested_bases:string[] = Object.keys(await L_Trie.filter((key,val)=>{
        const getted:T.Location = val;
        if(getted.state==="already") return true;
        else return false;
    }));
    console.log(requested_bases);
    const already_requests:string[] = _.copy(store.state.now_refreshing);
    console.log(already_requests);
    const not_same = pool_txs.reduce((result:T.Tx[],tx)=>{
        const bases = result.reduce((r:string[],t)=>{
            if(t.meta.kind==="request") return r.concat(t.meta.data.base);
            else return r;
        },requested_bases);
        const requests = result.reduce((r:string[],t)=>{
            if(t.meta.kind==="refresh") return r.concat(t.meta.data.request);
            else return r;
        },[]);
        if(tx.meta.kind==="request"&&!bases.some(b=>tx.meta.data.base.indexOf(b)!=-1)) return result.concat(tx);
        else if(tx.meta.kind==="refresh"&&requests.indexOf(tx.meta.data.request)===-1) return result.concat(tx);
        else return result;
    },[]);
    console.log('not_same:')
    console.log(not_same);
    const related = not_same.filter(tx=>{
        if(tx.meta.kind==="request") return true;
        const req_tx = TxSet.find_req_tx(tx,chain);
        if(req_tx.meta.pre.flag===true){
            const pres = TxSet.list_up_related(chain,TxSet.tx_to_pure(req_tx).meta,"pre");
            return pres.length>0;
        }
        else if(req_tx.meta.next.flag===true){
            const nexts = TxSet.list_up_related(chain,TxSet.tx_to_pure(req_tx).meta,"next");
            return nexts.length>0;
        }
        else return true;
    });
    console.log('related');
    console.log(related);
    let size_sum = new BigNumber(0);
    const choosed = related.reduce((result:T.Tx[],tx)=>{
        if(size_sum.isGreaterThan(new BigNumber(block_size).times(0.9))) return result;
        const tx_size = new BigNumber(Buffer.from(JSON.stringify(tx)).length);
        const added_size = size_sum.plus(tx_size);
        size_sum = added_size;
        if(added_size.isGreaterThan(new BigNumber(block_size).times(0.9))) return result;
        else return result.concat(tx);
    },[]);
    console.log('choosed')
    console.log(choosed);
    const reduced = choosed.reduce((result:{txs:T.Tx[],natives:T.Tx[],units:T.Tx[]},tx)=>{
        if(tx.meta.data.token===native) result.natives.push(tx);
        else if(tx.meta.data.token===unit) result.units.push(tx);
        else result.txs.push(tx);
        return result;
    },{txs:[],natives:[],units:[]});
    const txs = reduced.txs;
    const natives = reduced.natives;
    const units = reduced.units;
    const pre_block = BlockSet.CreateMicroBlock(my_version,0,chain,pow_target,pos_diff,pub_key,_.ObjectHash(candidates),stateroot,locationroot,txs,natives,units,block_time);
    const micro_block = BlockSet.SignBlock(pre_block,secret,pub_key[0]);
    const StateData = await states_for_block(micro_block,chain,S_Trie);
    const LocationData = await locations_for_block(micro_block,chain,L_Trie);
    //console.log(BlockSet.ValidMicroBlock(micro_block,chain,0,my_version,candidates,stateroot,locationroot,block_time,max_blocks,block_size,native,unit,token_name_maxsize,StateData,LocationData))
    const invalid_index = tx_check(micro_block,chain,StateData,LocationData);
    console.log(invalid_index);
    const block_check = BlockSet.ValidMicroBlock(micro_block,chain,0,my_version,candidates,stateroot,locationroot,block_time,max_blocks,block_size,native,unit,token_name_maxsize,StateData,LocationData);
    if(invalid_index===-1&&block_check){
        const new_pool = _.new_obj(
            pool,
            p=>{
                micro_block.txs.concat(micro_block.natives).concat(micro_block.units).forEach(tx=>{
                    if(tx.meta.kind==="refresh") delete p[tx.hash];
                });
                return p;
            }
        );
        store.commit('refresh_pool',_.copy(new_pool));
        const new_refreshing = already_requests.concat(micro_block.txs.concat(micro_block.natives).concat(micro_block.units).filter(tx=>tx.meta.kind==="refresh").map(tx=>tx.meta.data.request));
        store.commit('new_refreshing',_.copy(new_refreshing));
        client.publish('/data',{type:'block',tx:[],block:[micro_block]});
            //await store.dispatch("block_accept",_.copy(micro_block));
            //await block_accept(micro_block,chain,candidates,roots,pool,codes,secret,mode,socket);
        console.log("create micro block");
            //await send_micro_block(socket);
    }
    else if(invalid_index!=-1){
        const target_pure = micro_block.txs.concat(micro_block.natives).concat(micro_block.units)[invalid_index];
        const target_tx = TxSet.pure_to_tx(_.copy(target_pure),_.copy(micro_block));
        const valid = (()=>{
            if(target_tx.meta.kind==="request") return !TxSet.ValidRequestTx(_.copy(target_tx),my_version,native,unit,false,_.copy(StateData),_.copy(LocationData));
            else return true;
        })();
        const del_pool = ((p)=>{
            if(valid) delete p[target_pure.hash];
            return p;
        })(_.copy(pool));
        const add_unit_store = ((store)=>{
            if(target_pure.meta.kind==="refresh"){
                const new_unit:T.Unit = {
                    request:target_pure.meta.data.request,
                    index:target_pure.meta.data.index,
                    nonce:target_pure.meta.nonce,
                    payee:target_pure.meta.data.payee,
                    output:target_pure.meta.data.output,
                    unit_price:target_pure.meta.unit_price
                }
                const pre = store[target_pure.meta.data.request] || []
                store[target_pure.meta.data.request] = pre.concat(new_unit);
                return store;
            }
            else return store;
        })(_.copy(unit_store))
        store.commit("refresh_pool",_.copy(del_pool));
        store.commit("refresh_unit_store",_.copy(add_unit_store));
        await send_micro_block(_.copy(del_pool),secret,_.copy(chain),_.copy(candidates),_.copy(roots),_.copy(unit_store));
    }
    else{console.log("fall to create micro block;");}
}

const get_pre_info = async (chain:T.Block[]):Promise<[{stateroot:string,locationroot:string},T.Candidates[]]>=>{
    const pre_block = chain[chain.length-1] || BlockSet.empty_block();
    const S_Trie = trie_ins(pre_block.meta.stateroot);
    const StateData = await states_for_block(pre_block,chain.slice(0,pre_block.meta.index),S_Trie);
    const L_Trie = trie_ins(pre_block.meta.locationroot);
    const LocationData = await locations_for_block(pre_block,chain.slice(0,pre_block.meta.index),L_Trie);
    /*const pre_block2 = chain[chain.length-2] || BlockSet.empty_block();
    const pre_S_Trie = trie_ins(pre_block2.meta.stateroot);
    const pre_StateData = await states_for_block(pre_block2,chain.slice(0,pre_block.meta.index-1),pre_S_Trie);*/
    const candidates = BlockSet.CandidatesForm(BlockSet.get_units(unit,StateData));
    const accepted = await BlockSet.AcceptBlock(pre_block,_.copy(chain).slice(0,pre_block.meta.index),0,my_version,block_time,max_blocks,block_size,_.copy(candidates),S_Trie.now_root(),L_Trie.now_root(),native,unit,rate,token_name_maxsize,all_issue,StateData,LocationData);
    await P.forEach(accepted.state, async (state:T.State)=>{
        await S_Trie.put(state.owner,state);
    });
    await P.forEach(accepted.location, async (loc:T.Location)=>{
        await L_Trie.put(loc.address,loc);
    });
    const pre_root = {
        stateroot:S_Trie.now_root(),
        locationroot:L_Trie.now_root()
    }
    return [_.copy(pre_root),_.copy(accepted.candidates)];
}

export const check_chain = async (new_chain:T.Block[],my_chain:T.Block[],pool:T.Pool,codes:{[key:string]:string},secret:string,unit_store:{[key:string]:T.Unit[]})=>{
    if(new_chain.length>my_chain.length){
        const news = _.copy(new_chain).slice().reverse();
        let target:T.Block[] = [];
        for(let index in news){
            let i = Number(index);
            if(my_chain[news.length-i-1]!=null&&my_chain[news.length-i-1].hash===news[i].hash) break;
            else if(news[i].meta.kind==="key") target.push(news[i]);
            else if(news[i].meta.kind==="micro") target.push(news[i]);
        }
        const add_blocks = _.copy(target).slice().reverse();
        const back_chain = my_chain.slice(0,add_blocks[0].meta.index);
        console.log("add_block:");
        console.log(add_blocks);
        /*const back_chain:T.Block[] = [gen.block];
        const add_blocks = new_chain.slice(1);*/
        store.commit("replace_chain",_.copy(back_chain));
        const info = await (async ()=>{
            if(back_chain.length===1){
                return{
                    pool:_.copy(pool),
                    roots:_.copy(gen.roots),
                    candidates:_.copy(gen.candidates),
                    chain:_.copy(back_chain)
                }
            }
            const pre_info = await get_pre_info(back_chain);
            return {
                pool:_.copy(pool),
                roots:_.copy(pre_info[0]),
                candidates:_.copy(pre_info)[1],
                chain:_.copy(back_chain)
            }
        })();

        const add_blocks_data = add_blocks.map(block=>{
            return {
                type:'block',
                tx:[],
                block:[block]
            }
        });

        store.commit("refresh_roots",_.copy(info.roots));
        store.commit("refresh_candidates",_.copy(info.candidates));
        store.commit('replaceing',true);
        store.commit('rep_limit',_.copy(add_blocks[add_blocks.length-1]).meta.index);
        /*await P.reduce(add_blocks,async (result:{pool:T.Pool,roots:{[key:string]:string},candidates:T.Candidates[],chain:T.Block[]},block:T.Block)=>{
            const accepted = await block_accept(block,result.chain.slice(),result.candidates.slice(),_.copy(result.roots),_.copy(result.pool),codes,secret,unit_store);
            return _.copy(accepted);
        },info);*/
        store.commit('refresh_yet_data',_.copy(add_blocks_data).concat(_.copy(store.state.yet_data)));
        //add_blocks.forEach(block=>store.commit('push_yet_block',block));
        /*store.commit("checking",true);
        store.commit("checking",false);*/
        const amount = await get_balance(store.getters.my_address);
        store.commit("refresh_balance",amount);
    }else{
        console.log("not replace");
        store.commit('replaceing',false);
    }
}

export const unit_buying = async (secret:string,units:T.Unit[],roots:{[key:string]:string},chain:T.Block[])=>{
    try{
        console.log("unit!");
        const pub_key:string[] = [CryptoSet.PublicFromPrivate(secret)]
        const native_remiter = CryptoSet.GenereateAddress(native,_.reduce_pub(pub_key));
        const unit_remiter = CryptoSet.GenereateAddress(unit,_.reduce_pub(pub_key));
        console.log(native_remiter)
        const unit_sellers = units.map(u=>u.payee);
        console.log(unit_sellers);
        const native_sellers = unit_sellers.map(add=>add.split(":")[2]||"").map(id=>"Vr:"+native+":"+id);
        const prices = units.map(u=>u.unit_price);
        const pure_native_tx = TxSet.CreateRequestTx(pub_key,native_remiter,Math.pow(2,-3),"issue",native,_.copy([native_remiter].concat(unit_sellers)),["remit",JSON.stringify(prices)],[],my_version,TxSet.empty_tx_pure().meta.pre,TxSet.empty_tx_pure().meta.next,Math.pow(2,-18));
        const pure_unit_tx = TxSet.CreateRequestTx(pub_key,native_remiter,Math.pow(2,-3),"issue",unit,_.copy([unit_remiter].concat("Vr:"+unit+":"+_.toHash(''))),["buy",JSON.stringify(units)],[],my_version,TxSet.empty_tx_pure().meta.pre,TxSet.empty_tx_pure().meta.next,Math.pow(2,-18));
        console.log(pure_native_tx);
        const native_pure_hash = _.copy(pure_native_tx).meta.purehash;
        const unit_pure_hash = _.copy(pure_unit_tx).meta.purehash;
        const next_rel:T.Relation = {
            flag:true,
            hash:unit_pure_hash
        }
        const pre_rel:T.Relation = {
            flag:true,
            hash:native_pure_hash
        }
        const rel_native_tx = _.new_obj(
            pure_native_tx,
            (tx:T.Tx)=>{
                const new_meta = _.new_obj(
                    tx.meta,m=>{
                        m.next = next_rel;
                        return m;
                    }
                );
                tx.meta = _.copy(new_meta);
                tx.hash = _.ObjectHash(new_meta);
                return tx;
            }
        );
        const rel_unit_tx = _.new_obj(
            pure_unit_tx,
            (tx:T.Tx)=>{
                const new_meta = _.new_obj(
                    tx.meta,m=>{
                        m.pre = pre_rel;
                        return m;
                    }
                );
                tx.meta = _.copy(new_meta);
                tx.hash = _.ObjectHash(new_meta);
                return tx;
            }
        );
        const native_tx = TxSet.SignTx(rel_native_tx,secret,pub_key[0]);
        const unit_tx = TxSet.SignTx(rel_unit_tx,secret,pub_key[0]);
        const stateroot = roots.stateroot;
        const S_Trie:Trie = trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie:Trie = trie_ins(locationroot);
        const native_StateData = await states_for_tx(native_tx,chain,S_Trie);
        const native_LocationData = await locations_for_tx(native_tx,chain,L_Trie);
        const unit_StateData = await states_for_tx(unit_tx,chain,S_Trie);
        const unit_LocationData = await locations_for_tx(unit_tx,chain,L_Trie);
        if(!TxSet.ValidRequestTx(native_tx,my_version,native,unit,false,native_StateData,native_LocationData)||!TxSet.ValidRequestTx(unit_tx,my_version,native,unit,false,unit_StateData,unit_LocationData)) console.log("fail to buy units");
        else{
            console.log("buy unit!");
            store.commit('buying_unit',true);
            console.error(unit_tx.hash);
            client.publish('/data',{type:'tx',tx:[native_tx],block:[]});
            client.publish('/data',{type:'tx',tx:[unit_tx],block:[]});
        }
        /*const pre_tx = TxSet.CreateRequestTx(pub_key,remiter,Math.pow(2,-5),"issue",unit,[from],["buy",remiter,JSON.stringify(units)],[],my_version,TxSet.empty_tx_pure().meta.pre,TxSet.empty_tx_pure().meta.next,Math.pow(10,-18));
        const tx = TxSet.SignTx(pre_tx,secret,pub_key[0
        ]);
        const stateroot = roots.stateroot;
        const S_Trie:Trie = trie_ins(stateroot);
        const locationroot = roots.locationroot;
        const L_Trie:Trie = trie_ins(locationroot);
        const StateData = await states_for_tx(tx,chain,S_Trie);
        const LocationData = await locations_for_tx(tx,chain,L_Trie);*/
        /*if(!TxSet.ValidRequestTx(tx,my_version,native,unit,StateData,LocationData)) console.log("fail to buy units");
        else{
            console.log("buy unit!");
            client.publish('/data',{type:'tx',tx:[tx],block:[]});
        }*/
    }
    catch(e){throw new Error(e);}
}
