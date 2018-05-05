declare function require(x: string): any;

import * as crypto from 'crypto'
import * as _ from './basic'
import * as Trie from './merkle_patricia'
import * as StateSet from './state'
import * as DagSet from './dag'
import * as TxSet from './tx'
import * as PoolSet from './tx_pool'
import * as IpfsSet from './ipfs'

const {map,reduce,filter,forEach,some} = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
const rlp = require('rlp');

const CryptoSet = require('./crypto_set.js');

export const fee_by_size = 10;
/*export type AddressAlias = {
  kind:string;
  key:string;
}*/

export type RequestsAlias = {
  index:number;
  hash:string;
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
  request_root: string;
  //addressroot: string;
  //used_dagroot: string;
  //used_txroot: string;
  //evidences: string[];
  tx_root: string;
  fee:number;
  difficulty:number;
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

/*async function ChildHashs(parent:string,parents_dag){
  const hashs:string[] = await parents_dag.get(Trie.en_key(parent));
  return hashs;
}*/

/*async function NotDoubleConfirmed(hash:string,parents_dag){
  const children:string[] = await ChildHashs(hash,parents_dag);
  if(children.length==0) return true;
  return await some(children,async (key:string)=>{
    const grandchildren:string[] = await ChildHashs(key,parents_dag);
    return grandchildren.length==0;
  });
}*/

/*async function TxUsed(hash:string,used_tx){
  const used = await used_tx.get(Trie.en_key(hash));
  return used==null;
}*/

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

/*async function TxCheckintoChain(txs:TxSet.Tx[],parents_dag,used_tx){
  return await some(txs, async (tx:TxSet.Tx)=>{
    const not_confirmed_check = await NotDoubleConfirmed(tx.meta.evidence,parents_dag);
    const used_tx_check = await TxUsed(tx.meta.hash,used_tx);
    return not_confirmed_check==true || used_tx_check==true;
  });
}*/

async function ValidBlock(block:Block,chain:Block[],now_stateroot:string,now_request_root:string,dag_root:string,fee_by_size:number,key_currency:string,tag_limit:number){
  const hash = block.meta.hash;
  const validatorSign = block.meta.validatorSign;
  const index = block.contents.index;
  const parenthash = block.contents.parenthash;
  const timestamp = block.contents.timestamp;
  const stateroot = block.contents.stateroot;
  /*const addressroot = block.contents.addressroot;
  const used_dagroot = block.contents.used_dagroot;
  const used_txroot = block.contents.used_txroot;*/
  const request_root = block.contents.request_root;
  const tx_root = block.contents.tx_root;
  const fee = block.contents.fee;
  const difficulty = block.contents.difficulty;
  const validator = block.contents.validator;
  const validatorPub = block.contents.validatorPub;
  const candidates = block.contents.candidates;
  const txs = block.transactions;

  const last = chain[chain.length-1];
  const date = new Date();

  /*const DagData = new RadixTree({
    db: db,
    root: dag_root
  });*/

  /*const parents_dag = new RadixTree({
    db: db,
    root: parents_dag_root
  });*/

  /*const AddressState = new RadixTree({
    db: db,
    root: now_addressroot
  });*/

  const StateData = new RadixTree({
    db: db,
    root: now_stateroot
  });

  /*const UsedTx = new RadixTree({
    db: db,
    root: now_used_txroot
  });*/

  /*const evidences = txs.reduce((result:string[],tx:TxSet.Tx)=>{
    return result.concat(tx.meta.evidence);
  },[]);

  const evidences_units = await reduce(evidences, async (array:DagSet.Unit[],key:string)=>{
    const unit:DagSet.Unit = await DagData.get(Trie.en_key(key));
    return array.concat(unit)
  },[]);*/

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

  /*
  const RequestStates = new RadixTree({
    db: db,
    root: now_request_root
  });

  const request_map = await map(txs,async (tx:TxSet.Tx)=>{
    if(tx.kind=="request") return tx;
    else if(tx.kind=="refresh"){
      const request:TxSet.RequestTx = chain[tx.contents.index].transactions.reduce((result:TxSet.RequestTx[],t:TxSet.Tx)=>{
        if(t.kind=="request"&&t.meta.hash==tx.contents.request) return result.concat(t);
      },[])[0];
      const state:"waiting" | "refreshed" = await RequestStates.get(Trie.en_key(request.meta.hash));
      if(state=="waiting") return request
      else return ""
    }
    else return "";
  })

  const fee_sum = request_map.filter(t=>t!="").reduce((sum:number,tx:TxSet.RequestTx)=>{
    return sum + tx.contents.data.fee;
  });*/
  const size_sum = txs.reduce((sum:number,tx:TxSet.Tx):number=>{
    return sum + Buffer.from(JSON.stringify(tx)).length;
  },0);

  const right_validator = elected(SortCandidates(last.contents.candidates),_.get_unicode(block.meta.hash));

  const validator_state:StateSet.State = JSON.parse(rlp.decode(await StateData.get(Trie.en_key(validator))));
  const address = validator_state.contents.owner;
  /*const PnsData = await World.get(Trie.en_key('pns'));
  const pns:AddressAlias[] = await AddressState.get(Trie.en_key('pns'));
  const sacrifice_holders = await reduce(pns,async (result,alias:AddressAlias)=>{
    const state:StateSet.T_state = await PnsData.get(Trie.en_key(alias.key));
    if(result[state.contents.tag.])
  },{});*/
  const valid_txs = await some(txs, async (tx:TxSet.Tx)=>{
    if(tx.kind=="request"&&(await TxSet.ValidRequestTx(tx,this[0],tag_limit,key_currency,fee_by_size))){
      const new_roots =  await TxSet.AcceptRequestTx(tx,chain,validator,this[0],this[1],key_currency);
      this[0] = new_roots[0];
      this[1] = new_roots[1];
      return false;
    }
    else if(tx.kind=="refresh"&&(await TxSet.ValidRefreshTx(tx,dag_root,chain,this[0],this[1],key_currency,fee_by_size))){
      const new_roots = await TxSet.AcceptRefreshTx(tx,chain,validator,tx.contents.index,this[0],this[1],key_currency);
      this[0] = new_roots[0];
      this[1] = new_roots[1];
      return false;
    }
    else{
      return true;
    }
  },[stateroot,request_root]);

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
  /*else if(addressroot!=now_addressroot){
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
  }*/
  else if(request_root!=now_request_root){
    console.log("invalid request_root");
    return false;
  }
  else if(tx_root!=GetTreeroot(tx_hash_map)){
    console.log("invalid tx_root");
    return false;
  }
  /*else if(TxCheckintoChain(txs,parents_dag,UsedTx)){
    console.log("invalid transactions");
    return false;
  }*/
  else if(fee!=fee_by_size*size_sum){
    console.log("invalid fee");
  }
  else if(validator_state.contents.token!=key_currency||address!=right_validator){
    console.log("invalid validator");
    return false;
  }
  else if(address!=CryptoSet.AddressFromPublic(validatorPub)){
    console.log("invalid validator pub_key");
    return false;
  }
  else if(valid_txs){
    console.log("invalid transactions");
    return false;
  }
  else{
    return true;
  }
}

async function AcceptBlock(block:Block,chain:Block[],tag_limit:number,request_root:string,request_index:number,fee_by_size:number,key_currency:string,dag_root:string){
  const stateroot = block.contents.stateroot;
  const validator = block.contents.validator;
  if(!await ValidBlock(block,chain,stateroot,request_root,dag_root,fee_by_size,key_currency,tag_limit)) return [stateroot,request_root];
  const new_roots = await reduce(block.transactions, async (roots,tx:TxSet.Tx)=>{
    if(tx.kind=="request"){
      return await TxSet.AcceptRequestTx(tx,chain,validator,roots[0],roots[1],key_currency);
    }
    else if(tx.kind=="refresh"){
      return await TxSet.AcceptRefreshTx(tx,chain,validator,request_index,roots[0],roots[1],key_currency);
    }
    else{
      return roots
    }
  },[stateroot,request_root]);
  const new_chain = chain.concat(block);
  return {
    chain:new_chain,
    stateroot:new_roots[0],
    request_root:new_roots[1]
  }
}
