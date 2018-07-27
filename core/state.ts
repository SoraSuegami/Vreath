import * as _ from './basic'
import * as T from './types'


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

export const CreateState = (amount:number,owner:string[],token:string,data:{[key:string]:string},product:string[])=>{
  const contents:T.StateContent = {
      owner:owner,
      token:token,
      amount:amount,
      data:data,
      product:product
  };
  const hash = _.ObjectHash(contents);
  const state:T.State = {
    hash:hash,
    contents:contents
  }
  return state;
}

export const CreateToken = (nonce=0,token="",issued=0,deposited=0,committed:string[]=[],code="",developer:string[]=[]):T.Token=>{
  return {
    nonce:nonce,
    token:token,
    issued:issued,
    deposited:deposited,
    committed:committed,
    code:code,
    developer:developer
  }
}