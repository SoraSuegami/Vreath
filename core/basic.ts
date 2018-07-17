import * as CryptoSet from './crypto_set'

export const toHash = (str:string)=>{
  return CryptoSet.HashFromPass(str);
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

export const object_hash_check = (hash:string,obj)=>{
  return hash!=toHash(JSON.stringify(obj));
}

export const hash_size_check = (hash:string)=>{
  return Buffer.from(hash).length!=128;
}

export const sign_check = (address:string,token:string,hash:string,signature:string,pub_key:string)=>{
  return address!=token&&CryptoSet.verifyData(hash,signature,pub_key)==false
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