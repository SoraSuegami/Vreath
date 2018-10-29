import * as T from '../../core/types'
import * as _ from '../../core/basic'
import * as CryptoSet from '../../core/crypto_set'
import {Trie} from '../../core/merkle_patricia'
import * as TxSet from '../../core/tx'
import * as BlockSet from '../../core/block'
import * as StateSet from '../../core/state'
import * as P from 'p-iteration'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate, pow_target,pos_diff,all_issue,compatible_version} from '../con'
import { Tx_to_Pool } from '../../core/tx_pool';
import * as gen from '../../genesis/index';
import { RunVM } from '../../core/code';
import {BigNumber} from 'bignumber.js'
import faye from 'faye'
import * as io from 'socket.io-client'
import {peer_list} from './peer_list'

export type Data = {
    type:'tx'|'block';
    tx:T.Tx[];
    block:T.Block[];
}

const codes = {
    "native":"const main = () => {};",//"function main(){const state = vreath.states[0];const type = input[0];const other = input[1];const amount = Number(input[2]);switch (type) {case 'remit':if (tx.meta.data.type != 'scrap' || state.owner != tx.meta.data.address || amount >= 0 || state.amount < amount) {console.log('error'); return 0;} const remited = vreath.create_state(state.nonce + 1, state.owner, state.token, state.amount + amount, state.data, state.product);console.log(remited);vreath.change_states([state], [remited]);}}",
    "unit":"const main = () => {};"
}

export class Store {
    private _code:{[key:string]:string} = codes;
    private _pool:{[key:string]:T.Tx} = {};
    private _chain:T.Block[] = [gen.block];
    private _roots:{[key:string]:string} = gen.roots;
    private _candidates:T.Candidates[] = gen.candidates;
    private _unit_store:{[key:string]:T.Unit[]} = {};
    private _secret:string = CryptoSet.GenerateKeys();
    private _balance:number = 0;
    private _peers = {type:'client',ip:'localhost',port:57750,time:0};
    private _yet_data:Data[] = [];
    private _check_mode:boolean = false;
    private _replace_mode:boolean = false;
    private _replace_index:number = 0;
    private _not_refreshed_tx:T.Tx[] = [];
    private _now_buying:boolean = false;
    private _now_refreshing:string[] = [];
    private _req_index_map:{[key:string]:number} = {};
    private _return_chain:boolean = false;
    private _first_request:boolean = true;

    constructor(private _isNode:boolean,private read_func:<T>(key:string,def:T)=>Promise<T>,private write_func:<T>(key:string,val:T)=>Promise<void>){}

    async read(){
        this._code = await this.read_func('code',codes);
        this._pool = await this.read_func('pool',{});
        this._chain = await this.read_func('chain',[gen.block]);
        this._roots = await this.read_func('roots',gen.roots);
        this._candidates = await this.read_func('candidates',gen.candidates);
        this._unit_store = await this.read_func('unit_store',{});
        if(!this._isNode){
            this._secret = await this.read_func('secret',this._secret);
            this._balance = await this.read_func('balance',0);
            this._peers = await this.read_func('peers',{type:'client',ip:'localhost',port:57750,time:0});
        }
    }

    async write(){
        await this.write_func('pool',_.copy(this.pool));
        await this.write_func('chain',_.copy(this.chain));
        await this.write_func('roots',_.copy(this.roots));
        await this.write_func('candidates',_.copy(this.candidates));
        await this.write_func('unit_store',_.copy(this.unit_store));
        if(!this.isNode){
            await this.write_func('secret',_.copy(this.secret));
            await this.write_func('balance',_.copy(this.balance));
        }
    }

    get isNode(){
        return this._isNode
    }
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
    get req_index_map(){
        return this._req_index_map
    }
    get return_chain(){
        return this._return_chain
    }
    get first_request(){
        return this._first_request
    }
    get my_address(){
        return CryptoSet.GenereateAddress(native,CryptoSet.PublicFromPrivate(this._secret)) || ""
    }
    get unit_address(){
        return CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(this._secret)) || ""
    }

    refresh_pool(pool:T.Pool){
        this._pool = _.copy(pool);
        this.write_func('pool',_.copy(this.pool));
        /*self.postMessage({
            key:'refresh_pool',
            val:_.copy(pool)
        },location.protocol+'//'+location.host);*/
    }
    add_block(block:T.Block){
        this._chain = _.copy(this._chain).concat(block).filter((b:T.Block,i:number)=>b.meta.index===i);
        this.write_func('chain',_.copy(this._chain));
        /*self.postMessage({
            key:'add_block',
            val:_.copy(block)
        },location.protocol+'//'+location.host);*/
    }
    replace_chain(chain:T.Block[]){
        this._chain = _.copy(chain).slice().sort((a:T.Block,b:T.Block)=>{
            return a.meta.index - b.meta.index;
        }).filter((b:T.Block,i:number)=>b.meta.index===i);
        this.write_func('chain',_.copy(this._chain));
        /*self.postMessage({
            key:'replace_chain',
            val:_.copy(chain)
        },location.protocol+'//'+location.host);*/
    }
    refresh_roots(roots:{[key:string]:string}){
        this._roots = _.copy(roots);
        this.write_func('roots',_.copy(this._roots));
        /*self.postMessage({
            key:'refresh_roots',
            val:_.copy(roots)
        },location.protocol+'//'+location.host);*/
    }
    refresh_candidates(candidates:T.Candidates[]){
        this._candidates = _.copy(candidates);
        this.write_func('candidates',_.copy(this._candidates));
        /*self.postMessage({
            key:'refresh_candidates',
            val:_.copy(candidates)
        },location.protocol+'//'+location.host);*/
    }
    add_unit(unit:T.Unit){
        const units:T.Unit[] = _.copy(this._unit_store)[unit.request] || [];
        if(!units.some(u=>u.index===unit.index&&u.payee===unit.payee)){
            this._unit_store[unit.request] = _.copy(units).concat(unit);
            this.write_func('unit_store',_.copy(this._unit_store));
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
        this.write_func('unit_store',_.copy(this._unit_store));
        /*self.postMessage({
            key:'delete_unit',
            val:_.copy(unit)
        },location.protocol+'//'+location.host);*/
    }
    refresh_unit_store(store:{[key:string]:T.Unit[]}){
        this._unit_store = _.copy(store);
        this.write_func('unit_store',_.copy(this._unit_store));
        /*self.postMessage({
            key:'refresh_unit_store',
            val:_.copy(store)
        },location.protocol+'//'+location.host);*/
    }
    refresh_secret(secret:string){
        this._secret = secret;
        this.write_func('secret',this._secret);
        /*self.postMessage({
            key:'refresh_secret',
            val:secret
        },location.protocol+'//'+location.host);*/
    }
    refresh_balance(amount:number){
        this._balance = amount;
        this.write_func('balance',this._balance);
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
    add_req_index(key:string,index:number){
        this._req_index_map[key] = index;
    }
    del_req_index(key:string){
        delete this._req_index_map[key];
    }
    refresh_return_chain(bool:boolean){
        this._return_chain = bool;
    }
    requested(bool:boolean){
        this._first_request = bool;
    }

}

let db:any;
let store:Store;

const port = peer_list[0].port || "57750";
const ip = peer_list[0].ip || "localhost";

const client = new faye.Client('http://'+ip+':'+port+'/pubsub');
const socket = io.connect('http://'+ip+':'+port);


client.subscribe('/data',async (data:Data)=>{
    if(data.type==="block"){
        store.push_yet_data(_.copy(data));
        return 0;
    }
    const unit_amount = await get_balance(store.unit_address);
    if(data.type==="tx"&&unit_amount>0) store.push_yet_data(_.copy(data));
    return 0;
});

socket.on('replacechain',async (chain:T.Block[])=>{
    if(!store.replace_mode) await check_chain(_.copy(chain),_.copy(store.chain),_.copy(store.pool),_.copy(store.code),store.secret,_.copy(store.unit_store));
    store.checking(false);
    //setImmediate(compute_tx);
    console.log(store.yet_data.length);
    return 0;
});

socket.on('disconnect',()=>{
    store.refresh_pool({});
    store.replace_chain([gen.block]);
    store.refresh_roots(gen.roots);
    store.refresh_candidates(gen.candidates);
    store.refresh_unit_store({});
    store.refresh_yet_data([]);
});


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
    const concated = base_states.concat(output_states).concat(pay_states);
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
    return result;
}

export const states_for_block = async (block:T.Block,chain:T.Block[],S_Trie:Trie)=>{
    const native_validator = CryptoSet.GenereateAddress(native,_.reduce_pub(block.meta.validatorPub));
    const native_validator_state:T.State = await S_Trie.get(native_validator) || StateSet.CreateState(0,native_validator,native);
    const unit_validator = CryptoSet.GenereateAddress(unit,_.reduce_pub(block.meta.validatorPub));
    const unit_validator_state:T.State = await S_Trie.get(unit_validator) || StateSet.CreateState(0,unit_validator,unit);
    const targets = block.txs.concat(block.natives).concat(block.units).map(pure=>TxSet.pure_to_tx(pure,block));
    const tx_states:T.State[] = await P.reduce(targets,async (result:T.State[],tx:T.Tx)=>result.concat(await states_for_tx(tx,chain,S_Trie)),[]);
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
        /*const new_unit_store = _.new_obj(
            unit_store,
            (store)=>{
                const valid_ref_tx = (()=>{
                    for(let block of _.copy(chain).slice()){
                        let txs = block.txs.concat(block.natives).concat(block.units);
                        for(let t of _.copy(txs)){
                            if(t.meta.kind==="refresh"&&t.meta.data.request===tx.meta.data.request&&t.meta.data.index===tx.meta.data.index) return t;
                        }
                    }
                    return TxSet.empty_tx_pure();
                })();
                if(valid_ref_tx.hash!=TxSet.empty_tx_pure().hash&&valid_ref_tx.meta.data.output!=tx.meta.data.output) return store;
                const pre = store[tx.meta.data.request] || [];
                if(store[tx.meta.data.request]!=null&&store[tx.meta.data.request].some(u=>u.payee===new_unit.payee&&u.index===new_unit.index)) return _.copy(store);
                else store[tx.meta.data.request] = pre.concat(new_unit);
                return store;
            }
        )*/
        store.add_unit(_.copy(new_unit));
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
        store.refresh_pool(_.copy(new_pool))
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
        /*const reqested = (()=>{
            for(let block of _.copy(chain).slice(requested_index_min)){
                const txs = block.txs.concat(block.natives).concat(block.units);
                for(let tx of _.copy(txs)){
                    if(tx.meta.kind==="refresh"&&request_hashes.indexOf(tx.meta.data.request)!=-1) return true;
                }
            }
            return false;
        })();*/
        if(accepted.block.length>0/*&&!reqested*/){
            await P.forEach(accepted.state, async (state:T.State)=>{
                await S_Trie.put(state.owner,state);
            });
            await P.forEach(accepted.location, async (loc:T.Location)=>{
                await L_Trie.put(loc.address,loc);
            });
            const new_roots = {
                stateroot:S_Trie.now_root(),
                locationroot:L_Trie.now_root()
            }
            const new_pool = _.new_obj(
                pool,
                p=>{
                    block.txs.concat(block.natives).concat(block.units).forEach(tx=>{
                        Object.values(p).forEach(t=>{
                            if(t.meta.kind==="refresh"&&t.meta.data.index===tx.meta.data.index&&t.meta.data.request===tx.meta.data.request){
                                delete p[t.hash];
                                delete p[t.meta.data.request];
                            }
                        });
                    });
                    return p;
                }
            );
            const new_chain = _.copy(chain).concat(_.copy(accepted.block[0]));
            store.refresh_pool(_.copy(new_pool));
            store.refresh_roots(_.copy(new_roots));
            store.refresh_candidates(_.copy(accepted.candidates));
            store.add_block(_.copy(accepted.block[0]));

            const reqs_pure = block.txs.filter(tx=>tx.meta.kind==="request").concat(block.natives.filter(tx=>tx.meta.kind==="request")).concat(block.units.filter(tx=>tx.meta.kind==="request"));
            const refs_pure = block.txs.filter(tx=>tx.meta.kind==="refresh").concat(block.natives.filter(tx=>tx.meta.kind==="refresh")).concat(block.units.filter(tx=>tx.meta.kind==="refresh"));
            const added_not_refresh_tx = reqs_pure.reduce((result,pure)=>{
                const full_tx = TxSet.pure_to_tx(pure,block)
                store.add_not_refreshed(_.copy(full_tx));
                return result.concat(full_tx);
            },not_refreshed);

            if(reqs_pure.length>0){
                reqs_pure.map(pure=>pure.hash).forEach(key=>store.add_req_index(key,_.copy(block).meta.index));
            }
            if(refs_pure.length>0){
                store.del_not_refreshed(_.copy(refs_pure).map(pure=>pure.meta.data.request));
            }
            const now_refreshing:string[] = _.copy(store.now_refreshing);
            const refreshed = refs_pure.map(pure=>pure.meta.data.request);
            const new_refreshing = now_refreshing.filter(key=>refreshed.indexOf(key)===-1);
            store.new_refreshing(new_refreshing);
            const new_not_refreshed_tx = refs_pure.reduce((result,pure)=>{
                return result.filter(tx=>tx.meta.kind==="request"&&tx.hash!=pure.meta.data.request);
            },_.copy(added_not_refresh_tx));

            const bought_units = block.units.reduce((result:T.Unit[],u)=>{
                if(u.meta.kind==="request") return result;
                const ref_tx = TxSet.pure_to_tx(u,block);
                const req_tx = TxSet.find_req_tx(ref_tx,chain);
                const raw = req_tx.raw || TxSet.empty_tx().raw;
                const this_units:T.Unit[] = JSON.parse(raw.raw[1]||"[]")||[];
                return result.concat(this_units);
            },[]);
            const my_unit_buying = block.units.some(tx=>{
                if(tx.meta.kind==="request") return false;
                const ref_tx = _.copy(TxSet.pure_to_tx(_.copy(tx),_.copy(block)));
                const req_tx = _.copy(TxSet.find_req_tx(_.copy(ref_tx),_.copy(chain)));
                const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.secret));
                return _.copy(req_tx).meta.data.address===unit_address
            })
            const new_now_buying = store.now_buying||!my_unit_buying
            if(my_unit_buying) store.buying_unit(false);
            const new_unit_store = _.new_obj(
                unit_store,
                (store:{[key:string]:T.Unit[]})=>{
                    bought_units.forEach(unit=>{
                        const com = store[unit.request] || [];
                        const deleted = com.filter(c=>(c.payee!=unit.payee&&c.index==unit.index&&c.output===unit.output)||(c.index!=unit.index));
                        store[unit.request] = deleted;
                    });
                    return store;
                }
            )
            bought_units.forEach(unit=>{
                store.delete_unit(_.copy(unit));
            });


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
            store.refresh_pool(_.copy(deleted_pool));

            const now_refreshing:string[] = _.copy(store.now_refreshing);
            const refreshed = _.copy(block.txs.concat(block.natives).concat(block.units)).filter((pure,i)=>pure.meta.kind==="refresh"&&!valids[i]).map(pure=>pure.meta.data.request);
            const new_refreshing = now_refreshing.filter(key=>refreshed.indexOf(key)===-1);
            store.new_refreshing(_.copy(new_refreshing));
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
    const S_Trie = trie_ins(store.roots.stateroot||"");
    const state:T.State = await S_Trie.get(address);
    if(state==null) return 0;
    return new BigNumber(state.amount).toNumber();
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
            store.requested(false);
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
            let block:T.Block;
            let txs:T.TxPure[];
            let hashes:string[];
            let i:number;
            let tx:T.TxPure;
            for(block of _.copy(chain).slice().reverse()){
                txs = _.copy(_.copy(block).txs.concat(_.copy(block).natives).concat(_.copy(block).units));
                hashes = _.copy(txs).map(tx=>tx.meta.purehash);
                i = hashes.indexOf(req_tx.meta.pre.hash);
                if(i!=-1){
                    tx = _.copy(_.copy(txs)[i]);
                    if(tx.meta.kind=="request"&&tx.meta.next.flag===true&&tx.meta.next.hash===req_tx.meta.purehash){
                        return TxSet.pure_to_tx(_.copy(tx),_.copy(block));
                    }
                }
            }
            return TxSet.empty_tx();
        })();
        const relate_next_tx = (()=>{
            if(req_tx.meta.next.flag===false) return TxSet.empty_tx();
            let block:T.Block;
            let txs:T.TxPure[];
            let hashes:string[];
            let i:number;
            let tx:T.TxPure;
            for(block of _.copy(chain).slice().reverse()){
                txs =_.copy(_.copy(block).txs.concat(_.copy(block).natives).concat(_.copy(block).units));
                hashes = _.copy(txs).map(tx=>tx.meta.purehash);
                i = hashes.indexOf(req_tx.meta.next.hash);
                if(i!=-1){
                    tx = _.copy(_.copy(txs)[i]);
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
            store.del_not_refreshed([tx.meta.data.request]);
            store.del_req_index(_.copy(req_tx).hash);
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
    const pool_txs:T.Tx[] = Object.values(_.copy(pool))
    const requested_bases:string[] = Object.keys(await L_Trie.filter((key,val)=>{
        const getted:T.Location = val;
        if(getted.state==="already") return true;
        else return false;
    }));
    const already_requests:string[] = _.copy(store.now_refreshing);
    const not_same = pool_txs.reduce((result:T.Tx[],tx)=>{
        const bases = result.reduce((r:string[],t)=>{
            if(t.meta.kind==="request") return r.concat(t.meta.data.base);
            else return r;
        },requested_bases);
        const requests = result.reduce((r:string[],t)=>{
            if(t.meta.kind==="refresh") return r.concat(t.meta.data.request);
            else return r;
        },already_requests);
        if(tx.meta.kind==="request"&&!bases.some(b=>tx.meta.data.base.indexOf(b)!=-1)) return result.concat(tx);
        else if(tx.meta.kind==="refresh"&&requests.indexOf(tx.meta.data.request)===-1) return result.concat(tx);
        else return result;
    },[]);
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
    let size_sum = new BigNumber(0);
    const choosed = related.reduce((result:T.Tx[],tx)=>{
        if(size_sum.isGreaterThan(new BigNumber(block_size).times(0.9))) return result;
        const tx_size = new BigNumber(Buffer.from(JSON.stringify(tx)).length);
        const added_size = size_sum.plus(tx_size);
        size_sum = added_size;
        if(added_size.isGreaterThan(new BigNumber(block_size).times(0.9))) return result;
        else return result.concat(tx);
    },[]);
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
        store.refresh_pool(_.copy(new_pool));
        const new_refreshing = already_requests.concat(micro_block.txs.concat(micro_block.natives).concat(micro_block.units).filter(tx=>tx.meta.kind==="refresh").map(tx=>tx.meta.data.request));
        store.new_refreshing(_.copy(new_refreshing));
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
                if(pre.length>0&&(pre.map(u=>_.toHash(u.payee+u.request+u.index)).indexOf(_.toHash(new_unit.payee+new_unit.request+new_unit.index))!=-1||pre[0].output!=new_unit.output)) return store;
                store[target_pure.meta.data.request] = pre.concat(new_unit);
                return store;
            }
            else return store;
        })(_.copy(unit_store))
        const new_unit:T.Unit = {
            request:target_pure.meta.data.request,
            index:target_pure.meta.data.index,
            nonce:target_pure.meta.nonce,
            payee:target_pure.meta.data.payee,
            output:target_pure.meta.data.output,
            unit_price:target_pure.meta.unit_price
        }
        store.refresh_pool(_.copy(del_pool));
        store.add_unit(_.copy(new_unit));
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
        store.replace_chain(_.copy(back_chain));
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

        const add_blocks_data:Data[] = add_blocks.map(block=>{
            const data:Data = {
                type:'block',
                tx:[],
                block:[block]
            }
            return data;
        });

        store.refresh_roots(_.copy(info.roots));
        store.refresh_candidates(_.copy(info.candidates));
        store.replaceing(true);
        store.rep_limit(_.copy(add_blocks[add_blocks.length-1]).meta.index);
        /*await P.reduce(add_blocks,async (result:{pool:T.Pool,roots:{[key:string]:string},candidates:T.Candidates[],chain:T.Block[]},block:T.Block)=>{
            const accepted = await block_accept(block,result.chain.slice(),result.candidates.slice(),_.copy(result.roots),_.copy(result.pool),codes,secret,unit_store);
            return _.copy(accepted);
        },info);*/
        store.refresh_yet_data(_.copy(add_blocks_data).concat(_.copy(store.yet_data)));
        //add_blocks.forEach(block=>store.commit('push_yet_block',block));
        /*store.commit("checking",true);
        store.commit("checking",false);*/
        const amount = await get_balance(store.my_address);
        store.refresh_balance(amount);
    }else{
        console.log("not replace");
        store.replaceing(false);
    }
}

export const unit_buying = async (secret:string,units:T.Unit[],roots:{[key:string]:string},chain:T.Block[])=>{
    try{
        console.log("unit!");
        const pub_key:string[] = [CryptoSet.PublicFromPrivate(secret)]
        const native_remiter = CryptoSet.GenereateAddress(native,_.reduce_pub(pub_key));
        const unit_remiter = CryptoSet.GenereateAddress(unit,_.reduce_pub(pub_key));
        const unit_sellers = units.map(u=>u.payee);
        const native_sellers = unit_sellers.reduce((res:string[],add)=>{
            const index = res.indexOf(add);
            if(index===-1) return res.concat(add);
            else return res;
        },[]);
        const prices:number[] = Object.values(units.reduce((res:{[key:string]:number},unit)=>{
            const amount = res[unit.payee];
            if(amount==null){
                return _.new_obj(
                    res,
                    r=>{
                        r[unit.payee] = unit.unit_price;
                        return r;
                    }
                )
            }
            else{
                return _.new_obj(
                    res,
                    r=>{
                        r[unit.payee] = new BigNumber(amount).plus(unit.unit_price).toNumber();
                        return r;
                    }
                )
            }
        },{}));
        const pure_native_tx = TxSet.CreateRequestTx(pub_key,native_remiter,Math.pow(2,-3),"issue",native,_.copy([native_remiter].concat(native_sellers)),["remit",JSON.stringify(prices)],[],my_version,TxSet.empty_tx_pure().meta.pre,TxSet.empty_tx_pure().meta.next,Math.pow(2,-18));
        const pure_unit_tx = TxSet.CreateRequestTx(pub_key,native_remiter,Math.pow(2,-3),"issue",unit,_.copy([unit_remiter].concat("Vr:"+unit+":"+_.toHash(''))),["buy",JSON.stringify(units)],[],my_version,TxSet.empty_tx_pure().meta.pre,TxSet.empty_tx_pure().meta.next,Math.pow(2,-18));
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
            store.buying_unit(true);
            //console.error(unit_tx.hash);
            units.forEach(u=>{
                store.delete_unit(_.copy(u));
            });
            client.publish('/data',{type:'tx',tx:[native_tx],block:[]});
            client.publish('/data',{type:'tx',tx:[unit_tx],block:[]});
        }
    }
    catch(e){throw new Error(e);}
}

export const sleep = (msec:number)=>{
    return new Promise(function(resolve) {
        setTimeout(function() {resolve()}, msec);
     });
}

export const send_blocks = async ()=>{
    const unit_amount = await get_balance(store.unit_address);
    const last_key = BlockSet.search_key_block(_.copy(store.chain));
    const last_micros = BlockSet.search_micro_block(_.copy(store.chain),_.copy(last_key));
    const date = new Date();

    if(!store.replace_mode&&_.reduce_pub(last_key.meta.validatorPub)===CryptoSet.PublicFromPrivate(store.secret)&&last_micros.length<=max_blocks) await send_micro_block(_.copy(store.pool),store.secret,_.copy(store.chain),_.copy(store.candidates),_.copy(store.roots),store.unit_store);
    if(!store.replace_mode&&unit_amount>0&&date.getTime()-last_key.meta.timestamp>block_time*max_blocks) await send_key_block(_.copy(store.chain),store.secret,_.copy(store.candidates),_.copy(store.roots));

    if(store.isNode&&store.first_request&&!store.replace_mode&&unit_amount>0&&_.copy(store.chain).filter(b=>b.natives.length>0).length===0) {
        await send_request_tx(store.secret,"issue",native,[store.my_address,store.my_address],["remit",JSON.stringify([0])],[],_.copy(store.roots),_.copy(store.chain));
    }
}

export const set_config = async (_db:any,_store:Store)=>{
    db = _db;
    store = _store;
    await store.read();
    const last_block:T.Block = _.copy(store.chain[store.chain.length-1]) || _.copy(gen.block);
    const last_address = CryptoSet.GenereateAddress(native,_.reduce_pub(last_block.meta.validatorPub));
    if(last_address!=store.my_address){
        store.checking(true);
        socket.emit("checkchain");
    }
}

export const compute_tx = async ():Promise<void>=>{
    const now_yets:Data[] = _.copy(store.yet_data)
    const data:Data = now_yets.filter(d=>d.type==="tx"&&d.tx[0]!=null)[0];
    if(data!=null){
        const target:T.Tx = _.copy(data.tx[0]);
        //if(target.meta.kind==="request"||target.meta.data.index<store.state.chain.length){
        await tx_accept(_.copy(target),_.copy(store.chain),_.copy(store.roots),_.copy(store.pool),store.secret,_.copy(store.candidates),_.copy(store.unit_store));
    }
    let units:T.Unit[] = [];
    const reduced = now_yets.filter(d=>{
        if(d.type==="tx"&&d.tx[0]!=null&&data!=null&&d.tx[0].hash===data.tx[0].hash) return false;
        else if(d.type==="tx"&&d.tx[0]!=null){
            const t = _.copy(d.tx[0]);
            if(t.meta.kind==="request") return true;
            for(let block of _.copy(store.chain).slice(t.meta.data.index)){
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
    store.refresh_yet_data(_.copy(reduced));
    const pre_unit_store:{[key:string]:T.Unit[]} = _.copy(store.unit_store);
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
    store.refresh_unit_store(new_unit_store);
    await store.write();
    await sleep(block_time);
    setImmediate(compute_block);
}

export const compute_block = async ():Promise<void>=>{
    const data:Data = _.copy(store.yet_data[0]);
    if(data==null){
        store.replaceing(false);
        await send_blocks();
        console.log('yet:')
        console.log(store.yet_data.length);
        await sleep(block_time);
        //return await compute_yet();
    }
    /*else if(data.type==="tx"&&data.tx.length>0){
        const target:T.Tx = _.copy(data.tx[0]);
        //if(target.meta.kind==="request"||target.meta.data.index<store.state.chain.length){
        await tx_accept(_.copy(target),_.copy(store.chain),_.copy(store.roots),_.copy(store.pool),store.secret,_.copy(store.candidates),_.copy(store.unit_store));
        const now_yets:Data[] = _.copy(store.yet_data);
        const reduced = now_yets.filter(d=>{
            if(d.type==="tx"&&d.tx[0]!=null) return d.tx[0].hash!=target.hash;
            else if(d.type==="block"&&d.block[0]!=null) return true;
            else return false;
        });
        store.refresh_yet_data(_.copy(reduced));
        console.log('yet:')
        console.log(store.yet_data.length);
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
        const chain:T.Block[] = _.copy(store.chain);
        if(block.meta.version>=compatible_version){
            if(block.meta.index>chain.length){
                if(!store.replace_mode){
                    const address = CryptoSet.GenereateAddress(native,_.reduce_pub(block.meta.validatorPub));
                    if(address!=store.my_address){
                        store.checking(true);
                        socket.emit("checkchain",address);
                    }
                    else{
                        const deled_yet = _.copy(store.yet_data).slice(1);
                        store.refresh_yet_data(deled_yet);
                    }
                }
                else store.replaceing(false);
                //await send_blocks();
                await sleep(block_time);
                //return await compute_yet();
            }
            else if(block.meta.index===chain.length){
                if(store.replace_mode&&chain[chain.length-1].meta.index>=store.replace_index) store.replaceing(false);
                await block_accept(_.copy(block),_.copy(store.chain),_.copy(store.candidates),_.copy(store.roots),_.copy(store.pool),_.copy(store.not_refreshed_tx),store.now_buying,_.copy(store.unit_store))
                const new_chain:T.Block[] = _.copy(store.chain);
                if(store.replace_mode&&chain.length===new_chain.length) store.replaceing(false);
                if(store.replace_mode&&!store.isNode){
                    postMessage({
                        key:'replaceing',
                        val:true
                    });
                }
                else if(!store.isNode){
                    postMessage({
                        key:'replaceing',
                        val:false
                    });
                }
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
                    const pre_pool:T.Pool = _.copy(store.pool)
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
                    store.refresh_pool(_.copy(new_pool));
                    const pre_unit_store:{[key:string]:T.Unit[]} = _.copy(store.unit_store);
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
                    store.refresh_unit_store(new_unit_store);
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
                if(!store.isNode){
                    postMessage({
                        key:'refresh_balance',
                        val:balance
                    });
                }

                /*let refreshed_hash:string[] = [];
                let get_not_refresh:T.Tx[] = [];
                for(let block of _.copy(new_chain).slice().reverse()){
                    for(let tx of _.copy(block.txs.concat(block.natives).concat(block.units))){
                        if(_.copy(tx).meta.kind==="request"&&refreshed_hash.indexOf(_.copy(tx).hash)===-1) get_not_refresh.push(_.copy(TxSet.pure_to_tx(_.copy(tx),_.copy(block))));
                        else if(_.copy(tx).meta.kind==="refresh") refreshed_hash.push(_.copy(tx).meta.data.request);
                        else if(get_not_refresh.length>=10) break;
                    }
                }*/
                const refreshes:T.Tx[] = _.copy(store.not_refreshed_tx);
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
                    const index = store.req_index_map[req_tx.hash] || 0;
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

                /*const unit_store_values:T.Unit[][] = Object.values(store.unit_store);
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
                }*/
                if(store.isNode){
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
                    if(refreshed.length>0&&!store.now_buying&&!store.replace_mode){
                        const validatorPub = BlockSet.search_key_block(_.copy(reversed_chain)).meta.validatorPub;
                        const validator_address = CryptoSet.GenereateAddress(native,_.reduce_pub(validatorPub));
                        const buy_units = refreshed;
                        await unit_buying(store.secret,_.copy(buy_units),_.copy(store.roots),_.copy(new_chain));
                        //await send_blocks();
                    }
                }
                console.log('yet:')
                console.log(store.yet_data.length);
                await store.write();
                await send_blocks();
                if(!store.replace_mode||store.yet_data.length>10) await sleep(block_time);
                //return await compute_yet();
            }
            else{
                const now_yets:Data[] = _.copy(store.yet_data);
                const reduced = now_yets.filter(d=>{
                    if(d.type==="tx"&&d.tx[0]!=null) return true;
                    else if(d.type==="block"&&d.block[0]!=null) return d.block[0].meta.index>block.meta.index
                    else return false;
                });
                store.refresh_yet_data(_.copy(reduced));
                console.log('yet:')
                console.log(store.yet_data.length);
                await sleep(block_time);
                //return await compute_yet();
            }
        }
        else{
            const now_yets:Data[] = _.copy(store.yet_data);
            const reduced = now_yets.filter(d=>{
                if(d.type==="tx"&&d.tx[0]!=null) return true;
                else if(d.type==="block"&&d.block[0]!=null) return d.block[0].meta.index>block.meta.index
                else return false;
            });
            store.refresh_yet_data(_.copy(reduced));
            console.log('yet:')
            console.log(store.yet_data.length);
            await sleep(block_time);
            //return await compute_yet();
        }
    }
    setImmediate(compute_tx);
}