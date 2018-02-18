var fs = require('fs');
var CryptoSet = require('./crypto_set.js');
var BCScript = require('./blockchain.js');
var crypto = require("crypto");
var Trie = require('merkle-patricia-tree');
var levelup = require('levelup');
var leveldown = require('leveldown');
var rlp = require('rlp');
var db = levelup(leveldown('./db/dag'));
var password = 'Sora';
var currency_name = 'nix';

try{
  var DagData = JSON.parse(fs.readFileSync('./jsons/PhoenixDagData.json', 'utf8'));
}catch(err){
  var DagData = {};
  fs.writeFile('./jsons/PhoenixDagData.json', JSON.stringify(DagData),function(err){
    if (err) {
        throw err;
    }
  });
}

try{
  var DagStates = JSON.parse(fs.readFileSync('./jsons/PhoenixDagStates.json', 'utf8'));
}catch(err){
  var DagStates = {};
  fs.writeFile('./jsons/PhoenixDagStates.json', JSON.stringify(DagStates),function(err){
    if (err) {
        throw err;
    }
  });
}

try{
  var BlockChain = JSON.parse(fs.readFileSync('./jsons/PhoenixBlockChain.json', 'utf8'));
}catch(err){
  var BlockChain = [];
  fs.writeFile('./jsons/PhoenixBlockChain.json', JSON.stringify(BlockChain),function(err){
    if (err) {
        throw err;
    }
  });
}

var World = new Trie(db);
function ChangeWorld(acstate){
  var address = Buffer.from(acstate.address,'utf-8');
  var state = rlp.encode(JSON.stringify(acstate.Json()));
  World.put(address,state,function(){
    console.log(World.root.toString('hex'));
  });
}

function toHash(str){
  var sha256 = crypto.createHash('sha256');
  sha256.update(str);
  var pre_hash = sha256.digest('hex');
  var sha512 = crypto.createHash('sha512');
  sha512.update(pre_hash);
  var hash = sha512.digest('hex');
  return hash;
}

class State {
  constructor(address){
    this.address = address;
    if(this.states==null){
      this.states = {};
    }
    if(this.code==null){
      this.code = "";
    }
  }
  Json(){
    return{
      address:this.address,
      states:this.states,
      code:this.code
    }
  }
  AddState(key,value){
    this.states[key]=value;
    ChangeWorld(this);
    DagStates[this.address] = this.Json();
    fs.writeFile('./jsons/PhoenixDagStates.json', JSON.stringify(DagStates),function(err){
      if (err) {
          throw err;
      }
    });
  }

}

class Dag {
  constructor(from,from_key,to,to_key,timestamp,hash,parenthash,nonce,signature,app_address,code_id,inputs,outputs,delegate=null,export_tx=null){
    this.from = from;
    this.from_key = from_key;
    this.to = to;
    this.to_key = to_key;
    this.timestamp = timestamp;
    this.hash = hash;
    this.parenthash = parenthash;
    this.nonce = nonce
    this.signature = signature;
    this.app_address = app_address;
    this.code_id = code_id;
    this.inputs = inputs;
    this.outputs = outputs;
    this.delegate = delegate;
    this.export_tx = export_tx;
  }
  Json(){
    return{
      from:this.from,
      from_key:this.from_key,
      to:this.to,
      to_key:this.to_key,
      timestamp:this.timestamp,
      hash:this.hash,
      parenthash:this.parenthash,
      nonce:this.nonce,
      signature:this.signature,
      app_address:this.app_address,
      code_id:this.code_id,
      inputs:this.inputs,
      outputs:this.outputs,
      delegate:this.delegate,
      export_tx:this.export_tx
    }
  }
  inValidDag(){
    var date = new Date();
    if(this.from!=CryptoSet.AddressFromPublic(this.from_key)){
      console.error("invalid sender's publicKey");
      return false;
    }
    else if (this.to!=CryptoSet.AddressFromPublic(this.to_key)) {
      console.error("invalid receiver's publicKey");
      return false;
    }
    else if(this.timestamp>date.getTime()){
      console.error("invalid timestamp");
      return false;
    }
    else if (DagStates[this.address]==null){
      console.error("invalid app_address");
      return false;
    }
    else if (DagStates[this.address]['code'][this.code_id]==null){
      console.error("invalid code_id");
      return false;
    }
    else if (DagStates[this.delegate]==null||this.delegate==this.address){
      console.error("invalid delegate");
      return false;
    }
    else if (this.hash!=
      calculateHashForDag(this)){
      console.error("invalid hash");
      return false;
    }
    else if (DagData[this.parenthash]==null||this.parenthash!=DagData[this.parenthash].hash) {
      console.error("invalid parenthash");
      return false;
    }
    else if (nonce_count(this.hash)<=Number(difficulty)) {
      console.error("invalid nonce");
      return false;
    }
    else if (CryptoSet.verifyData(this.hash,this.signature,this.from_key)==false){
      console.error("invalid signature");
      return false;
    }
    for(var tx of export_tx){
      if(tx.inValidTx()==false){
        console.error("invalid export_tx");
        return false;
      }
    }
    return true;
  }
}

function nonce_count(hash) {
    return (all.match(new RegExp('^0*', "g")) || []).length;
}

function calculateHashForDag(Dag) {
    return toHash(Dag.from+Dag.from_key+Dag.to+Dag.to_key+Dag.timestamp+Dag.parenthash+Dag.nonce+Dag.app_address+Dag.code_id+Dag.inputs+Dag.outputs+Dag.delegate+JSON.stringify(Dag.export_tx))
}

function inValidTxFromDag(Tx){
  if(DagData[this.signature]==null){
    console.error("this signature hash doesn't exist");
    return false;
  }
  var confirm = [];
  for(var dag of DagData){
    if(dag.parentHash==this.hash && calculateHashForDag(dag)==dag.hash && nonce_count(dag.hash)<=Number(difficulty)){
      confirm.push(dag)
    }
  }
  if(confirm.length<2){
    console.error("this isn't confirmed by enough other dags");
    return false;
  }
  for(var block of BlockChain){
    for(var one_tx of block.transactions){
      if(one_tx.hash==Tx.hash){
        console.error("This transaction is used");
        return false;
      }
    }
  }
  return true;
}

module.exports = {
  inValidTxFromDag:inValidTxFromDag
}
