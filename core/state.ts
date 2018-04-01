declare function require(x: string): any;
import * as crypto from 'crypto'

const CryptoSet = require('./crypto_set.js');

type Data = {
  hash:string;
  size:number;
};

type T_state = {
  hash: string;
  owner: string;
  amount: number;
  tag: {[key:string]: any;};
  data: Data;
};

type Token = {
  token: string;
  pool: number;
  issued: number;
  stateroot: string;
  issue_code: string;
  change_code: string;
  scrap_code: string;
  developer: string;
  t_state: any;
};

const GetNode = (tree:any,key:string,val:any):any=>{
  const en_key:string = Buffer.from(key,'utf-8');
  const en_val:stri = rlp.encode(JSON.stringify(state));
}
