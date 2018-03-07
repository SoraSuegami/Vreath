const fs = require('fs');
const net = require('net');
const CryptoSet = require('./crypto_set.js');
const BCScript = require('./blockchain.js');
const crypto = require("crypto");

const difficulty = 10000000000000000000000000000000000000000000000000;
const password = 'Sora';
const currency_name = 'nix';

var client = new net.Socket();
client.setEncoding('utf8');


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
  var edit_dag = Dag;
  delete edit_dag.meta.hash;
  delete edit_dag.meta.signature;
  return toHash(JSON.stringify(edit_dag));
}

function nonce_count(hash) {
  return (all.match(new RegExp('^0*', "g")) || []).length;
}

function GetEdgeDag(DagData) {
  var parents = [];
  var children = [];
  var edge = [];
  for(var dag of DagData){
    parents.push(pull_parenthash(dag));
    children.push(pull_hash(dag));
  }
  for(var child of children){
    var idx = parents.indexOf(child);
    if(idx==-1){
      edge.push(child);
    }
  }
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
    return [tx]
  }
}

function RunCode(func,inputs) {
  var result = func.apply(this,inputs);
  return result;
}

function ReadDagData(){
  try{
    const DagData = JSON.parse(fs.readFileSync('./jsons/PhoenixDagData.json', 'utf8'));
  }catch(err){
    const DagData = {};
    fs.writeFile('./jsons/PhoenixDagData.json', JSON.stringify(DagData),function(err){
      if (err) {
          throw err;
      }
    });
  }
  return DagData;
}

function DagDataJson(address,pub_key,app,code_id,timestamp,app_rate,inputs,outputs,inputs_hash,outputs_hash,inputs_size,outputs_size,nonce,parenthash,hash,signature){
  return{
    meta:{
      address:address,
      pub_key:pub_key,
      app:app,
      code_id:code_id,
      timestamp:timestamp,
      app_rate:app_rate,
      inputs{
        hash:inputs_hash,
        size:inputs_size
      },
      outputs{
        hash:outputs_hash,
        size:outputs_size
      },
      nonce:nonce,
      parenthash:parenthash,
      hash:hash,
      signature:signature
    },
    data:{
      inputs:inputs,
      outputs:outputs
    }
  }
}

function ReadState(){
  try{
    const State = JSON.parse(fs.readFileSync('./jsons/PhoenixAccountState.json', 'utf8'));
  }catch(err){
    const State = {};
    fs.writeFile('./jsons/PhoenixAccountState.json', JSON.stringify(State),function(err){
      if (err) {
          throw err;
      }
    });
  }
  return State;
}

function inValidDag(dag,DagData,State,difficulty){
  const date = new Date();
  const address = pull_address(dag);
  const pub_key = pull_pub_key(dag);
  const app = pull_app(dag);
  const code_id = pull_code_id(dag);
  const timestamp = pull_timestamp(dag);
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


  if(app.match(/^PH/)){
    const code = require_sign.toString();
    const app_rate = 100;
  }
  else{
    const code = State[app]['code'][code_id]['data'] || null;
    const app_rate = pull_app_rate(dag);
    if(app_rate!=State[app]['code'][code_id]['rate']){
      console.error("invaild app_rate");
      return false;
    }
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
  else if(1){
    for(var i in inputs){
      if(inputs_hash[i]!=toHash(JSON.stringify(inputs[i]))){
        console.error("invalid inputs_hash");
        return false;
      }
      var in_buf = Buffer.from(JSON.stringify(inputs[i]));
      else if(inputs_size[i]!=in_buf.length){
        console.error("invalid inputs_size");
        return false;
      }
    }
    for(var i in outputs){
      if(outputs_hash[i]!=toHash(JSON.stringify(outputs[i]))){
        console.error("invalid outputs_hash");
        return false;
      }
      var out_buf = Buffer.from(JSON.stringify(outputs[i]));
      else if(outputs_size[i]!=out_buf.length){
        console.error("invalid outputs_size");
        return false;
      }
    }
  }
  else if(outputs!=RunCode(code,inputs)){
    console.error("invaild outputs");
    return false;
  }
  else{
    return true;
  }
}

function AddDagData(dag,DagData,State,difficulty){
  if(inValidDag(dag,DagData,State,difficulty)) return false;
  const hash = pull_hash(dag);
  DagData[hash] = dag;
  fs.writeFile('./jsons/PhoenixDagData.json', JSON.stringify(DagData),function(err){
    if (err) {
        throw err;
    }
  });
  ChangeState(dag,DagStates);
  return DagData;
}


function CreateDag(password,address,pub_key,app,code_id,inputs,DagData,State){
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
  const temporary = DagDataJson(address,pub_key,app,code_id,timestamp,app_rate,inputs,outputs,inputs_hash,outputs_hash,inputs_size,outputs_size,"",parenthash,"","");
  const mined = mining(temporary);
  const nonce = mined.nonce;
  const hash = mined.hash;
  const signature = CryptoSet.SignData(hash,password);
  const new_dag = DagDataJson(address,pub_key,app,code_id,timestamp,app_rate,inputs,outputs,inputs_hash,outputs_hash,inputs_size,outputs_size,nonce,parenthash,hash,signature);
  AddDagData();
  return new_dag;
}

// this is for test.
var my_pub = CryptoSet.PullMyPublic(password);
var my_address = CryptoSet.AddressFromPublic(my_pub);
CryptoSet.GenerateKeys("Test");
var test_pub = CryptoSet.PullMyPublic("Test");
var test_address = CryptoSet.AddressFromPublic(test_pub);
// this is for test.




  /*
  if (from.indexOf(/^PH/)==-1&&from.indexOf(/^PA/)==-1){
    console.error("invalid sender's address");
    return false;
  }
  else if(from.match(/^PA/)){
    const trigger = DagData[parenthash];
    var confirm = Confirmes(dag,DagData);
    var callers = [];
    for(var con of confirm){
      for(var ed of DagData[con].outputs.export_dag){
        if(ed.hash==hash){
          callers.push(ed.hash);
        }
      }
    }
    if(callers.length<=0){
      console.error("invalid dag trigger hash");
      return false;
    }
  }
  else if(from.match(/^PH/)){
    if(from!=CryptoSet.AddressFromPublic(from_key)){
      console.error("invalid sender's publicKey");
      return false;
    }
    else if (CryptoSet.verifyData(hash,signature,from_key)==false) {
      console.error("invalid signature");
      return false;
    }
  }
  else if(to.indexOf(/^PH/)==-1&&to.indexOf(/^PA/)==-1){
    console.error("invalid receiver's address");
    return false;
  }
  else if(to.match(/^PH/)&&to!=CryptoSet.AddressFromPublic(to_key)){
    console.error("invalid receiver's publicKey");
    return false;
  }
  else if(timestamp>date.getTime()){
    console.error("invalid timestamp");
    return false;
  }
  else if (hash!=calculateHashForDag(dag)){
    console.error("invalid hash");
    return false;
  }
  else if (DagData[parenthash]==null||parenthash!=DagData[parenthash].hash) {
    console.error("invalid parenthash");
    return false;
  }
  else if (0<nonce_count(hash)<=Number(difficulty)) {
    console.error("invalid nonce");
    return false;
  }
  else if (DagStates[app_address]==null){
    console.error("invalid app_address");
    return false;
  }
  else if (DagStates[app_address]['code'][code_id][saver]==null||DagStates[app_address]['code'][code_id][hash]==null){
    console.error("invalid code_id");
    return false;
  }
  else if (RunCode(DagStates[app_address]['code'][code_id],inputs)!=outputs){
    console.error("invalid outputs");
    return false;
  }
  else if (DagStates[delegate]==null||delegate==from){
    console.error("invalid delegate");
    return false;
  }
  else if (outputs.export_tx!=null) {
    for(var tx of outputs.export_tx){
      /*if(tx.inValidTx()==false){
        console.error("invalid export_tx");
        return false;
      }*/
    /*}
  }
  else if (outputs.export_dag!=null) {
    for(var dag of outputs.export_dag){
      /*if(tx.inValidTx()==false){
        console.error("invalid export_tx");
        return false;
      }*/
    /*}
  }
  else if(dag.save_storage!=null){
    if(dag.save_storage.from!=null){
      for(var key in dag.save_storage.from){
        var storage = dag.save_storage.from[key];
        if(storage.saver==null||storage.hash==null||storage.number==null||storage.fee==null||storage.size==null){
          console.error("invalid save_storage");
          return false;
          }
      }
    }
    else if (dag.save_storage.to!=null){
      for(var key in dag.save_storage.to){
        var storage = dag.save_storage.to[key];
        if(storage.saver==null||storage.hash==null||storage.number==null||storage.fee==null||storage.size==null){
          console.error("invalid save_storage");
          return false;
          }
      }
    }
  }
  else if (save_code.saver==null||save_code.hash==null||save_code.number==null||save_code.fee==null||save_code.size==null){
    console.error("invalid save_code");
    return false;
  }
  else if (to.match(/^PA/)&&DagStates[to]['code']!=null){
    console.error("You have already saved code in this address");
    return false;
  }
  return true;
}

function AddDagData(dag,DagData,difficulty){
  if(inValidDag(dag,DagData,difficulty)==false) return false;
  const hash = dag.hash;
  DagData[hash] = dag;
  fs.writeFile('./jsons/PhoenixDagData.json', JSON.stringify(DagData),function(err){
    if (err) {
        throw err;
    }
  });
  ChangeState(dag,DagStates);
  return DagData;
}
/*
function ReadDagState(){
  try{
    const DagStates = JSON.parse(fs.readFileSync('./jsons/PhoenixDagStates.json', 'utf8'));
  }catch(err){
    const deploy_app_name = CryptoSet.AppAddress("PhoenixAppDeploymentAddress");
    const deploy_app_key = 'PhoenixAppDeploy';
    const deploy_app_state = StateJson(deploy_app_name,{},{[deploy_app_key]:PhoenixDeployApp.toString()});
    const DagStates = {
      [deploy_app_name]:deploy_app_state
    };
    fs.writeFile('./jsons/PhoenixDagStates.json', JSON.stringify(DagStates),function(err){
      if (err) {
          throw err;
      }
    });
  }
  return DagStates;
}


function StateJson(address,storage={},code={}){
  return{
    address:address,
    storage:storage,
    code:code
  }
}

function inValidDagState(state){
  if(state.address==null||state.address.indexOf(/^PH/)==-1||state.address.indexOf(/^PS/)==-1){
    console.error('invaild address');
    return false;
  }
  else if (state.storage!=null) {
    for(var key of state.storage){
      if(state.storage[key].saver==null||state.storage[key].hash==null||state.storage.number==null||state.storage.fee==null||state.storage.size==null){
        console.error("invaild storage key:"+key);
        return false;
      }
    }
  }
  else if (state.address.match(/^PA/)&&state.code==null){
    console.error('invaild code');
    return false;
  }
  return true;
}

function ChangeState(dag,DagStates){
  var from_state = SetMyState(dag.from);
  var to_state = SetMyState(dag.to);
  for(var key in dag.save_storage.from){
    var storage = dag.save_storage.from[key];
    from_state[key] = {
      saver:storage.saver || null,
      hash:storage.hash || null,
      number:storage.number || null,
      fee:storage.fee || null,
      size:storage.size || null
    }
  }


  for(var key in dag.save_storage.to){
    var storage = dag.save_storage.to[key];
    to_state[key] = {
      saver:storage.saver || null,
      hash:storage.hash || null,
      number:storage.number || null,
      fee:storage.fee || null,
      size:storage.size || null
    }
  }

  if(to_state.code==null){
    to_state.code = dag.save_code;
  }
  /*for(var key in save_code){
    if(save_code[key].saver!=null&&save_code[key].hash!=null){
      to_state.code[key] ={
        saver:to_state.code[key].saver || null,
        hash:to_state.code[key].hash || null,
        number:to_state.code[key].number || null,
        fee:to_state.code[key].fee || null
      }
    }
  }*/
  /*
  DagStates[dag.from] = from_state;
  DagStates[dag.to] = to_state;
  fs.writeFile('./jsons/PhoenixDagStates.json', JSON.stringify(DagStates),function(err){
    if (err) {
        throw err;
    }
  });
  return DagStates;
}


function SetMyState(address,DagStates){
  if(DagStates[address] == null){
    const my_state = StateJson(address,{},{});
  }
  else{
    const my_state = DagStates[address];
  }
  return my_state;
}
*/
/*
function PhoenixDeployApp(address,key,func){
  var state = new State(address);
  console.log(func.toString());
  state.code[key] = func.toString();
  DagData[address] = state.Json();
}*/


/*
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
*/

/*var World = new Trie(db);
function ChangeWorld(acstate){
  var address = Buffer.from(acstate.address,'utf-8');
  var state = rlp.encode(JSON.stringify(acstate.Json()));
  World.put(address,state,function(){
    console.log(World.root.toString('hex'));
  });
}*/

/*
class State {
  constructor(address){
    this.address = address;
    if(this.states==null){
      this.states = {};
    }
    if(this.code==null){
      this.code = {};
    }
  }
  Json(){
    return{
      address:this.address,
      states:this.states,
      code:this.code
    }
  }
}

try{
  var DagStates = JSON.parse(fs.readFileSync('./jsons/PhoenixDagStates.json', 'utf8'));
}catch(err){
  var deploy_app_name = CryptoSet.AppAddress("PhoenixAppDeploymentAddress");
  var deploy_app_state = new State(deploy_app_name);
  var deploy_app_key = 'PhoenixAppDeploy';
  function PhoenixDeployApp(address,key,func){
    var state = new State(address);
    console.log(func.toString());
    state.code[key] = func.toString();
    DagData[address] = state.Json();
  }
  console.log(PhoenixDeployApp);
  deploy_app_state.code[deploy_app_key] = PhoenixDeployApp;
  console.log(deploy_app_state.code[deploy_app_key]);
  var DagStates = {};
  DagStates[deploy_app_name] = deploy_app_state.Json();
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

function SetMyState(address){
  var my_state;
  if(DagStates[address] == null){
    my_state = new State(address);
    DagStates[address] = my_state.Json();
  }
  else{
    my_state = new State(address);
    my_state.states = DagStates[address].states;
    //console.log(my_state.nonce);
    my_state.code = DagStates[address].code;
  }
  return my_state;
}

class Dag {
  constructor(from,from_key,to,to_key,timestamp,hash,parenthash,nonce,signature,app_address,code_id,inputs,outputs,delegate=null){
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
    this.export_tx = outputs.tx || null;
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
    if((this.from.match(/^PH/)&&(this.from!=CryptoSet.AddressFromPublic(this.from_key))) || this.match(/^PS/)){
      console.error("invalid sender's publicKey");
      return false;
    }
    else if ((this.to.match(/^PH/)&&(this.to!=CryptoSet.AddressFromPublic(this.to_key))) || this.match(/^PS/)) {
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
    else if (RunCode(DagStates[this.address]['code'][this.code_id],this.inputs)!=outputs.data){
      console.error("invalid outputs");
      return false;
    }
    else if (DagStates[this.delegate]==null||this.delegate==this.address){
      console.error("invalid delegate");
      return false;
    }
    else if (this.hash!=calculateHashForDag(this)){
      console.error("invalid hash");
      return false;
    }
    else if (DagData[this.parenthash]==null||this.parenthash!=DagData[this.parenthash].hash) {
      console.error("invalid parenthash");
      return false;
    }
    else if (0<nonce_count(this.hash)<=Number(difficulty)) {
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
  AddDag(){
    if(this.inValidDag()==false) return false;
    var from_state = SetMyState(this.from);
    var to_state = SetMyState(this.to);
    for(var key in this.output.from.state){
      from_state.states[key] = this.output.from.state[key];
    }
    for(var key in this.output.to.state){
      to_state.states[key] = this.output.to.state[key];
    }
    for(var key in this.output.from.code){
      from_state.code[key] = this.output.from.code[key];
    }
    for(var key in this.output.to.code){
      to_state.code[key] = this.output.to.code[key];
    }
    DagStates[this.from] = from_state.Json();
    DagStates[this.to] = to_state.Json();
    fs.writeFile('./jsons/PhoenixDagStates.json', JSON.stringify(DagStates),function(err){
      if (err) {
          throw err;
      }
    });
  }
}
*/

/*
function inValidTxFromDag(Tx,DagData){
  if(DagData.signature==null){
    console.error("this signature hash doesn't exist");
    return false;
  }
  var first_confirm = [];
  for(var dag of DagData){
    if(dag.parentHash==this.hash && calculateHashForDag(dag)==dag.hash && 0<nonce_count(dag.hash)<=Number(difficulty)){
      first_confirm.push(dag.hash)
    }
  }
  if(confirm.length<=0){
    console.error("this isn't confirmed by enough other dags");
    return false;
  }
  var second_confirm=null;
  for(var con of first_confirm){
    for(var dag of DagData){
      if(dag.parentHash==con && calculateHashForDag(dag)==dag.hash && 0<nonce_count(dag.hash)<=Number(difficulty)){
        second_confirm.push(dag.hash);
        break;
      }
    }
    if(second_confirm!=null)break;
  }
  if(second_confirm==null){
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
*/
/*function ImportDag(json){
  var dag = new Dag(json.from,jsom.from_key,json.to,json.to_key,json.timestamp,json.hash,json.parenthash,json.nonce,json.signature,json.app_address,json.code_id,json.inputs,json.outputs,json.delegate=null);
  return dag;
}*/




/*
function CreateDag(password,from,from_key,to,to_key,app_address,code_id,inputs,delegate=null){
  if(((from.match(/^PH/)&&(from!=CryptoSet.AddressFromPublic(from_key))) || from.indexOf(/^PS/)==-1)||((to.match(/^PH/)&&(to!=CryptoSet.AddressFromPublic(to_key))) || to.indexOf(/^PS/)==-1)) return false;
  var date = new Date();
  var timestamp = date.getTime();
  if(DagStates[address]['code'][code_id]==null) return false;
  var outputs = RunCode(DagStates[address]['code'][code_id],inputs);
  var export_tx = outputs.tx || null;
  var export_dag = outputs.dag || null;
  var edges = GetEdgeDag();
  do {
    var edge = ImportDag(edges[Math.floor(Math.random() * edges.length)]);
    if(edge.inValidDag()==false){
      delete DagData[edge.hash];
      edge = null;
    }
  } while (edge.inValidDag());
  var parenthash = edge.parenthash;

  for(var e of edges){
    var dag_obj = ImportDag(e);
    if(e.inValidDag()) return true;
  }
  var mined = mining(from,from_key,to,to_key,timestamp,parenthash,app_address,code_id,inputs,outputs,delegate);
  var nonce = mined.nonce;
  var hash = mined.hash;
  var signature = CryptoSet.SignData(hash,password);
  var NewDag = new Dag(from,from_key,to,to_key,timestamp,hash,parenthash,nonce,signature,app_address,code_id,inputs,outputs,delegate);
  return NewDag;
}

function DeployApp(password,developer,developer_key,app_address,code_id,func,delegate=null){
  var develop_to = CryptoSet.AppAddress("PhoenixAppDeploymentAddress");
  var deploy_app_key = 'PhoenixAppDeploy';
  return CreateDag(password,developer,developer_key,app_address,"",develop_to,deploy_app_key,[app_address,code_id,func],delegate);
}
function HelloWorld(name){
  console.log("HelloWorld," + name);
}
console.log(HelloWorld.toString());
DeployApp("Sora",my_address,my_pub,"HelloWorld","hello_world",HelloWorld);

//CreateDag("Sora",my_address,my_pub,test_address,test_pub,);
*/











module.exports = {

};
