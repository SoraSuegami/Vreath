declare function require(x: string): any;

import * as crypto from 'crypto'
import * as _ from './basic'
import * as Trie from './merkle_patricia'
import * as StateSet from './state'
import * as TxSet from './tx'
import * as ChainSet from './chain'
import * as IpfsSet from './ipfs'

const {map,reduce,filter,forEach,some} = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
const {NodeVM, VMScript} = require('vm2');
const rlp = require('rlp');

const CryptoSet = require('./crypto_set.js');

//const node = new IPFS();

const log_limit = 10000000;
/*
export type DataHash = {
  selfhash: string;
  ipfshash: string;
}

export type Input = {
  token_id: string[];
  others: string[];
  options: DataHash[];
}

export type Output = {
  states: StateSet.T_state[];
  app_rate: number;
  new_token: StateSet.Token[];
  log: any;
}

type Codetype = 'issue_code' | 'change_code' | 'scrap_code' | 'create_code';

type RawData = {
  input: string[];
  output: string[];
}

type UnitMeta = {
  nonce: string;
  hash: string;
  parenthash: string;
  signature: string;
}

type UnitContent = {
  address: string;
  token: string;
  timestamp: number;
  pub_key: string;
  codetype: Codetype;
  input: Input;
  output: Output;
}

export type Unit = {
  meta: UnitMeta;
  contents: UnitContent;
}
*/
export type DataHash = {
  selfhash: string;
  ipfshash: string;
}

export type Input = {
  token_id: string[];
  options: any[];
}

export type Output = {
  tx: string[];
  app_rate: number;
  log: any;
}

type Codetype = 'issue_code' | 'change_code' | 'scrap_code' | 'create_code';

type RawData = {
  input: string[];
  output: string[];
}

type UnitMeta = {
  nonce: string;
  hash: string;
  signature: string;
}

/*type UnitContents = {
  address: string;
  token: string;
  timestamp: number;
  last: {index:number,hash:string};
  fee: number;
  pub_key: string;
  input: Input;
  output: Output;
}*/

type UnitContents = {
  data:TxSet.RefreshContents;
  parenthash: string;
  difficulty:number;
  log_hash:string;
}

export type Unit = {
  meta: UnitMeta;
  contents: UnitContents;
  log_raw:any[];
}

const nonce_count = (hash:string)=>{
  let check = true
  const sum = hash.split("").reduce((result,val)=>{
    if(val==String(0)&&check==true){
      result ++;
      return result;
    }
    else{
      check = false;
      return result;
    }
  },0);
  return sum;
}

const HashForUnit = (unit:Unit):string=>{
  return _.toHash(unit.meta.nonce+JSON.stringify(unit.contents));
};

async function ValidUnit(unit:Unit,dag_root:string,log_limit:number,chain:ChainSet.Block[]){
  const nonce = unit.meta.nonce;
  const hash = unit.meta.hash;
  const signature = unit.meta.signature;
  const tx_data = unit.contents.data;
  const address = tx_data.address;
  const pub_key = tx_data.pub_key;
  const timestamp = tx_data.timestamp;
  const parenthash = unit.contents.parenthash;
  const difficulty = unit.contents.difficulty;
  const log_hash = unit.contents.log_hash;
  const log_raw = unit.log_raw;

  const date = new Date();

  const count = nonce_count(hash);

  const request_tx:TxSet.RequestTx = chain[tx_data.index].transactions.reduce((result:TxSet.RequestTx[],tx:TxSet.Tx)=>{
    if(tx.kind=="request"&&tx.meta.hash==tx_data.request) return result.concat(tx);
  },[])[0];

  const token = request_tx.contents.data.token;

  const DagData = new RadixTree({
    db: db,
    root: dag_root
  });

  const parent:Unit = JSON.parse(rlp.decode(await DagData.get(Trie.en_key(parenthash))));

  const log_size = log_raw.reduce((sum:number,log:any)=>{
    return sum + Buffer.from(JSON.stringify(log)).length;
  },0);

  if(count<=0||count>difficulty){
    console.log("invalid nonce");
    return false;
  }
  else if(hash!=HashForUnit(unit)){
    console.log("invalid hash");
    return false;
  }
  else if (address!=token&&CryptoSet.verifyData(hash,signature,pub_key)==false){
    console.log("invalid signature");
    return false;
  }
  else if(address!=token&&!address.match(/^PH/)){
    console.log("invalid address");
    return false;
  }
  else if(address!=token&&address!=CryptoSet.AddressFromPublic(pub_key)){
    console.log("invalid pub_key");
    return false;
  }
  else if(timestamp>date.getTime()){
    console.log("invalid timestamp");
    return false;
  }
  else if (parenthash!=parent.meta.hash){
    console.log("invalid parenthash");
    return false;
  }
  else if(log_hash!=_.toHash(JSON.stringify(log_raw))){
    console.log("invalid log_hash");
    return false;
  }
  else if(log_size>log_limit){
    console.log("This Log is too big");
    return false;
  }
  else{
    return true;
  }
}

async function Unit_to_Dag(unit:Unit,dag_root:string){
  const DagData = new RadixTree({
    db: db,
    root: dag_root
  });
  await DagData.set(Trie.en_key(unit.meta.hash),rlp.decode(JSON.stringify(unit)));
  const new_root = await DagData.flush();
  return new_root;
}

async function Unit_to_Memory(unit:Unit,memory_root:string){
  const Memory = new RadixTree({
    db: db,
    root: memory_root
  });
  const target:string[] = JSON.parse(rlp.decode(await Memory.get(Trie.en_key(unit.contents.data.request)))) || [];
  await Memory.set(Trie.en_key(unit.contents.data.request),rlp.decode(JSON.stringify(target.concat(unit.meta.hash))));
  const new_root = await Memory.flush();
  return new_root;
}

async function AcceptUnit(unit:Unit,dag_root:string,memory_root:string,log_limit:number,chain:ChainSet.Block[]){
  if(!await ValidUnit(unit,dag_root,log_limit,chain)) return {dag:dag_root,memory:memory_root};
  const new_dag_root = await Unit_to_Dag(unit,dag_root);
  const new_memory_root = await Unit_to_Memory(unit,memory_root);
  return {
    dag:new_dag_root,
    memory:new_memory_root
  }
}
/*const RunCode = (input:Input,token_state:StateSet.Token,type:Codetype,raw:string[],db,dag_root:string,worldroot:string,addressroot:string):Output=>{
  //const raw = IpfsSet.node_ready(node,())
  const Dag = new RadixTree({
    db: db,
    root: dag_root
  });

  const World = new RadixTree({
    db: db,
    root: worldroot
  });

  const Address = new RadixTree({
    db: db,
    root: addressroot
  });

  /*const tokens = new RadixTree({
    db: db,
    root: token_state.stateroot
  });*/

  /*const states = {
    dag:Dag,
    world:World,
    t_state:t_state,
    tokens:tokens
  }

  const library = {
    crypto:CryptoSet,
    map:map,
    reduce:reduce,
    filter:filter,
    forEach:forEach,
    some:some
  }*/
  /*
  const vm = new NodeVM({
    sandbox:{
      input:input,
      token_state:token_state,
      DagState:Dag,
      WorldState:World,
      AddressState:Address,
      RawData:raw
    },
    require:{
      external: true,
      root:"./library_for_js.js"
    }
  });
  const code = token_state[type];
  const script = new VMScript("module.exports = (()=>{"+code+"})()");
  const result:Output = vm.run(script);
  return result;
};*/


/*async function input_raws(node,datahashs:DataHash[]){
  await node.on('ready');
  const result = await map(datahashs,async (hashs:DataHash)=>{
    const ipfshash:string = hashs.ipfshash;
    const cated = await node.cat(ipfshash);
    return cated.toString('utf-8');
  });
  return result;
}*/

/*
async function ValidUnit(unit:Unit,dag_root:string,parents_dag_root:string,worldroot:string,addressroot:string,block:ChainSet.Block,difficulty:number,key_currency:string){
  const nonce = unit.meta.nonce;
  const hash = unit.meta.hash;
  const parenthash = unit.meta.parenthash;
  const signature = unit.meta.signature;
  const address = unit.contents.address;
  const token = unit.contents.token;
  const timestamp = unit.contents.timestamp;
  const last = unit.contents.last;
  const fee = unit.contents.fee;
  const pub_key = unit.contents.pub_key;
  const input = unit.contents.input;
  const output = unit.contents.output;

  const date = new Date();
  const DagData = new RadixTree({
    db: db,
    root: dag_root
  });

  const count = nonce_count(hash);

  const parent:Unit = await DagData.get(Trie.en_key(parenthash));

  const before_dag_data = new RadixTree({
    db: db,
    root: block.contents.parenthash
  });

  const before_address_data = new RadixTree({
    db: db,
    root: block.contents.addressroot
  });

  const state_hashs:string[] = await before_address_data.get(Trie.en_key(address));

  const balance:number = await reduce(state_hashs,async (sum:number,key:string)=>{
    const state:StateSet.State = await before_dag_data.get(Trie.en_key(key));
    if(state.contents.owner==address&&state.contents.token==key_currency){
      return sum + state.amount;
    }
    else return sum;
  },0);

  const valid_input_check = await input.options.some((hashs:DataHash,i:number)=>{
    return hashs.selfhash!=_.toHash(this[i]);
  },await input_raws(IpfsSet.node,input.options));

  const valid_log_check = output.log.some((log)=>{
    return Buffer.from(JSON.stringify(log)).length>10000000;
  });

  const parents_dag = new RadixTree({
    db: db,
    root: parents_dag_root
  });

  /*const others_check = await some(input.others, async (key:string)=>{
    const unit:Unit = await DagData.get(Trie.en_key(key))
    const check = await ValidUnit(unit,t_state,dag_root,parents_dag_root,worldroot,addressroot);
    if(check==true){
      return false;
    }
    else{
      return true;
    }
    /*await NotDoubleConfirmed(key,DagData,parents_dag);
    return check;*/
  /*});*/


  /*if(count<=0||count>difficulty){
    console.log("invalid nonce");
    return false;
  }
  else if(hash!=HashForUnit(unit)){
    console.log("invalid hash");
    return false;
  }
  else if (address!=token&&CryptoSet.verifyData(hash,signature,pub_key)==false){
    console.log("invalid signature");
    return false;
  }
  else if (parenthash!=parent.meta.hash){
    console.log("invalid parenthash");
    return false;
  }
  else if(address!=token&&!address.match(/^PH/)){
    console.log("invalid address");
    return false;
  }
  else if(timestamp>date.getTime()){
    console.log("invalid timestamp");
    return false;
  }
  else if(address!=token&&address!=CryptoSet.AddressFromPublic(pub_key)){
    console.log("invalid pub_key");
    return false;
  }
  else if(last.index!=block.contents.index||last.hash!=block.meta.hash){
    console.log("invalid last");
    return false;
  }
  else if(fee<0||fee>balance){
    console.log("invalid fee");
    return false;
  }
  else if(await valid_input_check){
    console.log("invalid input");
    return false;
  }
  else if(valid_log_check){
    console.log("Too big log");
    return false;
  }*/
  /*else if(others_check){
    console.log("invalid quotation units");
  }*/
  /*else if(_.toHash(JSON.stringify(output))!=_.toHash(JSON.stringify(RunCode(input,t_state,codetype,raw_inputs,db,dag_root,worldroot,addressroot)))){
    console.log("invalid result");
    return false;
  }*/
  /*else{
    return true;
  }
}*/
/*
async function AddUnittoDag(unit:Unit,dag_root:string,parents_dag_root:string,worldroot:string,addressroot:string,block:ChainSet.Block,difficulty:number,key_currency:string){
  if(!ValidUnit(unit,dag_root,parents_dag_root,worldroot,addressroot,block,difficulty,key_currency)) return dag_root;
  const dag = new RadixTree({
    db: db,
    root: dag_root
  });
  const new_dag = await dag.set(Trie.en_key(unit.meta.hash),unit);
  const new_world_root:string = await new_dag.flush();
  return new_world_root;
}

async function CreateUnit(password:string,address:string,token:string,pub_key:string,codetype:Codetype,input:Input){

}
*/
