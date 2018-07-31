import * as _ from './basic'
import * as T from './types'

export const CreateState = (nonce:number=0,owner:string[]=[],token:string="",amount:number=0,data:{[key:string]:string}={},product:string[]=[])=>{
  const contents:T.StateContent = {
      nonce:0,
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