"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const con_1 = require("../wallet/con");
const genesis_pub = "03197dced5b880718079c048f42c25cf3378a4352919ba3183f428d3290ce5c494";
const stateroot = "f3a7e29e01052eeea4b84db142243d08839b0d87828d75c4615b40db4571e07f"; //"ace10da62902dbd84f2fc0d1c0b457f01b0f6d406d68d55e99377131df29226d"//"61127a7a4187262b74749ec799b38b072331b4a7ef008b492a60466f1b8bc3ec"//"467dd369487cbf99225b9e7e32cccfb2d31b4955aa3fcb2d10278d1f44cf3682"
const locationroot = "56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421";
exports.genesis_block = {
    hash: '6aa601f05dd07c62a486b6402376bd624765353945ef8ddd1421fb66ed415778',
    validatorSign: [],
    meta: {
        version: 0,
        shard_id: 0,
        kind: 'key',
        index: 0,
        parenthash: 'cd372fb85148700fa88095e3492d3f9f5beb43e555e5ff26d95f5a6adc36f8e6',
        timestamp: 1534086196853,
        pow_target: con_1.pow_target,
        pos_diff: con_1.pos_diff,
        validatorPub: ['03197dced5b880718079c048f42c25cf3378a4352919ba3183f428d3290ce5c494'],
        candidates: '43b98724d091bc767a254f2bc7e5dd072943952a37326064cbad987bfe0fe9f7',
        stateroot: stateroot,
        locationroot: locationroot,
        tx_root: 'cd372fb85148700fa88095e3492d3f9f5beb43e555e5ff26d95f5a6adc36f8e6',
        fee_sum: 0
    },
    txs: [],
    natives: [],
    units: [],
    raws: []
};
