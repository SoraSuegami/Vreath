import * as T from '../core/types'
import * as CryptoSet from '../core/crypto_set'
import * as StateSet from '../core/state'
//100000000000000
const genesis_pub = "03197dced5b880718079c048f42c25cf3378a4352919ba3183f428d3290ce5c494"
const genesis_pub2 = "03f86f2484722d3b922ac3212575fe7fdfc5d3a028f812b44fbd93c24c18938189"
const genesis_native_address = CryptoSet.GenereateAddress("native",genesis_pub);
const genesis_unit_address = CryptoSet.GenereateAddress("unit",genesis_pub);
const genesis_unit_address2 = CryptoSet.GenereateAddress("unit",genesis_pub2);
export const genesis_state:T.State[] = [StateSet.CreateState(0,genesis_native_address,"native",0,{},[]),StateSet.CreateState(0,genesis_unit_address,"unit",100,{},[]),StateSet.CreateState(0,genesis_unit_address2,"unit",100,{},[]),StateSet.CreateToken(0,"native",0,0,[],"",[]),StateSet.CreateToken(0,"unit",100,0,[],"",[])];