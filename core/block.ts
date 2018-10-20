import * as _ from './basic'
import * as CryptoSet from './crypto_set'
import * as T from './types'
import * as StateSet from './state'
import * as TxSet from './tx'
import {RunVM} from './code'
import {BigNumber} from 'bignumber.js'

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

export const search_key_block = (chain:T.Block[])=>{
    let block:T.Block;
    for(block of chain.slice().reverse()){
        if(block.meta.kind==="key") return block;
    }
    return empty_block();
}

export const search_micro_block = (chain:T.Block[],key_block:T.Block):T.Block[]=>{
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
    return txs.reduce((sum,tx)=>new BigNumber(sum).plus(_.tx_fee(tx)).toNumber(),0);
};

const PoS_mining = (parenthash:string,address:string,balance:number,difficulty:number)=>{
    let date;
    let timestamp
    let i=0;
    do {
      date = new Date();
      timestamp = date.getTime();
      i++;
      if(i>1000) break;
      //console.log("left:"+_.Hex_to_Num(_.toHash((new BigNumber(_.Hex_to_Num(parenthash)).plus(_.Hex_to_Num(address)).plus(timestamp)).toString())))
      //console.log("right:"+(new BigNumber(2).exponentiatedBy(256)).times(new BigNumber(balance).div(difficulty)).toString())
    } while (new BigNumber(_.Hex_to_Num(_.toHash((new BigNumber(_.Hex_to_Num(parenthash)).plus(_.Hex_to_Num(address)).plus(timestamp)).toString()))).isGreaterThan(new BigNumber(new BigNumber(2).exponentiatedBy(256)).times(new BigNumber(balance).div(difficulty))));
    return timestamp;
}

const Wait_block_time = (pre:number,block_time:number)=>{
    let date;
    let timestamp;
    do{
        date = new Date();
        timestamp = date.getTime();
    } while(new BigNumber(timestamp).minus(pre).isLessThan(new BigNumber(block_time)))
    return timestamp;
}

export const txs_check = (block:T.Block,my_version:number,native:string,unit:string,chain:T.Block[],token_name_maxsize:number,StateData:T.State[],LocationData:T.Location[])=>{
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
    return target.some((tx:T.Tx)=>{
        if(tx.meta.kind==="request"){
            return !TxSet.ValidRequestTx(tx,my_version,native,unit,true,StateData,LocationData);
        }
        else if(tx.meta.kind==="refresh"){
            return !TxSet.ValidRefreshTx(tx,chain,my_version,native,unit,true,token_name_maxsize,StateData,LocationData);
        }
        else return true;
    });
}

export const ValidKeyBlock = (block:T.Block,chain:T.Block[],my_shard_id:number,my_version:number,right_candidates:T.Candidates[],right_stateroot:string,right_locationroot:string,block_size:number,native:string,unit:string,StateData:T.State[],LocationData:T.Location[])=>{
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
    const txs = block.txs;
    const natives = block.natives;
    const units = block.units;

    const last = chain[chain.length-1];
    const right_parenthash = (()=>{
        if(last!=null) return last.hash;
        else return _.toHash('');
    })()
    const native_validator = CryptoSet.GenereateAddress(native,_.reduce_pub(validatorPub));
    const unit_validator = CryptoSet.GenereateAddress(unit,_.reduce_pub(validatorPub));
    const unit_validator_state:T.State = StateData.filter(s=>{return s.kind==="state"&&s.owner===unit_validator&&s.token===unit})[0] || StateSet.CreateState(0,unit_validator,unit,0,{},[]);
    /*console.log("dgw:")
    console.log(unit_validator_state.amount/pos_diff)
    console.log(chain.map(block=>{
        return {
            timestamp:block.meta.timestamp,
            target:Math.pow(2,256)*unit_validator_state.amount/pos_diff
        }
    }))
    console.log(dgw.getTarget(chain.map(block=>{
        return {
            timestamp:block.meta.timestamp,
            target:Math.pow(2,200)
        }
    }),block_time))*/

    const date = new Date();

    if(_.object_hash_check(hash,meta)||new BigNumber(_.Hex_to_Num(_.toHash((new BigNumber(_.Hex_to_Num(parenthash)).plus(_.Hex_to_Num(unit_validator)).plus(timestamp)).toString()))).isGreaterThan(new BigNumber(new BigNumber(2).exponentiatedBy(256)).times(new BigNumber(unit_validator_state.amount).div(pos_diff)))){
        console.log("invalid hash");
        return false;
    }
    /*else if(TxSet.requested_check([unit_validator],LocationData)){
        console.log("invalid validator");
        return false;
    }*/
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
    else if(new BigNumber(Buffer.from(JSON.stringify(meta)+JSON.stringify(block.txs)+JSON.stringify(block.natives)+JSON.stringify(block.units)+JSON.stringify(raws)).length).isGreaterThan(block_size)){
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
    const raws = block.raws;

    const empty = empty_block();
    const last = chain[chain.length-1];
    const right_parenthash = (()=>{
        if(last!=null) return last.hash;
        else return _.toHash('');
    })();
    const key_block = search_key_block(chain);
    const right_pub = key_block.meta.validatorPub;
    const native_validator = CryptoSet.GenereateAddress(native,_.reduce_pub(validatorPub));
    const unit_validator = CryptoSet.GenereateAddress(unit,_.reduce_pub(validatorPub));
    const validator = CryptoSet.GenereateAddress(unit,_.reduce_pub(validatorPub));
    const validator_state:T.State = StateData.filter(s=>{return s.kind==="state"&&s.token===unit&&s.owner===validator})[0] || StateSet.CreateState(0,validator,unit,0,{},[]);

    /*const native_request_check = natives.some(pure=>{
        if(pure.meta.kind==="refresh") return false;
        return pure.meta.data.base.indexOf(native_validator)!=-1;
    });

    const native_refresh_check = natives.some(pure=>{
        if(pure.meta.kind==="request") return false;
        const tx = TxSet.pure_to_tx(pure,block);
        const req = TxSet.find_req_tx(tx,chain);
        return req.meta.data.base.indexOf(native_validator)!=-1;
    });
    const unit_refresh_check = units.some(pure=>{
        if(pure.meta.kind==="request") return false;
        const tx = TxSet.pure_to_tx(pure,block);
        const req = TxSet.find_req_tx(tx,chain);
        return req.meta.data.base.indexOf(unit_validator)!=-1;
    })*/

    const tx_roots = txs.map(t=>t.hash).concat(natives.map(n=>n.hash)).concat(units.map(u=>u.hash));
    const pures = txs.map(tx=>{return {hash:tx.hash,meta:tx.meta}}).concat(natives.map(n=>{return {hash:n.hash,meta:n.meta}})).concat(units.map(u=>{return {hash:u.hash,meta:u.meta}}));

    const date = new Date();
    const now = date.getTime();

    const already_micro = search_micro_block(chain,key_block);


    if(_.object_hash_check(hash,meta)){
        console.log("invalid hash");
        return false;
    }
    else if(_.ObjectHash(validator_state)===_.ObjectHash(StateSet.CreateState(0,validator,unit,0,{},[]))){
        console.log("invalid validator");
        return false;
    }
    /*else if(TxSet.requested_check([unit_validator],LocationData)&&!unit_refresh_check){
        console.log("validator is already requested");
        console.log(block);
        return false;
    }*/
    else if(sign.length===0||sign.some((s,i)=>_.sign_check(hash,s,validatorPub[i]))){
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
    else if(last==null||_.time_check(timestamp)&&new BigNumber(now-last.meta.timestamp).isLessThan(block_time)){
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
    else if(new BigNumber(Buffer.from(JSON.stringify(meta)+JSON.stringify(txs)+JSON.stringify(natives)+JSON.stringify(units)+JSON.stringify(raws)).length).isGreaterThan(block_size)){
        console.log("too big block");
        return false;
    }
    else if(already_micro.length>max_blocks){
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
        //const waited = Wait_block_time(pre_key.meta.timestamp,block_time*max_blocks);
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

export const get_units = (unit:string,StateData:T.State[])=>{
    return StateData.filter(s=>{return s.kind==="state"&&s.token===unit});
}

const reduce_units = (states:T.State[],rate:number)=>{
    return states.map(state=>{
        return _.new_obj(
            state,
            s=>{
                s.amount = new BigNumber(s.amount).times(rate).toNumber();
                return s;
            }
        );
    });
}

export const CandidatesForm = (states:T.State[]):T.Candidates[]=>{
    return _.copy(states).slice().sort((a,b)=>{
        return _.Hex_to_Num(_.toHash(a.owner))-_.Hex_to_Num(_.toHash(b.owner))
    }).map(state=>{
        return {address:state.owner,amount:state.amount}
    });
}

export const NewCandidates = (unit:string,StateData:T.State[])=>CandidatesForm((get_units(unit,StateData)));



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

export const change_unit_amounts = (unit:string,rate:number,targets:string[],StateData:T.State[])=>{
    return StateData.map(s=>{
        if(s.kind!="state"||s.token!=unit) return s;
        return _.new_obj(
            s,
            s=>{
                s.amount = new BigNumber(s.amount).times(rate).toNumber();
                const index = targets.indexOf(s.owner);
                if(index!=-1&&s.data.reduce==null) s.data.reduce = rate.toFixed(18);
                else if(index!=-1) s.data.reduce = (new BigNumber(Number(s.data.reduce)).times(rate)).toFixed(18);
                return s;
            }
        );
    });
}

const compute_issue = (all_issue:number,index:number,cycle:number)=>{
    const new_amount = new BigNumber(all_issue).times(new BigNumber(0.5).exponentiatedBy(index+1));
    const pre_amount = new BigNumber(all_issue).times(new BigNumber(0.5).exponentiatedBy(index));
    const issue = pre_amount.minus(new_amount).div(cycle);
    if(issue.isLessThanOrEqualTo(new BigNumber(10).exponentiatedBy(-18))) return 0;
    else return issue.toNumber();
}

const issue_native = (block:T.Block,validator:string,all_issue:number,fee_sum:number,block_time:number,native:string,solvency:string[],StateData:T.State[])=>{
    const cycle = new BigNumber(126144000000).dividedToIntegerBy(block_time);
    const index = new BigNumber(block.meta.index);
    const i = index.div(cycle).integerValue(BigNumber.ROUND_DOWN).toNumber();
    const issue = compute_issue(all_issue,i,cycle.toNumber());
    const add = new BigNumber(issue).plus(fee_sum);
    return StateData.map(s=>{
        if(s.kind==="state"&&s.owner===validator&&s.token===native){
            return _.new_obj(
                s,
                (s)=>{
                    s.amount = new BigNumber(s.amount).plus(issue).toNumber();
                    const index = solvency.indexOf(validator);
                    if(index!=-1&&s.data.issue==null) s.data.issue = add.toFixed(18);
                    else if(index!=-1) s.data.issue = new BigNumber(Number(s.data.issue)).plus(add).toFixed(18);
                    return s;
                }
            )
        }
        else return s;
    })
}

export const AcceptBlock = (block:T.Block,chain:T.Block[],my_shard_id:number,my_version:number,block_time:number,max_blocks:number,block_size:number,right_candidates:T.Candidates[],right_stateroot:string,right_locationroot:string,native:string,unit:string,rate:number,token_name_maxsize:number,all_issue:number,StateData:T.State[],LocationData:T.Location[])=>{
    if(block.meta.kind==="key"&&ValidKeyBlock(block,chain,my_shard_id,my_version,right_candidates,right_stateroot,right_locationroot,block_size,native,unit,StateData,LocationData)){
        const validator = CryptoSet.GenereateAddress(native,_.reduce_pub(block.meta.validatorPub));
        const StateData_issued = issue_native(block,validator,all_issue,0,block_time,native,[],StateData);
        const StateData_unit = change_unit_amounts(unit,rate,[],StateData_issued);
        const new_candidates = NewCandidates(unit,StateData_unit);
        return {
            state:StateData_unit,
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
        const validator = CryptoSet.GenereateAddress(native,_.reduce_pub(block.meta.validatorPub));
        const sets:[T.State[],T.Location[]] = [StateData,LocationData];
        const refreshed = target.reduce((result,tx)=>{
            if(tx.meta.kind==="request"){
                return TxSet.AcceptRequestTx(tx,validator,block.meta.index,result[0],result[1]);
            }
            else if(tx.meta.kind==="refresh"){
                return TxSet.AcceptRefreshTx(tx,chain,validator,native,unit,result[0],result[1]);
            }
            else return result;
        },sets);
        const fee_sum = tx_fee_sum(target.map(t=>TxSet.tx_to_pure(t)),block.raws);
        const solvency = target.reduce((result:string[],tx)=>{
            if(tx.meta.kind!="request") return result;
            return result.concat(tx.meta.data.base);
        },[]);
        const unit_targets = units.reduce((result:string[],tx)=>{
            if(tx.meta.kind==="refresh") return result;
            return result.concat(tx.meta.data.address);
        },[]);
        const StateData_issued = issue_native(block,validator,all_issue,fee_sum,block_time,native,solvency,refreshed[0]);
        const unit_changed = change_unit_amounts(unit,rate,unit_targets,StateData_issued);

        const new_candidates = NewCandidates(unit,unit_changed);
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