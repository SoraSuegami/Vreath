import * as _ from '../core/basic'
import {pow_target,pos_diff} from '../wallet/con'
import * as T from '../core/types'

const genesis_pub = "03197dced5b880718079c048f42c25cf3378a4352919ba3183f428d3290ce5c494"
const stateroot = "5e67c96a8d4a580a15417dd11406bd68bf824ceba43ecfaf656c93dd59126f7b"//"61127a7a4187262b74749ec799b38b072331b4a7ef008b492a60466f1b8bc3ec"//"467dd369487cbf99225b9e7e32cccfb2d31b4955aa3fcb2d10278d1f44cf3682"
const locationroot = "56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"

export const genesis_block:T.Block = {
    hash: '24f3e98080019e749f4e2114eceeefbb60e4ce160c24f81afd43648ca093b9fb',
    validatorSign: [],
    meta:{
        version: 0,
        shard_id: 0,
        kind: 'key',
        index: 0,
        parenthash: 'cd372fb85148700fa88095e3492d3f9f5beb43e555e5ff26d95f5a6adc36f8e6',
        timestamp: 1534086196853,
        pow_target: pow_target,
        pos_diff: pos_diff,
        validatorPub: [ '03197dced5b880718079c048f42c25cf3378a4352919ba3183f428d3290ce5c494' ],
        candidates: '43b98724d091bc767a254f2bc7e5dd072943952a37326064cbad987bfe0fe9f7',
        stateroot: stateroot,
        locationroot: locationroot,
        tx_root: 'cd372fb85148700fa88095e3492d3f9f5beb43e555e5ff26d95f5a6adc36f8e6',
        fee_sum: 0 },
    txs: [],
    natives: [],
    units: [],
    raws: []
}