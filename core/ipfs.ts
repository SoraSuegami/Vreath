const IPFS = require('ipfs');
const multihash = require("multi-hash");

export const node = new IPFS()
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

export const node_ready = (node,cb)=>{
  node.on('ready',cb);
}

export const ipfs_hash = (str:string):string=>{
  const buffered = Buffer.from(str);
  if(buffered.length!=32) return "";
  else{
    return multihash.encode(buffered);
  }
}
