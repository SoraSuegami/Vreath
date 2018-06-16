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
var R = require("ramda");
var _a = require('p-iteration'), map = _a.map, reduce = _a.reduce, filter = _a.filter, forEach = _a.forEach, some = _a.some;
//const RadixTree = require('dfinity-radix-tree');
////const leveldown = require('leveldown');
//const db = levelup(leveldown('./db/state'));
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
var mining = function (unit, difficulty) {
    var nonce = -1;
    var hashed = "";
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
var HashForUnit = function (unit) {
    return _.toHash(unit.meta.nonce + JSON.stringify(unit.contents));
};
function ValidUnit(unit, log_limit, chain, DagData) {
    return __awaiter(this, void 0, void 0, function () {
        var nonce, hash, signature, tx_data, address, pub_key, timestamp, parenthash, difficulty, log_hash, log_raw, date, count, request_tx, token, parent, log_size;
        return __generator(this, function (_a) {
            switch (_a.label) {
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
                    token = request_tx.contents.data.token || "";
                    return [4 /*yield*/, DagData.get(parenthash)];
                case 1:
                    parent = _a.sent();
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
function Unit_to_Dag(unit, DagData) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, DagData.put(unit.meta.hash, unit)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, DagData];
            }
        });
    });
}
function Unit_to_Memory(unit, MemoryData) {
    return __awaiter(this, void 0, void 0, function () {
        var target;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, MemoryData.get(unit.contents.data.request)];
                case 1:
                    target = _a.sent();
                    if (Object.keys(target).length == 0)
                        target = [];
                    return [4 /*yield*/, MemoryData.put(unit.contents.data.request, target.concat(unit.meta.hash))];
                case 2:
                    _a.sent();
                    return [2 /*return*/, MemoryData];
            }
        });
    });
}
function AcceptUnit(unit, log_limit, chain, DagData, MemoryData) {
    return __awaiter(this, void 0, void 0, function () {
        var new_dag, new_memory;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ValidUnit(unit, log_limit, chain, DagData)];
                case 1:
                    if (!(_a.sent()))
                        return [2 /*return*/, [DagData, MemoryData]];
                    return [4 /*yield*/, Unit_to_Dag(unit, DagData)];
                case 2:
                    new_dag = _a.sent();
                    return [4 /*yield*/, Unit_to_Memory(unit, MemoryData)];
                case 3:
                    new_memory = _a.sent();
                    return [2 /*return*/, [new_dag, new_memory]];
            }
        });
    });
}
exports.AcceptUnit = AcceptUnit;
function GetEdgeDag(DagData) {
    return __awaiter(this, void 0, void 0, function () {
        var filtered, _a, _b, parents, children, edge;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _b = (_a = R).values;
                    return [4 /*yield*/, DagData.filter()];
                case 1:
                    filtered = _b.apply(_a, [_c.sent()]).reduce(function (result, val) {
                        result.parents.push(val.contents.parenthash);
                        result.children.push(val.meta.hash);
                        return result;
                    }, { parents: [], children: [] });
                    parents = filtered.parents;
                    children = filtered.children;
                    if (parents == [] || children == [])
                        return [2 /*return*/, []];
                    edge = children.reduce(function (result, val) {
                        var idx = parents.indexOf(val);
                        if (parents.indexOf(val) == -1)
                            return result.concat(val);
                        else
                            return result;
                    }, []);
                    return [2 /*return*/, edge];
            }
        });
    });
}
function CreateUnit(password, pub_key, request, index, payee, difficulty, log, DagData) {
    return __awaiter(this, void 0, void 0, function () {
        var address, date, timestamp, log_hash, data, edges, parenthash, pre_1, mined, nonce, hash, signature, unit;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    address = CryptoSet.AddressFromPublic(pub_key);
                    date = new Date();
                    timestamp = date.getTime();
                    log_hash = _.toHash(JSON.stringify(log));
                    data = {
                        address: address,
                        pub_key: pub_key,
                        timestamp: timestamp,
                        request: request,
                        index: index,
                        payee: payee
                    };
                    return [4 /*yield*/, GetEdgeDag(DagData)];
                case 1:
                    edges = _a.sent();
                    parenthash = edges[Math.floor(Math.random() * edges.length)];
                    pre_1 = {
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
                    mined = mining(pre_1, difficulty);
                    nonce = mined.nonce;
                    hash = mined.hash;
                    signature = CryptoSet.SignData(hash, password);
                    unit = (function (pre_1, nonce, hash, signature) {
                        pre_1.meta.nonce = nonce;
                        pre_1.meta.hash = hash;
                        pre_1.meta.signature = signature;
                        return pre_1;
                    })(pre_1, nonce, hash, signature);
                    return [2 /*return*/, unit];
            }
        });
    });
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
