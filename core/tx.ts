import * as _ from './basic'
import * as CryptoSet from './crypto_set'
import * as T from './types'
import {Trie} from './merkle_patricia'
import * as StateSet from './state'
import {map,reduce,some,ForEach} from 'p-iteration'

export const empty_tx = ():T.Tx=>{
  const data:T.TxData = {
    address:[],
    pub_key:[],
    timestamp:0,
    log_hash:[],
    gas:0,
    solvency:_.toHash(""),
    type:"change",
    token:"",
    base:[],
    input:[],
    request:_.toHash(""),
    index:0,
    payee:_.toHash(""),
    output:[],
    trace:[]
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
  }
}

export const tx_to_pure = (tx:T.Tx):T.TxPure=>{
  return{
      hash:tx.hash,
      meta:tx.meta
  }
}

export const empty_tx_pure = ()=>{
  const tx = empty_tx();
  return tx_to_pure(tx);
}

const empty_location = ():T.Location => {
  return{
    state:"yet",
    index:0,
    hash:_.toHash("")
  }
}

const requested_check = async (base:string[],LocationData:Trie):Promise<boolean>=>{
  return await some(base, async(key:string)=>{
    const getted:T.Location =  await LocationData.get(key);
    if(getted==null) return false;
    else if(getted.state=="yet") return false;
    else return true;
  });
}

const hashed_pub_check = (state:T.State,pubs:string[])=>{
  return state.contents.owner.some((address,index)=>{
    return _.toHash(pubs[index]) != address.split(':')[2];
  });
}

const refreshed_check = async (base:string[],index:number,tx_hash:string,LocationData:Trie):Promise<boolean>=>{
  return await some(base, async(key:string)=>{
    const getted:T.Location =  await LocationData.get(key);
    if(getted==null) return true;
    else if(getted.state=="already"&&getted.index==index&&getted.hash==tx_hash) return false;
    else return true;
  });
}
const state_check = (state:T.State,token_name_maxsize:number)=>{
  const hash_size = Buffer.from(_.toHash("")).length;
  return _.object_hash_check(state.hash,state.contents) ||
  state.contents.owner.some(ow=>_.address_form_check(ow,token_name_maxsize)) ||
  state.contents.amount<0 ||
  Object.entries(state.contents.data).some((obj:string[])=>{return Buffer.from(obj[0]).length>hash_size||Buffer.from(obj[1]).length>hash_size}) ||
  state.contents.product.some(pro=>Buffer.from(pro).length>token_name_maxsize);
}

const base_declaration_check = async (target:T.State,base_hashes:string[],StateData:Trie)=>{
  const getted = await StateData.get(target.hash);
  return getted!=null && base_hashes.indexOf(target.hash)===-1;
}

const output_check = async (type:T.TxTypes,base_states:T.State[],output_raw:string[],token_name_maxsize:number,StateData:Trie)=>{
  if(type==="create"){
    const token_state:T.Token = JSON.parse(output_raw[0]);
    const code:string = output_raw[1];
    const key = token_state.token;
    const getted:T.Token = await StateData.get(key);
    const dev_check = token_state.developer.some((dev)=>{
      return _.address_form_check(dev,token_name_maxsize)
    });
    if(getted!=null||dev_check||token_state.nonce!=0||token_state.issued<0||token_state.code!=_.toHash(code)) return true;
    else return false;
  }
  else if(type==="update"){
    const token_state:T.Token = JSON.parse(output_raw[0]);
    const key = token_state.token;
    const empty = StateSet.CreateToken();
    const getted:T.Token = await StateData.get(key) || empty;
    const dev_check = token_state.developer.some((dev)=>{
      return _.address_form_check(dev,token_name_maxsize)
    });
    const comm = token_state.committed.some((c:string)=>{
      return getted.committed.indexOf(c)!=-1
    });
    if(key!=token_state.token||getted==empty||dev_check||getted.deposited-token_state.deposited<0) return true;
    else return false;
  }
  else{
    const new_states:T.State[] = output_raw.map((o)=>{
      return JSON.parse(o);
    });
    const base_hashes = base_states.map(s=>s.hash);
    if(await some(new_states,async (s:T.State)=>{state_check(s,token_name_maxsize)||await base_declaration_check(s,base_hashes,StateData)})) return true;
    const pre_amount = base_states.reduce((sum,s)=>{return sum+s.contents.amount},0);
    const new_amount = new_states.reduce((sum,s)=>{return sum+s.contents.amount},0);
    return (type==="issue"&&pre_amount>=new_amount) || (type==="change"&&pre_amount!=new_amount) || (type==="scrap"&&pre_amount<=new_amount);
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

const mining = (request:string,refresher:string,output:string[],target:number)=>{
  let nonce:number = -1;
  let num:number;
  do{
    nonce ++;
    num = _.Hex_to_Num(request)+nonce+_.Hex_to_Num(refresher)+_.Hex_to_Num(_.ObjectHash(output));
  }while(num>target);
  return nonce;
}

export const find_req_tx = (ref_tx:T.Tx,chain:T.Block[]):T.Tx=>{
  const index = ref_tx.meta.data.index || 0;
  const req_pure = chain[index].txs.filter(tx=>tx.hash===ref_tx.meta.data.request)[0];
  if(req_pure==null) return empty_tx();
  const req_raw = chain[index].raws[chain[index].txs.indexOf(req_pure)];
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

const ValidNative = async (req_tx:T.Tx,ref_tx:T.Tx,chain:T.Block[],StateData:Trie)=>{
  try{
    const base_state:T.State = await StateData.get(req_tx.meta.data.base[0]);
    const new_state:T.State = JSON.parse(ref_tx.raw.raw[0]);
    if(base_state==null||new_state==null) return true;
    const inputs = req_tx.raw.raw;
    const type = inputs[0];
    const other = inputs[1];
    const amount = Number(inputs[2]);
    const empty_token = StateSet.CreateToken();
    const valid_state = ((state:T.State)=>{
      state.contents.amount += amount;
      const hash = _.ObjectHash(state.contents);
      state.hash = hash;
      return state;
    })(base_state)
    switch(type){
      case "remit":
        return req_tx.meta.data.type!="scrap"||base_state.contents.owner!=req_tx.meta.data.address||new_state.contents.amount-base_state.contents.amount!=amount||valid_state!=new_state||amount<=0;

      case "deposit":
        if(req_tx.meta.data.type!="scrap"||base_state.contents.owner!=req_tx.meta.data.address||amount>0||new_state.contents.amount-base_state.contents.amount!=amount||req_tx.meta.next.flag!=true||valid_state!=new_state)return true;
        const depo_meta = search_related_tx(chain,req_tx.meta.next.hash,'pre',req_tx.meta.purehash);
        const depo_raw = search_related_raw(chain,req_tx.meta.next.hash,'pre',req_tx.meta.purehash);
        const depo_token_info:T.Token = JSON.parse(depo_raw.raw[0]) || empty_token;
        return !(depo_meta.data.type==="update"&&depo_token_info!=empty_token&&depo_token_info.token===req_tx.meta.data.token&&amount+depo_token_info.deposited===0&&other===depo_token_info.token&&valid_state.contents.amount>=0);

      case "withdrawal":
        if(req_tx.meta.data.type!="issue"||base_state.contents.owner!=req_tx.meta.data.address||amount<0||new_state.contents.amount-base_state.contents.amount!=amount||req_tx.meta.pre.flag!=true||valid_state!=new_state)return true;
        const with_meta = search_related_tx(chain,req_tx.meta.next.hash,'pre',req_tx.meta.purehash);
        const with_raw= search_related_raw(chain,req_tx.meta.next.hash,'next',req_tx.meta.purehash);
        const with_token_info:T.Token = JSON.parse(with_raw.raw[0]) || empty_token;
        const pre_token_info:T.Token = await StateData.get(with_token_info.token) || empty_token;
        return !(with_meta.data.type==="update"&&with_token_info!=empty_token&&pre_token_info!=empty_token&&with_token_info.token===req_tx.meta.data.token&&amount+with_token_info.deposited===0&&other===with_token_info.token&&valid_state.contents.amount>=0&&pre_token_info.deposited-amount>=0);

      default:
        return true;
    }
  }
  catch(e){
    console.log(e);
    return true;
  }
}

const ValidUnit = async (req_tx:T.Tx,ref_tx:T.Tx,StateData:Trie)=>{
  try{
    const base_state:T.State = await StateData.get(req_tx.meta.data.base[0]);
    const new_state:T.State = JSON.parse(ref_tx.raw.raw[0]);
    if(base_state==null||new_state==null) return true;
    const inputs = req_tx.raw.raw;
    const type = inputs[0];
    const remiter = inputs[1];
    const item_refs:T.Tx[] = JSON.parse(inputs[2]) || [empty_tx()];
    const prices = item_refs.map(ref=>ref.meta.unit_price);
    const price_sum = prices.reduce((sum,p)=>{return sum+p},0)
    const valid_state = prices.reduce((state,price)=>{
        state.contents.amount += price;
        const hash = _.ObjectHash(state.contents);
        state.hash = hash;
        return state;
    },base_state);
    const empty_state = StateSet.CreateState(0,[],"",{},[]);
    const empty_token = StateSet.CreateToken();

    switch(type){
      case "buy":
        const remit_state:T.State = await StateData.get(remiter) || empty_state;
        const commit_token:T.Token = await StateData.get(req_tx.meta.data.token) || empty_token;
        const committed = item_refs.map(item=>item.hash).some(key=>{
          return commit_token.committed.indexOf(key)!=-1;
        });
        return req_tx.meta.data.type!="issue"||base_state.contents.owner!=req_tx.meta.data.address||new_state.contents.amount-base_state.contents.amount!=item_refs.length||req_tx.meta.pre.flag!=true||valid_state!=new_state||remit_state===empty_state||commit_token===empty_token||remit_state.contents.amount-price_sum<0||committed;
      default:
        return true;
    }
  }
  catch(e){
    console.log(e);
    return true;
  }
}


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
  const log_hash = tx_data.log_hash;
  const raw = tx.raw;
  const sign = raw.signature;
  const raw_data = raw.raw;
  const log_raw = raw.log;

  if(_.object_hash_check(hash,tx.meta)){
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
  else if(address.some((add,i)=>{return _.address_check(add,pub_key[i],token)})){
    console.log("invalid address");
    return false;
  }
  else if(pub_key.some((pub)=>{return pub!=_.toHash('')})){
    console.log("invalid pub_key");
    return false;
  }
  else if(_.time_check(timestamp)){
    console.log("invalid timestamp");
    return false;
  }
  else if(address.some((ad,i)=>{return _.sign_check(ad,token,hash,sign[i],pub_key[i])})){
    console.log("invalid signature");
    return false;
  }
  else if(raw_data.some((r,i)=>{return r!=_.toHash(raw_data[i])})){
    console.log("invalid input hash");
    return false;
  }
  else if(log_hash.some((l,i)=>{return l!=_.toHash(log_raw[i])})){
    console.log("invalid log hash");
    return false;
  }
  else{
    return true;
  }
}

export const ValidRequestTx = async (tx:T.Tx,my_version:number,native:string,unit:string,StateData:Trie,LocationData:Trie)=>{
  const tx_meta = tx.meta;
  const kind = tx_meta.kind;
  const tx_data = tx_meta.data;
  const address = tx_data.address;
  const pub_key = tx_data.pub_key;
  const gas = tx_data.gas;
  const solvency = tx_data.solvency;
  const token = tx_data.token;
  const base = tx_data.base;

  const solvency_state:T.State = await StateData.get(solvency) || StateSet.CreateState(0,address,native,{},[]);

  if(!ValidTxBasic(tx,my_version)){
    return false;
  }
  else if(kind!="request"){
    console.log("invalid kind");
    return false;
  }
  else if(solvency_state.contents.amount<_.tx_fee(tx)+gas||hashed_pub_check(solvency_state,pub_key)||solvency_state.contents.token!=native||await requested_check([solvency],LocationData)){
    console.log("invalid solvency");
    return false;
  }
  else if(await requested_check(base,LocationData)){
    console.log("base states are already requested");
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


export const ValidRefreshTx = async (tx:T.Tx,chain:T.Block[],my_version:number,pow_target:number,native:string,unit:string,token_name_maxsize:number,StateData:Trie,LocationData:Trie)=>{
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
  const trace = tx_data.trace;
  const raw = tx.raw;
  const output_raw = raw.raw;

  const req_tx = _.find_tx(chain,request);
  const req_raw = chain[index].raws[chain[index].txs.indexOf(req_tx)];
  const req_tx_full:T.Tx = {
    hash:req_tx.hash,
    meta:req_tx.meta,
    raw:req_raw
  }

  const token = req_tx.meta.data.token;

  const payee_state:T.State = await StateData.get(payee) || StateSet.CreateState(0,address,native,{},[]);

  const base_states:T.State[] = await reduce(req_tx.meta.data.base,async (result:T.State[],key:string)=>{
    const getted:T.State = await StateData.get(key);
    if(getted) return result.concat(getted);
  },[]);

  const pres = list_up_related(chain,req_tx.meta,"pre",[]);
  const nexts = list_up_related(chain,req_tx.meta,"next",[]);

  if(!ValidTxBasic(tx,my_version)){
    return false;
  }
  else if(kind!="refresh"){
    console.log("invalid kind");
    return false;
  }
  else if(_.Hex_to_Num(request)+nonce+_.Hex_to_Num(payee)+_.Hex_to_Num(_.ObjectHash(output))>pow_target){
    console.log("invalid nonce");
    return false;
  }
  else if(unit_price<0){
    console.log("invalid unit_price");
    return false;
  }
  else if(index<0||index>chain.length-1){
    console.log("invalid request index");
    return false;
  }
  else if(req_tx==empty_tx_pure()||chain[tx.meta.data.index].txs.indexOf(req_tx)===-1){
    console.log("invalid request hash");
    return false;
  }
  else if(await refreshed_check(req_tx.meta.data.base,index,request,LocationData)){
    console.log("base states are already refreshed");
    return false;
  }
  else if(await refreshed_check([req_tx.meta.data.solvency],index,request,LocationData)){
    console.log("invalid solvency");
    return false;
  }
  else if(payee_state.contents.amount+req_tx.meta.data.gas<_.tx_fee(tx)||hashed_pub_check(payee_state,pub_key)||payee_state.contents.token!=native){
    console.log("invalid payee");
    return false;
  }
  else if(trace[0]!=_.ObjectHash(req_tx.meta.data.base)||trace[trace.length-1]!=_.ObjectHash(output)){
    console.log("invalid trace");
    return false;
  }
  else if(await output_check(req_tx.meta.data.type,base_states,output_raw,token_name_maxsize,StateData)){
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
  else if(token===native&&await ValidNative(req_tx_full,tx,chain,StateData)){
    console.log("invalid native txs");
    return false;
  }
  else if(token===unit&&await ValidUnit(req_tx_full,tx,StateData)){
    console.log("invalid unit txs");
    return false;
  }
  else{
    return true;
  }
}

export const CreateRequestTx = (pub_key:string[],solvency:string,gas:number,type:T.TxTypes,token:string,base:string[],input_raw:string[],log:string[],version:number,pre:T.Relation,next:T.Relation,feeprice:number)=>{
  const address = pub_key.map(p=>CryptoSet.GenereateAddress(token,p));
  const date = new Date();
  const timestamp = date.getTime();
  const input = input_raw.map(i=>_.toHash(i));
  const log_hash = log.map(l=>_.toHash(l));
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
    output:empty.meta.data.output,
    trace:empty.meta.data.trace
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

export const CreateRefreshTx = (version:number,unit_price:number,pub_key:string[],target:number,feeprice:number,request:string,index:number,payee:string,output_raw:string[],trace:string[],log_raw:string[],chain:T.Block[])=>{
  const req_tx:T.TxMeta = _.find_tx(chain,request).meta;
  const address = pub_key.map(p=>CryptoSet.GenereateAddress(req_tx.data.token,p));
  const date = new Date();
  const timestamp = date.getTime();
  const output = output_raw.map(o=>_.toHash(o));
  const log_hash = log_raw.map(l=>_.toHash(l));
  const empty = empty_tx_pure();
  const data:T.TxData = {
    address:address,
    pub_key:pub_key,
    timestamp:timestamp,
    log_hash:log_hash,
    gas:empty.meta.data.gas,
    solvency:empty.meta.data.solvency,
    type:empty.meta.data.type,
    token:empty.meta.data.token,
    base:empty.meta.data.base,
    input:empty.meta.data.input,
    request:request,
    index:index,
    payee:payee,
    output:output,
    trace:trace
  }
  const nonce = mining(request,payee,output,target);
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

export const SignTx = (tx:T.Tx,my_pass:string,my_address:string)=>{
  const addresses = tx.meta.data.address;
  const index = addresses.indexOf(my_address);
  const sign = CryptoSet.SignData(tx.hash,my_pass);
  tx.raw.signature[index] = sign;
  return tx;
}

export const PayFee = (solvency:T.State,validator:T.State,fee:number)=>{
  if(solvency.hash===validator.hash) return [solvency,validator];
  solvency.contents.amount -= fee;
  solvency.hash = _.ObjectHash(solvency.contents);
  validator.contents.amount += fee;
  validator.hash = _.ObjectHash(validator.contents);
  return [solvency,validator];
}

export const PayGas = (solvency:T.State,payee:T.State,gas:number)=>{
  if(solvency.hash===payee.hash) return [solvency,payee];
  solvency.contents.amount -= gas;
  solvency.hash = _.ObjectHash(solvency.contents);
  payee.contents.amount += gas;
  payee.hash = _.ObjectHash(payee.contents);
  return [solvency,payee];
}

export const PayStates = (solvency_state:T.State,payee_state:T.State,validator_state:T.State,gas:number,fee:number)=>{
  const after_gas = PayGas(solvency_state,payee_state,gas);
  const after_fee = PayFee(after_gas[1],validator_state,fee);
  if(solvency_state.hash===payee_state.hash&&payee_state.hash===validator_state.hash) return [solvency_state];
  else if(solvency_state.hash===payee_state.hash) return after_fee;
  else if(payee_state.hash===validator_state.hash) return after_gas;
  else if(solvency_state.hash===validator_state.hash) return after_fee;
  return [after_gas[0],after_fee[1],after_fee[2]];
}

export const AcceptRequestTx = async (tx:T.Tx,my_version:number,native:string,unit:string,validator:string,index:number,StateData:Trie,LocationData:Trie)=>{
  if(!await ValidRequestTx(tx,my_version,native,unit,StateData,LocationData)) return [StateData,LocationData];
  const solvency_state:T.State = await StateData.get(tx.meta.data.solvency);
  const validator_state:T.State = await StateData.get(validator);
  const fee = _.tx_fee(tx);
  const after = PayFee(solvency_state,validator_state,fee);
  await StateData.put(after[0].hash,after[0]);
  await StateData.put(after[1].hash,after[1]);

  await ForEach(tx.meta.data.base,async (key:string)=>{
    let get_loc:T.Location = await LocationData.get(key) || empty_location();
    get_loc = {
      state:"already",
      index:index,
      hash:tx.hash
    }
    await LocationData.put(key,get_loc);
  });
  return [StateData,LocationData];
}

export const AcceptRefreshTx = async (ref_tx:T.Tx,chain:T.Block[],my_version:number,pow_target:number,native:string,unit:string,token_name_maxsize:number,StateData:Trie,LocationData:Trie)=>{
  if(!await ValidRefreshTx(ref_tx,chain,my_version,pow_target,native,unit,token_name_maxsize,StateData,LocationData)) return [StateData,LocationData];
  const req_tx = find_req_tx(ref_tx,chain)
  if(req_tx.meta.data.type==="create"){
    const token_info:T.Token = JSON.parse(req_tx.raw.raw[0]);
    await StateData.put(token_info.token,token_info);
  }
  else if(req_tx.meta.data.type==="update"){
    const token_info:T.Token = JSON.parse(req_tx.raw.raw[0]);
    let pre_token = await StateData.get(token_info.token);
    pre_token.nonce ++;
    pre_token.committed = pre_token.committed.concat(token_info.committed);
    await StateData.put(token_info.token,pre_token);
    const deposit_amount = token_info.deposited;
    let native_info:T.Token = await StateData.get(native);
    native_info.deposited ++;
    native_info.deposited += deposit_amount;
    await StateData.put(native,native_info);
  }
  else{
    let token_info = await StateData.get(req_tx.meta.data.token);
    token_info.nonce ++;
    const base_states:T.State[] = await map(req_tx.meta.data.base, async (key:string)=>{
      return await StateData.get(key);
    });
    const new_states:T.State[] = ref_tx.raw.raw.map(obj=>JSON.parse(obj));
    const pre_amount_sum = base_states.reduce((sum,state)=>sum+state.contents.amount,0);
    const new_amount_sum = new_states.reduce((sum,state)=>sum+state.contents.amount,0);
    token_info.issued += (new_amount_sum-pre_amount_sum);
    await ForEach(req_tx.meta.data.base,async (key:string)=>{
      await StateData.delete(key);
      await LocationData.delete(key);
    });
    await ForEach(ref_tx.raw.raw,async (val:string)=>{
      const state:T.State = JSON.parse(val);
      await StateData.put(state.hash,state);
    });
    if(req_tx.meta.data.token===native&&req_tx.meta.data.type==="scrap"&&req_tx.raw.raw[0]==="remit"){
      const receiver = req_tx.raw.raw[1];
      const amount = -1*Number(req_tx.raw.raw[2]);
      let receiver_state:T.State = await StateData.get(receiver);
      receiver_state.contents.amount += amount;
      token_info.nonce++;
      token_info.issued += amount;
    }
    else if(req_tx.meta.data.token===unit&&req_tx.meta.data.type==="issue"&&req_tx.raw.raw[0]==="buy"){
      const inputs = req_tx.raw.raw;
      const remiter = inputs[1];
      const item_refs:T.Tx[] = JSON.parse(inputs[2]) || [empty_tx()];
      const hashes = item_refs.map(ref=>ref.hash);
      const sellers = item_refs.map(ref=>ref.meta.data.payee);
      const price_sum = item_refs.reduce((sum,ref)=>{
        return sum+ref.meta.unit_price;
      },0)
      const remiter_state:T.State = await StateData.get(remiter);
      await StateData.delete(remiter);
      const new_remiter = StateSet.CreateState(remiter_state.contents.amount-price_sum,remiter_state.contents.owner,remiter_state.contents.token,remiter_state.contents.data,remiter_state.contents.product);
      await StateData.put(new_remiter.hash,new_remiter);
      await ForEach(sellers,async (key:string,i:number)=>{
        const pre:T.State = await StateData.get(key);
        await StateData.delete(key);
        const new_amount = pre.contents.amount+item_refs[i].meta.unit_price;
        const new_state = StateSet.CreateState(new_amount,pre.contents.owner,pre.contents.token,pre.contents.data,pre.contents.product);
        await StateData.put(new_state.hash,new_state);
      });
      let native_info = await StateData.get(native);
      native_info.nonce += (sellers.length+1);
      await StateData.put(native,native_info);
      let unit_info = await StateData.get(unit);
      unit_info.committed = unit_info.committed.concat(hashes);
      await StateData.put(unit,unit_info);
    }

    await StateData.put(req_tx.meta.data.token,token_info);
  }
  return [StateData,LocationData];
}

