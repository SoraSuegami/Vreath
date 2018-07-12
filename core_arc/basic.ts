import * as crypto from 'crypto'
const CryptoSet = require('./crypto_set.js');

export const toHash = (str:string)=>{
  var sha256 = crypto.createHash('sha256');
  sha256.update(str);
  const pre_hash = sha256.digest('hex');
  var sha512 = crypto.createHash('sha512');
  sha512.update(pre_hash);
  const hash = sha512.digest('hex');
  return hash;
}

export const get_unicode = (str:string):number=>{
  const result = str.split("").reduce((num,val)=>{
    return num + val.charCodeAt(0);
  },0);
  return result;
}

export const object_hash_check = (hash:string,obj)=>{
  return hash!=toHash(JSON.stringify(obj));
}

export const sign_check = (address:string,token:string,hash:string,signature:string,pub_key:string)=>{
  return address!=token&&CryptoSet.verifyData(hash,signature,pub_key)==false
}

export const address_check = (address:string,token:string)=>{
  return address!=token&&!address.match(/^PH/)
}

export const pub_key_check = (address:string,token:string,pub_key:string)=>{
  return address!=token&&address!=CryptoSet.AddressFromPublic(pub_key);
}

export const time_check = (timestamp:number)=>{
  const date = new Date();
  return timestamp>date.getTime();
}
