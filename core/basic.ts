import * as crypto from 'crypto'

export function toHash(str:string){
  var sha256 = crypto.createHash('sha256');
  sha256.update(str);
  const pre_hash = sha256.digest('hex');
  var sha512 = crypto.createHash('sha512');
  sha512.update(pre_hash);
  const hash = sha512.digest('hex');
  return hash;
}

export function get_unicode(str:string):number{
  const result = str.split("").reduce((num,val)=>{
    return num + val.charCodeAt(0);
  },0);
  return result;
}
