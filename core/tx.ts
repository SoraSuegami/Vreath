import * as _ from './basic'
import * as CryptoSet from './crypto_set'
import * as T from './types'
import * as StateSet from './state'
import * as BlockSet from './block'
import {BigNumber} from 'bignumber.js'

export const empty_tx = ():T.Tx=>{
  const data:T.TxData = {
    address:"",
    pub_key:[],
    timestamp:0,
    log_hash:"",
    gas:0,
    solvency:"[]",
    type:"change",
    token:"",
    base:[],
    input:"",
    request:_.toHash(""),
    index:0,
    payee:"[]",
    output:""
  }

  const meta:T.TxMeta = {
    kind:"request",
    version:0,
    purehash:_.ObjectHash(data),
    nonce:0,
    unit_price:0,
    pre:{
      flag:false,
      hash:_.toHash("")
    },
    next:{
      flag:false,
      hash:_.toHash("")
    },
    feeprice:0,
    data:data
  }

  const raw:T.TxRaw = {
    signature:[],
    raw:[],
    log:[]
  }

  const hash = _.ObjectHash(meta);

  return {
    hash:hash,
    meta:meta,
    raw:raw
  };
}

export const tx_to_pure = (tx:T.Tx):T.TxPure=>{
  return {
    hash:tx.hash,
    meta:tx.meta
  }
}

export const pure_to_tx = (pure:T.TxPure,block:T.Block):T.Tx=>{
  const index = block.txs.concat(block.natives).concat(block.units).map(tx=>tx.hash).indexOf(pure.hash);
  if(index===-1) return empty_tx();
  const raw = block.raws[index];
  return {
      hash:pure.hash,
      meta:pure.meta,
      raw:raw
  }
}

export const empty_tx_pure = ()=>{
  const tx = empty_tx();
  return {
    hash:tx.hash,
    meta:tx.meta
  }
}

export const empty_location = ():T.Location => {
  return {
    address:CryptoSet.GenereateAddress("",_.toHash("")),
    state:"yet",
    index:0,
    hash:_.toHash("")
  }
}

export const requested_check = (base:string[],LocationData:T.Location[])=>{
  const addresses = LocationData.map(l=>l.address);
  return base.some(key=>{
    const index = addresses.indexOf(key);
    const val = LocationData[index];
    if(index===-1) return false;
    else if(val.state==="yet") return false;
    else return true;
  });
}

const hashed_pub_check = (state:T.State,pubs:string[])=>{
  return state.owner.split(':')[2]!=_.toHash(_.reduce_pub(pubs));
}

export const refreshed_check = (base:string[],index:number,tx_hash:string,LocationData:T.Location[])=>{
  const addresses = LocationData.map(l=>l.address);
  return base.some(key=>{
    if(key.split(':')[2]===_.toHash('')) return false;
    const i = addresses.indexOf(key);
    const val = LocationData[i];
    if(i===-1) return true;
    else if(val.state==="already"&&val.index===index&&val.hash===tx_hash) return false;
    else return true;
  });
}

const state_check = (state:T.State,token_name_maxsize:number)=>{
  return _.address_form_check(state.owner,token_name_maxsize) || new BigNumber(state.amount).isLessThan(0) ||
  state.product.some(pro=>new BigNumber(Buffer.from(pro).length).isGreaterThan(token_name_maxsize));
}

const base_declaration_check = (target:T.State,bases:string[],StateData:T.State[])=>{
  const getted = StateData.filter(s=>{return s.owner===target.owner})[0];
  return getted!=null && bases.indexOf(target.owner)===-1;
}

const output_check = (type:T.TxTypes,base_states:T.State[],output_raw:string[],token_name_maxsize:number,StateData:T.State[])=>{
  if(type==="create"){
    const token_state:T.State = JSON.parse(output_raw[0]);
    const code:string = output_raw[1];
    const getted:T.State = StateData.filter(s=>{return s.kind==="token"&&s.token===token_state.token})[0]
    const dev_check = token_state.developer.some((dev)=>{
      return _.address_form_check(dev,token_name_maxsize)
    });
    if(getted!=null||dev_check||token_state.nonce!=0||new BigNumber(token_state.issued).isLessThan(0)||token_state.code!=_.toHash(code)) return true;
    else return false;
  }
  else if(type==="update"){
    const token_state:T.State = JSON.parse(output_raw[0]);
    const key = token_state.token;
    const empty = StateSet.CreateToken();
    const getted:T.State = StateData.filter(s=>{return s.kind==="token"&&s.token===key})[0]
    const dev_check = token_state.developer.some((dev)=>{
      return _.address_form_check(dev,token_name_maxsize)
    });
    const comm = getted.committed.some((c:string)=>{
      return token_state.committed.indexOf(c)===-1
    });
    if(getted==null||dev_check||new BigNumber(token_state.deposited).isLessThan(0)||comm) return true;
    else return false;
  }
  else{
    const new_states:T.State[] = output_raw.reduce((arr,o)=>{
      return arr.concat(JSON.parse(o));
    },[]);
    const bases = base_states.map(s=>s.owner);
    if(new_states.some((s:T.State)=>{return state_check(s,token_name_maxsize)||base_declaration_check(s,bases,StateData)})) return true;
    return false;
    /*const pre_amount = base_states.reduce((sum,s)=>new BigNumber(sum).plus(s.amount).toNumber(),0);
    const new_amount = new_states.reduce((sum,s)=>new BigNumber(sum).plus(s.amount).toNumber(),0);
    console.log(pre_amount);
    console.log(new_amount)
    return (type==="issue"&&new BigNumber(pre_amount).isGreaterThan(new_amount)) || (type==="change"&&!(new BigNumber(pre_amount).isEqualTo(new_amount))) || (type==="scrap"&&new BigNumber(pre_amount).isLessThan(new_amount));*/
  }
}

const search_related_tx = (chain:T.Block[],hash:string,order:'pre'|'next',caller_hash:string):T.TxMeta=>{
  let block:T.Block;
  let txs:T.TxPure[];
  let i:number;
  let tx:T.TxPure;
  for(block of chain.slice().reverse()){
    txs = block.txs.concat(block.natives).concat(block.units);
    i = txs.map(tx=>tx.meta.purehash).indexOf(hash);
    if(i!=-1){
      tx = _.copy(txs[i]);
      if(tx.meta.kind=="request"&&tx.meta[order].flag===true&&tx.meta[order].hash===caller_hash) return tx.meta;
    }
  }
  return empty_tx_pure().meta;
}

export const list_up_related = (chain:T.Block[],tx:T.TxMeta,order:'pre'|'next'):T.TxMeta[]=>{
  if(tx[order].flag===false) return [];
  const ori_order = (()=>{
    if(order==='pre') return 'pre';
    else return 'next'
  })();
  const count_order = (()=>{
    if(order==='pre') return 'next';
    else return 'pre'
  })();
  const searched = search_related_tx(chain,tx[ori_order].hash,count_order,tx.purehash);
  if(searched.purehash===empty_tx_pure().meta.purehash||searched.kind!="request") return [];
  return [searched];
}

const mining = (request:string,index:number,refresher:string,output:string,target:number)=>{
  let nonce:number = -1;
  let num:number = 0;
  let i:number = 0;
  do{
    i ++;
    if(i>1000000) break;
    nonce ++;
    num = _.Hex_to_Num(_.toHash(new BigNumber(_.Hex_to_Num(request)).plus(index).plus(nonce).plus(_.Hex_to_Num(refresher)).plus(_.Hex_to_Num(output)).toString()));
  }while(new BigNumber(num).isGreaterThan(target));
  return nonce;
}

export const find_req_tx = (ref_tx:T.Tx,chain:T.Block[]):T.Tx=>{
  const index = ref_tx.meta.data.index || 0;
  const block = chain[index] || BlockSet.empty_block();
  const req_pure = block.txs.filter(tx=>tx.hash===ref_tx.meta.data.request).concat(block.natives.filter(tx=>tx.hash===ref_tx.meta.data.request)).concat(block.units.filter(tx=>tx.hash===ref_tx.meta.data.request))[0];
  if(req_pure==null) return empty_tx();
  const raw_index = (()=>{
    const txs = block.txs.indexOf(req_pure);
    if(txs!=-1) return txs;
    const natives = block.natives.indexOf(req_pure);
    if(natives!=-1) return block.txs.length+natives;
    const units = block.units.indexOf(req_pure);
    if(units!=-1) return block.txs.length+block.natives.length+units;
    return -1;
  })();
  const req_raw = block.raws[raw_index];
  return {
    hash:req_pure.hash,
    meta:req_pure.meta,
    raw:req_raw
  }
}

/*const search_related_raw = (chain:T.Block[],hash:string,order:'pre'|'next',caller_hash:string):T.TxRaw=>{
  for(let block of chain){
    if(block.meta.kind==="key") continue;
    for(let i in block.txs){
      const tx = block.txs[i];
      if(tx.meta.kind=="request"&&tx.meta.purehash===hash&&tx.meta[order].flag===true&&tx.meta[order].hash===caller_hash) return block.raws[i];
    }
  }
  return empty_tx().raw;
}*/

const compute_new_state = (state_raw:string[],solvency:string,payee:string,fee:number,gas:number,native:string,unit:string)=>{
  const output_states:T.State[] = state_raw.map(s=>JSON.parse(s||JSON.stringify(StateSet.CreateState())));
  const output_owners = output_states.map(o=>o.owner);
  const outputed = output_states.map(s=>{
    const i = output_owners.indexOf(s.owner);
    if(i!=-1) return output_states[i];
    else return s;
  });
  const solvencied = outputed.map(s=>{
    if(s.owner===solvency){
      return _.new_obj(
        s,
        s=>{
          s.amount = new BigNumber(s.amount).minus(gas).toNumber();
          return s;
        }
      )
    }
    else return s;
  });
  const payed = solvencied.map(s=>{
    if(s.owner===payee){
      return _.new_obj(
        s,
        s=>{
          s.amount = new BigNumber(s.amount).plus(gas).minus(fee).toNumber();
          return s;
        }
      )
    }
    else return s;
  });
  const issued = payed.map(s=>{
    if(s.kind!="state"||s.token!=native) return s;
    const issue = Number(s.data.issue||"0");
    return _.new_obj(
      s,
      s=>{
        s.amount = new BigNumber(s.amount).plus(issue).toNumber();
        s.data.issue = (0).toFixed(18);
        return s;
      }
    )
  });
  const reduced = issued.map(s=>{
    if(s.kind!="state"||s.token!=unit) return s;
    const reduce = Number(s.data.reduce||"1");
    return _.new_obj(
      s,
      s=>{
        s.amount = new BigNumber(s.amount).times(reduce).toNumber();
        s.data.reduce = (1).toFixed(18);
        return s;
      }
    )
  });
  const token_changed = reduced.map(s=>{
    if(s.kind!="token") return s;
    const i = output_owners.indexOf(s.owner);
    if(i===-1) return s;
    const change = output_states[i];
    if(change.kind!="token") return s;
    return _.new_obj(
      s,
      s=>{
        s.nonce += change.nonce;
        s.deposited = new BigNumber(s.deposited).plus(change.deposited).toNumber();
        s.issued = new BigNumber(s.issued).plus(change.issued).toNumber();
        s.committed = s.committed.concat(change.committed);
        return s;
      }
    )
  })
  const pretty = token_changed.map((s,i)=>{
    const index = output_owners.indexOf(s.owner);
    if(index!=i) return issued[index];
    else return s;
  });
  return pretty;
}

/*const ValidNative = (req_tx:T.Tx,ref_tx:T.Tx,chain:T.Block[],StateData:T.State[])=>{
  try{
    const base_state = StateData.filter(s=>{return s.kind==="state"&&s.owner===req_tx.meta.data.base[0]})[0] || StateSet.CreateState();
    const new_state:T.State = JSON.parse(ref_tx.raw.raw[0]) || StateSet.CreateState();
    if(_.ObjectHash(base_state)===_.ObjectHash(StateSet.CreateState())||_.ObjectHash(new_state)===_.ObjectHash(StateSet.CreateState())) return true;
    const inputs = req_tx.raw.raw;
    const type = inputs[0];
    const other = inputs[1];
    const amount = Number(inputs[2]);
    const empty_token = StateSet.CreateToken();
    const valid_state = iassign(
      base_state,
      (state)=>{
        state.nonce ++ ;
        state.amount += amount;
        return state;
      }
    );
    switch(type){
      case "remit":
        return req_tx.meta.data.type!="scrap"||base_state.owner!=req_tx.meta.data.address||new_state.amount-base_state.amount!=amount||_.ObjectHash(valid_state)!=_.ObjectHash(new_state)||amount>=0;

      case "deposit":
        if(req_tx.meta.data.type!="scrap"||base_state.owner!=req_tx.meta.data.address||amount>=0||new_state.amount-base_state.amount!=amount||req_tx.meta.next.flag!=true||_.ObjectHash(valid_state)!=_.ObjectHash(new_state)) return true;
        const depo_meta = search_related_tx(chain,req_tx.meta.next.hash,'pre',req_tx.meta.purehash);
        const depo_raw = search_related_raw(chain,req_tx.meta.next.hash,'pre',req_tx.meta.purehash);
        const depo_token_info:T.State = JSON.parse(depo_raw.raw[0]) || empty_token;
        return !(depo_meta.data.type==="update"&&depo_token_info!=empty_token&&depo_token_info.token===req_tx.meta.data.token&&amount+depo_token_info.deposited===0&&other===depo_token_info.token&&valid_state.amount>0);

      case "withdrawal":
        if(req_tx.meta.data.type!="issue"||base_state.owner!=req_tx.meta.data.address||amount<=0||new_state.amount-base_state.amount!=amount||req_tx.meta.pre.flag!=true||_.ObjectHash(valid_state)!=_.ObjectHash(new_state))return true;
        const with_meta = search_related_tx(chain,req_tx.meta.next.hash,'pre',req_tx.meta.purehash);
        const with_raw= search_related_raw(chain,req_tx.meta.next.hash,'next',req_tx.meta.purehash);
        const with_token_info:T.State = JSON.parse(with_raw.raw[0]) || empty_token;
        const pre_token_info:T.State = StateData.filter(s=>{return s.kind==="token"&&s.token===with_token_info.token})[0] || empty_token;
        return !(with_meta.data.type==="update"&&with_token_info!=empty_token&&pre_token_info!=empty_token&&with_token_info.token===req_tx.meta.data.token&&amount+with_token_info.deposited===0&&other===with_token_info.token&&valid_state.amount>0&&pre_token_info.deposited-amount>0);

      default:
        return true;
    }
  }
  catch(e){
    console.log(e);
    return true;
  }
}

const ValidUnit = (req_tx:T.Tx,ref_tx:T.Tx,chain:T.Block[],StateData:T.State[])=>{
    const base_state:T.State = StateData.filter(s=>{return s.kind==="state"&&s.owner===req_tx.meta.data.base[0]})[0] || StateSet.CreateState();
    const new_state:T.State = JSON.parse(ref_tx.raw.raw[0]) || StateSet.CreateState();
    if(_.ObjectHash(base_state)!=_.ObjectHash(StateSet.CreateState())||_.ObjectHash(new_state)!=_.ObjectHash(StateSet.CreateState())) return true;
    const inputs = req_tx.raw.raw;
    const type = inputs[0];
    const remiter = inputs[1];
    const units:T.Unit[] = JSON.parse(inputs[2]);
    const prices = units.map(u=>u.unit_price);
    const price_sum = prices.reduce((sum,p)=>{return sum+p},0)
    const valid_state =
    prices.reduce((state,price)=>{
        state.nonce ++;
        state.amount -= price;
        return state;
    },base_state);
    const mined_check = units.some(u=>{
      const request = u.request;
      const index = u.index;
      const nonce = u.nonce;
      const payee = u.payee;
      const output = u.output;
      const pow_target = chain[index].meta.pow_target;
      return _.Hex_to_Num(request)+index+nonce+_.Hex_to_Num(payee)+_.Hex_to_Num(output)>pow_target;
    });
    const empty_state = StateSet.CreateState();
    const empty_token = StateSet.CreateToken();

    switch(type){
      case "buy":
        const remit_state:T.State = StateData.filter(s=>{return s.kind==="state"&&s.owner===remiter})[0] || empty_state;
        const commit_token:T.State = StateData.filter(s=>{return s.kind==="token"&&s.token===unit})[0] || empty_token;
        const committed = units.map(item=>_.ObjectHash(item)).some(key=>{
          return commit_token.committed.indexOf(key)!=-1;
        });
        return mined_check||req_tx.meta.data.type!="issue"||base_state.owner!=req_tx.meta.data.address||new_state.amount-base_state.amount!=units.length||req_tx.meta.pre.flag!=true||valid_state!=new_state||remit_state===empty_state||commit_token===empty_token||remit_state.amount-price_sum<0||committed;
      default:
        return true;
    }
}*/


export const ValidTxBasic = (tx:T.Tx,my_version:number)=>{
  const hash = tx.hash;
  const tx_meta = tx.meta;
  const version = tx_meta.version;
  const purehash = tx_meta.purehash;
  const pre = tx_meta.pre;
  const next = tx_meta.next;
  const tx_data = tx_meta.data;
  const address = tx_data.address;
  const token = tx_data.token;
  const pub_key = tx_data.pub_key;
  const timestamp = tx_data.timestamp;
  const input = tx_data.input;
  const log_hash = tx_data.log_hash;
  const raw = tx.raw;
  const sign = raw.signature;
  const raw_data = raw.raw;
  const log_raw = raw.log;

  if(_.object_hash_check(hash,tx_meta)){
    console.log("invalid hash");
    return false;
  }
  else if(version!=my_version){
    console.log("different version");
    return false;
  }
  else if(_.object_hash_check(purehash,tx_data)){
    console.log("invalid purehash");
    return false;
  }
  else if(_.hash_size_check(hash)||_.hash_size_check(purehash)||_.hash_size_check(pre.hash)||_.hash_size_check(next.hash)){
    console.log("invalid hash size");
    return false;
  }
  else if(address.length===0||_.address_check(address,_.reduce_pub(pub_key),token)){
    console.log("invalid address");
    return false;
  }
  else if(_.time_check(timestamp)){
    console.log("invalid timestamp");
    return false;
  }
  else if(sign.length===0||sign.some((s,i)=>_.sign_check(hash,s,pub_key[i]))){
    console.log("invalid signature");
    return false;
  }
  else if(log_hash!=_.ObjectHash(log_raw)){
    console.log("invalid log hash");
    return false;
  }
  else{
    return true;
  }
}

export const ValidRequestTx = (tx:T.Tx,my_version:number,native:string,unit:string,request_mode:boolean,StateData:T.State[],LocationData:T.Location[])=>{
  const tx_meta = tx.meta;
  const kind = tx_meta.kind;
  const tx_data = tx_meta.data;
  const address = tx_data.address;
  const pub_key = tx_data.pub_key;
  const gas = tx_data.gas;
  const solvency = tx_data.solvency;
  const token = tx_data.token;
  const base = tx_data.base;
  const input = tx_data.input;
  const raw_data = tx.raw.raw;
  const solvency_state:T.State = StateData.filter(s=>{
    return s.kind==="state"&&s.token===native&&s.owner===solvency&&new BigNumber(s.amount).minus(_.tx_fee(tx)).minus(gas).isGreaterThanOrEqualTo(0);
  })[0];

  const base_states = base.map(key=>{
    return StateData.filter(s=>{return s.owner===key})[0] || StateSet.CreateState();
  });

  if(!ValidTxBasic(tx,my_version)){
    return false;
  }
  else if(kind!="request"){
    console.log("invalid kind");
    return false;
  }
  else if(solvency_state==null||hashed_pub_check(solvency_state,pub_key)){
    console.log("invalid solvency");
    return false;
  }
  else if(base_states.indexOf(StateSet.CreateState())!=-1){
    console.log("invalid base");
    return false;
  }
  else if(request_mode&&requested_check(base,LocationData)){
    console.log("base states are already requested");
    return false;
  }
  else if(input!=_.ObjectHash(raw_data)){
    console.log("invalid input hash");
    return false;
  }
  else{
    return true;
  }
}


export const ValidRefreshTx = (tx:T.Tx,chain:T.Block[],my_version:number,native:string,unit:string,refresh_mode:boolean,token_name_maxsize:number,StateData:T.State[],LocationData:T.Location[])=>{
  const hash = tx.hash;
  const tx_meta = tx.meta;
  const nonce = tx_meta.nonce;
  const unit_price = tx_meta.unit_price;
  const kind = tx_meta.kind;
  const tx_data = tx_meta.data;
  const address = tx_data.address;
  const pub_key = tx_data.pub_key;
  const request = tx_data.request;
  const index = tx_data.index;
  const payee = tx_data.payee;
  const output = tx_data.output;
  const raw = tx.raw;
  const output_raw = raw.raw;
  const block = chain[index] || BlockSet.empty_block();
  const pow_target = block.meta.pow_target;
  const req_tx = find_req_tx(tx,chain);

  const req_raw = block.raws[block.txs.concat(block.natives).concat(block.units).map(tx=>tx.hash).indexOf(req_tx.hash)] || empty_tx().raw;

  const fee = _.tx_fee(tx);

  const block_tx_hashes = block.txs.concat(block.natives).concat(block.units).map(tx=>tx.hash);

  const new_states_raw:string[] = (()=>{
    if(req_tx.meta.data.type==="create") return output_raw.concat(compute_new_state([],req_tx.meta.data.solvency,payee,_.tx_fee(tx),req_tx.meta.data.gas,native,unit).map(s=>JSON.stringify(s)));
    else return compute_new_state(output_raw,req_tx.meta.data.solvency,payee,fee,req_tx.meta.data.gas,native,unit).map(s=>JSON.stringify(s));
  })();

  const payee_state:T.State = StateData.filter(s=>s.kind==="state"&&s.owner===payee&&s.token===native&&new BigNumber(s.amount).plus(req_tx.meta.data.gas).minus(fee).isGreaterThanOrEqualTo(0))[0];



  const base_states:T.State[] = req_tx.meta.data.base.map(key=>{
    return StateData.filter(s=>{return s.owner===key})[0] || StateSet.CreateState();
  });



  const pres = list_up_related(chain,req_tx.meta,"pre");
  const nexts = list_up_related(chain,req_tx.meta,"next");

  if(!ValidTxBasic(tx,my_version)){
    return false;
  }
  else if(kind!="refresh"){
    console.log("invalid kind");
    return false;
  }
  else if(new BigNumber(_.Hex_to_Num(_.toHash(new BigNumber(_.Hex_to_Num(request)).plus(index).plus(nonce).plus(_.Hex_to_Num(payee)).plus(_.Hex_to_Num(output)).toString()))).isGreaterThan(pow_target)){
    console.log("invalid nonce");
    return false;
  }
  else if(new BigNumber(unit_price).isLessThan(0)){
    console.log("invalid unit_price");
    return false;
  }
  else if(index<0||index>chain.length-1){
    console.log("invalid request index");
    return false;
  }
  else if(req_tx.hash==empty_tx_pure().hash||block_tx_hashes.indexOf(req_tx.hash)===-1){
    console.log("invalid request hash");
    return false;
  }
  else if(refresh_mode&&refreshed_check(req_tx.meta.data.base,index,request,LocationData)){
    console.log("base states are already refreshed");
    return false;
  }
  else if(payee_state==null||hashed_pub_check(payee_state,pub_key)){
    console.log("invalid payee");
    return false;
  }
  else if(output!=_.ObjectHash(output_raw)){
    console.log("invalid output hash");
    return false;
  }
  else if(refresh_mode&&output!=_.ObjectHash(base_states.map(s=>JSON.stringify(s)))&&output_check(req_tx.meta.data.type,base_states,new_states_raw,token_name_maxsize,StateData)){
    console.log("invalid output");
    return false;
  }
  else if(req_tx.meta.pre.flag===true&&pres.length===0){
    console.log("invalid pre txs");
    return false;
  }
  else if(req_tx.meta.next.flag===true&&nexts.length===0){
    console.log("invalid next txs");
    return false;
  }
  /*else if(token===native&&ValidNative(req_tx_full,tx,chain,StateData)){
    console.log("invalid native txs");
    return false;
  }
  else if(token===unit&&ValidUnit(req_tx_full,tx,chain,StateData)){
    console.log("invalid unit txs");
    return false;
  }*/
  else{
    return true;
  }
}

export const CreateRequestTx = (pub_key:string[],solvency:string,gas:number,type:T.TxTypes,token:string,base:string[],input_raw:string[],log:string[],version:number,pre:T.Relation,next:T.Relation,feeprice:number)=>{
  const address = CryptoSet.GenereateAddress(token,_.reduce_pub(pub_key));
  const date = new Date();
  const timestamp = date.getTime();
  const input = _.ObjectHash(input_raw);
  const log_hash = _.ObjectHash(log);
  const empty = empty_tx();

  const data:T.TxData = {
    address:address,
    pub_key:pub_key,
    timestamp:timestamp,
    log_hash:log_hash,
    gas:gas,
    solvency:solvency,
    type:type,
    token:token,
    base:base,
    input:input,
    request:empty.meta.data.request,
    index:empty.meta.data.index,
    payee:empty.meta.data.payee,
    output:empty.meta.data.output
  }

  const purehash = _.ObjectHash(data);

  const meta:T.TxMeta = {
    kind:"request",
    version:version,
    purehash:purehash,
    nonce:empty.meta.nonce,
    unit_price:empty.meta.unit_price,
    pre:pre,
    next:next,
    feeprice:feeprice,
    data:data
  }

  const hash = _.ObjectHash(meta);

  const tx:T.Tx = {
    hash:hash,
    meta:meta,
    raw:{
      signature:[],
      raw:input_raw,
      log:log
    }
  }
  return tx;
}

export const native_code = (StateData:T.State[],req_tx:T.Tx,native:string)=>{
  const base = req_tx.meta.data.base;
  const not_changed = StateData;
  req_tx = _.copy(req_tx);
  if(req_tx.meta.data.token!=native) return not_changed;
  const type = req_tx.raw.raw[0];
  switch(type){
    case "remit":
      if(req_tx.meta.data.type!="issue") return not_changed;
      const remiter = base[0];
      const remiter_state = StateData.filter(s=>s.kind==="state"&&s.token===native&&s.owner===remiter)[0];
      const receivers = base.slice(1);
      const amounts:number[] = JSON.parse(req_tx.raw.raw[1]||"[]").map((str:string)=>Number(str));
      const sum = amounts.reduce((s,a)=>s+a,0);
      const gas = Number(remiter_state.data.gas||"0");
      if(remiter_state==null||amounts.some(n=>new BigNumber(n).isLessThan(0))||new BigNumber(remiter_state.amount).minus(sum).minus(gas).isLessThan(0)) return not_changed;

      const remited = StateData.map(s=>{
        if(s.kind!="state"||s.token!=native||s.owner!=remiter) return s;
        const issued = Number(s.data.issue||"0");
        return _.new_obj(
          s,
          (s)=>{
            s.nonce ++;
            s.amount = new BigNumber(s.amount).minus(issued).minus(sum).toNumber();
            return s;
          }
        )
      });
      const recieved = remited.map(s=>{
        const index = receivers.indexOf(s.owner);
        if(s.kind!="state"||s.token!=native||index===-1) return s;
        const issued = Number(s.data.issue||"0");
        return _.new_obj(
          s,
          s=>{
            s.nonce ++;
            s.amount = new BigNumber(s.amount).minus(issued).plus(amounts[index]).toNumber();
            return s;
          }
        )
      });
      return recieved;

    default: return not_changed;
  }
}

export const unit_code = (StateData:T.State[],req_tx:T.Tx,pre_tx:T.Tx,native:string,unit:string,chain:T.Block[])=>{
  const base = req_tx.meta.data.base;
  const not_changed = _.copy(StateData).map(s=>{
    if(s.kind!="token"&&s.token!=unit) return s;
    return _.new_obj(
      s,
      s=>{
        s.committed = [];
        s.issued = 0;
        return s;
      }
    )
  });
  const pre = _.copy(pre_tx);
  const pre_base = _.copy(pre).meta.data.base;
  if(req_tx.meta.data.token!=unit||req_tx.meta.data.type!="issue"&&req_tx.raw.raw[0]!="buy") return not_changed;
  const inputs = req_tx.raw.raw;
  const pre_unit = _.copy(StateData.filter(s=>{return s.kind==="token"&&s.token===unit})[0]);
  const remiter = req_tx.meta.data.address;
  const units:T.Unit[] = JSON.parse(inputs[1]);
  const unit_check = units.some(u=>{
    const unit_ref_tx = (()=>{
      let block:T.Block;
      let txs:T.TxPure[];
      let tx:T.TxPure;
      for(block of chain.slice().reverse()){
        txs = block.txs.concat(block.natives).concat(block.units);
        for(tx of txs){
          if(tx.meta.kind==="refresh"&&tx.meta.data.request===u.request&&tx.meta.data.index===u.index) return tx;
        }
      }
      return empty_tx_pure();
    })();
    return unit_ref_tx.meta.data.output!=u.output||pre_unit.committed.indexOf(_.toHash(u.payee+u.request+u.index.toString()))!=-1;
  });
  if(unit_check||req_tx.meta.data.base[0]!=remiter) return not_changed;

  const hashes = units.map(u=>_.toHash(u.payee+u.request+u.index.toString()));
  if(hashes.some((v,i,arr)=>arr.indexOf(v)!=i)) return not_changed;
  const unit_address = units.map(u=>u.payee);
  const unit_price_map = units.reduce((res:{[key:string]:number},unit)=>{
    if(res[unit.payee]==null){
      res[unit.payee] = new BigNumber(unit.unit_price).toNumber();
      return res;
    }
    else{
      res[unit.payee] = new BigNumber(res[unit.payee]).plus(unit.unit_price).toNumber();
      return res;
    }
  },{});
  const unit_sum = units.length;

  const unit_ids = unit_address.map(add=>add.split(":")[2]||"");
  const native_adds = pre.meta.data.base.splice(1);
  const native_ids = native_adds.map(add=>add.split(":")[2]||"");
  const price_sum = units.reduce((sum,u)=>sum+u.unit_price,0);
  const native_amounts:number[] = JSON.parse(pre.raw.raw[1]||"[]").map((str:string)=>Number(str));
  const native_price_map = native_adds.reduce((res:{[key:string]:number},add,i)=>{
    if(res[add]==null){
      res[add] = new BigNumber(native_amounts[i]).toNumber();
      return res;
    }
    else{
      res[add] = new BigNumber(res[add]).plus(native_amounts[i]).toNumber();
      return res;
    }
  },{});
  const native_sum = native_amounts.reduce((s,a)=>s+a,0);
  if(/*pre_base.splice(1).some(add=>unit_address.indexOf(add)===-1)*/_.ObjectHash(unit_price_map)!=_.ObjectHash(native_price_map)||pre.meta.data.token!=native||pre.meta.data.type!="issue"||pre.raw.raw[0]!="remit"||_.toHash(_.reduce_pub(req_tx.meta.data.pub_key))!=_.toHash(_.reduce_pub(pre.meta.data.pub_key))||native_ids.some(add=>unit_ids.indexOf(add)===-1)||!(new BigNumber(price_sum).isEqualTo(native_sum))) return not_changed;

  const unit_bought = StateData.map(s=>{
    if(s.kind==="state"&&s.token===unit&&s.owner===remiter){
      const reduce = Number(s.data.reduce||"1");
      if((new BigNumber(s.amount).plus(unit_sum)).times(reduce).isLessThan(0)) return s;
      return _.new_obj(
        s,
        (s)=>{
          s.nonce ++;
          s.amount = new BigNumber(s.amount).div(reduce).plus(unit_sum).toNumber();
          return s;
        }
      )
    }
    else return s;
  });
  const unit_token = unit_bought.map(s=>{
    if(s.kind==="token"&&s.token===unit){
      return _.new_obj(
        s,
        (state)=>{
          state.nonce = 1;
          state.issued = unit_sum
          state.committed = hashes
          return state;
        }
      )
    }
    else return s;
  });
  return unit_token;

}


export const CreateRefreshTx = (version:number,unit_price:number,pub_key:string[],target:number,feeprice:number,request:string,index:number,payee:string,output_raw:string[],log_raw:string[],chain:T.Block[])=>{
  const req_tx:T.TxMeta = _.find_tx(chain,request).meta;
  const token = req_tx.data.token;
  const address = CryptoSet.GenereateAddress(token,_.reduce_pub(pub_key));
  const date = new Date();
  const timestamp = date.getTime();
  const output = _.ObjectHash(output_raw);
  const log_hash = _.ObjectHash(log_raw);
  const empty = empty_tx_pure();
  const data:T.TxData = {
    address:address,
    pub_key:pub_key,
    timestamp:timestamp,
    log_hash:log_hash,
    gas:empty.meta.data.gas,
    solvency:empty.meta.data.solvency,
    type:empty.meta.data.type,
    token:token,
    base:empty.meta.data.base,
    input:empty.meta.data.input,
    request:request,
    index:index,
    payee:payee,
    output:output
  }
  const nonce = mining(request,index,JSON.stringify(payee),output,target);

  const meta:T.TxMeta = {
    kind:"refresh",
    version:version,
    purehash:_.ObjectHash(data),
    nonce:nonce,
    unit_price:unit_price,
    pre:empty.meta.pre,
    next:empty.meta.next,
    feeprice:feeprice,
    data:data
  }
  const hash = _.ObjectHash(meta);
  const raw:T.TxRaw = {
    signature:[],
    raw:output_raw,
    log:log_raw
  }
  const tx:T.Tx = {
    hash:hash,
    meta:meta,
    raw:raw
  }
  return tx;
}

export const SignTx = (tx:T.Tx,my_private:string,my_pub:string)=>{
  const pub_keys = tx.meta.data.pub_key;
  const index = pub_keys.indexOf(my_pub);
  if(index===-1) return tx;
  const sign = CryptoSet.SignData(tx.hash,my_private);
  return _.new_obj(
    tx,
    tx=>{
      tx.raw.signature[index] = sign;
      return tx
    });
}

export const PayFee = (states:T.State[],sol:string,val:string,fee:number)=>{
  const solvency = states.filter(s=>s.kind==="state"&&s.owner===sol)[0];
  const validator = states.filter(s=>s.kind==="state"&&s.owner===val)[0];
  const new_solvency = _.new_obj(
    solvency,
    solvency=>{
      solvency.amount = new BigNumber(solvency.amount).minus(fee).toNumber();
      return solvency;
    }
  );
  const new_validator= _.new_obj(
    validator,
    validator=>{
      validator.amount = new BigNumber(validator.amount).plus(fee).toNumber();
      return validator;
    }
  )
  return states.map(s=>{
    if(s.owner===sol) return new_solvency;
    else if(s.owner===val) return new_validator;
    else return s;
  });
}

export const PayGas = (states:T.State[],sol:string,pay:string,gas:number)=>{
  const solvency = states.filter(s=>s.kind==="state"&&s.owner===sol)[0];
  const payee = states.filter(s=>s.kind==="state"&&s.owner===pay)[0];
  const new_solvency = _.new_obj(
    solvency,
    solvency=>{
      solvency.amount = new BigNumber(solvency.amount).minus(gas).toNumber();
      return solvency;
    }
  )
  const new_payee = _.new_obj(
    payee,
    payee=>{
      payee.amount = new BigNumber(payee.amount).plus(gas).toNumber();
      return payee;
    }
  )
  return states.map(s=>{
    if(s.owner===sol) return new_solvency;
    else if(s.owner===pay) return new_payee;
    else return s;
  })
}

export const PayStates = (solvency_state:T.State,payee_state:T.State,validator_state:T.State,gas:number,fee:number)=>{
  const states = [solvency_state].concat(payee_state).concat(validator_state).filter((val,i,array)=>array.map(s=>_.ObjectHash(s)).indexOf(_.ObjectHash(val))===i);
  const sol = solvency_state.owner;
  const pay = payee_state.owner;
  const val = validator_state.owner;
  return PayFee(PayGas(states,sol,pay,gas),pay,val,fee);
}

export const AcceptRequestTx = (tx:T.Tx,validator:string,index:number,StateData:T.State[],LocationData:T.Location[]):[T.State[],T.Location[]]=>{
  const solvency_state:T.State = StateData.filter(s=>s.owner===tx.meta.data.solvency)[0];
  const validator_state:T.State = StateData.filter(s=>s.owner===validator)[0];
  const fee = _.tx_fee(tx);
  const after = PayStates(solvency_state,solvency_state,validator_state,0,fee);
  const fee_owners = after.map(a=>a.owner);
  const StateData_added = StateData.map(s=>{
    const index = fee_owners.indexOf(s.owner);
    if(index===-1) return s;
    return after[index];
  });
  const gas = tx.meta.data.gas;
  const StateData_sol = StateData_added.map(s=>{
    if(s.owner!=tx.meta.data.solvency) return s;
    return _.new_obj(
      s,
      s=>{
        if(s.data.gas==null) s.data.gas = gas.toFixed(18);
        else s.data.gas = new BigNumber(s.data.gas).plus(gas).toFixed(18);
        return s;
      }
    )
  });

  const LocationData_added = LocationData.map(l=>{
    const i = tx.meta.data.base.indexOf(l.address);
    if(i!=-1){
      return _.new_obj(
        l,
        l=>{
          l.state = "already";
          l.index = index;
          l.hash = tx.hash;
          return l;
        }
      );
    }
    else return l;
  });

  return [StateData_sol,LocationData_added];
}

export const AcceptRefreshTx = (ref_tx:T.Tx,chain:T.Block[],validator:string,native:string,unit:string,StateData:T.State[],LocationData:T.Location[]):[T.State[],T.Location[]]=>{
  const req_tx = find_req_tx(ref_tx,chain);
  const solvency = req_tx.meta.data.solvency;
  const payee = ref_tx.meta.data.payee;
  const tx_fee = _.tx_fee(ref_tx);
  const gas = req_tx.meta.data.gas;
  const solvency_state = StateData.filter(s=>{return s.kind==="state"&&s.owner===solvency})[0] || StateSet.CreateState(0,solvency,native,0,{},[]);
  const payee_state = StateData.filter(s=>{return s.kind==="state"&&s.owner===payee})[0] || StateSet.CreateState(0,payee,native,0,{},[]);
  const validator_state = StateData.filter(s=>{return s.kind==="state"&&s.owner===validator})[0] || StateSet.CreateState(0,validator,native,0,{},[]);
  const pay_states = PayStates(solvency_state,payee_state,validator_state,gas,tx_fee);
  const pay_owners = pay_states.map(p=>p.owner);
  const payed = StateData.map(s=>{
    const index = pay_owners.indexOf(s.owner);
    if(index!=-1) return pay_states[index];
    else return s;
  });
  if(req_tx.meta.data.type==="create"){
    const token_info:T.State = JSON.parse(req_tx.raw.raw[0]);
    const created = payed.map(s=>{
      if(s.kind==="token"&&s.token===token_info.token) return token_info;
      else return s;
    });
    return [created,LocationData];
  }
  else{
    const output_states:T.State[] = ref_tx.raw.raw.map(s=>JSON.parse(s||JSON.stringify(StateSet.CreateState())));
    const output_owners = output_states.map(o=>o.owner);
    const outputed = payed.map(s=>{
      if(s.kind==="state"){
        const i = output_owners.indexOf(s.owner);
        if(i!=-1) return output_states[i];
        else return s;
      }
      else{
        const i = output_owners.indexOf(s.owner);
        if(i===-1) return s;
        const change = output_states[i];
        if(change.kind!="token") return s;
        return _.new_obj(
          s,
          s=>{
            s.nonce += change.nonce;
            s.deposited = new BigNumber(s.deposited).plus(change.deposited).toNumber();
            s.issued = new BigNumber(s.issued).plus(change.issued).toNumber();
            s.committed = s.committed.concat(change.committed);
            return s;
          }
        )
      }
    });
    const issued = outputed.map(s=>{
      if(s.kind!="state"||s.token!=native) return s;
      const issue = Number(s.data.issue||"0");
      return _.new_obj(
        s,
        s=>{
          s.amount = new BigNumber(s.amount).plus(issue).toNumber();
          s.data.issue = (0).toFixed(18);
          return s;
        }
      )
    });
    const reduced = issued.map(s=>{
      if(s.kind!="state"||s.token!=unit) return s;
      const reduce = Number(s.data.reduce||"1");
      return _.new_obj(
        s,
        s=>{
          s.amount = new BigNumber(s.amount).times(reduce).toNumber();
          s.data.reduce = (1).toFixed(18);
          return s;
        }
      )
    });
    const gased = reduced.map(s=>{
      if(s.kind!="state"||s.owner!=solvency) return s;
      return _.new_obj(
        s,
        s=>{
          s.data.gas = (0).toFixed(18);
          return s;
        }
      )
    });
    const added = LocationData.map(l=>{
      const index = req_tx.meta.data.base.indexOf(l.address);
      if(index!=-1){
        return _.new_obj(
          l,
          l=>{
            l.state = "yet";
            return l;
          }
        );
      }
      else return l;
    });
    return [gased,added];
  }
}

