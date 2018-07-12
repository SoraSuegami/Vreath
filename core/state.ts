declare function require(x: string): any;

import * as crypto from 'crypto'
import * as _ from './basic'
import * as CryptoSet from './crypto_set'
import {Trie} from './merkle_patricia'
import * as StateSet from './state'
import * as DagSet from './dag'
import * as ChainSet from './chain'
import * as T from './types'

const {map,reduce,filter,forEach} = require('p-iteration');

// These are for test.
/*const password = 'Sora';
const my_pub = CryptoSet.PullMyPublic(password);
const my_address = CryptoSet.AddressFromPublic(my_pub);
CryptoSet.GenerateKeys("Test");
const test_pub = CryptoSet.PullMyPublic("Test");
const test_address = CryptoSet.AddressFromPublic(test_pub);*/
// These are for test.

/*function FunctoStr(func):string{
  return func.toString().replace(/^\(\)\s=>\s{/,"").replace(/}$/,"");
}*/

export function CreateState(amount:number,owner:string[],token:string,data:{[key:string]:string},product:string[]){
  const contents:T.StateContent = {
      owner:owner,
      token:token,
      amount:amount,
      data:data,
      product:product
  };
  const hash = _.toHash(JSON.stringify(contents));
  const state:T.State = {
    hash:hash,
    contents:contents
  }
  return state;
}

