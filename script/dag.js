const fs = require('fs');
const net = require('net');
const CryptoSet = require('./crypto_set.js');
const Read = require('./read.js');
const Write = require('./write.js');
const crypto = require("crypto");
const difficulty = 10000000000000000000000000000000000000000000000000;
const currency_name = 'nix';


function array_to_obj(array){
  return array.reduce((obj,val)=>{
    if(val[1] instanceof Object){
      val[1]=array_to_obj(Object.entries(val[1]));
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
  return toHash(JSON.stringify(array_to_obj(filtered)));
}

function nonce_count(hash){
  const sum =  hash.split("").reduce((result,val)=>{
    if(val==0&&result[1]==true){
      result[0] ++;
      return result;
    }
    else{
      result[1] = false;
      return result;
    }
  },[0,true]);
  return sum[0];
}

function GetEdgeDag(DagData){
  const filtered = Object.values(DagData).reduce((result,val)=>{
    result.parents.push(val.meta.parenthash);
    result.children.push(val.meta.hash);
    return result
  },{parents:[],children:[]});
  const parents = filtered.parents;
  const children = filtered.children;
  if(parents==null||children==null) return [];
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
  } while (nonce_count(hashed)<=0||Number(difficulty)<nonce_count(hashed));
  return {
    nonce:nonce,
    hash:hashed
  }
}

function require_sign(tx,me,pub_key,signature){
  const tx_hash = toHash(JSON.stringify(tx));
  const buf = Buffer.from(JSON.stringify(tx));
  const Tx = ((tx,me,pub_key,signature)=>{
    if(me!=CryptoSet.AddressFromPublic(pub_key)){
      return ""
    }
    else if (CryptoSet.verifyData(tx_hash,signature,pub_key)==false){
      return ""
    }
    else {
      return tx;
    }
  })(tx,me,pub_key,signature);
  return{
      meta:{
        type:["transaction"],
        app_rate:[
          {
            app:50,
            deposit:0
          }
        ]
      },
      data:[Tx]
  };
}

function RunCode(func,inputs){
  var result = func.apply(null,inputs);
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

function edit_outputs(outputs){
  const result = outputs.meta.type.reduce((outputs,val,i)=>{
    if(val=="transaction"&&outputs.data[i].evidence!=null){
      outputs.data[i] = array_to_obj(
        Object.keys(outputs.data[i]).filter(val=>{
          return val!="evidence";
        })
      );
    }
    return outputs;
  },outputs);
  return result;
}


function evi_added_outputs(outputs,evidence){
  return outputs.meta.type.reduce((outputs,val,i)=>{
    if(val=="transaction"){
      outputs.data[i].evidence = evidence;
    }
    return outputs;
  },outputs);
}

function inValidDag(dag,DagData,State,difficulty){
  const date = new Date();
  const address = dag.meta.address;
  const pub_key = dag.meta.pub_key;
  const app = dag.meta.app;
  const code_id = dag.meta.code_id;
  const timestamp = dag.meta.timestamp;
  const app_rate = dag.meta.app_rate;
  const inputs = dag.data.inputs;
  const outputs = dag.data.outputs;
  const inputs_hash = dag.meta.inputs.hash;
  const outputs_hash = dag.meta.outputs.hash;
  const inputs_size = dag.meta.inputs.size;
  const outputs_size = dag.meta.outputs.size;
  const nonce = dag.meta.nonce;
  const parenthash = dag.meta.parenthash;
  const hash = dag.meta.hash;
  const signature = dag.meta.signature;
  const lastblock = dag.meta.lastblock;

  const app_rate_check = Object.entries(app_rate).forEach(val=>{
    if(val[1]<0 || 100<val[1] || val[1]!=outputs.meta.app_rate[val[0]]) return true;
  });

  const code = ((app,require_sign,State)=>{
    if(app.match(/^PH/)){
      return require_sign;
    }
    else{
      return State[app]['code'][code_id]['data'] || null;
    }
  })(app,require_sign,State);

  const edited_outputs = edit_outputs(outputs);

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
  else if (nonce_count(hash)<=0||Number(difficulty)<nonce_count(hash)) {
    console.error("invalid nonce");
    return false;
  }
  else if (DagData[parenthash]==null||parenthash!=DagData[parenthash].meta.hash) {
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
  else if(app_rate_check){
    console.error("invalid app_rate");
    return false;
  }
  else if(inputs_hash!=toHash(JSON.stringify(inputs))){
    console.error("invalid inputs_hash");
    return false;
  }
  else if(inputs_size!=Buffer.from(JSON.stringify(inputs)).length){
    console.error("invalid inputs_size");
    return false;
  }
  else if(outputs_hash!=toHash(JSON.stringify(edited_outputs))){
    console.error("invalid outputs_hash");
    return false;
  }
  else if(outputs_size!=Buffer.from(JSON.stringify(edited_outputs)).length){
    console.error("invalid outputs_size");
    return false;
  }
  else if(toHash(JSON.stringify(outputs))!=toHash(JSON.stringify(RunCode(code,inputs)))){
    console.error("invalid outputs");
    return false;
  }
  else{
    return true;
  }
}

function AddDagData(dag,DagData,State,difficulty){
  if(!inValidDag(dag,DagData,State,difficulty)) return false;
  const hash = dag.meta.hash;
  if(DagData[hash]!=null){
    console.error("This dag exist");
    return false;
  }
  const new_DagData = ((dags,hash,dag)=>{
    dags[hash] = dag;
    return dags
  })(DagData,hash,dag);
  return new_DagData;
}


function CreateDag(password,address,pub_key,app,code_id,inputs,DagData,State,Blocks,difficulty,require_sign){
  const date = new Date();
  const timestamp = date.getTime();
  const code = ((app,State)=>{
    if(app.match(/^PH/)){
      return require_sign;
    }
    else{
      return State[app]['code'][code_id]['code_data'] || "";
    }
  })(app,State);
  const outputs = RunCode(code,inputs);
  const edited_outputs = edit_outputs(outputs);
  const app_rate = outputs.meta.app_rate;
  const inputs_hash = toHash(JSON.stringify(inputs));
  const outputs_hash = toHash(JSON.stringify(edited_outputs));
  const in_buf = Buffer.from(JSON.stringify(inputs));
  const inputs_size = in_buf.length;
  const out_buf = Buffer.from(JSON.stringify(edited_outputs));
  const outputs_size = out_buf.length;
  const edges = GetEdgeDag(DagData);
  const parenthash = edges[Math.floor(Math.random() * edges.length)];
  const lastblock = Blocks.length-1;
  const temporary = DagDataJson(address,pub_key,app,code_id,timestamp,app_rate,inputs,edited_outputs,inputs_hash,outputs_hash,inputs_size,outputs_size,"",parenthash,"","",lastblock);
  const mined = mining(temporary);
  const nonce = mined.nonce;
  const hash = mined.hash;
  const signature = CryptoSet.SignData(hash,password);
  const real_outputs = evi_added_outputs(outputs,hash);
  const new_dag = DagDataJson(address,pub_key,app,code_id,timestamp,app_rate,inputs,real_outputs,inputs_hash,outputs_hash,inputs_size,outputs_size,nonce,parenthash,hash,signature,lastblock);
  const new_DagData = AddDagData(new_dag,DagData,State,difficulty);
  return new_DagData;
}

/* this is for test.*/
const password = 'Sora';
const my_pub = CryptoSet.PullMyPublic(password);
const my_address = CryptoSet.AddressFromPublic(my_pub);
CryptoSet.GenerateKeys("Test");
const test_pub = CryptoSet.PullMyPublic("Test");
const test_address = CryptoSet.AddressFromPublic(test_pub);
console.dir(CreateDag(password,my_address,my_pub,my_address,"",["b",my_address,my_pub,CryptoSet.SignData(toHash("a"),password)],Read.DagData(),Read.State(),Read.Chain(),difficulty,require_sign));


module.exports = {
  CreateDag:CreateDag
};
