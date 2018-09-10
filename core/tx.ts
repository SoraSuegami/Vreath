import * as _ from './basic'
import * as CryptoSet from './crypto_set'
import * as T from './types'
import * as StateSet from './state'
import * as BlockSet from './block'
import { block } from '../genesis';
import {BigNumber} from 'bignumber.js'
import { stat } from 'fs';

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
  const index = block.txs.concat(block.natives).concat(block.units).indexOf(pure);
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
    const i = addresses.indexOf(key);
    const val = LocationData[i];
    if(i===-1) return true;
    else if(val.state==="yet"&&val.index===index&&val.hash===tx_hash) return true;
    else return false;
  });
}

const state_check = (state:T.State,token_name_maxsize:number)=>{
  const hash_size = Buffer.from(_.toHash("")).length;
  const copy_state = state;
  return _.address_form_check(copy_state.owner,token_name_maxsize) || new BigNumber(copy_state.amount).isLessThan(0) ||
  Object.entries(copy_state.data).some(([val,key])=>{return new BigNumber(Buffer.from(key).length).isGreaterThan(hash_size) || new BigNumber(Buffer.from(val).length).isGreaterThan(hash_size)}) ||
  copy_state.product.some(pro=>new BigNumber(Buffer.from(pro).length).isGreaterThan(token_name_maxsize));
}

const base_declaration_check = (target:T.State,bases:string[],StateData:T.State[])=>{
  const getted = StateData.filter(s=>{return s.kind==="state"&&s.owner===target.owner})[0];
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
    const nonce_check = base_states.some((b,i)=>b.nonce+1!=new_states[i].nonce);
    if(new_states.some((s:T.State)=>{return state_check(s,token_name_maxsize)||base_declaration_check(s,bases,StateData)})||nonce_check) return true;
    const pre_amount = base_states.reduce((sum,s)=>{return new BigNumber(sum).plus(s.amount)},new BigNumber(0));
    const new_amount = new_states.reduce((sum,s)=>{return new BigNumber(sum).plus(s.amount)},new BigNumber(0));
    return (type==="issue"&&new BigNumber(pre_amount).isGreaterThanOrEqualTo(new_amount)) || (type==="change"&&pre_amount!=new_amount) || (type==="scrap"&&new BigNumber(pre_amount).isLessThanOrEqualTo(new_amount));
  }
}

const search_related_tx = (chain:T.Block[],hash:string,order:'pre'|'next',caller_hash:string):T.TxMeta=>{
  for(let block of chain){
    if(block.meta.kind==="key") continue;
    for(let tx of block.txs){
      if(tx.meta.kind=="request"&&tx.meta.purehash===hash&&tx.meta[order].flag===true&&tx.meta[order].hash===caller_hash) return tx.meta;
    }
  }
  return empty_tx_pure().meta;
}

const list_up_related = (chain:T.Block[],tx:T.TxMeta,order:'pre'|'next',result:T.TxMeta[]=[]):T.TxMeta[]=>{
  if(tx.pre.flag===false) return result;
  const ori_order = order;
  if(order=='pre') order = 'next';
  else order = 'pre';
  const searched = search_related_tx(chain,tx.pre.hash,order,tx.purehash);
  if(searched===empty_tx_pure().meta||searched.kind!="request") return [];
  const new_pres = result.concat(searched);
  return list_up_related(chain,searched,ori_order,new_pres);
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

const search_related_raw = (chain:T.Block[],hash:string,order:'pre'|'next',caller_hash:string):T.TxRaw=>{
  for(let block of chain){
    if(block.meta.kind==="key") continue;
    for(let i in block.txs){
      const tx = block.txs[i];
      if(tx.meta.kind=="request"&&tx.meta.purehash===hash&&tx.meta[order].flag===true&&tx.meta[order].hash===caller_hash) return block.raws[i];
    }
  }
  return empty_tx().raw;
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
  else if(sign.length===0||sign.some((s,i)=>{return _.sign_check(hash,s,pub_key[i])})){
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

export const ValidRequestTx = (tx:T.Tx,my_version:number,native:string,unit:string,StateData:T.State[],LocationData:T.Location[])=>{
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
    return s.kind==="state"&&s.token===native&&s.owner===solvency&&new BigNumber(s.amount).isGreaterThanOrEqualTo(new BigNumber(_.tx_fee(tx)).plus(gas))
  })[0];

  const base_states = base.map(key=>{
    return StateData.filter(s=>{return s.kind==="state"&&s.owner===key})[0] || StateSet.CreateState();
  });

  if(!ValidTxBasic(tx,my_version)){
    return false;
  }
  else if(kind!="request"){
    console.log("invalid kind");
    return false;
  }
  else if(solvency_state==null||hashed_pub_check(solvency_state,pub_key)||requested_check([solvency],LocationData)){
    console.log("invalid solvency");
    return false;
  }
  else if(base_states.indexOf(StateSet.CreateState())!=-1){
    console.log("invalid base");
    return false;
  }
  else if(requested_check(base,LocationData)){
    console.log("base states are already requested");
    return false;
  }
  else if(input!=_.ObjectHash(raw_data)){
    console.log("invalid input hash");
    return false;
  }
  else if((token===native||token===unit)&&base.length!=1){
    console.log("invalid natives txs");
    return false;
  }
  else{
    return true;
  }
}


export const ValidRefreshTx = (tx:T.Tx,chain:T.Block[],my_version:number,native:string,unit:string,token_name_maxsize:number,StateData:T.State[],LocationData:T.Location[])=>{
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
  const req_tx = _.find_tx(chain,request);

  const req_raw = (()=>{
    const txs_index = block.txs.indexOf(req_tx);
    if(txs_index!=-1) return block.raws[txs_index];
    const natives_index = block.natives.indexOf(req_tx);
    if(natives_index!=-1) return block.raws[natives_index];
    const units_index = block.units.indexOf(req_tx);
    if(units_index!=-1) return block.raws[units_index];
    return empty_tx().raw;
  })()

  const req_tx_full:T.Tx = {
    hash:req_tx.hash,
    meta:req_tx.meta,
    raw:req_raw
  }

  const token = req_tx.meta.data.token;

  const payee_state:T.State = StateData.filter(s=>{
    return s.kind==="state"&&s.owner===payee&&s.token===native&&new BigNumber(s.amount).plus(req_tx.meta.data.gas).isGreaterThanOrEqualTo(_.tx_fee(tx))
  })[0];



  const base_states:T.State[] = req_tx.meta.data.base.map(key=>{
    return StateData.slice().filter(s=>{return s.kind==="state"&&s.owner===key})[0] || StateSet.CreateState();
  });



  const pres = list_up_related(chain,req_tx.meta,"pre",[]);
  const nexts = list_up_related(chain,req_tx.meta,"next",[]);

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
  else if(req_tx==empty_tx_pure()||(chain[tx.meta.data.index].txs.indexOf(req_tx)===-1&&chain[tx.meta.data.index].natives.indexOf(req_tx)===-1&&chain[tx.meta.data.index].units.indexOf(req_tx)===-1)){
    console.log("invalid request hash");
    return false;
  }
  else if(refreshed_check(req_tx.meta.data.base,index,request,LocationData)){
    console.log("base states are already refreshed");
    return false;
  }
  else if(refreshed_check([req_tx.meta.data.solvency],index,request,LocationData)){
    console.log("invalid solvency");
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
  else if(output!=_.ObjectHash(base_states.map(s=>JSON.stringify(s)))&&output_check(req_tx.meta.data.type,base_states,output_raw,token_name_maxsize,StateData)){
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

  const LocationData_added = tx.meta.data.base.reduce((loc:T.Location[],key):T.Location[]=>{
    const new_loc:T.Location = {
      address:key,
      state:"already",
      index:index,
      hash:tx.hash
    };
    const mapped =  LocationData.map(l=>{
      if(l.address===key) return new_loc;
      else return l;
    });
    if(_.ObjectHash(mapped)===_.ObjectHash(LocationData)) return LocationData.concat(new_loc);
    else return mapped;
  },LocationData);

  return [StateData_added,LocationData_added];
}

export const AcceptRefreshTx = (ref_tx:T.Tx,chain:T.Block[],validator:string,native:string,unit:string,StateData:T.State[],LocationData:T.Location[]):[T.State[],T.Location[]]=>{
  const req_tx = find_req_tx(ref_tx,chain);
  if(req_tx.meta.data.type==="create"){
    const token_info:T.State = JSON.parse(req_tx.raw.raw[0]);
    const StateData_create = StateData.map(s=>{
      if(s.kind==="token"&&s.token===token_info.token) return token_info;
      else return s;
    });
    return [StateData_create,LocationData];
  }
  else if(req_tx.meta.data.type==="update"){
    const token_info:T.State = JSON.parse(req_tx.raw.raw[0]);
    const pre_token = StateData.filter(s=>{return s.kind==="token"&&s.token===token_info.token})[0];
    const new_token:T.State = _.new_obj(
      pre_token,
      (token)=>{
        token.nonce ++;
        token.issued = new BigNumber(token.issued).plus(token_info.issued).toNumber();
        token.committed = token.committed.concat(token_info.committed);
        return token;
      }
    );
    const StateData_update = StateData.map(s=>{
      if(s.kind==="token"&&s.token===token_info.token) return new_token;
      else return s;
    });
    return [StateData_update,LocationData];
  }
  else{
    const token_info = StateData.filter(s=>{return s.kind==="token"&&s.token===req_tx.meta.data.token})[0];
    const base_states:T.State[] = req_tx.meta.data.base.map((key:string)=>{
      return StateData.filter(s=>{return s.kind==="state"&&s.owner===key})[0]
    });
    const new_states:T.State[] = ref_tx.raw.raw.map(obj=>JSON.parse(obj));
    const pre_amount_sum = base_states.reduce((sum,state)=>new BigNumber(sum).plus(state.amount).toNumber(),0);
    const new_amount_sum = new_states.reduce((sum,state)=>new BigNumber(sum).plus(state.amount).toNumber(),0);
    const new_token_info = _.new_obj(
      token_info,
      (token)=>{
        token.issued = new BigNumber(token.issued).plus(new_amount_sum).minus(pre_amount_sum).toNumber();
        return token;
      }
    );
    const solvency_state = StateData.filter(s=>{return s.kind==="state"&&s.owner===req_tx.meta.data.solvency})[0] || StateSet.CreateState(0,req_tx.meta.data.solvency,native,0,{},[]);
    const payee_state = StateData.filter(s=>{return s.kind==="state"&&s.owner===ref_tx.meta.data.payee})[0] || StateSet.CreateState(0,ref_tx.meta.data.payee,native,0,{},[]);
    const validator_state = StateData.filter(s=>{return s.kind==="state"&&s.owner===validator})[0] || StateSet.CreateState(0,validator,native,0,{},[]);
    const tx_fee = _.tx_fee(ref_tx);
    const payed = PayStates(solvency_state,payee_state,validator_state,req_tx.meta.data.gas,tx_fee);
    const payed_owners = payed.map(s=>s.owner);
    const StateData_payed = StateData.map(s=>{
      const index = payed_owners.indexOf(s.owner);
      if(index===-1) return s;
      return payed[index];
    });
    const StateData_deleted = StateData_payed.filter(s=>{
      return s.kind==="token"||req_tx.meta.data.base.indexOf(s.owner)===-1
    }).map(s=>{
      if(s.kind==="token"&&s.token===req_tx.meta.data.token) return new_token_info;
      else return s;
    });
    const owners = StateData_deleted.map(s=>s.owner);
    const StateData_added:T.State[] = ref_tx.raw.raw.reduce((states,val)=>{
      const state:T.State = JSON.parse(val);
      if(state==null) return states;
      const index = owners.indexOf(state.owner)
      if(index!=-1){
        return states.map((val,i)=>{if(index===i)return state; else return val});
      }
      else return states.concat(state);
    },StateData_deleted);
    const loc_addresses = LocationData.map(l=>l.address);
    const LocationData_added = req_tx.meta.data.base.reduce((locs,key)=>{
      const index = loc_addresses.indexOf(key);
      const pre_loc = locs[index];
      const new_loc = _.new_obj(
        pre_loc,
        loc=>{
          loc.state = "yet";
          return loc;
        }
      );
      return locs.map((val,i)=>{if(index===i)return new_loc; else return val;})
    },LocationData);
    if(req_tx.meta.data.token===native&&req_tx.meta.data.type==="scrap"&&req_tx.raw.raw[0]==="remit"){
      const remiter_state = StateData.filter(s=>s.kind==="state"&&s.token===native&&s.owner===req_tx.meta.data.address)[0];
      const receiver = req_tx.raw.raw[1];
      const amount = -1*Number(req_tx.raw.raw[2]);
      if(remiter_state==null||new BigNumber(amount).isLessThan(0)||new BigNumber(remiter_state.amount).minus(amount).isLessThan(0)) return [StateData_added,LocationData_added];
      const remited = _.new_obj(
        remiter_state,
        (state)=>{
          state.nonce ++;
          state.amount = new BigNumber(state.amount).minus(amount).toNumber();
          return state;
        }
      )
      const StateData_remited = StateData.map(s=>{
        if(s.kind==="state"&&s.token===native&&s.owner===req_tx.meta.data.address) return remited;
        else return s;
      });
      const receiver_state:T.State = StateData_remited.filter(s=>{return s.kind==="state"&&s.owner===receiver})[0] || StateSet.CreateState(0,receiver,native,0,{},[]);
      const recieved = _.new_obj(
        receiver_state,
        state=>{
          state.amount = new BigNumber(state.amount).plus(amount).toNumber();
          return state;
        }
      );
      const StateData_native = StateData_added.map(s=>{
        if(s.kind==="state"&&s.owner===receiver) return recieved;
        else return s;
      });
      return [StateData_native,LocationData_added];
    }
    else if(req_tx.meta.data.token===unit&&req_tx.meta.data.type==="issue"&&req_tx.raw.raw[0]==="buy"){
      const inputs = req_tx.raw.raw;
      const pre_unit = StateData.filter(s=>{return s.kind==="token"&&s.token===unit})[0];
      const remiter = inputs[1];
      const units:T.Unit[] = JSON.parse(inputs[2]);
      const unit_check = units.some(u=>{
        const block = chain[u.index] || BlockSet.empty_block();
        const unit_ref_tx = (()=>{
          for(let block of chain.slice().reverse()){
            for(let tx of block.txs.concat(block.natives).concat(block.units)){
              if(tx.meta.kind==="refresh"&&tx.meta.data.request===u.request&&tx.meta.data.index===u.index) return tx;
            }
          }
          return empty_tx_pure();
        })();
        return unit_ref_tx.meta.data.output!=u.output || pre_unit.committed.indexOf(_.ObjectHash(u))!=-1;
      });
      if(unit_check) return [StateData_added,LocationData_added];
      const hashes = units.map(u=>_.ObjectHash(u));
      const sellers = units.map(u=>u.payee);
      const unit_address = CryptoSet.GenereateAddress(unit,_.reduce_pub(req_tx.meta.data.pub_key));
      const unit_state = StateData_added.filter(s=>{return s.kind==="state"&&s.owner===unit_address})[0] || StateSet.CreateState(0,unit_address,unit,0,{},[]);
      /*const pre_waiting_total_obj:{[key:string]:number[]} = JSON.parse(pre_unit.committed.slice().reverse().filter(c=>Object.keys(JSON.parse(c))[0]==="waiting_total")[0]||JSON.stringify({waiting_total:[block.meta.index,0]}));
      const pre_waiting_total = Object.values(pre_waiting_total_obj)[0][1];
      const pre_block_index = (()=>{
        for(let block of chain.slice().reverse()){
          if(block.units.length!=0) return block.meta.index;
        }
        return 0;
      })();
      const waiting_states_obj:{[key:string]:number[]} = JSON.parse(pre_unit.committed.slice().reverse().filter(c=>Object.keys(JSON.parse(c))[0]==="waiting_states")[0]||JSON.stringify({waiting_states:[block.meta.index,0]}));
      const waiting_states = Object.values(waiting_states_obj)[0][1];
      const waiting_total = new BigNumber(pre_waiting_total).plus(new BigNumber(block.meta.index).minus(pre_block_index)).times(waiting_states).toNumber();
      const unit_waitings = units.map(u=>{
        const pre_obj:{[key:string]:number} = JSON.parse(pre_unit.committed.slice().reverse().filter(c=>Object.keys(JSON.parse(c))[0]===u.payee)[0]||JSON.stringify({[u.payee]:block.meta.index}));
        const pre_time = Object.values(pre_obj)[0];
        return BigNumber.maximum(block.meta.index-pre_time,0).toNumber();
      });
      const unit_values = unit_waitings.map(time=>BigNumber.maximum(
        new BigNumber(2).exponentiatedBy(new BigNumber(time).div(waiting_total).times(
          new BigNumber(10).exponentiatedBy(7).toNumber()
        ).toNumber()
      ).toNumber(),1).toNumber());
      const unit_sum = unit_values.reduce((sum,u)=>new BigNumber(sum).plus(u).toNumber(),0);*/
      const unit_sum = units.length
      const StateData_unit_bought = StateData_added.map(s=>{
        if(s.kind==="state"&&s.token===unit&&s.owner===unit_address){
          return _.new_obj(
            s,
            (state)=>{
              state.amount = new BigNumber(state.amount).plus(unit_sum).toNumber();
              return state;
            }
          )
        }
        else return s;
      });
      const price_sum = units.reduce((sum,u)=>{
        return new BigNumber(sum).plus(u.unit_price).toNumber();
      },0)
      const remiter_state:T.State = StateData_added.filter(s=>{return s.kind==="state"&&s.owner===remiter})[0];
      if(new BigNumber(remiter_state.amount).minus(price_sum).isLessThan(0)) return [StateData_added,LocationData_added];
      const StateData_unit_remited = StateData_unit_bought.map(s=>{
        if(s.kind==="state"&&s.token===native&&s.owner===remiter){
          return _.new_obj(
            s,
            (state)=>{
              state.amount = new BigNumber(state.amount).minus(price_sum).toNumber();
              return state;
            }
          )
        }
        else return s;
      });
      const StateData_unit_recieve = StateData_unit_remited.map(s=>{
        if(s.kind==="state"&&s.token===native){
          const index = sellers.indexOf(s.owner);
          if(index===-1) return s;
          return _.new_obj(
            s,
            (state)=>{
              state.amount = new BigNumber(state.amount).plus(units[index].unit_price).toNumber();
              return state;
            }
          )
        }
        else return s;
      });
      const StateData_unit_token = StateData_unit_recieve.map(s=>{
        if(s.kind==="token"&&s.token===unit){
          return _.new_obj(
            s,
            (state)=>{
              state.nonce ++;
              state.issued = new BigNumber(state.issued).plus(unit_sum).toNumber();
              state.committed = state.committed.concat(hashes);
              return state;
            }
          )
        }
        else return s;
      });
      /*sellers.reduce((states:T.State[],seller,i)=>{
        const index = owners.indexOf(seller);
        const amount = units[i].unit_price;
        if(index==-1) return states.concat(StateSet.CreateState(0,seller,native,amount,{},[]));
        const pre = states[index];
        return states.map((val,i)=>{
          if(index===i){
            return _.new_obj(val,
              (state)=>{
                state.amount = new BigNumber(state.amount).plus(amount).toNumber();
                return state
              });
          }
          else return val;})
      },StateData_unit_remit);*/
      /*const new_waitings = units.map(u=>{
        return JSON.stringify({
          [u.payee]:block.meta.index
        })
      });
      const reduced_time = unit_waitings.reduce((sum,time)=>BigNumber.maximum(new BigNumber(sum).minus(time).toNumber(),0).toNumber(),waiting_states);
      const firsters = unit_waitings.filter(time=>new BigNumber(time).isLessThanOrEqualTo(0));
      const new_wait_states = new BigNumber(waiting_states).plus(firsters.length).toNumber();*/
      return [StateData_unit_token,LocationData_added];
    }
    return [StateData_added,LocationData_added];
  }
}

