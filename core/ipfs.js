"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const IPFS = require('ipfs');
const multihash = require("multi-hash");
exports.node = new IPFS();
/*node.on('ready', () => {
  const files = [
  {
    path: '/tmp/myfile',
    content: Buffer.from('Helo')
  }
  ]
  node.files.add(files, function (err, files) {
    console.log(files[1]);
    //console.log(multihash.encode(Buffer.from('Helo')))
  })
})*/
exports.node_ready = (node, cb) => {
    node.on('ready', cb);
};
exports.ipfs_hash = (str) => {
    const buffered = Buffer.from(str);
    if (buffered.length != 32)
        return "";
    else {
        return multihash.encode(buffered);
    }
};
