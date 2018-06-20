"use strict";
exports.__esModule = true;
var IPFS = require('ipfs');
var multihash = require("multi-hash");
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
exports.node_ready = function (node, cb) {
    node.on('ready', cb);
};
exports.ipfs_hash = function (str) {
    var buffered = Buffer.from(str);
    if (buffered.length != 32)
        return "";
    else {
        return multihash.encode(buffered);
    }
};
