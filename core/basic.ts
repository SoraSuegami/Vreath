import * as CryptoSet from './crypto_set'
import * as T from './types'
import * as TxSet from './tx'
import {BigNumber} from 'bignumber.js'


export const copy = <T>(data:T)=>{
  return Object.assign({},data);
}


export const new_obj = <T>(obj:T,fn:(obj:T)=>T)=>{
  return fn(copy(obj));
}

export const toHash = (str:string)=>{
  return CryptoSet.HashFromPass(str);
}

export const ObjectSort = <T>(obj:{[key:string]:T}|T[]):string=>{
  const keys = Object.keys(obj).sort();
  let maped:{[key:string]:T} = {};
  keys.forEach(((key:string)=>{
    let val = obj[key];
    if(typeof val==="object") val = ObjectSort(val);
    maped[key] = val;
  }));
  return JSON.stringify(maped);
}

export const ObjectHash = <T>(obj:{[key:string]:T}|T[])=>{
  const sorted = ObjectSort(obj);
  return toHash(sorted);
}

export const Hex_to_Num = (str:string):number=>{
  return parseInt(str,16);
}

export const get_unicode = (str:string):number[]=>{
  return str.split("").map((val)=>{
    return val.charCodeAt(0);
  });
}

export const reduce_pub = (pubs:string[])=>{
  return pubs.slice().sort().reduce((res:string,pub:string)=>{
    return toHash(pub+res);
  });
}

export const get_string = (uni:number[]):string=>{
  return String.fromCharCode.apply({},uni);
}

export const object_hash_check = (hash:string,obj:{[key:string]:any}|any[])=>{
  return hash!=ObjectHash(obj);
}

export const hash_size_check = (hash:string)=>{
  return Buffer.from(hash).length!=Buffer.from(toHash('')).length;
}

export const sign_check = (hash:string,signature:string,pub_key:string)=>{
  return CryptoSet.verifyData(hash,signature,pub_key)==false
}

export const address_check = (address:string,Public:string,token:string)=>{
  return address!=CryptoSet.GenereateAddress(token,Public);
}

export const time_check = (timestamp:number)=>{
  const date = new Date();
  return timestamp>date.getTime();
}

export const address_form_check = (address:string,token_name_maxsize:number)=>{
  const splitted = address.split(":");
  return splitted.length!=3 || splitted[0]!="Vr" || Buffer.from(splitted[1]).length>token_name_maxsize;
}

export const tx_fee = (tx:T.Tx)=>{
  const price = tx.meta.feeprice;
  const meta_part = Object.entries(tx.meta).filter(en=>en[0]!="feeprice");
  const raw_part = Object.entries(tx.raw).filter(en=>en[0]!="signature");
  const target = JSON.stringify(meta_part)+JSON.stringify(raw_part);
  return new BigNumber(price).times(Buffer.from(target).length).toNumber();
}

export const find_tx = (chain:T.Block[],hash:string)=>{
  for(let block of chain.slice()){
    if(block.meta.kind==="key") continue;
    for(let tx of block.txs.slice()){
      if(tx.hash===hash) return tx;
    }
    for(let tx of block.natives.slice()){
      if(tx.hash===hash) return tx;
    }
    for(let tx of block.units.slice()){
      if(tx.hash===hash) return tx;
    }
  }
  return TxSet.empty_tx_pure();
}

