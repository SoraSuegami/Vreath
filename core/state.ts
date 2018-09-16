import * as _ from './basic'
import * as T from './types'
import * as CryptoSet from './crypto_set'

export const CreateState = (nonce:number=0,owner:string=CryptoSet.GenereateAddress("",_.toHash("")),token:string="",amount:number=0,data:{[key:string]:string}={},product:string[]=[]):T.State=>{
  return {
    kind:"state",
    nonce:nonce,
    token:token,
    owner:owner,
    amount:amount,
    data:data,
    product:product,
    issued:0,
    deposited:0,
    committed:[""],
    code:"",
    developer:[""]
  }
}

export const CreateToken = (nonce=0,token="",issued=0,deposited=0,committed:string[]=[],code="",developer:string[]=[]):T.State=>{
  return {
    kind:"token",
    nonce:nonce,
    token:token,
    owner:"Vr:"+token+":"+_.toHash(''),
    amount:0,
    data:{},
    product:[""],
    issued:issued,
    deposited:deposited,
    committed:committed,
    code:code,
    developer:developer
  }
}