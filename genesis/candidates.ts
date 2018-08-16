import * as CryptoSet from '../core/crypto_set'
import {native} from '../wallet/con'

const genesis_pub = "03197dced5b880718079c048f42c25cf3378a4352919ba3183f428d3290ce5c494"

export const genesis_candidates = [{
    address:CryptoSet.GenereateAddress(native,genesis_pub),
    amount:100000000000000
}]