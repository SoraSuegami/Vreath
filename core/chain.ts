declare function require(x: string): any;

import * as crypto from 'crypto'
import * as _ from './basic'
import * as Trie from './merkle_patricia'
import * as StateSet from './state'
import * as DagSet from './dag'
import * as IpfsSet from './ipfs'

const {map,reduce,filter,forEach,some} = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');

const CryptoSet = require('./crypto_set.js');

export type AddressAlias = {
  kind:string;
  key:string;
}
type Candidates = {
  address: string;
  amount: number;
}

type BlockMeta = {
  hash: string;
  validatorSign: string;
}

type BlockCon = {
  index:number;
  parenthash:string;
  timestamp: number;
  stateroot: string;
  addressroot: string;
  evidences: string[];
  validator: string;
  validatorPub: string;
  candidates: Candidates[];
}

type Block = {
  meta:BlockMeta;
  contents:BlockCon;
}

async function ChildHashs(parent:string,parents_dag){
  const hashs:string[] = await parents_dag.get(Trie.en_key(parent));
  return hashs;
}

async function NotDoubleConfirmed(hash:string,DagData,parents_dag){
  const children:string[] = await ChildHashs(hash,parents_dag);
  if(children.length==0) return true;
  return await some(children,async (key:string)=>{
    const grandchildren:string[] = await ChildHashs(key,parents_dag);
    return grandchildren.length==0;
  });
}

function SortCandidates(candidates:Candidates[]){
  return candidates.sort((a:Candidates,b:Candidates)=>{
    return _.get_unicode(a.address) - _.get_unicode(b.address);
  });
}

function elected(sorted:Candidates[],result:number,now=-1,i=0):string{
  if(result>sorted.length-1) return "";
  const new_now = now + sorted[i].amount;
  if(new_now<result) return elected(sorted,result,new_now,i+1);
  else return sorted[i].address;
}

async function ValidBlock(block:Block,chain:Block[],nowroot:string,nowaddressroot:string,dag_root:string,parents_dag_root:string){
  const hash = block.meta.hash;
  const validatorSign = block.meta.validatorSign;
  const index = block.contents.index;
  const parenthash = block.contents.parenthash;
  const timestamp = block.contents.timestamp;
  const stateroot = block.contents.stateroot;
  const addressroot = block.contents.addressroot;
  const evidences = block.contents.evidences;
  const validator = block.contents.validator;
  const validatorPub = block.contents.validatorPub;
  const candidates = block.contents.candidates;

  const last = chain[chain.length-1];
  const date = new Date();

  const DagData = new RadixTree({
    db: db,
    root: dag_root
  });

  const parents_dag = new RadixTree({
    db: db,
    root: parents_dag_root
  });

  const not_confirmed_check = await some(evidences, async (key:string)=>{
    const check = await NotDoubleConfirmed(key,DagData,parents_dag);
    return check;
  });

  const right_validator = elected(SortCandidates(last.contents.candidates),_.get_unicode(block.meta.hash));

  const AddressState = new RadixTree({
    db: db,
    root: nowaddressroot
  });
  const World = new RadixTree({
    db: db,
    root: nowroot
  });
  /*const PnsData = await World.get(Trie.en_key('pns'));
  const pns:AddressAlias[] = await AddressState.get(Trie.en_key('pns'));
  const sacrifice_holders = await reduce(pns,async (result,alias:AddressAlias)=>{
    const state:StateSet.T_state = await PnsData.get(Trie.en_key(alias.key));
    if(result[state.contents.tag.])
  },{});*/

  if(hash!=_.toHash(JSON.stringify(block.contents))){
    console.log("invalid hash");
    return false;
  }
  else if(CryptoSet.verifyData(hash,validatorSign,validatorPub)==false){
    console.log("invalid signature");
    return false;
  }
  else if(index!=chain.length){
    console.log("invalid index");
    return false;
  }
  else if(parenthash!=last.meta.hash){
    console.log("invalid parenthash");
    return false;
  }
  else if(timestamp>date.getTime()){
    console.log("invalid timestamp");
    return false;
  }
  else if(stateroot!=nowroot){
    console.log("invalid stateroot");
    return false;
  }
  else if(addressroot!=nowaddressroot){
    console.log("invalid addressroot");
    return false;
  }
  else if(not_confirmed_check){
    console.log("invalid evidences");
    return false;
  }
  else if(validator!=right_validator){
    console.log("invalid validator");
    return false;
  }
  else if(validator!=CryptoSet.AddressFromPublic(validatorPub)){
    console.log("invalid validator pub_key");
    return false;
  }
}
