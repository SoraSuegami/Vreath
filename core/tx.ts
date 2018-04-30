declare function require(x: string): any;

import * as crypto from 'crypto'
import * as _ from './basic'
import * as Trie from './merkle_patricia'
import * as StateSet from './state'
import * as DagSet from './dag'
import * as IpfsSet from './ipfs'

const {map,reduce,filter,forEach} = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');

const CryptoSet = require('./crypto_set.js');

export type TxTypes = 'issue' | 'change' | 'scrap' | 'create'

type TxMeta = {
  hash:string;
  signature:string;
  evidence:string;
}

type TxContents = {
  address:string;
  pub_key:string;
  timestamp:number;
  type:TxTypes;
  token:string;
  input:string[];
  output:StateSet.State[];
  new_token:StateSet.Token[];
  pre:string;
}

export type TxData = {
  purehash:string;
  contents:TxContents;
}

export type Tx = {
  meta:TxMeta;
  data:TxData;
}

async function get_raws(node,states:StateSet.State[]){
  await node.on('ready');
  const result = await map(states,async (state:StateSet.State)=>{
    const ipfshash:string = state.contents.data.ipfshash;
    const cated = await node.cat(ipfshash);
    return cated.toString('utf-8');
  });
  return result;
}

async function ValidTx(tx:Tx,dag_root:string,stateroot:string){
  const hash = tx.meta.hash;
  const signature = tx.meta.signature;
  const evidence = tx.meta.evidence;
  const purehash = tx.data.purehash;
  const address = tx.data.contents.address;
  const pub_key = tx.data.contents.pub_key;
  const timestamp = tx.data.contents.timestamp;
  const type = tx.data.contents.type;
  const token = tx.data.contents.token;
  const input = tx.data.contents.input;
  const output = tx.data.contents.output;
  const new_token = tx.data.contents.new_token;
  const pre = tx.data.contents.pre;

  const date = new Date();

  const DagData = new RadixTree({
    db: db,
    root: dag_root
  });

  const StateData = new RadixTree({
    db: db,
    root: stateroot
  });

  const unit:DagSet.Unit = await DagData.get(Trie.en_key(evidence));

  const input_state = await reduce(unit.contents.input.token_id,async (array:StateSet.State[],id:string)=>{
    const geted:StateSet.State = await StateData.get(Trie.en_key(id));
    if(geted!=null) return array.concat(geted);
    else return array;
  },[]);

  const state_check = await output.some((state:StateSet.State,i:number)=>{
    return state.contents.data.selfhash!=_.toHash(this[i]) || Buffer.from(JSON.stringify(state.contents.tag)).length>1000;
  },await get_raws(IpfsSet.node,output));

  const pre_amount = input_state.reduce((sum:number,state:StateSet.State)=>{
    return sum + state.amount;
  },0);

  const new_amount = output.reduce((sum:number,state:StateSet.State)=>{
    return sum + state.amount;
  },0);

  if(hash!=_.toHash(JSON.stringify(tx.data))){
    console.log("invalid hash");
    return false;
  }
  else if (address!=token&&CryptoSet.verifyData(hash,signature,pub_key)==false){
    console.log("invalid signature");
    return false;
  }
  else if(unit.contents.output.tx.indexOf(_.toHash(JSON.stringify(tx.data))) == -1||address!=unit.contents.address){
    console.log("invalid evidence");
    return false;
  }
  else if(purehash!=_.toHash(JSON.stringify(tx.data.contents))){
    console.log("invalid purehash");
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
  /*else if(token!=t_state.token){
    console.log("invalid token name");
    return false;
  }*/
  else if(input.length!=input_state.length){
    console.log("invalid input");
    return false;
  }
  else if(state_check){
    console.log("invalid output");
    return false;
  }
  else if(type=='issue'&&pre_amount>=new_amount){
    console.log("invalid type");
    return false;
  }
  else if(type=='change'&&pre_amount!=new_amount){
    console.log("invalid type");
    return false;
  }
  else if(type=='scrap'&&pre_amount<=new_amount){
    console.log("invalid type");
    return false;
  }
  else{
    return true;
  }
}

function TxIsuue(tx:Tx,inputs:StateSet.State[]):StateSet.State[]{
  if(tx.data.contents.type!="issue") return inputs;
  const outputs = tx.data.contents.output;
  return outputs;
}

function TxChange(tx:Tx,inputs:StateSet.State[]):StateSet.State[]{
  if(tx.data.contents.type!="change") return inputs;
  return inputs.map((state:StateSet.State,i:number)=>{
    const output = tx.data.contents.output[i];
    state.amount += output.amount;
    state.contents = output.contents;
    return state;
  });
}

function TxScrap(tx:Tx,inputs:StateSet.State[]):StateSet.State[]{
  if(tx.data.contents.type!="scrap") return inputs;
  else return [];
}

function TxCreate(tx:Tx,inputs:StateSet.State[]):StateSet.State[]{
  if(tx.data.contents.type!="create") return inputs;
  const outputs = tx.data.contents.output;
  return outputs;
}
