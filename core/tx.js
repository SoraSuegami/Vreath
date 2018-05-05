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
var _a = require('p-iteration'), map = _a.map, reduce = _a.reduce, filter = _a.filter, forEach = _a.forEach, find = _a.find;
var RadixTree = require('dfinity-radix-tree');
var levelup = require('levelup');
var leveldown = require('leveldown');
var db = levelup(leveldown('./db/state'));
var IPFS = require('ipfs');
var rlp = require('rlp');
var CryptoSet = require('./crypto_set.js');
var tag_limit = 10000;
var key_currency = "nix";
function ValidRequestTx(tx, stateroot, tag_limit, key_currency, fee_by_size) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        var hash, signature, input_raw, code, purehash, pre, next, address, pub_key, timestamp, fee, solvency, type, token, base, input_hash, output, new_token, date, StateData, solvency_state, _a, _b, _c, _d, base_state, amount_result, new_state, state_check;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    hash = tx.meta.hash;
                    signature = tx.meta.signature;
                    input_raw = tx.input_raw;
                    code = tx.code;
                    purehash = tx.contents.purehash;
                    pre = tx.contents.pre;
                    next = tx.contents.next;
                    address = tx.contents.data.address;
                    pub_key = tx.contents.data.pub_key;
                    timestamp = tx.contents.data.timestamp;
                    fee = tx.contents.data.fee;
                    solvency = tx.contents.data.solvency;
                    type = tx.contents.data.type;
                    token = tx.contents.data.token;
                    base = tx.contents.data.base;
                    input_hash = tx.contents.data.input_hash;
                    output = tx.contents.data.output;
                    new_token = tx.contents.data.new_token;
                    date = new Date();
                    StateData = new RadixTree({
                        db: db,
                        root: stateroot
                    });
                    _b = (_a = JSON).parse;
                    _d = (_c = rlp).decode;
                    return [4 /*yield*/, StateData.get(Trie.en_key(solvency))];
                case 1:
                    solvency_state = _b.apply(_a, [_d.apply(_c, [_e.sent()])]);
                    return [4 /*yield*/, reduce(base, function (array, id) { return __awaiter(_this, void 0, void 0, function () {
                            var geted, _a, _b, _c, _d;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        _b = (_a = JSON).parse;
                                        _d = (_c = rlp).decode;
                                        return [4 /*yield*/, StateData.get(Trie.en_key(id))];
                                    case 1:
                                        geted = _b.apply(_a, [_d.apply(_c, [_e.sent()])]);
                                        if (geted != null)
                                            return [2 /*return*/, array.concat(geted)];
                                        else
                                            return [2 /*return*/, array];
                                        return [2 /*return*/];
                                }
                            });
                        }); }, [])];
                case 2:
                    base_state = _e.sent();
                    amount_result = output.reduce(function (sum, state) {
                        return sum + state.amount;
                    }, 0);
                    new_state = (function (tx, bases) {
                        if (type == "issue")
                            return TxIsuue(tx, bases);
                        else if (type == "change")
                            return TxChange(tx, bases);
                        else if (type == "scrap")
                            return TxScrap(tx, bases);
                        else
                            return bases;
                    })(tx, base_state);
                    state_check = new_state.some(function (state) {
                        if (state.hash == solvency_state.hash) {
                            state.amount -= (fee + Buffer.from(JSON.stringify(tx)).length);
                        }
                        return state.amount < 0 || Buffer.from(JSON.stringify(state.contents.tag)).length > tag_limit;
                    });
                    if (hash != _.toHash(JSON.stringify(tx.contents))) {
                        console.log("invalid hash");
                        return [2 /*return*/, false];
                    }
                    else if (address != token && CryptoSet.verifyData(hash, signature, pub_key) == false) {
                        console.log("invalid signature");
                        return [2 /*return*/, false];
                    }
                    else if (purehash != _.toHash(JSON.stringify(tx.contents.data))) {
                        console.log("invalid purehash");
                        return [2 /*return*/, false];
                    }
                    else if ((address != token && !address.match(/^PH/)) || address != token) {
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
                    else if (solvency_state.contents.token != key_currency || solvency_state.amount < fee + Buffer.from(JSON.stringify(tx)).length) {
                        console.log("invalid solvency");
                        return [2 /*return*/, false];
                    }
                    else if (base.length != base_state.length) {
                        console.log("invalid input");
                        return [2 /*return*/, false];
                    }
                    else if (input_hash != _.toHash(JSON.stringify(input_raw))) {
                        console.log("invalid input");
                        return [2 /*return*/, false];
                    }
                    else if (type == 'issue' && amount_result <= 0) {
                        console.log("invalid type issue");
                        return [2 /*return*/, false];
                    }
                    else if (type == 'change' && amount_result != 0) {
                        console.log("invalid type change");
                        return [2 /*return*/, false];
                    }
                    else if (type == 'scrap' && amount_result >= 0) {
                        console.log("invalid type scrap");
                        return [2 /*return*/, false];
                    }
                    else if (state_check) {
                        console.log("invalid result");
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
exports.ValidRequestTx = ValidRequestTx;
/*function isRequest(tx:Tx):tx is RequestTx{
  tx.contents.data
}*/
//const isRequest = (tx:Tx):tx is RequestTx => tx.kind === "request";
function ValidRefreshTx(tx, dag_root, chain, stateroot, request_root, key_currency, fee_by_size) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        var hash, signature, evidence, address, pub_key, timestamp, request, index, payee, date, DagData, unit, _a, _b, _c, _d, request_tx, token, StateData, payee_state, _e, _f, _g, _h, solvency_state, _j, _k, _l, _m, base_state, new_request_state, fee, state_check, RequestsAlias, get_request;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    hash = tx.meta.hash;
                    signature = tx.meta.signature;
                    evidence = tx.evidence;
                    address = tx.contents.address;
                    pub_key = tx.contents.pub_key;
                    timestamp = tx.contents.timestamp;
                    request = tx.contents.request;
                    index = tx.contents.index;
                    payee = tx.contents.payee;
                    date = new Date();
                    DagData = new RadixTree({
                        db: db,
                        root: dag_root
                    });
                    _b = (_a = JSON).parse;
                    _d = (_c = rlp).decode;
                    return [4 /*yield*/, DagData.get(Trie.en_key(evidence))];
                case 1:
                    unit = _b.apply(_a, [_d.apply(_c, [_o.sent()])]);
                    request_tx = chain[index].transactions.reduce(function (result, tx) {
                        if (tx.kind == "request" && tx.meta.hash == request)
                            return result.concat(tx);
                    }, [])[0];
                    token = request_tx.contents.data.token;
                    StateData = new RadixTree({
                        db: db,
                        root: stateroot
                    });
                    _f = (_e = JSON).parse;
                    _h = (_g = rlp).decode;
                    return [4 /*yield*/, StateData.get(Trie.en_key(tx.contents.payee))];
                case 2:
                    payee_state = _f.apply(_e, [_h.apply(_g, [_o.sent()])]);
                    _k = (_j = JSON).parse;
                    _m = (_l = rlp).decode;
                    return [4 /*yield*/, StateData.get(Trie.en_key(request_tx.contents.data.solvency))];
                case 3:
                    solvency_state = _k.apply(_j, [_m.apply(_l, [_o.sent()])]);
                    return [4 /*yield*/, reduce(request_tx.contents.data.base, function (array, id) { return __awaiter(_this, void 0, void 0, function () {
                            var geted, _a, _b, _c, _d;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        _b = (_a = JSON).parse;
                                        _d = (_c = rlp).decode;
                                        return [4 /*yield*/, StateData.get(Trie.en_key(id))];
                                    case 1:
                                        geted = _b.apply(_a, [_d.apply(_c, [_e.sent()])]);
                                        if (geted != null)
                                            return [2 /*return*/, array.concat(geted)];
                                        else
                                            return [2 /*return*/, array];
                                        return [2 /*return*/];
                                }
                            });
                        }); }, [])];
                case 4:
                    base_state = _o.sent();
                    new_request_state = (function (tx, bases) {
                        var type = tx.contents.data.type;
                        if (type == "issue")
                            return TxIsuue(tx, bases);
                        else if (type == "change")
                            return TxChange(tx, bases);
                        else if (type == "scrap")
                            return TxScrap(tx, bases);
                        else
                            return bases;
                    })(request_tx, base_state);
                    fee = request_tx.contents.data.fee;
                    state_check = new_request_state.some(function (state) {
                        if (state.hash == solvency_state.hash) {
                            state.amount -= (fee + Buffer.from(JSON.stringify(tx)).length);
                        }
                        else if (state.hash == payee_state.hash) {
                            state.amount -= ((-1) * fee + Buffer.from(JSON.stringify(tx)).length);
                        }
                        return state.amount < 0 || Buffer.from(JSON.stringify(state.contents.tag)).length > tag_limit;
                    });
                    RequestsAlias = new RadixTree({
                        db: db,
                        root: request_root
                    });
                    return [4 /*yield*/, RequestsAlias.get(Trie.en_key(request_tx.meta.hash))];
                case 5:
                    get_request = _o.sent();
                    if (hash != _.toHash(JSON.stringify(tx.contents))) {
                        console.log("invalid hash");
                        return [2 /*return*/, false];
                    }
                    else if (address != token && CryptoSet.verifyData(hash, signature, pub_key) == false) {
                        console.log("invalid signature");
                        return [2 /*return*/, false];
                    }
                    else if ((address != token && !address.match(/^PH/)) || address != token) {
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
                    else if (unit.contents.data != tx.contents) {
                        console.log("invalid evidence");
                        return [2 /*return*/, false];
                    }
                    else if (payee_state.contents.token != key_currency || payee_state.amount < fee_by_size * Buffer.from(JSON.stringify(tx)).length) {
                        console.log("invalid payee");
                        return [2 /*return*/, false];
                    }
                    else if (solvency_state.contents.token != key_currency || solvency_state.amount < request_tx.contents.data.fee) {
                        console.log("invalid fee");
                        return [2 /*return*/, false];
                    }
                    else if (request_tx.contents.data.base.length != base_state.length) {
                        console.log("invalid input");
                        return [2 /*return*/, false];
                    }
                    else if (state_check) {
                        console.log("invalid result");
                        return [2 /*return*/, false];
                    }
                    else if (get_request != null) {
                        console.log("This request is already refreshed");
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
exports.ValidRefreshTx = ValidRefreshTx;
function TxIsuue(tx, bases) {
    if (tx.contents.data.type != "issue")
        return bases;
    var outputs = tx.contents.data.output;
    var refreshed = bases.map(function (state, i) {
        var target = outputs[i];
        state.amount += target.amount;
        state.contents = target.contents;
        return state;
    });
    return refreshed.concat(outputs.slice(outputs.length));
}
function TxChange(tx, bases) {
    if (tx.contents.data.type != "change")
        return bases;
    var outputs = tx.contents.data.output;
    var refreshed = bases.map(function (state, i) {
        var target = outputs[i];
        state.amount += target.amount;
        state.contents = target.contents;
        return state;
    });
    return refreshed.concat(outputs.slice(outputs.length));
    /*return bases.map((state:StateSet.State,i:number)=>{
      const output = tx.contents.data.output[i];
      state.amount += output.amount;
      state.contents = output.contents;
      return state;
    });*/
}
function TxScrap(tx, bases) {
    if (tx.contents.data.type != "scrap")
        return bases;
    return bases.map(function (state, i) {
        var output = tx.contents.data.output[i];
        state.amount += output.amount;
        state.contents = output.contents;
        return state;
    });
}
/*function TxCreate(tx:RequestTx,bases:StateSet.State[]):StateSet.State[]{
  if(tx.contents.data.type!="create") return bases;
  const outputs = tx.contents.data.output;
  return outputs;
}*/
function NewState(tx, bases) {
    switch (tx.contents.data.type) {
        case "issue":
            return TxIsuue(tx, bases);
        case "change":
            return TxChange(tx, bases);
        case "scrap":
            return TxScrap(tx, bases);
        default:
            return bases;
    }
}
function RefreshRequestRoot(request, refresh, index, root) {
    return __awaiter(this, void 0, void 0, function () {
        var Aliases, alias, new_root;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (request.meta.hash != refresh.contents.request)
                        return [2 /*return*/, root];
                    Aliases = new RadixTree({
                        db: db,
                        root: root
                    });
                    alias = {
                        index: index,
                        hash: refresh.meta.hash
                    };
                    return [4 /*yield*/, Aliases.set(Trie.en_key(request.meta.hash), rlp.encode(JSON.stringify(alias)))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, Aliases.flush()];
                case 2:
                    new_root = _a.sent();
                    return [2 /*return*/, new_root];
            }
        });
    });
}
/*async function Fee_to_Verifier(request:RequestTx,refresh:RefreshTx,stateroot:string,key_currency:string){
  if(request.meta.hash!=refresh.contents.request) return stateroot;
  const StateData = new RadixTree({
    db: db,
    root: stateroot
  });
  let solvency:StateSet.State = JSON.parse(rlp.decode(await StateData.get(Trie.en_key(request.contents.data.solvency))));
  let payee:StateSet.State = JSON.parse(rlp.decode(await StateData.get(Trie.en_key(refresh.contents.payee))));
  if(solvency.contents.token!=key_currency||payee.contents.token!=key_currency) return stateroot;
  solvency.amount -= request.contents.data.fee;
  payee.amount += request.contents.data.fee;
  await StateData.set(Trie.en_key(solvency.hash),rlp.encode(JSON.stringify(solvency)));
  await StateData.set(Trie.en_key(payee.hash),rlp.encode(JSON.stringify(payee)));
  const new_root = await StateData.flush();
  return new_root;
}*/
function Fee_to_Verifier(solvency, payee, fee, key_currency) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (solvency.contents.token != key_currency || payee.contents.token != key_currency)
                return [2 /*return*/, [solvency, payee]];
            solvency.amount -= fee;
            payee.amount += fee;
            return [2 /*return*/, [solvency, payee]];
        });
    });
}
function Fee_to_Validator(pay_state, validator_state, fee, key_currency) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (pay_state.contents.token != key_currency || validator_state.contents.token != key_currency)
                return [2 /*return*/, [pay_state, validator_state]];
            pay_state.amount -= fee;
            validator_state.amount += fee;
            return [2 /*return*/, [pay_state, validator_state]];
        });
    });
}
/*async function Fee_to_Validator(tx:Tx,validator:string,stateroot:string,key_currency:string){
  const fee_pay = ((tx)=>{
    if(tx.kind=="request") return tx.contents.data.solvency;
    else if(tx.kind=="refresh") return tx.contents.payee;
    else return "";
  })(tx);
  if(fee_pay=="") return stateroot;
  const StateData = new RadixTree({
    db: db,
    root: stateroot
  });
  const fee = Buffer.from(JSON.stringify(tx)).length;
  let pay_state:StateSet.State = JSON.parse(rlp.decode(await StateData.get(Trie.en_key(fee_pay))));
  let validator_state:StateSet.State = JSON.parse(rlp.decode(await StateData.get(Trie.en_key(validator))));
  if(pay_state.contents.token!=key_currency||validator_state.contents.token!=key_currency) return stateroot;
  pay_state.amount -= fee;
  validator_state.amount += fee;
  await StateData.set(Trie.en_key(pay_state.hash),rlp.encode(JSON.stringify(pay_state)));
  await StateData.set(Trie.en_key(validator_state.hash),rlp.encode(JSON.stringify(validator_state)));
  const new_root = await StateData.flush();
  return new_root;
}*/
function AcceptRequestTx(tx, chain, validator, stateroot, request_root, key_currency) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        var StateData, for_fee_state, validator_fee_payed, new_stateroot;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    StateData = new RadixTree({
                        db: db,
                        root: stateroot
                    });
                    return [4 /*yield*/, map([tx.contents.data.solvency, validator], function (key) { return __awaiter(_this, void 0, void 0, function () {
                            var state, _a, _b, _c, _d;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        _b = (_a = JSON).parse;
                                        _d = (_c = rlp).decode;
                                        return [4 /*yield*/, StateData.get(Trie.en_key(key))];
                                    case 1: return [4 /*yield*/, _b.apply(_a, [_d.apply(_c, [_e.sent()])])];
                                    case 2:
                                        state = _e.sent();
                                        return [2 /*return*/, state];
                                }
                            });
                        }); })];
                case 1:
                    for_fee_state = _a.sent();
                    return [4 /*yield*/, Fee_to_Validator(for_fee_state[0], for_fee_state[1], Buffer.from(JSON.stringify(tx)).length, key_currency)];
                case 2:
                    validator_fee_payed = _a.sent();
                    return [4 /*yield*/, StateData.set(Trie.en_key(_.toHash(JSON.stringify(validator_fee_payed[0].contents))), rlp.encode(JSON.stringify(validator_fee_payed[0])))];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, StateData.set(Trie.en_key(_.toHash(JSON.stringify(validator_fee_payed[1].contents))), rlp.encode(JSON.stringify(validator_fee_payed[1])))];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, StateData.flush()];
                case 5:
                    new_stateroot = _a.sent();
                    return [2 /*return*/, [new_stateroot, request_root]];
            }
        });
    });
}
exports.AcceptRequestTx = AcceptRequestTx;
function AcceptRefreshTx(tx, chain, validator, index, stateroot, request_root, key_currency) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        var request_tx, new_request_root, StateData, bases, new_state, new_state_hashs, for_fee, for_fee_state, verifier_fee_payed, validator_fee_payed, new_stateroot;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    request_tx = chain[index].transactions.reduce(function (result, t) {
                        if (t.kind == "request" && t.meta.hash == tx.contents.request)
                            return result.concat(t);
                    }, [])[0];
                    return [4 /*yield*/, RefreshRequestRoot(request_tx, tx, index, request_root)];
                case 1:
                    new_request_root = _a.sent();
                    StateData = new RadixTree({
                        db: db,
                        root: stateroot
                    });
                    return [4 /*yield*/, map(request_tx.contents.data.base, function (key) { return __awaiter(_this, void 0, void 0, function () {
                            var state, _a, _b, _c, _d;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        _b = (_a = JSON).parse;
                                        _d = (_c = rlp).decode;
                                        return [4 /*yield*/, StateData.get(Trie.en_key(key))];
                                    case 1:
                                        state = _b.apply(_a, [_d.apply(_c, [_e.sent()])]);
                                        return [2 /*return*/, state];
                                }
                            });
                        }); })];
                case 2:
                    bases = _a.sent();
                    new_state = NewState(request_tx, bases);
                    new_state_hashs = new_state.map(function (state) {
                        return state.hash;
                    });
                    for_fee = [request_tx.contents.data.solvency, tx.contents.payee, validator].map(function (key) {
                        var index = new_state_hashs.indexOf(key);
                        if (index == -1)
                            return key;
                        else
                            return new_state_hashs[index];
                    });
                    return [4 /*yield*/, map(for_fee, function (key) { return __awaiter(_this, void 0, void 0, function () {
                            var state, _a, _b, _c, _d;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        _b = (_a = JSON).parse;
                                        _d = (_c = rlp).decode;
                                        return [4 /*yield*/, StateData.get(Trie.en_key(key))];
                                    case 1:
                                        state = _b.apply(_a, [_d.apply(_c, [_e.sent()])]);
                                        return [2 /*return*/, state];
                                }
                            });
                        }); })];
                case 3:
                    for_fee_state = _a.sent();
                    return [4 /*yield*/, Fee_to_Verifier(for_fee_state[0], for_fee_state[1], request_tx.contents.data.fee, key_currency)];
                case 4:
                    verifier_fee_payed = _a.sent();
                    return [4 /*yield*/, Fee_to_Validator(verifier_fee_payed[1], for_fee_state[2], Buffer.from(JSON.stringify(tx)).length, key_currency)];
                case 5:
                    validator_fee_payed = _a.sent();
                    return [4 /*yield*/, StateData.set(Trie.en_key(_.toHash(JSON.stringify(verifier_fee_payed[0].contents))), rlp.encode(JSON.stringify(verifier_fee_payed[0])))];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, StateData.set(Trie.en_key(_.toHash(JSON.stringify(validator_fee_payed[0].contents))), rlp.encode(JSON.stringify(validator_fee_payed[0])))];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, StateData.set(Trie.en_key(_.toHash(JSON.stringify(validator_fee_payed[1].contents))), rlp.encode(JSON.stringify(validator_fee_payed[1])))];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, StateData.flush()];
                case 9:
                    new_stateroot = _a.sent();
                    return [2 /*return*/, [new_stateroot, new_request_root]];
            }
        });
    });
}
exports.AcceptRefreshTx = AcceptRefreshTx;
/*
async function get_raws(node,states:StateSet.State[]){
  await node.on('ready');
  const result = await map(states,async (state:StateSet.State)=>{
    const ipfshash:string = state.contents.data.ipfshash;
    const cated = await node.cat(ipfshash);
    return cated.toString('utf-8');
  });
  return result;
}

async function ValidTx(tx:Tx,dag_root:string,stateroot:string){
  const hash = tx.meta.hash;
  const signature = tx.meta.signature;
  const evidence = tx.meta.evidence;
  const purehash = tx.data.purehash;
  const address = tx.data.contents.address;
  const pub_key = tx.data.contents.pub_key;
  const timestamp = tx.data.contents.timestamp;
  const type = tx.data.contents.type;
  const token = tx.data.contents.token;
  const input = tx.data.contents.input;
  const output = tx.data.contents.output;
  const new_token = tx.data.contents.new_token;
  const pre = tx.data.contents.pre;

  const date = new Date();

  const DagData = new RadixTree({
    db: db,
    root: dag_root
  });

  const StateData = new RadixTree({
    db: db,
    root: stateroot
  });

  const unit:DagSet.Unit = await DagData.get(Trie.en_key(evidence));

  const input_state = await reduce(unit.contents.input.token_id,async (array:StateSet.State[],id:string)=>{
    const geted:StateSet.State = await StateData.get(Trie.en_key(id));
    if(geted!=null) return array.concat(geted);
    else return array;
  },[]);

  const state_check = await output.some((state:StateSet.State,i:number)=>{
    return state.contents.data.selfhash!=_.toHash(this[i]) || Buffer.from(JSON.stringify(state.contents.tag)).length>1000;
  },await get_raws(IpfsSet.node,output));

  const pre_amount = input_state.reduce((sum:number,state:StateSet.State)=>{
    return sum + state.amount;
  },0);

  const new_amount = output.reduce((sum:number,state:StateSet.State)=>{
    return sum + state.amount;
  },0);

  if(hash!=_.toHash(JSON.stringify(tx.data))){
    console.log("invalid hash");
    return false;
  }
  else if (address!=token&&CryptoSet.verifyData(hash,signature,pub_key)==false){
    console.log("invalid signature");
    return false;
  }
  else if(unit.contents.output.tx.indexOf(_.toHash(JSON.stringify(tx.data))) == -1||address!=unit.contents.address){
    console.log("invalid evidence");
    return false;
  }
  else if(purehash!=_.toHash(JSON.stringify(tx.data.contents))){
    console.log("invalid purehash");
    return false;
  }
  else if(address!=token&&!address.match(/^PH/)){
    console.log("invalid address");
    return false;
  }
  else if(address!=token&&address!=CryptoSet.AddressFromPublic(pub_key)){
    console.log("invalid pub_key");
    return false;
  }
  else if(timestamp>date.getTime()){
    console.log("invalid timestamp");
    return false;
  }
  /*else if(token!=t_state.token){
    console.log("invalid token name");
    return false;
  }*/
/*else if(input.length!=input_state.length){
  console.log("invalid input");
  return false;
}
else if(state_check){
  console.log("invalid output");
  return false;
}
else if(type=='issue'&&pre_amount>=new_amount){
  console.log("invalid type");
  return false;
}
else if(type=='change'&&pre_amount!=new_amount){
  console.log("invalid type");
  return false;
}
else if(type=='scrap'&&pre_amount<=new_amount){
  console.log("invalid type");
  return false;
}
else{
  return true;
}
}
*/
