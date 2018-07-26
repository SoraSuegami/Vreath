import * as _ from './basic'
import * as CryptoSet from './crypto_set'
import * as T from './types'
import {Trie} from './merkle_patricia'
import * as StateSet from './state'
import {reduce,some,ForEach} from 'p-iteration'

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
    commit:[],
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

const commited_check = async (token:string,commit:string[],StateData:Trie)=>{
  const token_state:T.Token = await StateData.get(CryptoSet.GenereateAddress(token,_.toHash('')));
  if(token_state==null) return true;
  const committed = token_state.committed;
  return commit.some((c:string)=>{
    return committed.indexOf(c)!=-1
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
    const key = CryptoSet.GenereateAddress(token_state.token,_.toHash(''));
    const getted:T.Token[] = await StateData.get(key);
    const dev_check = token_state.developer.some((dev)=>{
      return dev===key || _.address_form_check(dev,token_name_maxsize)
    });
    if(getted!=null||token_state.issued<0||dev_check) return true;
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

const mining = (meta:T.TxMeta,target:number)=>{
  let hash:string;
  let num:number;
  do{
    hash = _.ObjectHash(meta);
    num = _.Hex_to_Num(hash);
    meta.nonce ++;
  }while(num>target);
  return {
    nonce:meta.nonce,
    hash:hash
  }
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
    const new_states:T.State = JSON.parse(ref_tx.raw.raw[0]);
    if(base_state==null||new_states==null) return true;
    const inputs = req_tx.raw.raw;
    const type = inputs[0];
    const other = inputs[1];
    const amount = Number(inputs[2]);
    const nonce = Number(inputs[3]);

    switch(type){
      case "remit":
        if(base_state.contents.owner===req_tx.meta.data.address&&base_state.contents.amount-new_states.contents.amount===amount&&req_tx.meta.next.flag===true)return false;
        const next_meta = search_related_tx(chain,req_tx.meta.next.hash,'pre',req_tx.meta.purehash);
        const next_raw= search_related_raw(chain,req_tx.meta.next.hash,'pre',req_tx.meta.purehash);
        const next_inputs = next_raw.raw;
        const next_type = next_inputs[0];
        const next_other = next_inputs[1];
        const next_amount = Number(next_inputs[2]);
        const next_nonce = Number(next_inputs[3]);
        return !(next_meta.data.address===req_tx.meta.data.address&&next_type==="receive"&&next_other===req_tx.meta.data.base[0]&&amount===next_amount&&nonce===next_nonce);
      case "receive":
        if(new_states.contents.amount-base_state.contents.amount===amount&&req_tx.meta.next.flag===true)return false;
        const pre_meta = search_related_tx(chain,req_tx.meta.pre.hash,'next',req_tx.meta.purehash);
        const pre_raw = search_related_raw(chain,req_tx.meta.pre.hash,'next',req_tx.meta.purehash);
        const pre_inputs = pre_raw.raw;
        const pre_type = pre_inputs[0];
        const pre_other = pre_inputs[1];
        const pre_amount = Number(pre_inputs[2]);
        const pre_nonce = Number(pre_inputs[3]);
        return !(pre_meta.data.address===req_tx.meta.data.address&&pre_type==="remit"&&pre_other===req_tx.meta.data.base[0]&&amount===pre_amount&&nonce===pre_nonce);
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

export const ValidRequestTx = async (tx:T.Tx,my_version:number,native:string,StateData:Trie,LocationData:Trie)=>{
  const tx_meta = tx.meta;
  const kind = tx_meta.kind;
  const tx_data = tx_meta.data;
  const address = tx_data.address;
  const pub_key = tx_data.pub_key;
  const gas = tx_data.gas;
  const solvency = tx_data.solvency;
  const token = tx_data.token;
  const base = tx_data.base;
  const commit = tx_data.commit;

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
  else if(await commited_check(token,commit,StateData)){
    console.log("commits are already committed");
    return false;
  }
  else if(token===native&&base.length!=1){
    console.log("invalid natives txs");
    return false;
  }
  else{
    return true;
  }
}


export const ValidRefreshTx = async (tx:T.Tx,chain:T.Block[],my_version:number,pow_target:number,native:string,token_name_maxsize:number,StateData:Trie,LocationData:Trie)=>{
  const hash = tx.hash;
  const tx_meta = tx.meta;
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
  else if(_.Hex_to_Num(hash)>pow_target){
    console.log("invalid nonce");
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
  else{
    return true;
  }
}

export const CreateRequestTx = (pub_key:string[],solvency:string,gas:number,type:T.TxTypes,token:string,base:string[],commit:string[],input_raw:string[],log:string[],version:number,pre:T.Relation,next:T.Relation,feeprice:number)=>{
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
    commit:commit,
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

export const CreateRefreshTx = (version:number,pub_key:string[],target:number,feeprice:number,request:string,index:number,payee:string,output_raw:string[],trace:string[],log_raw:string[],chain:T.Block[])=>{
  const req_tx:T.TxMeta = _.find_tx(chain,request).meta;
  const address = pub_key.map(p=>CryptoSet.GenereateAddress(req_tx.data.token,p));
  const date = new Date();
  const timestamp = date.getTime();
  const output = output_raw.map(o=>_.toHash(o));
  const log_hash = log_raw.map(l=>_.toHash(l));
  const empty = empty_tx_pure();
  let data:T.TxData = {
    address:address,
    pub_key:pub_key,
    timestamp:timestamp,
    log_hash:log_hash,
    gas:empty.meta.data.gas,
    solvency:empty.meta.data.solvency,
    type:empty.meta.data.type,
    token:empty.meta.data.token,
    base:empty.meta.data.base,
    commit:empty.meta.data.commit,
    input:empty.meta.data.input,
    request:request,
    index:index,
    payee:payee,
    output:output,
    trace:trace
  }
  let meta:T.TxMeta = {
    kind:"refresh",
    version:version,
    purehash:_.ObjectHash(data),
    nonce:0,
    pre:empty.meta.pre,
    next:empty.meta.next,
    feeprice:feeprice,
    data:data
  }
  const mined = mining(meta,target);
  meta.nonce = mined.nonce;
  const hash = mined.hash;
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

export const AcceptRequestTx = async (tx:T.Tx,my_version:number,native:string,validator:string,index:number,StateData:Trie,LocationData:Trie)=>{
  if(!await ValidRequestTx(tx,my_version,native,StateData,LocationData)) return [StateData,LocationData];
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

export const AcceptRefreshTx = async (ref_tx:T.Tx,chain:T.Block[],my_version:number,pow_target:number,native:string,token_name_maxsize:number,StateData:Trie,LocationData:Trie)=>{
  if(!await ValidRefreshTx(ref_tx,chain,my_version,pow_target,native,token_name_maxsize,StateData,LocationData)) return [StateData,LocationData];
  const req_tx = find_req_tx(ref_tx,chain)
  if(req_tx.meta.data.type==="create"){
    const state:T.Token = JSON.parse(req_tx.raw.raw[0]);
    await StateData.put(CryptoSet.GenereateAddress(state.token,_.toHash('')),state);
  }
  else{
    await ForEach(req_tx.meta.data.base,async (key:string)=>{
      await StateData.delete(key);
      await LocationData.delete(key);
    });
    await ForEach(ref_tx.raw.raw,async (val:string)=>{
      const state:T.State = JSON.parse(val);
      await StateData.put(state.hash,state);
    });
  }
  return [StateData,LocationData];
}

