import * as _ from './basic'
import * as CryptoSet from './crypto_set'
import * as T from './types'
import * as StateSet from './state'
import * as TxSet from './tx'
import {RunVM} from './code'

export const empty_block = ():T.Block=>{
    const meta:T.BlockMeta = {
        version:0,
        shard_id:0,
        kind:"key",
        index:0,
        parenthash:_.toHash(""),
        timestamp:0,
        pow_target:0,
        pos_diff:0,
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
        natives:[],
        units:[]
    }
}

const search_key_block = (chain:T.Block[])=>{
    for(let block of chain.reverse()){
        if(block.meta.kind==="key") return block;
    }
    return empty_block();
}

const search_micro_block = (chain:T.Block[],key_block:T.Block):T.Block[]=>{
    return chain.slice(key_block.meta.index).filter((block:T.Block)=>{
        return block.meta.kind==="micro"&&_.reduce_pub(block.meta.validatorPub)===_.reduce_pub(key_block.meta.validatorPub)
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
    const txs:T.Tx[] = pure_txs.map((t,i)=>{
        return {
            hash:t.hash,
            meta:t.meta,
            raw:raws[i]
        }
    });
    return txs.reduce((sum,tx)=>sum+_.tx_fee(tx),0);
};

const PoS_mining = (parenthash:string,address:string,balance:number,difficulty:number)=>{
    let date;
    let timestamp
    let i=0;
    do {
      date = new Date();
      timestamp = date.getTime();
      i++;
      if(i>300) break;
      console.log("left:"+_.Hex_to_Num(_.toHash(parenthash+JSON.stringify(address)+timestamp.toString())))
      console.log("right:"+Math.pow(2,256)*balance/difficulty)
    } while (_.Hex_to_Num(_.toHash(parenthash))+_.Hex_to_Num(_.toHash(address))+timestamp>Math.pow(2,256)*balance/difficulty);
    return timestamp;
}

const Wait_block_time = (pre:number,block_time:number)=>{
    let date;
    let timestamp;
    do{
        date = new Date();
        timestamp = date.getTime();
    } while(timestamp-pre<block_time)
    return timestamp;
}

const txs_check = (block:T.Block,my_version:number,native:string,unit:string,chain:T.Block[],token_name_maxsize:number,StateData:T.State[],LocationData:T.Location[])=>{
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
    return target.some((tx:T.Tx)=>{
        if(tx.meta.kind==="request"){
            return !TxSet.ValidRequestTx(tx,my_version,native,unit,StateData,LocationData);
        }
        else if(tx.meta.kind==="refresh"){
            return !TxSet.ValidRefreshTx(tx,chain,my_version,native,unit,token_name_maxsize,StateData,LocationData);
        }
        else return true;
    });
}

export const ValidKeyBlock = (block:T.Block,chain:T.Block[],my_shard_id:number,my_version:number,right_candidates:T.Candidates[],right_stateroot:string,right_locationroot:string,block_time:number,max_blocks:number,block_size:number,unit:string,StateData:T.State[])=>{
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
    const validatorPub = meta.validatorPub;
    const candidates = meta.candidates;
    const stateroot = meta.stateroot;
    const locationroot = meta.locationroot;
    const tx_root = meta.tx_root;
    const fee_sum = meta.fee_sum;
    const raws = block.raws;


    const last = chain[chain.length-1];
    const right_parenthash = (()=>{
        if(last!=null) return last.hash;
        else return _.toHash('');
    })();


    const unit_validator = CryptoSet.GenereateAddress(unit,_.reduce_pub(validatorPub));
    const unit_validator_state:T.State = StateData.filter(s=>{return s.kind==="state"&&s.owner===unit_validator})[0] || StateSet.CreateState(0,unit_validator,unit,0,{},[]);

    const date = new Date();

    if(_.object_hash_check(hash,meta)||_.Hex_to_Num(_.toHash(parenthash))+_.Hex_to_Num(_.toHash(unit_validator_state.owner))+timestamp>Math.pow(2,256)*unit_validator_state.amount/pos_diff){
        console.log("invalid hash");
        return false;
    }
    else if(_.ObjectHash(unit_validator_state)===_.ObjectHash(StateSet.CreateState(0,unit_validator,unit,0,{},[]))||sign.length===0||sign.some((s,i)=>_.sign_check(hash,s,validatorPub[i]))){
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
    else if(parenthash!=right_parenthash){
        console.log("invalid parenthash");
        return false;
    }
    else if(_.time_check(timestamp)){
        console.log("invalid timestamp");
        return false;
    }
    else if(candidates!=_.ObjectHash(right_candidates)){
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
    else if(Buffer.from(JSON.stringify(meta)+JSON.stringify(block.txs)+JSON.stringify(block.natives)+JSON.stringify(block.units)+JSON.stringify(raws)).length>block_size){
        console.log("too big block");
        return false;
    }
    else{
        return true;
    }
}

export const ValidMicroBlock = (block:T.Block,chain:T.Block[],my_shard_id:number,my_version:number,right_candidates:T.Candidates[],right_stateroot:string,right_locationroot:string,block_time:number,max_blocks:number,block_size:number,native:string,unit:string,token_name_maxsize:number,StateData:T.State[],LocationData:T.Location[])=>{
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
    const validatorPub = meta.validatorPub;
    const candidates = meta.candidates;
    const stateroot = meta.stateroot;
    const locationroot = meta.locationroot;
    const tx_root = meta.tx_root;
    const fee_sum = meta.fee_sum;
    const txs = block.txs;
    const natives = block.natives;
    const units = block.units;
    const raws:T.TxRaw[] = block.raws;

    const empty = empty_block();
    const last = chain[chain.length-1];
    const right_parenthash = (()=>{
        if(last!=null) return last.hash;
        else return _.toHash('');
    })();
    const key_block = search_key_block(chain);
    const right_pub = key_block.meta.validatorPub;

    const validator = CryptoSet.GenereateAddress(unit,_.reduce_pub(validatorPub));
    const validator_state:T.State = StateData.filter(s=>{return s.kind==="state"&&s.owner===validator})[0] || StateSet.CreateState(0,validator,unit,0,{},[]);

    const tx_roots = txs.map(t=>t.hash).concat(natives.map(n=>n.hash)).concat(units.map(u=>u.hash));
    const pures = txs.map(tx=>{return {hash:tx.hash,meta:tx.meta}}).concat(natives.map(n=>{return {hash:n.hash,meta:n.meta}})).concat(units.map(u=>{return {hash:u.hash,meta:u.meta}}));

    const date = new Date();
    const now = date.getTime();

    const already_micro = search_micro_block(chain,key_block);

    if(_.object_hash_check(hash,meta)){
        console.log("invalid hash");
        return false;
    }
    else if(_.ObjectHash(validator_state)===_.ObjectHash(StateSet.CreateState(0,validator,unit,0,{},[]))||sign.length===0||sign.some((s,i)=>_.sign_check(hash,s,validatorPub[i]))){
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
    else if(parenthash!=right_parenthash){
        console.log("invalid parenthash");
        return false;
    }
    else if(last==null||_.time_check(timestamp)&&now-last.meta.timestamp<block_time){
        console.log("invalid timestamp");
        return false;
    }
    else if(_.ObjectHash(validatorPub)!=_.ObjectHash(right_pub)){
        console.log("invalid validator public key");
        return false;
    }
    else if(candidates!=_.ObjectHash(right_candidates)){
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
    else if(tx_root!=GetTreeroot(tx_roots)[0]){
        console.log("invalid tx_root");
        return false;
    }
    else if(fee_sum!=tx_fee_sum(pures,raws)){
        console.log("invalid fee_sum");
        return false;
    }
    else if(txs.length+natives.length+units.length!=raws.length){
        console.log("invalid raws");
        return false;
    }
    else if(Buffer.from(JSON.stringify(meta)+JSON.stringify(txs)+JSON.stringify(natives)+JSON.stringify(units)+JSON.stringify(raws)).length>block_size){
        console.log("too big block");
        return false;
    }
    else if(already_micro.length+1>max_blocks){
        console.log("too many micro blocks");
        return false;
    }
    else if(txs_check(block,my_version,native,unit,chain,token_name_maxsize,StateData,LocationData)){
        console.log("invalid txs");
        return false;
    }
    else if(txs.some(tx=>tx.meta.data.token===native||tx.meta.data.token===unit)){
        console.log("native tx or unit tx is in txs");
        return false;
    }
    else{
        return true;
    }
}

export const CreateKeyBlock = (version:number,shard_id:number,chain:T.Block[],block_time:number,max_blocks:number,pow_target:number,pos_diff:number,unit:string,validatorPub:string[],candidates:string,stateroot:string,locationroot:string,StateData:T.State[]):T.Block=>{
    const last = chain[chain.length-1];
    const parenthash = (()=>{
        if(last==null) return _.toHash('');
        else return last.hash;
    })();
    const validator_address = CryptoSet.GenereateAddress(unit,_.reduce_pub(validatorPub));
    const validator_state = StateData.filter(s=>{return s.kind==="state"&&s.owner===validator_address})[0]|| StateSet.CreateState(0,validator_address,unit,0,{},[]);
    const pre_key = search_key_block(chain);
    const timestamp = (()=>{
        const waited = Wait_block_time(pre_key.meta.timestamp,block_time*max_blocks);
        return PoS_mining(parenthash,validator_address,validator_state.amount,pos_diff);
    })()
    const empty = empty_block();
    const meta:T.BlockMeta = {
        version:version,
        shard_id:shard_id,
        kind:"key",
        index:chain.length,
        parenthash:parenthash,
        timestamp:timestamp,
        pow_target:pow_target,
        pos_diff:pos_diff,
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
        natives:[],
        units:[],
        raws:[]
    }
}

export const CreateMicroBlock = (version:number,shard_id:number,chain:T.Block[],pow_target:number,pos_diff:number,validatorPub:string[],candidates:string,stateroot:string,locationroot:string,txs:T.Tx[],natives:T.Tx[],units:T.Tx[],block_time:number):T.Block=>{
    const last = chain[chain.length-1];
    const timestamp = Wait_block_time(last.meta.timestamp,block_time);
    const pures:T.TxPure[] = txs.map(tx=>{return {hash:tx.hash,meta:tx.meta}}).concat(natives.map(n=>{return {hash:n.hash,meta:n.meta}})).concat(units.map(u=>{return {hash:u.hash,meta:u.meta}}));
    const raws:T.TxRaw[] = txs.map(tx=>tx.raw).concat(natives.map(n=>n.raw)).concat(units.map(u=>u.raw));
    const tx_root = GetTreeroot(txs.map(t=>t.hash).concat(natives.map(n=>n.hash)).concat(units.map(u=>u.hash)))[0];
    const fee_sum = tx_fee_sum(pures,raws);

    const meta:T.BlockMeta = {
        version:version,
        shard_id:shard_id,
        kind:"micro",
        index:chain.length,
        parenthash:last.hash,
        timestamp:timestamp,
        pow_target:pow_target,
        pos_diff:pos_diff,
        validatorPub:validatorPub,
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
        txs:txs.map(t=>TxSet.tx_to_pure(t)),
        natives:natives.map(n=>TxSet.tx_to_pure(n)),
        units:units.map(u=>TxSet.tx_to_pure(u)),
        raws:raws
    }
}

export const SignBlock = (block:T.Block,my_private:string,my_pub:string)=>{
    const index = block.meta.validatorPub.indexOf(my_pub);
    if(index===-1) return block;
    const sign = CryptoSet.SignData(block.hash,my_private);
    block.validatorSign[index] = sign;
    return block;
}

const get_units = (unit:string,StateData:T.State[])=>{
    return StateData.filter(s=>{return s.kind==="state"&&s.token===unit});
}

const reduce_units = (states:T.State[],rate:number)=>{
    return states.map(state=>{
        state.amount *= rate;
        return state;
    });
}

const CandidatesForm = (states:T.State[]):T.Candidates[]=>{
    return states.map(state=>{
        return {address:state.owner,amount:state.amount}
    });
}

const NewCandidates = (unit:string,rate:number,StateData:T.State[])=>{
    return CandidatesForm(reduce_units(get_units(unit,StateData),rate))
}


/*const check_fraud_proof = (block:T.Block,chain:T.Block[],code:string,gas_limit:number,StateData:T.State[])=>{
    const tx = _.find_tx(chain,block.meta.fraud.hash);
    const empty_state = StateSet.CreateState()
    const states = tx.meta.data.base.map(key=>{
        return StateData.filter(s=>{s.kind==="state"&&s.owner===key})[0] || empty_state;
    });
    if(block.meta.fraud.flag===false||tx===TxSet.empty_tx_pure()||tx.meta.kind!="refresh"||block.meta.fraud.step<0||!Number.isInteger(block.meta.fraud.step)||block.meta.fraud.step>tx.meta.data.trace.length-1||states.indexOf(empty_state)!=-1) return true;
    const this_block = chain[tx.meta.data.index];
    const req = this_block.txs.filter(t=>t.hash===tx.meta.data.request)[0];
    const inputs = this_block.raws[this_block.txs.indexOf(req)].raw;
    const result = RunVM(2,code,states,block.meta.fraud.step,inputs,req,tx.meta.data.trace,gas_limit);
    if(result.traced!=tx.meta.data.trace) return true;
    return false;
}*/

const change_unit_amounts = (block:T.Block,unit:string,rate:number,StateData:T.State[])=>{
    const reduced = StateData.map(s=>{
        if(s.kind!="state"||s.token!=unit) return s;
        return Object.assign({amount:s.amount*rate},s);
    });
    const validator = CryptoSet.GenereateAddress(unit,_.reduce_pub(block.meta.validatorPub));
    const index = reduced.map(r=>r.owner).indexOf(validator);
    if(index===-1) return reduced;
    const validator_state = reduced[index];
    const share_amount = block.units.reduce((sum,tx,i)=>{
        if(tx.meta.data.address!=validator) return sum+block.raws[block.txs.length+block.natives.length+i].raw[2].length;
        else return sum;
    },0);
    const shared = Object.assign({amount:validator_state.amount-share_amount*(1-rate)},validator_state);
    return StateData.map((val,i)=>{if(i===index)return shared; else return val;});
}

export const AcceptBlock = (block:T.Block,chain:T.Block[],my_shard_id:number,my_version:number,block_time:number,max_blocks:number,block_size:number,right_candidates:T.Candidates[],right_stateroot:string,right_locationroot:string,native:string,unit:string,rate:number,token_name_maxsize:number,StateData:T.State[],LocationData:T.Location[])=>{
    if(block.meta.kind==="key"&&ValidKeyBlock(block,chain,my_shard_id,my_version,right_candidates,right_stateroot,right_locationroot,block_time,max_blocks,block_size,native,StateData)){
        const new_candidates = NewCandidates(unit,rate,StateData);
        return {
            state:StateData,
            location:LocationData,
            candidates:new_candidates,
            block:[block]
        }
    }
    else if(block.meta.kind==="micro"&&ValidMicroBlock(block,chain,my_shard_id,my_version,right_candidates,right_stateroot,right_locationroot,block_time,max_blocks,block_size,native,unit,token_name_maxsize,StateData,LocationData)){
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
        const sets:[T.State[],T.Location[]] = [StateData,LocationData];
        const validator = CryptoSet.GenereateAddress(native,_.reduce_pub(block.meta.validatorPub));
        const refreshed = target.reduce((result,tx)=>{
            if(tx.meta.kind==="request"){
                return TxSet.AcceptRequestTx(tx,validator,block.meta.index,result[0],result[1]);
            }
            else if(tx.meta.kind==="refresh"){
                return TxSet.AcceptRefreshTx(tx,chain,validator,native,unit,result[0],result[1]);
            }
            else return result;
        },sets);
        const unit_changed = change_unit_amounts(block,unit,rate,refreshed[0]);

        const new_candidates = NewCandidates(unit,rate,StateData);
        return {
            state:unit_changed,
            location:refreshed[1],
            candidates:new_candidates,
            block:[block]
        }
    }
    else{
        return {
            state:StateData,
            location:LocationData,
            candidates:right_candidates,
            block:[]
        }
    }
}