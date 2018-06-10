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
var TxSet = require("./tx");
var R = require("ramda");
var _a = require('p-iteration'), map = _a.map, reduce = _a.reduce, filter = _a.filter, forEach = _a.forEach, some = _a.some;
//const RadixTree = require('dfinity-radix-tree');
//const levelup = require('levelup');
//const leveldown = require('leveldown');
//const db = levelup(leveldown('./db/state'));
var IPFS = require('ipfs');
var rlp = require('rlp');
var CryptoSet = require('./crypto_set.js');
exports.fee_by_size = 10;
function GetTreeroot(pre) {
    if (pre.length == 0)
        return [_.toHash("")];
    else if (pre.length == 1)
        return pre;
    else {
        var union = pre.reduce(function (result, val, index, array) {
            var i = Number(index);
            if (i % 2 == 0) {
                var left = val;
                var right = (function (left, i, array) {
                    if (array[i + 1] == null)
                        return "";
                    else
                        return array[i + 1];
                })(left, i, array);
                return result.concat(_.toHash(left + right));
            }
        }, []);
        return GetTreeroot(union);
    }
}
/*async function ChildHashs(parent:string,parents_dag){
  const hashs:string[] = await parents_dag.get(Trie.en_key(parent));
  return hashs;
}*/
/*async function NotDoubleConfirmed(hash:string,parents_dag){
  const children:string[] = await ChildHashs(hash,parents_dag);
  if(children.length==0) return true;
  return await some(children,async (key:string)=>{
    const grandchildren:string[] = await ChildHashs(key,parents_dag);
    return grandchildren.length==0;
  });
}*/
/*async function TxUsed(hash:string,used_tx){
  const used = await used_tx.get(Trie.en_key(hash));
  return used==null;
}*/
function HextoNum(str) {
    return parseInt(str, 16);
}
function SortCandidates(candidates) {
    return candidates.sort(function (a, b) {
        return HextoNum(a.address) - HextoNum(b.address);
    });
}
function elected(sorted, result, now, i) {
    if (now === void 0) { now = -1; }
    if (i === void 0) { i = 0; }
    if (result > sorted.length - 1)
        return "";
    var new_now = now + sorted[i].amount;
    if (new_now < result)
        return elected(sorted, result, new_now, i + 1);
    else
        return sorted[i].address;
}
/*async function TxCheckintoChain(txs:TxSet.Tx[],parents_dag,used_tx){
  return await some(txs, async (tx:TxSet.Tx)=>{
    const not_confirmed_check = await NotDoubleConfirmed(tx.meta.evidence,parents_dag);
    const used_tx_check = await TxUsed(tx.meta.hash,used_tx);
    return not_confirmed_check==true || used_tx_check==true;
  });
}*/
function ValidBlock(block, chain, fee_by_size, key_currency, tag_limit, StateData, DagData, RequestData) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        var hash, validatorSign, index, parenthash, timestamp, stateroot, request_root, tx_root, fee, difficulty, validator, validatorPub, candidates, txs, last, date, right_stateroot, right_request_root, tx_hash_map, size_sum, right_validator, validator_state, address, _a, _b, changed, valid_txs, Sacrifice, collected, sorted;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    hash = block.meta.hash;
                    validatorSign = block.meta.validatorSign;
                    index = block.contents.index;
                    parenthash = block.contents.parenthash;
                    timestamp = block.contents.timestamp;
                    stateroot = block.contents.stateroot;
                    request_root = block.contents.request_root;
                    tx_root = block.contents.tx_root;
                    fee = block.contents.fee;
                    difficulty = block.contents.difficulty;
                    validator = block.contents.validator;
                    validatorPub = block.contents.validatorPub;
                    candidates = block.contents.candidates;
                    txs = block.transactions;
                    last = chain[chain.length - 1];
                    date = new Date();
                    right_stateroot = StateData.now_root();
                    right_request_root = RequestData.now_root();
                    tx_hash_map = txs.map(function (tx) {
                        return tx.meta.hash;
                    });
                    size_sum = txs.reduce(function (sum, tx) {
                        return sum + Buffer.from(JSON.stringify(tx)).length;
                    }, 0);
                    right_validator = elected(SortCandidates(last.contents.candidates), _.get_unicode(block.meta.hash));
                    return [4 /*yield*/, StateData.get(validator)];
                case 1:
                    validator_state = _c.sent();
                    address = validator_state.contents.owner;
                    /*const PnsData = await World.get(Trie.en_key('pns'));
                    const pns:AddressAlias[] = await AddressState.get(Trie.en_key('pns'));
                    const sacrifice_holders = await reduce(pns,async (result,alias:AddressAlias)=>{
                      const state:StateSet.T_state = await PnsData.get(Trie.en_key(alias.key));
                      if(result[state.contents.tag.])
                    },{});*/
                    _b = (_a = console).log;
                    return [4 /*yield*/, StateData.filter()];
                case 2:
                    /*const PnsData = await World.get(Trie.en_key('pns'));
                    const pns:AddressAlias[] = await AddressState.get(Trie.en_key('pns'));
                    const sacrifice_holders = await reduce(pns,async (result,alias:AddressAlias)=>{
                      const state:StateSet.T_state = await PnsData.get(Trie.en_key(alias.key));
                      if(result[state.contents.tag.])
                    },{});*/
                    _b.apply(_a, [_c.sent()]);
                    changed = [StateData, RequestData];
                    return [4 /*yield*/, some(txs, function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            var _a, news, _b, news;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _a = tx.kind == "request";
                                        if (!_a) return [3 /*break*/, 2];
                                        return [4 /*yield*/, TxSet.ValidRequestTx(tx, tag_limit, key_currency, fee_by_size, changed[0])];
                                    case 1:
                                        _a = (_c.sent());
                                        _c.label = 2;
                                    case 2:
                                        if (!_a) return [3 /*break*/, 4];
                                        return [4 /*yield*/, TxSet.AcceptRequestTx(tx, chain, validator, key_currency, changed[0], changed[1])];
                                    case 3:
                                        news = _c.sent();
                                        changed[0] = news[0];
                                        changed[1] = news[1];
                                        return [2 /*return*/, false];
                                    case 4:
                                        _b = tx.kind == "refresh";
                                        if (!_b) return [3 /*break*/, 6];
                                        return [4 /*yield*/, TxSet.ValidRefreshTx(tx, chain, key_currency, fee_by_size, tag_limit, changed[0], DagData, changed[1])];
                                    case 5:
                                        _b = (_c.sent());
                                        _c.label = 6;
                                    case 6:
                                        if (!_b) return [3 /*break*/, 8];
                                        return [4 /*yield*/, TxSet.AcceptRefreshTx(tx, chain, validator, key_currency, changed[0], changed[1])];
                                    case 7:
                                        news = _c.sent();
                                        changed[0] = news[0];
                                        changed[1] = news[1];
                                        return [2 /*return*/, false];
                                    case 8: return [2 /*return*/, true];
                                }
                            });
                        }); })];
                case 3:
                    valid_txs = _c.sent();
                    return [4 /*yield*/, StateData.filter(function (key, value) {
                            var state = value;
                            return state.contents.token == "sacrifice" && state.amount > 0;
                        })];
                case 4:
                    Sacrifice = _c.sent();
                    collected = R.values(Sacrifice).reduce(function (result, state) {
                        var address = state.contents.owner;
                        var amount = state.amount;
                        if (result[address] == null)
                            result[address] = { address: address, amount: 0 };
                        result[address]["amount"] += amount;
                        return result;
                    }, {});
                    sorted = SortCandidates(R.values(collected));
                    if (hash != _.toHash(JSON.stringify(block.contents))) {
                        console.log("invalid hash");
                        return [2 /*return*/, false];
                    }
                    else if (CryptoSet.verifyData(hash, validatorSign, validatorPub) == false) {
                        console.log("invalid signature");
                        return [2 /*return*/, false];
                    }
                    else if (index != chain.length) {
                        console.log("invalid index");
                        return [2 /*return*/, false];
                    }
                    else if (parenthash != last.meta.hash) {
                        console.log("invalid parenthash");
                        return [2 /*return*/, false];
                    }
                    else if (timestamp > date.getTime()) {
                        console.log("invalid timestamp");
                        return [2 /*return*/, false];
                    }
                    else if (stateroot != right_stateroot) {
                        console.log("invalid stateroot");
                        return [2 /*return*/, false];
                    }
                    /*else if(addressroot!=now_addressroot){
                      console.log("invalid addressroot");
                      return false;
                    }
                    else if(used_dagroot!=now_used_dagroot){
                      console.log("invalid used_dagroot");
                      return false;
                    }
                    else if(used_txroot!=now_used_txroot){
                      console.log("invalid used_txroot");
                      return false;
                    }*/
                    else if (request_root != right_request_root) {
                        console.log("invalid request_root");
                        return [2 /*return*/, false];
                    }
                    else if (tx_root != GetTreeroot(tx_hash_map)[0]) {
                        console.log("invalid tx_root");
                        return [2 /*return*/, false];
                    }
                    /*else if(TxCheckintoChain(txs,parents_dag,UsedTx)){
                      console.log("invalid transactions");
                      return false;
                    }*/
                    else if (fee != fee_by_size * size_sum) {
                        console.log("invalid fee");
                    }
                    else if (validator_state.contents.token != key_currency /*||address!=right_validator*/) {
                        console.log("invalid validator");
                        return [2 /*return*/, false];
                    }
                    else if (address != CryptoSet.AddressFromPublic(validatorPub)) {
                        console.log("invalid validator pub_key");
                        return [2 /*return*/, false];
                    }
                    else if (valid_txs) {
                        console.log("invalid transactions");
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
function AcceptBlock(block, chain, tag_limit, fee_by_size, key_currency, StateData, DagData, RequestData) {
    return __awaiter(this, void 0, void 0, function () {
        var stateroot, request_root, validator, _a, _b, new_chain;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    stateroot = block.contents.stateroot;
                    request_root = block.contents.request_root;
                    validator = block.contents.validator;
                    return [4 /*yield*/, ValidBlock(block, chain, fee_by_size, key_currency, tag_limit, StateData, DagData, RequestData)];
                case 1:
                    if (!(_c.sent()))
                        return [2 /*return*/, { chain: chain, state: stateroot, request: request_root }];
                    console.log("OK");
                    _b = (_a = console).log;
                    return [4 /*yield*/, StateData.filter()];
                case 2:
                    _b.apply(_a, [_c.sent()]);
                    new_chain = chain.concat(block);
                    return [2 /*return*/, {
                            chain: new_chain,
                            state: StateData.now_root(),
                            request: RequestData.now_root()
                        }];
            }
        });
    });
}
exports.AcceptBlock = AcceptBlock;
function CreateBlock(password, chain, stateroot, request_root, fee_by_size, difficulty, validator, validatorPub, candidates, txs) {
    var last = chain[chain.length - 1];
    var index = chain.length;
    var parenthash = last.meta.hash;
    var date = new Date();
    var timestamp = date.getTime();
    var tx_hash_map = txs.map(function (tx) {
        return tx.meta.hash;
    });
    var tx_root = GetTreeroot(tx_hash_map)[0];
    var fee = txs.reduce(function (sum, tx) {
        return (sum + fee_by_size * Buffer.from(JSON.stringify(tx)).length);
    }, 0);
    var pre_1 = {
        meta: {
            hash: "",
            validatorSign: ""
        },
        contents: {
            index: index,
            parenthash: parenthash,
            timestamp: timestamp,
            stateroot: stateroot,
            request_root: request_root,
            tx_root: tx_root,
            fee: fee,
            difficulty: difficulty,
            validator: validator,
            validatorPub: validatorPub,
            candidates: candidates
        },
        transactions: txs
    };
    var hash = _.toHash(JSON.stringify(pre_1.contents));
    var signature = CryptoSet.SignData(hash, password);
    var block = (function (pre_1, hash, signature) {
        pre_1.meta.hash = hash;
        pre_1.meta.validatorSign = signature;
        return pre_1;
    })(pre_1, hash, signature);
    return block;
}
exports.CreateBlock = CreateBlock;
/*async function empty_tree(db){
  const StateData = new RadixTree({
    db: db
  });
  /*await StateData.set("a","b");
  await StateData.delete("a");
  const empty_tree_root = await StateData.flush();
  console.log(empty_tree_root);
  return empty_tree_root;*/
/*}
const StateData = new RadixTree({
  db: db
});
StateData.flush()*/
/*const first:Block = {
  meta:{
    hash:"",
    validatorSign:""
  },
  contents:{
    index:0,
    parenthash:"2f6c5d2f6d5a5011f9f498476cf424b57b6ad5f90cf225c03525de77b78ed45ec57f6d9ebddaa20a130f555cb871f00bbefd5d3fea501b24ca5d5578122acfd2",
    timestamp:1525596393758,
    stateroot:stateroot,
    request_root:request_root,
    tx_root:tx_root,
    fee:fee,
    difficulty:difficulty,
    validator:validator,
    validatorPub:validatorPub,
    candidates:candidates
  },
  transactions:txs
}*/
//const block = CreateBlock("Sora",pub,"",0,"","",3,[]);
