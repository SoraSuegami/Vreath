declare function require(x: string): any;

import * as crypto from 'crypto'
import * as _ from './basic'
import * as Trie from './merkle_patricia'
import * as StateSet from './state'

const {map,reduce,filter,forEach} = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));

const CryptoSet = require('./crypto_set.js');

type PutMeta = {
  hash:string;
  size:number;
}

export type InputCon = {
  token_id: string[];
  others: string[];
  options: any[];
}

export type OutputCon = {
  states: StateSet.T_state[];
  app_rate: number;
  new_token: StateSet.Token[];
  options: any[];
}

type Input = {
  meta: PutMeta;
  contents: InputCon;
}

type Output = {
  meta: PutMeta;
  contents: OutputCon;
}

type Codetype = 'issue_code' | 'change_code' | 'scrap_code' | 'create_code';

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

const RunCode = (input:InputCon,t_state:StateSet.Token,type:Codetype):OutputCon | StateSet.Token=>{
  const code = t_state[type];
  const result = code(input);
  return result
};


async function inValidUnit(unit:Unit,t_state:StateSet.Token,dag_root:string){
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

  const pre_amount = await reduce(input.contents.token_id, async (sum:number,key:string)=>{
    const geted:StateSet.T_state = await pre_states.get(Trie.en_key(key));
    const new_sum = await sum + geted.contents.amount
    return new_sum;
  },0);

  const new_amount = output.contents.states.reduce((sum:number,state:StateSet.T_state)=>{
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
    else if (CryptoSet.verifyData(hash,signature,pub_key)==false){
      console.log("invalid signature");
      return false;
    }
    else if(!address.match(/^PH/)){
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
    else if(address!=CryptoSet.AddressFromPublic(pub_key)){
      console.log("invalid pub_key");
      return false;
    }
    else if (parenthash!=parent.meta.hash){
      console.log("invalid parenthash");
      return false;
    }
    else if(input.meta.hash!=_.toHash(JSON.stringify(input.contents))||input.meta.size!=Buffer.from(JSON.stringify(input.contents)).length){
      console.log("invalid input");
      return false;
    }else if(output.meta.hash!=_.toHash(JSON.stringify(output.contents))||output.meta.size!=Buffer.from(JSON.stringify(output.contents)).length){
      console.log("invalid output");
      return false;
    }
    else if(codetype=='issue_code'&&input.contents.token_id.length!=0){
      console.log("invalid codetype");
      return false;
    }
    else if(codetype=='change_code'&&pre_amount!=new_amount){
      console.log("invalid codetype");
      return false;
    }
    else if(codetype=='scrap_code'&&output.contents.states.length!=0){
      console.log("invalid codetype");
      return false;
    }
    else if(codetype=='create_code'&&output.contents.new_token.length==0){
      console.log("invalid codetype");
      return false;
    }
    else if(_.toHash(JSON.stringify(output))!=_.toHash(JSON.stringify(RunCode(input.contents,t_state,codetype)))){
      console.log("invalid result");
      return false;
    }
    else{
      return true;
    }
}
