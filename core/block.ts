import * as _ from './basic'
import * as CryptoSet from './crypto_set'
import * as T from './types'
import {Trie} from './merkle_patricia'
import * as StateSet from './state'
import {reduce,some,ForEach,filter} from 'p-iteration'
import { block_ips } from '../wallet/access_block';

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
            step:0
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
        raws:[]
    }
}

const check_fraud_proof = async (fraud:T.FraudInfo,block:T.Block,chain:T.Block[],my_shard_id:number,my_version:number,right_candidates:T.Candidates[],right_stateroot:string,right_locationroot:string,StateDate:Trie)=>{
    const tx = _.find_tx(chain,fraud.hash);
    if(tx==null) return false;
    return await ValidKeyBlock(block,chain,my_shard_id,my_version,right_candidates,right_stateroot,right_locationroot,StateDate);
}

const search_key_block = (chain:T.Block[])=>{
    for(let block of chain.reverse()){
        if(block.meta.kind==="key") return block;
    }
    return empty_block();
}

const search_micro_block = async (chain:T.Block[],key_block:T.Block,StateDate:Trie):Promise<T.Block[]>=>{
    return await filter(chain.slice(key_block.meta.index),async (block:T.Block)=>{
        const state:T.State = await StateDate.get(block.meta.validator);
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


const ValidKeyBlock = async (block:T.Block,chain:T.Block[],my_shard_id:number,my_version:number,right_candidates:T.Candidates[],right_stateroot:string,right_locationroot:string,StateDate:Trie)=>{
    const hash = block.hash;
    const sign = block.validatorSign;
    const meta = block.meta;
    const version = meta.version;
    const shard_id = meta.shard_id;
    const index = meta.index;
    const parenthash = meta.parenthash;
    const timestamp = meta.timestamp;
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

    const last = chain[chain.length-1];

    const validator_state:T.State = await StateDate.get(validator);

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
    else{
        return true;
    }
}

const ValidMicroBlock = async (block:T.Block,chain:T.Block[],my_shard_id:number,my_version:number,block_time:number,max_blocks:number,right_candidates:T.Candidates[],right_stateroot:string,right_locationroot:string,StateDate:Trie)=>{
    const hash = block.hash;
    const sign = block.validatorSign;
    const meta:T.BlockMeta = block.meta;
    const version = meta.version;
    const shard_id = meta.shard_id;
    const index = meta.index;
    const parenthash = meta.parenthash;
    const timestamp = meta.timestamp;
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

    const empty = empty_block();
    const last = chain[chain.length-1];
    const key_block = search_key_block(chain);
    const right_pub = key_block.meta.validatorPub;

    const validator_state:T.State = await StateDate.get(validator);

    const date = new Date();
    const now = date.getTime();

    const already_micro = await search_micro_block(chain,key_block,StateDate);

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
    else if(already_micro.length+1>max_blocks){
        console.log("too many micro blocks");
        return false;
    }
    else{
        return true;
    }
};