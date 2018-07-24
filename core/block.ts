import * as _ from './basic'
import * as CryptoSet from './crypto_set'
import * as T from './types'
import {Trie} from './merkle_patricia'
import * as StateSet from './state'
import {map,filter,reduce} from 'p-iteration'
import * as TxSet from './tx'
import {RunVM} from './code'


const empty_block = ():T.Block=>{
    const meta:T.BlockMeta = {
        version:0,
        shard_id:0,
        kind:"key",
        index:0,
        parenthash:_.toHash(""),
        timestamp:0,
        fraud:{
            flag:false,
            index:0,
            hash:_.toHash(""),
            step:0,
            data:_.ObjectHash({states:[],inputs:[]})
        },
        pow_target:0,
        pos_diff:0,
        validator:_.toHash(""),
        token:"",
        validatorPub:[],
        candidates:_.toHash(""),
        stateroot:_.toHash(""),
        locationroot:_.toHash(""),
        tx_root:_.toHash(""),
        fee_sum:0
    }
    const hash = _.ObjectHash(meta);
    return {
        hash:hash,
        validatorSign:[],
        meta:meta,
        txs:[],
        raws:[],
        fraudData:{
            states:[],
            inputs:[]
        }
    }
}

const search_key_block = (chain:T.Block[])=>{
    for(let block of chain.reverse()){
        if(block.meta.kind==="key") return block;
    }
    return empty_block();
}

const search_micro_block = async (chain:T.Block[],key_block:T.Block,StateData:Trie):Promise<T.Block[]>=>{
    return await filter(chain.slice(key_block.meta.index),async (block:T.Block)=>{
        const state:T.State = await StateData.get(block.meta.validator);
        return block.meta.kind==="micro"&&block.meta.validatorPub.some((pub,i)=>_.address_check(state.contents.owner[i],pub,block.meta.token))
    });
}

export const GetTreeroot = (pre:string[]):string[]=>{
    if(pre.length==0) return [_.toHash("")];
    else if(pre.length==1) return pre;
    else{
    const union = pre.reduce((result:string[],val:string,index:number,array:string[]):string[]=>{
      const i = Number(index);
      if(i%2==0){
        const left = val;
        const right = ((left:string,i:number,array:string[])=>{
          if(array[i+1]==null) return _.toHash("");
          else return array[i+1];
        })(left,i,array);
        return result.concat(_.toHash(left+right));
      }
      else return result;
    },[]);
    return GetTreeroot(union);
    }
  }

const tx_fee_sum = (pure_txs:T.TxPure[],raws:T.TxRaw[])=>{
    const txs:T.Tx[] = pure_txs.map((t,i)=>{return {
        hash:t.hash,
        meta:t.meta,
        raw:raws[i]
    }});
    return txs.reduce((sum,tx)=>sum+_.tx_fee(tx),0);
  };


export const ValidKeyBlock = async (block:T.Block,chain:T.Block[],my_shard_id:number,my_version:number,right_candidates:T.Candidates[],right_stateroot:string,right_locationroot:string,block_time:number,max_blocks:number,block_size:number,StateData:Trie)=>{
    const hash = block.hash;
    const sign = block.validatorSign;
    const meta = block.meta;
    const version = meta.version;
    const shard_id = meta.shard_id;
    const index = meta.index;
    const parenthash = meta.parenthash;
    const timestamp = meta.timestamp;
    const fraud = meta.fraud;
    const pow_target = meta.pow_target;
    const pos_diff = meta.pos_diff;
    const validator = meta.validator;
    const token = meta.token;
    const validatorPub = meta.validatorPub;
    const candidates = meta.candidates;
    const stateroot = meta.stateroot;
    const locationroot = meta.locationroot;
    const tx_root = meta.tx_root;
    const fee_sum = meta.fee_sum;
    const raws = block.raws;
    const fraudData = block.fraudData;

    const last = chain[chain.length-1];

    const validator_state:T.State = await StateData.get(validator);

    const date = new Date();

    if(_.object_hash_check(hash,meta)||_.Hex_to_Num(_.toHash(last.hash)+_.ObjectHash(validator_state.contents.owner)+timestamp)>Math.pow(2,256)*validator_state.contents.amount/pos_diff){
        console.log("invalid hash");
        return false;
    }
    else if(validator_state==null||sign.some((s,i)=>_.sign_check(validator_state.contents.owner[i],token,hash,s,validatorPub[i]))){
        console.log("invalid validator signature");
        return false;
    }
    else if(version!=my_version){
        console.log("invalid version");
        return false;
    }
    else if(shard_id!=my_shard_id){
        console.log("invalid shard id");
        return false;
    }
    else if(index!=chain.length){
        console.log("invalid index");
        return false;
    }
    else if(parenthash!=last.hash){
        console.log("invalid parenthash");
        return false;
    }
    else if(_.time_check(timestamp)){
        console.log("invalid timestamp");
        return false;
    }
    else if(validator_state.contents.owner.some((add,i)=>_.address_check(add,validatorPub[i],token))){
        console.log("invalid validator addresses");
        return false;
    }
    else if(validatorPub.some(pub=>pub!=_.toHash(""))){
        console.log("invalid validator public key");
        return false;
    }
    else if(candidates!=_.ObjectHash(right_candidates.map(can=>_.ObjectHash(can)))){
        console.log("invalid candidates");
        return false;
    }
    else if(stateroot!=right_stateroot){
        console.log("invalid stateroot");
        return false;
    }
    else if(locationroot!=right_locationroot){
        console.log("invalid location");
        return false;
    }
    else if(tx_root!=_.toHash("")){
        console.log("invalid tx_root");
        return false;
    }
    else if(fee_sum!=0){
        console.log("invalid fee_sum");
        return false;
    }
    else if(raws.length>0){
        console.log("invalid raws");
        return false;
    }
    else if(fraudData.states.length!=0&&fraudData.inputs.length!=0&&_.object_hash_check(fraud.data,fraudData)){
        console.log("invalid fraudData");
    }
    else if(Buffer.from(JSON.stringify(meta)+JSON.stringify(raws)).length>block_size){
        console.log("too big block");
        return false;
    }
    else if(date.getTime()-search_key_block(chain).meta.timestamp<block_time*max_blocks&&fraud.flag===false){
        console.log("not valid validator");
        return false;
    }
    else{
        return true;
    }
}

export const ValidMicroBlock = async (block:T.Block,chain:T.Block[],my_shard_id:number,my_version:number,right_candidates:T.Candidates[],right_stateroot:string,right_locationroot:string,block_time:number,max_blocks:number,block_size:number,StateData:Trie)=>{
    const hash = block.hash;
    const sign = block.validatorSign;
    const meta:T.BlockMeta = block.meta;
    const version = meta.version;
    const shard_id = meta.shard_id;
    const index = meta.index;
    const parenthash = meta.parenthash;
    const timestamp = meta.timestamp;
    const fraud = meta.fraud;
    const pow_target = meta.pow_target;
    const pos_diff = meta.pos_diff;
    const validator = meta.validator;
    const token = meta.token;
    const validatorPub = meta.validatorPub;
    const candidates = meta.candidates;
    const stateroot = meta.stateroot;
    const locationroot = meta.locationroot;
    const tx_root = meta.tx_root;
    const fee_sum = meta.fee_sum;
    const txs = block.txs;
    const raws:T.TxRaw[] = block.raws;
    const fraudData = block.fraudData;

    const empty = empty_block();
    const last = chain[chain.length-1];
    const key_block = search_key_block(chain);
    const right_pub = key_block.meta.validatorPub;

    const validator_state:T.State = await StateData.get(validator);

    const date = new Date();
    const now = date.getTime();

    const already_micro = await search_micro_block(chain,key_block,StateData);

    if(_.object_hash_check(hash,meta)){
        console.log("invalid hash");
        return false;
    }
    else if(validator_state==null||sign.some((s,i)=>_.sign_check(validator_state.contents.owner[i],token,hash,s,right_pub[i]))){
        console.log("invalid validator signature");
        return false;
    }
    else if(version!=my_version){
        console.log("invalid version");
        return false;
    }
    else if(shard_id!=my_shard_id){
        console.log("invalid shard id");
        return false;
    }
    else if(index!=chain.length){
        console.log("invalid index");
        return false;
    }
    else if(parenthash!=last.hash){
        console.log("invalid parenthash");
        return false;
    }
    else if(_.time_check(timestamp)&&now-key_block.meta.timestamp<block_time){
        console.log("invalid timestamp");
        return false;
    }
    else if(validator_state.contents.owner.some((add,i)=>_.address_check(add,validatorPub[i],token))){
        console.log("invalid validator addresses");
        return false;
    }
    else if(validatorPub!=empty.meta.validatorPub){
        console.log("invalid validator public key");
        return false;
    }
    else if(candidates!=_.ObjectHash(right_candidates.map(can=>_.ObjectHash(can)))){
        console.log("invalid candidates");
        return false;
    }
    else if(stateroot!=right_stateroot){
        console.log("invalid stateroot");
        return false;
    }
    else if(locationroot!=right_locationroot){
        console.log("invalid location");
        return false;
    }
    else if(tx_root!=GetTreeroot(txs.map(tx=>tx.hash))[0]){
        console.log("invalid tx_root");
        return false;
    }
    else if(fee_sum!=tx_fee_sum(txs,raws)){
        console.log("invalid fee_sum");
        return false;
    }
    else if(fraudData.states.length!=0&&fraudData.inputs.length!=0&&_.object_hash_check(fraud.data,fraudData)){
        console.log("invalid fraudData");
    }
    else if(Buffer.from(JSON.stringify(meta)+JSON.stringify(raws)).length>block_size){
        console.log("too big block");
        return false;
    }
    else if(already_micro.length+1>max_blocks){
        console.log("too many micro blocks");
        return false;
    }
    else{
        return true;
    }
}

export const CreateKeyBlock = (version:number,shard_id:number,chain:T.Block[],fraud:T.FraudInfo,pow_target:number,pos_diff:number,validator:string,token:string,validatorPub:string[],candidates:string,stateroot:string,locationroot:string,fraudData:T.FraudData):T.Block=>{
    const last = chain[chain.length-1];
    const date = new Date();
    const empty = empty_block();
    const meta:T.BlockMeta = {
        version:version,
        shard_id:shard_id,
        kind:"key",
        index:chain.length,
        parenthash:last.hash,
        timestamp:date.getTime(),
        fraud:fraud,
        pow_target:pow_target,
        pos_diff:pos_diff,
        validator:validator,
        token:token,
        validatorPub:validatorPub,
        candidates:candidates,
        stateroot:stateroot,
        locationroot:locationroot,
        tx_root:empty.meta.tx_root,
        fee_sum:empty.meta.fee_sum
    }
    const hash = _.ObjectHash(meta);
    return {
        hash:hash,
        validatorSign:[],
        meta:meta,
        txs:[],
        raws:[],
        fraudData:fraudData
    }
}

export const CreateMicroBlock = (version:number,shard_id:number,chain:T.Block[],fraud:T.FraudInfo,pow_target:number,pos_diff:number,validator:string,token:string,candidates:string,stateroot:string,locationroot:string,txs:T.Tx[],fraudData:T.FraudData):T.Block=>{
    const last = chain[chain.length-1];
    const date = new Date();
    const pures:T.TxPure[] = txs.map(tx=>{return {hash:tx.hash,meta:tx.meta}});
    const raws:T.TxRaw[] = txs.map(tx=>tx.raw);
    const tx_root = GetTreeroot(pures.map(p=>p.hash))[0];
    const fee_sum = tx_fee_sum(pures,raws);
    const meta:T.BlockMeta = {
        version:version,
        shard_id:shard_id,
        kind:"micro",
        index:chain.length,
        parenthash:last.hash,
        timestamp:date.getTime(),
        fraud:fraud,
        pow_target:pow_target,
        pos_diff:pos_diff,
        validator:validator,
        token:token,
        validatorPub:[],
        candidates:candidates,
        stateroot:stateroot,
        locationroot:locationroot,
        tx_root:tx_root,
        fee_sum:fee_sum
    }
    const hash = _.ObjectHash(meta);
    return {
        hash:hash,
        validatorSign:[],
        meta:meta,
        txs:pures,
        raws:raws,
        fraudData:fraudData
    }
}

export const SignBlock = async (block:T.Block,password:string,my_pub:string,StateData:Trie)=>{
    const states:T.State = await StateData.get(block.meta.validator);
    if(states==null) return block;
    const index = states.contents.owner.map(add=>add.split(":")[2]).indexOf(_.toHash(my_pub));
    if(index===-1) return block;
    const sign = CryptoSet.SignData(block.hash,password);
    block.validatorSign[index] = sign;
    return block;
}

const get_units = async (unit_token:string,StateData:Trie)=>{
    const getted:{[key:string]:T.State} = await StateData.filter((key:string,val:any)=>{
        if(val==null) return false;
        const state:T.State = val;
        return state.contents.token===unit_token;
    });
    return Object.values(getted);
}

const reduce_units = (states:T.State[],rate:number)=>{
    return states.map(state=>{
        state.contents.amount *= rate;
        return state;
    });
}

const CandidatesForm = (states:T.State[]):T.Candidates[]=>{
    return states.map(state=>{
        return {address:state.contents.owner,amount:state.contents.amount}
    });
}

const NewCandidates = async (unit_token:string,rate:number,StateData:Trie)=>{
    return CandidatesForm(reduce_units(await get_units(unit_token,StateData),rate))
}

const tx_to_pure = (tx:T.Tx):T.TxPure=>{
    return{
        hash:tx.hash,
        meta:tx.meta
    }
}

const check_fraud_proof = async (block:T.Block,chain:T.Block[],code:string,gas_limit:number,StateData:Trie)=>{
    const tx = _.find_tx(chain,block.meta.fraud.hash);
    const empty_state = StateSet.CreateState(0,[],"",{},[])
    const states:T.State[] = await map(tx.meta.data.base,async (key:string)=>{return await StateData.get(key)||empty_state});
    if(block.meta.fraud.flag===false||tx===TxSet.empty_tx_pure()||tx.meta.kind!="refresh"||block.meta.fraud.step<0||!Number.isInteger(block.meta.fraud.step)||block.meta.fraud.step>tx.meta.data.trace.length-1||states.indexOf(empty_state)!=-1) return true;
    const this_block = chain[tx.meta.data.index];
    const req = this_block.txs.filter(t=>t.hash===tx.meta.data.request)[0];
    const inputs = this_block.raws[this_block.txs.indexOf(req)].raw;
    const result:string[] = await RunVM(2,code,states,block.meta.fraud.step,inputs,req,tx.meta.data.trace,gas_limit);
    if(result!=tx.meta.data.trace) return true;
    return false;
}

export const AcceptBlock = async (block:T.Block,chain:T.Block[],my_shard_id:number,my_version:number,block_time:number,max_blocks:number,block_size:number,right_candidates:T.Candidates[],right_stateroot:string,right_locationroot:string,code:string,gas_limit:number,unit_token:string,rate:number,key_currency:string,pow_target:number,token_name_maxsize:number,StateData:Trie,pre_StateData:Trie,LocationData:Trie)=>{
    let index = block.meta.index;
    if(block.meta.fraud.flag){
        index = block.meta.fraud.index-1;
        StateData = pre_StateData;
        right_stateroot = chain[block.meta.fraud.index].meta.stateroot;
        right_locationroot = chain[block.meta.fraud.index].meta.locationroot;
        right_candidates = await NewCandidates(unit_token,rate,pre_StateData);
    }
    if(block.meta.kind==="key"&&await ValidKeyBlock(block,chain,my_shard_id,my_version,right_candidates,right_stateroot,right_locationroot,block_time,max_blocks,block_size,StateData)&&(block.meta.fraud.flag===false||await check_fraud_proof(block,chain,code,gas_limit,StateData))){
        const new_candidates = await NewCandidates(unit_token,rate,StateData);
        return {
            state:StateData,
            location:LocationData,
            candidates:new_candidates
        }
    }
    else if(block.meta.kind==="micro"&&await ValidMicroBlock(block,chain,my_shard_id,my_version,right_candidates,right_stateroot,right_locationroot,block_time,max_blocks,block_size,StateData)&&(block.meta.fraud.flag===false||await check_fraud_proof(block,chain,code,gas_limit,StateData))){
        const txs = block.txs.map((tx,i):T.Tx=>{
            return {
                hash:tx.hash,
                meta:tx.meta,
                raw:block.raws[i]
            }
        });
        const refreshed:Trie[] = await reduce(txs, async (result:Trie[],tx:T.Tx)=>{
            if(tx.meta.kind==="request"){
                return await TxSet.AcceptRequestTx(tx,my_version,key_currency,block.meta.validator,index,result[0],result[1]);
            }
            else if(tx.meta.kind==="refresh"){
                return await TxSet.AcceptRefreshTx(tx,chain,my_version,pow_target,key_currency,token_name_maxsize,result[0],result[1]);
            }
            else return result;
        },[StateData,LocationData]);
        const new_candidates = await NewCandidates(unit_token,rate,StateData);
        return {
            state:refreshed[0],
            location:refreshed[1],
            candidates:new_candidates
        }
    }
    else{
        return {
            state:StateData,
            location:LocationData,
            candidates:right_candidates
        }
    }
}