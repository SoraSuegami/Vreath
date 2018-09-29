import * as CryptoSet from '../core/crypto_set'
import {native} from '../wallet/con'

const genesis_pub = "03197dced5b880718079c048f42c25cf3378a4352919ba3183f428d3290ce5c494"
const genesis_pub2 = "03f86f2484722d3b922ac3212575fe7fdfc5d3a028f812b44fbd93c24c18938189"

const genesis_unit_address = CryptoSet.GenereateAddress("unit",genesis_pub);
const genesis_unit_address2 = CryptoSet.GenereateAddress("unit",genesis_pub2);

export const genesis_candidates = [
    {
        address:genesis_unit_address,
        amount:100
    },
    {
        address:genesis_unit_address2,
        amount:100
    }
]