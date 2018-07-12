export const CryptoSet = require('./crypto_set.js');
export {map,reduce,filter,forEach} = require('p-iteration');
export const multihash = require("multi-hash");
export const en_key_for_js = (key)=>{
  const result =  key.split("").reduce((array:string[],val:string)=>{
    const asclled:string = val.charCodeAt(0).toString(16);
    const splited:string[] = asclled.split("").reduce((a:string[],v:string)=>{
      const new_a = a.concat(v);
      return new_a;
    },[]);
    const new_array = array.concat(splited);
    return new_array;
  },[]);
  return result;
};

export const toHash = (str)=>{
  var sha256 = crypto.createHash('sha256');
  sha256.update(str);
  const pre_hash = sha256.digest('hex');
  var sha512 = crypto.createHash('sha512');
  sha512.update(pre_hash);
  const hash = sha512.digest('hex');
  return hash;
}

export const ipfs_hash = (str:string):string=>{
  const buffered = Buffer.from(str);
  if(buffered.length!=32) return "";
  else{
    return multihash.encode(buffered);
  }
}
