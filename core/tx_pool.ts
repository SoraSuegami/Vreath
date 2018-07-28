import {Trie} from './merkle_patricia'
import * as TxSet from './tx'
import * as T from './types'

const check_tx = async (tx:T.Tx,my_version:number,native:string,unit:string,chain:T.Block[],pow_target:number,token_name_maxsize:number,StateData:Trie,LocationData:Trie)=>{
  if(tx.meta.kind=="request"){
    return await TxSet.ValidRequestTx(tx,my_version,native,unit,StateData,LocationData);
  }
  else if(tx.meta.kind=="refresh"){
    return await TxSet.ValidRefreshTx(tx,chain,my_version,pow_target,native,unit,token_name_maxsize,StateData,LocationData);
  }
  else return false;
}

export async function Tx_to_Pool(pool:T.Pool,tx:T.Tx,my_version:number,native:string,unit:string,chain:T.Block[],pow_target:number,token_name_maxsize:number,StateData:Trie,LocationData:Trie){
  if(! await check_tx(tx,my_version,native,unit,chain,pow_target,token_name_maxsize,StateData,LocationData)) return pool;
  const new_pool = ((pool:T.Pool)=>{
    pool[tx.hash] = tx;
    return pool;
  })(pool);
  return new_pool;
}
