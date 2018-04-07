declare function require(x: string): any;

import * as crypto from 'crypto'
import * as _ from './basic'
import * as Trie from './merkle_patricia'
import * as StateSet from './state'
import * as IpfsSet from './ipfs'

const {map,reduce,filter,forEach,some} = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
const {NodeVM, VMScript} = require('vm2');

const CryptoSet = require('./crypto_set.js');

const node = new IPFS();

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
  signature: string;
}

type UnitContent = {
  address: string;
  token: string;
  timestamp: number;
  pub_key: string;
  codetype: Codetype;
  parenthash: string;
  input: Input;
  output: Output;
}

export type Unit = {
  meta: UnitMeta;
  contents: UnitContent;
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


const RunCode = (input:Input,token_state:StateSet.Token,type:Codetype,raw:string[],db,dag_root:string,worldroot:string,addressroot:string):Output=>{
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

  const tokens = new RadixTree({
    db: db,
    root: token_state.stateroot
  });

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

  const vm = new NodeVM({
    sandbox:{
      input:input,
      token_state:token_state,
      DagState:Dag,
      WorldState:World,
      AddressState:Address,
      tokens:tokens,
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
};


async function input_raws(node,datahashs:DataHash[]){
  await node.on('ready');
  const result = await map(datahashs,async (hashs:DataHash)=>{
    const ipfshash:string = hashs.ipfshash;
    const cated = await node.cat(ipfshash);
    return cated.toString('utf-8');
  });
  return result;
}

async function output_raws(node,states:StateSet.T_state[]){
  await node.on('ready');
  const result = await map(states,async (state:StateSet.T_state)=>{
    const ipfshash:string = state.contents.data.ipfshash;
    const cated = await node.cat(ipfshash);
    return cated.toString('utf-8');
  });
  return result;
}

async function ValidUnit(unit:Unit,t_state:StateSet.Token,dag_root:string,parents_dag_root:string,worldroot:string,addressroot:string){
  const nonce = unit.meta.nonce;
  const hash = unit.meta.hash;
  const signature = unit.meta.signature;
  const address = unit.contents.address;
  const token = unit.contents.token;
  const timestamp = unit.contents.timestamp;
  const pub_key = unit.contents.pub_key;
  const codetype = unit.contents.codetype;
  const parenthash = unit.contents.parenthash;
  const input = unit.contents.input;
  const output = unit.contents.output;

  const date = new Date();
  const DagData = new RadixTree({
    db: db,
    root: dag_root
  });

  const parent:Unit = await DagData.get(Trie.en_key(parenthash));

  const pre_states = new RadixTree({
    db: db,
    root: t_state.stateroot
  });

  const valid_input_check = await input.options.some((hashs:DataHash,i:number)=>{
    return hashs.selfhash!=_.toHash(this[i]);
  },await input_raws(IpfsSet.node,input.options));

  const valid_output_check = await output.states.some((state:StateSet.T_state,i:number)=>{
    return state.contents.data.selfhash!=_.toHash(this[i]) || Buffer.from(JSON.stringify(state.contents.tag)).length>1000 || Buffer.from(JSON.stringify(output.log)).length>1000;
  },await output_raws(IpfsSet.node,output.states));

  const parents_dag = new RadixTree({
    db: db,
    root: parents_dag_root
  });

  const others_check = await some(input.others, async (key:string)=>{
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
  });

  const pre_amount = await reduce(input.token_id, async (sum:number,key:string)=>{
    const geted:StateSet.T_state = await pre_states.get(Trie.en_key(key));
    const new_sum = await sum + geted.contents.amount
    return new_sum;
  },0);

  const new_amount = output.states.reduce((sum:number,state:StateSet.T_state)=>{
    return sum + state.contents.amount;
  },0);

  if(nonce_count(hash)<=0){
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
  else if(token!=t_state.token){
    console.log("invalid token name");
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
  else if (parenthash!=parent.meta.hash){
    console.log("invalid parenthash");
    return false;
  }
  else if(await valid_input_check){
    console.log("invalid input");
    return false;
  }
  else if(await valid_output_check){
    console.log("invalid output");
    return false;
  }
  else if(others_check){
    console.log("invalid quotation units");
  }
  else if(t_state[codetype]==""){
    console.log("invalid codetype");
  }
  else if(codetype=='issue_code'&&input.token_id.length!=0){
    console.log("invalid codetype");
    return false;
  }
  else if(codetype=='change_code'&&pre_amount!=new_amount){
    console.log("invalid codetype");
    return false;
  }
  else if(codetype=='scrap_code'&&output.states.length!=0){
    console.log("invalid codetype");
    return false;
  }
  else if(codetype=='create_code'&&output.new_token.length==0){
    console.log("invalid codetype");
    return false;
  }
  else if(_.toHash(JSON.stringify(output))!=_.toHash(JSON.stringify(RunCode(input,t_state,codetype,raw_inputs,db,dag_root,worldroot,addressroot)))){
    console.log("invalid result");
    return false;
  }
  else{
    return true;
  }
}

async function AddUnittoDag(unit:Unit,t_state:StateSet.Token,dag_root:string,parents_dag_root:string,worldroot:string,addressroot:string){
  if(!ValidUnit(unit,t_state,dag_root,parents_dag_root,worldroot,addressroot)) return dag_root;
  const dag = new RadixTree({
    db: db,
    root: dag_root
  });
  const new_dag = await dag.set(Trie.en_key(unit.meta.hash),unit);
  const new_world_root:string = await new_dag.flush();
  return new_world_root;
}

async function CreateUnit(password:string,address:string,token:string,pub_key:string,codetype:Codetype,input:Input,output_con:Output){

}
