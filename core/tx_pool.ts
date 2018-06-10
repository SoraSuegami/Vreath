declare function require(x: string): any;

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as _ from './basic'
import {Trie} from './merkle_patricia'
import * as StateSet from './state'
import * as DagSet from './dag'
import * as TxSet from './tx'
import * as ChainSet from './chain'
import * as IpfsSet from './ipfs'

const {map,reduce,filter,forEach,some} = require('p-iteration');
//const RadixTree = require('dfinity-radix-tree');
//const levelup = require('levelup');
//const leveldown = require('leveldown');
//const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
const rlp = require('rlp');

const CryptoSet = require('./crypto_set.js');

export type Pool = {
  [key:string]:TxSet.Tx;
}

async function check_tx(tx:TxSet.Tx,tag_limit:number,key_currency:string,fee_by_size:number,chain:ChainSet.Block[],StateData:Trie,DagData:Trie,RequestsAlias:Trie){
  if(tx.kind=="request"){
    return await TxSet.ValidRequestTx(tx,tag_limit,key_currency,fee_by_size,StateData)
  }
  else if(tx.kind=="refresh"){
    return await TxSet.ValidRefreshTx(tx,chain,key_currency,fee_by_size,tag_limit,StateData,DagData,RequestsAlias);
  }
  else return false;
}

export async function Tx_to_Pool(pool:Pool,tx:TxSet.Tx,tag_limit:number,key_currency:string,fee_by_size:number,chain:ChainSet.Block[],StateData:Trie,DagData:Trie,RequestsAlias:Trie){
  if(! await check_tx(tx,tag_limit,key_currency,fee_by_size,chain,StateData,DagData,RequestsAlias)) return pool;
  const new_pool = ((pool:Pool)=>{
    pool[tx.meta.hash] = tx;
    return pool;
  })(pool);
  return new_pool;
}
