"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var _ = require("./basic");
var Trie = require("./merkle_patricia");
var _a = require('p-iteration'), map = _a.map, reduce = _a.reduce, filter = _a.filter, forEach = _a.forEach, some = _a.some;
var RadixTree = require('dfinity-radix-tree');
var levelup = require('levelup');
var leveldown = require('leveldown');
var db = levelup(leveldown('./db/state'));
var IPFS = require('ipfs');
var _b = require('vm2'), NodeVM = _b.NodeVM, VMScript = _b.VMScript;
var rlp = require('rlp');
var CryptoSet = require('./crypto_set.js');
//const node = new IPFS();
var log_limit = 10000000;
var nonce_count = function (hash) {
    var check = true;
    var sum = hash.split("").reduce(function (result, val) {
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
var HashForUnit = function (unit) {
    return _.toHash(unit.meta.nonce + JSON.stringify(unit.contents));
};
function ValidUnit(unit, dag_root, log_limit, chain) {
    return __awaiter(this, void 0, void 0, function () {
        var nonce, hash, signature, tx_data, address, pub_key, timestamp, parenthash, difficulty, log_hash, log_raw, date, count, request_tx, token, DagData, parent, _a, _b, _c, _d, log_size;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    nonce = unit.meta.nonce;
                    hash = unit.meta.hash;
                    signature = unit.meta.signature;
                    tx_data = unit.contents.data;
                    address = tx_data.address;
                    pub_key = tx_data.pub_key;
                    timestamp = tx_data.timestamp;
                    parenthash = unit.contents.parenthash;
                    difficulty = unit.contents.difficulty;
                    log_hash = unit.contents.log_hash;
                    log_raw = unit.log_raw;
                    date = new Date();
                    count = nonce_count(hash);
                    request_tx = chain[tx_data.index].transactions.reduce(function (result, tx) {
                        if (tx.kind == "request" && tx.meta.hash == tx_data.request)
                            return result.concat(tx);
                    }, [])[0];
                    token = request_tx.contents.data.token;
                    DagData = new RadixTree({
                        db: db,
                        root: dag_root
                    });
                    _b = (_a = JSON).parse;
                    _d = (_c = rlp).decode;
                    return [4 /*yield*/, DagData.get(Trie.en_key(parenthash))];
                case 1:
                    parent = _b.apply(_a, [_d.apply(_c, [_e.sent()])]);
                    log_size = log_raw.reduce(function (sum, log) {
                        return sum + Buffer.from(JSON.stringify(log)).length;
                    }, 0);
                    if (count <= 0 || count > difficulty) {
                        console.log("invalid nonce");
                        return [2 /*return*/, false];
                    }
                    else if (hash != HashForUnit(unit)) {
                        console.log("invalid hash");
                        return [2 /*return*/, false];
                    }
                    else if (address != token && CryptoSet.verifyData(hash, signature, pub_key) == false) {
                        console.log("invalid signature");
                        return [2 /*return*/, false];
                    }
                    else if (address != token && !address.match(/^PH/)) {
                        console.log("invalid address");
                        return [2 /*return*/, false];
                    }
                    else if (address != token && address != CryptoSet.AddressFromPublic(pub_key)) {
                        console.log("invalid pub_key");
                        return [2 /*return*/, false];
                    }
                    else if (timestamp > date.getTime()) {
                        console.log("invalid timestamp");
                        return [2 /*return*/, false];
                    }
                    else if (parenthash != parent.meta.hash) {
                        console.log("invalid parenthash");
                        return [2 /*return*/, false];
                    }
                    else if (log_hash != _.toHash(JSON.stringify(log_raw))) {
                        console.log("invalid log_hash");
                        return [2 /*return*/, false];
                    }
                    else if (log_size > log_limit) {
                        console.log("This Log is too big");
                        return [2 /*return*/, false];
                    }
                    else {
                        return [2 /*return*/, true];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function Unit_to_Dag(unit, dag_root) {
    return __awaiter(this, void 0, void 0, function () {
        var DagData, new_root;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    DagData = new RadixTree({
                        db: db,
                        root: dag_root
                    });
                    return [4 /*yield*/, DagData.set(Trie.en_key(unit.meta.hash), rlp.decode(JSON.stringify(unit)))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, DagData.flush()];
                case 2:
                    new_root = _a.sent();
                    return [2 /*return*/, new_root];
            }
        });
    });
}
function Unit_to_Memory(unit, memory_root) {
    return __awaiter(this, void 0, void 0, function () {
        var Memory, target, _a, _b, _c, _d, new_root;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    Memory = new RadixTree({
                        db: db,
                        root: memory_root
                    });
                    _b = (_a = JSON).parse;
                    _d = (_c = rlp).decode;
                    return [4 /*yield*/, Memory.get(Trie.en_key(unit.contents.data.request))];
                case 1:
                    target = _b.apply(_a, [_d.apply(_c, [_e.sent()])]) || [];
                    return [4 /*yield*/, Memory.set(Trie.en_key(unit.contents.data.request), rlp.decode(JSON.stringify(target.concat(unit.meta.hash))))];
                case 2:
                    _e.sent();
                    return [4 /*yield*/, Memory.flush()];
                case 3:
                    new_root = _e.sent();
                    return [2 /*return*/, new_root];
            }
        });
    });
}
function AcceptUnit(unit, dag_root, memory_root, log_limit, chain) {
    return __awaiter(this, void 0, void 0, function () {
        var new_dag_root, new_memory_root;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ValidUnit(unit, dag_root, log_limit, chain)];
                case 1:
                    if (!(_a.sent()))
                        return [2 /*return*/, { dag: dag_root, memory: memory_root }];
                    return [4 /*yield*/, Unit_to_Dag(unit, dag_root)];
                case 2:
                    new_dag_root = _a.sent();
                    return [4 /*yield*/, Unit_to_Memory(unit, memory_root)];
                case 3:
                    new_memory_root = _a.sent();
                    return [2 /*return*/, {
                            dag: new_dag_root,
                            memory: new_memory_root
                        }];
            }
        });
    });
}
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
