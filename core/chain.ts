declare function require(x: string): any;

import * as crypto from 'crypto'
import * as _ from './basic'
import * as Trie from './merkle_patricia'
import * as StateSet from './state'
import * as DagSet from './dag'
import * as TxSet from './tx'
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

type BlockContents = {
  index:number;
  parenthash:string;
  timestamp: number;
  stateroot: string;
  addressroot: string;
  used_dagroot: string;
  used_txroot: string;
  //evidences: string[];
  tx_root: string
  validator: string;
  validatorPub: string;
  candidates: Candidates[];
}

export type Block = {
  meta:BlockMeta;
  contents:BlockContents;
  transactions: TxSet.Tx[];
}

function GetTreeroot(pre:string[]){
  if(pre.length==1) return pre[0];
  else{
  const union = pre.reduce((result:string[],val:string,index:number,array:string[]):string[]=>{
    const i = Number(index);
    if(i%2==0){
      const left = val;
      const right = ((left:string,i:number,array:string[])=>{
        if(array[i+1]==null) return "";
        else return array[i+1];
      })(left,i,array);
      return result.concat(_.toHash(left+right));
    }
  },[]);
  return GetTreeroot(union);
  }
}

async function ChildHashs(parent:string,parents_dag){
  const hashs:string[] = await parents_dag.get(Trie.en_key(parent));
  return hashs;
}

async function NotDoubleConfirmed(hash:string,parents_dag){
  const children:string[] = await ChildHashs(hash,parents_dag);
  if(children.length==0) return true;
  return await some(children,async (key:string)=>{
    const grandchildren:string[] = await ChildHashs(key,parents_dag);
    return grandchildren.length==0;
  });
}

async function TxUsed(hash:string,used_tx){
  const used = await used_tx.get(Trie.en_key(hash));
  return used==null;
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

async function TxCheckintoChain(txs:TxSet.Tx[],parents_dag,used_tx){
  return await some(txs, async (tx:TxSet.Tx)=>{
    const not_confirmed_check = await NotDoubleConfirmed(tx.meta.evidence,parents_dag);
    const used_tx_check = await TxUsed(tx.meta.hash,used_tx);
    return not_confirmed_check==true || used_tx_check==true;
  });
}

async function ValidBlock(block:Block,chain:Block[],now_stateroot:string,now_addressroot:string,now_used_dagroot:string,now_used_txroot:string,dag_root:string,parents_dag_root:string){
  const hash = block.meta.hash;
  const validatorSign = block.meta.validatorSign;
  const index = block.contents.index;
  const parenthash = block.contents.parenthash;
  const timestamp = block.contents.timestamp;
  const stateroot = block.contents.stateroot;
  const addressroot = block.contents.addressroot;
  const used_dagroot = block.contents.used_dagroot;
  const used_txroot = block.contents.used_txroot;
  const tx_root = block.contents.tx_root;
  const validator = block.contents.validator;
  const validatorPub = block.contents.validatorPub;
  const candidates = block.contents.candidates;
  const txs = block.transactions;

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

  const AddressState = new RadixTree({
    db: db,
    root: now_addressroot
  });

  const StateData = new RadixTree({
    db: db,
    root: now_stateroot
  });

  const UsedTx = new RadixTree({
    db: db,
    root: now_used_txroot
  });

  const evidences = txs.reduce((result:string[],tx:TxSet.Tx)=>{
    return result.concat(tx.meta.evidence);
  },[]);

  const evidences_units = await reduce(evidences, async (array:DagSet.Unit[],key:string)=>{
    const unit:DagSet.Unit = await DagData.get(Trie.en_key(key));
    return array.concat(unit)
  },[]);

  /*const input_check = await some(evidences_units,(unit:DagSet.Unit)=>{
    const this_token:StateSet.Token = await World.get(Trie.en_key(unit.contents.token));
    return await some(unit.contents.input.token_id,(id:string)=>{
      const tokens =  new RadixTree({
        db: db,
        root:this
      });
      const input = await tokens.get(Trie.en_key(id));
      return input==null;
    },this_token.stateroot);
  });*/
  const tx_hash_map = txs.map((tx:TxSet.Tx)=>{
    return tx.meta.hash;
  });

  const right_validator = elected(SortCandidates(last.contents.candidates),_.get_unicode(block.meta.hash));

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
  else if(stateroot!=now_stateroot){
    console.log("invalid stateroot");
    return false;
  }
  else if(addressroot!=now_addressroot){
    console.log("invalid addressroot");
    return false;
  }
  else if(used_dagroot!=now_used_dagroot){
    console.log("invalid used_dagroot");
    return false;
  }
  else if(used_txroot!=now_used_txroot){
    console.log("invalid used_txroot");
    return false;
  }
  else if(tx_root!=GetTreeroot(tx_hash_map)){
    console.log("invalid tx_root");
    return false;
  }
  else if(TxCheckintoChain(txs,parents_dag,UsedTx)){
    console.log("invalid transactions");
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
