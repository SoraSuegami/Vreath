"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("./basic"));
const R = __importStar(require("ramda"));
const { map, reduce, filter, forEach, some } = require('p-iteration');
//const RadixTree = require('dfinity-radix-tree');
////const leveldown = require('leveldown');
//const db = levelup(leveldown('./db/state'));
const { NodeVM, VMScript } = require('vm2');
const rlp = require('rlp');
const CryptoSet = require('./crypto_set.js');
//const node = new IPFS();
const log_limit = 10000000;
const nonce_count = (hash) => {
    let check = true;
    const sum = hash.split("").reduce((result, val) => {
        if (val == String(0) && check == true) {
            result++;
            return result;
        }
        else {
            check = false;
            return result;
        }
    }, 0);
    return sum;
};
const mining = (unit, difficulty) => {
    let nonce = -1;
    let hashed = "";
    do {
        nonce++;
        unit.meta.nonce = nonce.toString();
        hashed = HashForUnit(unit);
        console.log(nonce);
        console.log(hashed);
    } while (nonce_count(hashed) < difficulty);
    return {
        nonce: nonce.toString(),
        hash: hashed
    };
};
const HashForUnit = (unit) => {
    return _.toHash(unit.meta.nonce + JSON.stringify(unit.contents));
};
async function ValidUnit(unit, log_limit, chain, DagData) {
    const nonce = unit.meta.nonce;
    const hash = unit.meta.hash;
    const signature = unit.meta.signature;
    const tx_data = unit.contents.data;
    const address = tx_data.address;
    const pub_key = tx_data.pub_key;
    const timestamp = tx_data.timestamp;
    const parenthash = unit.contents.parenthash;
    const difficulty = unit.contents.difficulty;
    const log_hash = unit.contents.log_hash;
    const log_raw = unit.log_raw;
    const date = new Date();
    const count = nonce_count(hash);
    const request_tx = chain[tx_data.index].transactions.reduce((result, tx) => {
        if (tx.kind == "request" && tx.meta.hash == tx_data.request)
            return result.concat(tx);
        else
            return result;
    }, [])[0];
    const token = request_tx.contents.data.token || "";
    const parent = await DagData.get(parenthash);
    const log_size = log_raw.reduce((sum, log) => {
        return sum + Buffer.from(JSON.stringify(log)).length;
    }, 0);
    if (count <= 0 || count > difficulty) {
        console.log("invalid nonce");
        return false;
    }
    else if (hash != HashForUnit(unit)) {
        console.log("invalid hash");
        return false;
    }
    else if (address != token && CryptoSet.verifyData(hash, signature, pub_key) == false) {
        console.log("invalid signature");
        return false;
    }
    else if (address != token && !address.match(/^PH/)) {
        console.log("invalid address");
        return false;
    }
    else if (address != token && address != CryptoSet.AddressFromPublic(pub_key)) {
        console.log("invalid pub_key");
        return false;
    }
    else if (timestamp > date.getTime()) {
        console.log("invalid timestamp");
        return false;
    }
    else if (parenthash != parent.meta.hash) {
        console.log("invalid parenthash");
        return false;
    }
    else if (log_hash != _.toHash(JSON.stringify(log_raw))) {
        console.log("invalid log_hash");
        return false;
    }
    else if (log_size > log_limit) {
        console.log("This Log is too big");
        return false;
    }
    else {
        return true;
    }
}
async function Unit_to_Dag(unit, DagData) {
    await DagData.put(unit.meta.hash, unit);
    return DagData;
}
async function Unit_to_Memory(unit, MemoryData) {
    let target = await MemoryData.get(unit.contents.data.request);
    if (Object.keys(target).length == 0)
        target = [];
    await MemoryData.put(unit.contents.data.request, target.concat(unit.meta.hash));
    return MemoryData;
}
async function AcceptUnit(unit, log_limit, chain, DagData, MemoryData) {
    if (!await ValidUnit(unit, log_limit, chain, DagData))
        return [DagData, MemoryData];
    const new_dag = await Unit_to_Dag(unit, DagData);
    const new_memory = await Unit_to_Memory(unit, MemoryData);
    return [new_dag, new_memory];
}
exports.AcceptUnit = AcceptUnit;
async function GetEdgeDag(DagData) {
    const filtered = R.values(await DagData.filter()).reduce((result, val) => {
        result.parents.push(val.contents.parenthash);
        result.children.push(val.meta.hash);
        return result;
    }, { parents: [], children: [] });
    const parents = filtered.parents;
    const children = filtered.children;
    if (parents == [] || children == [])
        return [];
    const edge = children.reduce((result, val) => {
        const idx = parents.indexOf(val);
        if (parents.indexOf(val) == -1)
            return result.concat(val);
        else
            return result;
    }, []);
    return edge;
}
async function CreateUnit(password, pub_key, request, index, payee, difficulty, log, DagData) {
    const address = CryptoSet.AddressFromPublic(pub_key);
    const date = new Date();
    const timestamp = date.getTime();
    const log_hash = _.toHash(JSON.stringify(log));
    const data = {
        address: address,
        pub_key: pub_key,
        timestamp: timestamp,
        request: request,
        index: index,
        payee: payee
    };
    const edges = await GetEdgeDag(DagData);
    const parenthash = edges[Math.floor(Math.random() * edges.length)];
    const pre_1 = {
        meta: {
            nonce: "0",
            hash: "",
            signature: ""
        },
        contents: {
            data: data,
            parenthash: parenthash,
            difficulty: difficulty,
            log_hash: log_hash
        },
        log_raw: log
    };
    const mined = mining(pre_1, difficulty);
    const nonce = mined.nonce;
    const hash = mined.hash;
    const signature = CryptoSet.SignData(hash, password);
    const unit = ((pre_1, nonce, hash, signature) => {
        pre_1.meta.nonce = nonce;
        pre_1.meta.hash = hash;
        pre_1.meta.signature = signature;
        return pre_1;
    })(pre_1, nonce, hash, signature);
    return unit;
}
exports.CreateUnit = CreateUnit;
/*CreateUnit("phoenix",CryptoSet.PullMyPublic("phoenix"),"52247c160b7aa9565d378b7e1704e4590587f95ce6877163cd8e6d7fefffcea1a023b17e20e033fd188a589b98c866faa37d03ae3b62827c2bc8f16765f398ef",0,"00ca49de7929c881ac8013534b477b986cad41dd34adcfab18c4938f642c4732953507a7d6639f83ebc86217311f64f8b79d04c486121ffe892d7ace48d44929",3,[],)*/
/*ValidUnit(unit,"",1000,[]).then(check=>{
  console.log(check);
});*/
/*const RunCode = (input:Input,token_state:StateSet.Token,type:Codetype,raw:string[],db,dag_root:string,worldroot:string,addressroot:string):Output=>{
  //const raw = IpfsSet.node_ready(node,())
  const Dag = new RadixTree({
    db: db,
    root: dag_root
  });

  const World = new RadixTree({
    db: db,
    root: worldroot
  });

  const Address = new RadixTree({
    db: db,
    root: addressroot
  });

  /*const tokens = new RadixTree({
    db: db,
    root: token_state.stateroot
  });*/
/*const states = {
  dag:Dag,
  world:World,
  t_state:t_state,
  tokens:tokens
}

const library = {
  crypto:CryptoSet,
  map:map,
  reduce:reduce,
  filter:filter,
  forEach:forEach,
  some:some
}*/
/*
const vm = new NodeVM({
  sandbox:{
    input:input,
    token_state:token_state,
    DagState:Dag,
    WorldState:World,
    AddressState:Address,
    RawData:raw
  },
  require:{
    external: true,
    root:"./library_for_js.js"
  }
});
const code = token_state[type];
const script = new VMScript("module.exports = (()=>{"+code+"})()");
const result:Output = vm.run(script);
return result;
};*/
/*async function input_raws(node,datahashs:DataHash[]){
  await node.on('ready');
  const result = await map(datahashs,async (hashs:DataHash)=>{
    const ipfshash:string = hashs.ipfshash;
    const cated = await node.cat(ipfshash);
    return cated.toString('utf-8');
  });
  return result;
}*/
/*
async function ValidUnit(unit:Unit,dag_root:string,parents_dag_root:string,worldroot:string,addressroot:string,block:ChainSet.Block,difficulty:number,key_currency:string){
  const nonce = unit.meta.nonce;
  const hash = unit.meta.hash;
  const parenthash = unit.meta.parenthash;
  const signature = unit.meta.signature;
  const address = unit.contents.address;
  const token = unit.contents.token;
  const timestamp = unit.contents.timestamp;
  const last = unit.contents.last;
  const fee = unit.contents.fee;
  const pub_key = unit.contents.pub_key;
  const input = unit.contents.input;
  const output = unit.contents.output;

  const date = new Date();
  const DagData = new RadixTree({
    db: db,
    root: dag_root
  });

  const count = nonce_count(hash);

  const parent:Unit = await DagData.get(Trie.en_key(parenthash));

  const before_dag_data = new RadixTree({
    db: db,
    root: block.contents.parenthash
  });

  const before_address_data = new RadixTree({
    db: db,
    root: block.contents.addressroot
  });

  const state_hashs:string[] = await before_address_data.get(Trie.en_key(address));

  const balance:number = await reduce(state_hashs,async (sum:number,key:string)=>{
    const state:StateSet.State = await before_dag_data.get(Trie.en_key(key));
    if(state.contents.owner==address&&state.contents.token==key_currency){
      return sum + state.amount;
    }
    else return sum;
  },0);

  const valid_input_check = await input.options.some((hashs:DataHash,i:number)=>{
    return hashs.selfhash!=_.toHash(this[i]);
  },await input_raws(IpfsSet.node,input.options));

  const valid_log_check = output.log.some((log)=>{
    return Buffer.from(JSON.stringify(log)).length>10000000;
  });

  const parents_dag = new RadixTree({
    db: db,
    root: parents_dag_root
  });

  /*const others_check = await some(input.others, async (key:string)=>{
    const unit:Unit = await DagData.get(Trie.en_key(key))
    const check = await ValidUnit(unit,t_state,dag_root,parents_dag_root,worldroot,addressroot);
    if(check==true){
      return false;
    }
    else{
      return true;
    }
    /*await NotDoubleConfirmed(key,DagData,parents_dag);
    return check;*/
/*});*/
/*if(count<=0||count>difficulty){
  console.log("invalid nonce");
  return false;
}
else if(hash!=HashForUnit(unit)){
  console.log("invalid hash");
  return false;
}
else if (address!=token&&CryptoSet.verifyData(hash,signature,pub_key)==false){
  console.log("invalid signature");
  return false;
}
else if (parenthash!=parent.meta.hash){
  console.log("invalid parenthash");
  return false;
}
else if(address!=token&&!address.match(/^PH/)){
  console.log("invalid address");
  return false;
}
else if(timestamp>date.getTime()){
  console.log("invalid timestamp");
  return false;
}
else if(address!=token&&address!=CryptoSet.AddressFromPublic(pub_key)){
  console.log("invalid pub_key");
  return false;
}
else if(last.index!=block.contents.index||last.hash!=block.meta.hash){
  console.log("invalid last");
  return false;
}
else if(fee<0||fee>balance){
  console.log("invalid fee");
  return false;
}
else if(await valid_input_check){
  console.log("invalid input");
  return false;
}
else if(valid_log_check){
  console.log("Too big log");
  return false;
}*/
/*else if(others_check){
  console.log("invalid quotation units");
}*/
/*else if(_.toHash(JSON.stringify(output))!=_.toHash(JSON.stringify(RunCode(input,t_state,codetype,raw_inputs,db,dag_root,worldroot,addressroot)))){
  console.log("invalid result");
  return false;
}*/
/*else{
  return true;
}
}*/
/*
async function AddUnittoDag(unit:Unit,dag_root:string,parents_dag_root:string,worldroot:string,addressroot:string,block:ChainSet.Block,difficulty:number,key_currency:string){
  if(!ValidUnit(unit,dag_root,parents_dag_root,worldroot,addressroot,block,difficulty,key_currency)) return dag_root;
  const dag = new RadixTree({
    db: db,
    root: dag_root
  });
  const new_dag = await dag.set(Trie.en_key(unit.meta.hash),unit);
  const new_world_root:string = await new_dag.flush();
  return new_world_root;
}

async function CreateUnit(password:string,address:string,token:string,pub_key:string,codetype:Codetype,input:Input){

}
*/
