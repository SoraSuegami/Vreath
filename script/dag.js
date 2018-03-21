const fs = require('fs');
const net = require('net');
const CryptoSet = require('./crypto_set.js');
const BCScript = require('./blockchain.js');
const Read = require('./read.js');
const crypto = require("crypto");
const difficulty = 10000000000000000000000000000000000000000000000000;
const password = 'Sora';
const currency_name = 'nix';

function pull_address(Dag){
 return Dag.meta.address || "";
}
function pull_pub_key(Dag){
  return Dag.meta.pub_key || "";
}
function pull_app(Dag){
  return Dag.meta.app || "";
}
function pull_code_id(Dag){
  return Dag.meta.code_id || "";
}
function pull_timestamp(Dag){
  return Dag.meta.timestamp || "";
}
function pull_app_rate(Dag){
  return Dag.meta.app_rate || 50;
}
function pull_inputs(Dag){
  return Dag.data.inputs || [];
}
function pull_outputs(Dag){
  return Dag.deta.outputs || [];
}
function pull_inputs_hash(Dag){
  return Dag.meta.inputs.inputs_hash || [];
}
function pull_outputs_hash(Dag){
  return Dag.meta.outputs.outputs_hash || [];
}
function pull_inputs_size(Dag){
  return Dag.meta.inputs.inputs_size || [];
}
function pull_outputs_size(Dag){
  return Dag.meta.outputs.outputs_size || [];
}
function pull_nonce(Dag){
  return Dag.meta.nonce || 0;
}
function pull_parenthash(Dag){
  return Dag.meta.parenthash || "";
}
function pull_hash(Dag){
  return Dag.meta.hash || "";
}
function pull_signature(Dag){
  return Dag.meta.signature || "";
}
function pull_lastblock(Dag){
  return Dag.meta.lastblock || 0;
}

function array_to_obj(array){
  return array.reduce((obj,val)=>{
    if(val[1][1]!=null){
      array_to_obj(val[1]);
    }
    obj[val[0]] = val[1];
    return obj
  },{});
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

function calculateHashForDag(Dag) {
  const filtered = Object.entries(Dag.meta).filter(val=>{
    return val[0]!="hash" && val[0]!="signature";
  });
  const edited = ((Dag,filtered)=>{
    Dag.meta = array_to_obj(filtered);
    return Dag;
  })(Dag,filtered);
  return toHash(JSON.stringify(edited));
}

function nonce_count(hash) {
  return (all.match(new RegExp('^0*', "g")) || []).length;
}

function GetEdgeDag(DagData){
  var parents = [];
  var children = [];
  var edge = [];
  const filtered = Object.values(DagData).reduce((result,val)=>{
    result.parents.push(pull_parenthash(val));
    result.children.push(pull_hash(val));
  },{});
  const parents = filtered.parents;
  const children = filtered.children;
  const edge = children.reduce((result,val)=>{
    const idx = parents.indexOf(val);
    if(parents.indexOf(val)==-1) result.push(val);
    return result;
  },[]);
  return edge;
}

function mining(dag,difficulty){
  var Dag = dag;
  var nonce = -1;
  do {
    nonce ++;
    Dag.meta.nonce = nonce;
    var hashed = calculateHashForDag(Dag);
  } while (0<nonce_count(hashed)<=Number(difficulty));
  return {
    nonce:nonce,
    hash:hashed
  }
}

function require_sign(tx,me,pub_key,signature){
  const tx_hash = toHash(JSON.stringify(tx));
  const buf = Buffer.from(JSON.stringify(tx));
  if(me!=CryptoSet.AddressFromPublic(pub_key)){
    console.error("inValid pub_key");
    return false;
  }
  else if (CryptoSet.verifyData(tx_hash,signature,pub_key)==false){
    console.error("inValid signature");
    return false;
  }
  else{
    return{
      meta:{
        app_rate:{
          app:50,
          deposit:0
        }
      },
      data:[Tx]
    }
  }
}

function RunCode(func,inputs) {
  var result = func.apply(this,inputs);
  return result;
}


function DagDataJson(address,pub_key,app,code_id,timestamp,app_rate,inputs,outputs,inputs_hash,outputs_hash,inputs_size,outputs_size,nonce,parenthash,hash,signature,lastblock){
  return{
    meta:{
      address:address,
      pub_key:pub_key,
      app:app,
      code_id:code_id,
      timestamp:timestamp,
      app_rate:app_rate,
      inputs:{
        hash:inputs_hash,
        size:inputs_size
      },
      outputs:{
        hash:outputs_hash,
        size:outputs_size
      },
      nonce:nonce,
      parenthash:parenthash,
      hash:hash,
      signature:signature,
      lastblock:lastblock
    },
    data:{
      inputs:inputs,
      outputs:outputs
    }
  }
}


function inValidDag(dag,DagData,State,difficulty){
  const date = new Date();
  const address = pull_address(dag);
  const pub_key = pull_pub_key(dag);
  const app = pull_app(dag);
  const code_id = pull_code_id(dag);
  const timestamp = pull_timestamp(dag);
  const app_rate = pull_app_rate(dag);
  const inputs = pull_inputs(dag);
  const outputs = pull_outputs(dag);
  const inputs_hash = pull_inputs_hash(dag);
  const outputs_hash = pull_outputs_hash(dag);
  const inputs_size = pull_inputs_size(dag);
  const outputs_size = pull_outputs_size(dag);
  const nonce = pull_nonce(dag);
  const parenthash = pull_parenthash(dag);
  const hash = pull_hash(dag);
  const signature = pull_signature(dag);
  const lastblock = pull_lastblock(dag);

  const app_rate_check = Object.entries(app_rate).forEach(val=>{
    if(val[1]<0 || 100<val[1] || val[1]!=outputs.meta.app_rate[val[0]]) return false;
  });

  const inputs_check = inputs.forEach((val,i)=>{
    const in_buf = Buffer.from(JSON.stringify(val));
    if(inputs_hash[i]!=toHash(JSON.stringify(val))){
      console.error("invalid inputs_hash");
      return false;
    }
    else if(inputs_size[i]!=in_buf.length){
      console.error("invalid inputs_size");
      return false;
    }
  });

  const outputs_check = outputs.forEach((val,i)=>{
    const out_buf = Buffer.from(JSON.stringify(val));
    if(outputs_hash[i]!=toHash(JSON.stringify(val))){
      console.error("invalid outputs_hash");
      return false;
    }
    else if(outputs_size[i]!=out_buf.length){
      console.error("invalid outputs_size");
      return false;
    }
  });


  if(app.match(/^PH/)){
    const code = require_sign.toString();
  }
  else{
    const code = State[app]['code'][code_id]['data'] || null;
  }


  if(address!=CryptoSet.AddressFromPublic(pub_key)){
    console.error("invalid pub_key");
    return false;
  }
  else if(code==null){
    console.error("invalid code");
    return false;
  }
  else if(timestamp>date.getTime()){
    console.error("invalid timestamp");
    return false;
  }
  else if (0<nonce_count(this.hash)<=Number(difficulty)) {
    console.error("invalid nonce");
    return false;
  }
  else if (DagData[parenthash]==null||parenthash!=pull_hash(DagData[parenthash])) {
    console.error("invalid parenthash");
    return false;
  }
  else if (hash!=calculateHashForDag(dag)){
    console.error("invalid hash");
    return false;
  }
  else if (CryptoSet.verifyData(hash,signature,pub_key)==false){
    console.error("invalid signature");
    return false;
  }
  else if(app_rate_check==false || inputs_check==false || outputs_check==false){
    return false;
  }
  else if(outputs!=RunCode(code,inputs)){
    console.error("invalid outputs");
    return false;
  }
  else{
    return true;
  }
}

function AddDagData(dag,DagData,State,difficulty){
  if(!inValidDag(dag,DagData,State,difficulty)) return false;
  const hash = pull_hash(dag);
  if(DagData[hash]!=null){
    console.error("This dag exist");
  }
  const new_DagData = ((dags,hash,dag)=>{
    dags[hash] = dag;
  })(DagData,hash,dag);
  return new_DagData;
}


function CreateDag(password,address,pub_key,app,code_id,inputs,DagData,State,Blocks,difficulty){
  const date = new Date();
  const timestamp = date.getTime();
  if(app.match(/^PH/)){
    const code = "";
    const app_rate = "";
  }
  else{
    const code = State[app]['code'][code_id]['data'] || "";
    const app_rate = State[app]['code'][code_id]['rate'] || "";
  }
  const outputs = RunCode(code,inputs);
  const inputs_hash = toHash(JSON.stringify(inputs));
  const outputs_hash = toHash(JSON.stringify(outputs));
  const in_buf = Buffer.from(JSON.stringify(inputs));
  const inputs_size = in_buf.length;
  const out_buf = Buffer.from(JSON.stringify(outputs));
  const outputs_size = out_buf.length;
  const edges = GetEdgeDag(DagData);
  const parenthash = edges[Math.floor(Math.random() * edges.length)];
  const lastblock = Blocks.length-1;
  const temporary = DagDataJson(address,pub_key,app,code_id,timestamp,app_rate,inputs,outputs,inputs_hash,outputs_hash,inputs_size,outputs_size,"",parenthash,"","",lastblock);
  const mined = mining(temporary);
  const nonce = mined.nonce;
  const hash = mined.hash;
  const signature = CryptoSet.SignData(hash,password);
  const new_dag = DagDataJson(address,pub_key,app,code_id,timestamp,app_rate,inputs,outputs,inputs_hash,outputs_hash,inputs_size,outputs_size,nonce,parenthash,hash,signature,lastblock);
  const new_DagData = AddDagData(new_dag,DagData,State,difficulty);
  return new_DagData;
}

// this is for test.
var my_pub = CryptoSet.PullMyPublic(password);
var my_address = CryptoSet.AddressFromPublic(my_pub);
CryptoSet.GenerateKeys("Test");
var test_pub = CryptoSet.PullMyPublic("Test");
var test_address = CryptoSet.AddressFromPublic(test_pub);
// this is for test.



module.exports = {
  CreateDag:CreateDag
};
