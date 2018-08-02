import * as CryptoSet from './crypto_set'
import * as T from './types'
import * as TxSet from './tx'

export const toHash = (str:string)=>{
  return CryptoSet.HashFromPass(str);
}

export const ObjectSort = (obj:{[key:string]:any}|any[]):string=>{
  const keys = Object.keys(obj).sort();
  let maped:{[key:string]:any} = {};
  keys.forEach(((key:string)=>{
    let val:any = obj[key];
    if(typeof val==="object") val = ObjectSort(val);
    maped[key] = val;
  }));
  return JSON.stringify(maped);
}

export const ObjectHash = (obj:{[key:string]:any}|any[])=>{
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
  return price * Buffer.from(target).length;
}

export const find_tx = (chain:T.Block[],hash:string)=>{
  for(let block of chain){
    if(block.meta.kind==="key") continue;
    for(let tx of block.txs){
      if(tx.hash===hash) return tx;
    }
    for(let tx of block.natives){
      if(tx.hash===hash) return tx;
    }
    for(let tx of block.units){
      if(tx.hash===hash) return tx;
    }
  }
  return TxSet.empty_tx_pure();
}