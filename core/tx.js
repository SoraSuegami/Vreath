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
var StateSet = require("./state");
var _a = require('p-iteration'), map = _a.map, reduce = _a.reduce, filter = _a.filter, forEach = _a.forEach, find = _a.find, some = _a.some;
//const RadixTree = require('dfinity-radix-tree');
//const levelup = require('levelup');
//const leveldown = require('leveldown');
//const db = levelup(leveldown('./db/state'));
var IPFS = require('ipfs');
var rlp = require('rlp');
var CryptoSet = require('./crypto_set.js');
function ValidRequestTx(tx, tag_limit, key_currency, fee_by_size, StateData) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        var hash, signature, input_raw, code, purehash, pre, next, address, pub_key, timestamp, fee, solvency, type, token, base, input_hash, output, new_token, date, stateroot, solvency_state, base_state, amount_result, new_state, base_check, state_check;
        return __generator(this, function (_a) {
            switch (_a.label) {
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
                    stateroot = StateData.now_root();
                    return [4 /*yield*/, StateData.get(solvency)];
                case 1:
                    solvency_state = _a.sent();
                    return [4 /*yield*/, reduce(base, function (array, id) { return __awaiter(_this, void 0, void 0, function () {
                            var geted;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, StateData.get(id)];
                                    case 1:
                                        geted = _a.sent();
                                        if (Object.keys(geted).length != 0)
                                            return [2 /*return*/, array.concat(geted)];
                                        else
                                            return [2 /*return*/, array];
                                        return [2 /*return*/];
                                }
                            });
                        }); }, [])];
                case 2:
                    base_state = _a.sent();
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
                    return [4 /*yield*/, some(output, function (state) { return __awaiter(_this, void 0, void 0, function () {
                            var pre_state;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, StateData.get(state.hash)];
                                    case 1:
                                        pre_state = _a.sent();
                                        return [2 /*return*/, Object.keys(pre_state).length != 0 && base.indexOf(state.hash) == -1];
                                }
                            });
                        }); })];
                case 3:
                    base_check = _a.sent();
                    state_check = new_state.some(function (state, index) {
                        if (state.hash == solvency_state.hash) {
                            state.amount -= (fee + Buffer.from(JSON.stringify(tx)).length);
                        }
                        return state.amount < 0 || (base_state[index] != null && base_state[index].contents.owner != state.contents.owner) || Buffer.from(JSON.stringify(state.contents.tag)).length > tag_limit || ![0, 128].includes(Buffer.from(state.contents.data).length);
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
                    else if (solvency_state.contents.token != key_currency || solvency_state.amount < fee + Buffer.from(JSON.stringify(tx)).length) {
                        console.log("invalid solvency");
                        return [2 /*return*/, false];
                    }
                    else if (base.length != base_state.length || base_check) {
                        console.log("invalid base");
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
function ValidRefreshTx(tx, chain, key_currency, fee_by_size, tag_limit, StateData, DagData, RequestsAlias) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        var hash, signature, evidence, address, pub_key, timestamp, request, index, payee, date, unit, request_tx, token, payee_state, solvency_state, base_state, new_request_state, fee, state_check, get_request;
        return __generator(this, function (_a) {
            switch (_a.label) {
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
                    return [4 /*yield*/, DagData.get(evidence)];
                case 1:
                    unit = _a.sent();
                    console.log(unit);
                    request_tx = chain[index].transactions.reduce(function (result, tx) {
                        if (tx.kind == "request" && tx.meta.hash == request)
                            return result.concat(tx);
                    }, [])[0];
                    token = request_tx.contents.data.token;
                    return [4 /*yield*/, StateData.get(tx.contents.payee)];
                case 2:
                    payee_state = _a.sent();
                    return [4 /*yield*/, StateData.get(request_tx.contents.data.solvency)];
                case 3:
                    solvency_state = _a.sent();
                    return [4 /*yield*/, reduce(request_tx.contents.data.base, function (array, id) { return __awaiter(_this, void 0, void 0, function () {
                            var geted;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, StateData.get(id)];
                                    case 1:
                                        geted = _a.sent();
                                        if (geted != null)
                                            return [2 /*return*/, array.concat(geted)];
                                        else
                                            return [2 /*return*/, array];
                                        return [2 /*return*/];
                                }
                            });
                        }); }, [])];
                case 4:
                    base_state = _a.sent();
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
                        return state.amount < 0 || Buffer.from(JSON.stringify(state.contents.tag)).length > tag_limit || ![0, 128].includes(Buffer.from(state.contents.data).length);
                    });
                    return [4 /*yield*/, RequestsAlias.get(request_tx.meta.hash)];
                case 5:
                    get_request = _a.sent();
                    if (hash != _.toHash(JSON.stringify(tx.contents))) {
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
                    else if (_.toHash(JSON.stringify(unit.contents.data)) != _.toHash(JSON.stringify(tx.contents))) {
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
                        console.log("invalid base");
                        return [2 /*return*/, false];
                    }
                    else if (state_check) {
                        console.log("invalid result");
                        return [2 /*return*/, false];
                    }
                    else if (Object.keys(get_request) != 0) {
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
function ChangeState(amount, contents) {
    return StateSet.CreateState(amount, contents.owner, contents.token, contents.tag, contents.data, contents.product);
}
exports.ChangeState = ChangeState;
function TxIsuue(tx, bases) {
    if (tx.contents.data.type != "issue")
        return bases;
    var outputs = tx.contents.data.output;
    var refreshed = bases.map(function (state, i) {
        var target = outputs[i];
        return ChangeState(state.amount + target.amount, target.contents);
    });
    return refreshed.concat(outputs.slice(outputs.length - 1));
}
function TxChange(tx, bases) {
    if (tx.contents.data.type != "change")
        return bases;
    var outputs = tx.contents.data.output;
    var refreshed = bases.map(function (state, i) {
        var target = outputs[i];
        return ChangeState(state.amount + target.amount, target.contents);
    });
    return refreshed.concat(outputs.slice(outputs.length - 1));
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
        return ChangeState(state.amount + output.amount, output.contents);
        ;
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
function RefreshRequestRoot(request, refresh, index, Aliases) {
    return __awaiter(this, void 0, void 0, function () {
        var alias, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log(Aliases.now_root());
                    if (request.meta.hash != refresh.contents.request)
                        return [2 /*return*/, Aliases];
                    alias = {
                        index: index,
                        hash: refresh.meta.hash
                    };
                    return [4 /*yield*/, Aliases.put(request.meta.hash, alias)];
                case 1:
                    _c.sent();
                    _b = (_a = console).log;
                    return [4 /*yield*/, Aliases.filter()];
                case 2:
                    _b.apply(_a, [_c.sent()]);
                    return [2 /*return*/, Aliases];
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
            if (solvency.hash == payee.hash)
                payee.amount = solvency.amount;
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
            if (pay_state.hash == validator_state.hash)
                validator_state.amount = pay_state.amount;
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
function AcceptRequestTx(tx, chain, validator, key_currency, StateData, RequestData) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        var for_fee_state, validator_fee_payed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, map([tx.contents.data.solvency, validator], function (key) { return __awaiter(_this, void 0, void 0, function () {
                        var state;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, StateData.get(key)];
                                case 1:
                                    state = _a.sent();
                                    return [2 /*return*/, state];
                            }
                        });
                    }); })];
                case 1:
                    for_fee_state = _a.sent();
                    return [4 /*yield*/, Fee_to_Validator(for_fee_state[0], for_fee_state[1], Buffer.from(JSON.stringify(tx)).length, key_currency)];
                case 2:
                    validator_fee_payed = _a.sent();
                    return [4 /*yield*/, StateData.put(_.toHash(JSON.stringify(validator_fee_payed[0].contents)), validator_fee_payed[0])];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, StateData.put(_.toHash(JSON.stringify(validator_fee_payed[1].contents)), validator_fee_payed[1])];
                case 4:
                    _a.sent();
                    return [2 /*return*/, [StateData, RequestData]];
            }
        });
    });
}
exports.AcceptRequestTx = AcceptRequestTx;
function AcceptRefreshTx(tx, chain, validator, key_currency, StateData, RequestData) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        var index, request_tx, for_fee, for_fee_state, verifier_fee_payed, validator_fee_payed, states_for_fee, hash_for_fee, bases, new_state, new_request;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    index = tx.contents.index;
                    request_tx = chain[index].transactions.reduce(function (result, t) {
                        if (t.kind == "request" && t.meta.hash == tx.contents.request)
                            return result.concat(t);
                    }, [])[0];
                    for_fee = [request_tx.contents.data.solvency, tx.contents.payee, validator];
                    return [4 /*yield*/, map(for_fee, function (key) { return __awaiter(_this, void 0, void 0, function () {
                            var state;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, StateData.get(key)];
                                    case 1:
                                        state = _a.sent();
                                        return [2 /*return*/, state];
                                }
                            });
                        }); })];
                case 1:
                    for_fee_state = _a.sent();
                    return [4 /*yield*/, Fee_to_Verifier(for_fee_state[0], for_fee_state[1], request_tx.contents.data.fee, key_currency)];
                case 2:
                    verifier_fee_payed = _a.sent();
                    return [4 /*yield*/, Fee_to_Validator(verifier_fee_payed[1], for_fee_state[2], Buffer.from(JSON.stringify(tx)).length, key_currency)];
                case 3:
                    validator_fee_payed = _a.sent();
                    states_for_fee = [verifier_fee_payed[0], validator_fee_payed[0], validator_fee_payed[1]];
                    hash_for_fee = states_for_fee.map(function (state) {
                        return _.toHash(JSON.stringify(state.contents));
                    });
                    return [4 /*yield*/, StateData.put(hash_for_fee[0], states_for_fee[0])];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, StateData.put(hash_for_fee[1], states_for_fee[1])];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, StateData.put(hash_for_fee[2], states_for_fee[2])];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, map(request_tx.contents.data.base, function (key) { return __awaiter(_this, void 0, void 0, function () {
                            var state, already;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, StateData.get(key)];
                                    case 1:
                                        state = _a.sent();
                                        already = hash_for_fee.indexOf(state.hash);
                                        if (already != -1)
                                            return [2 /*return*/, states_for_fee[already]];
                                        else
                                            return [2 /*return*/, state];
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 7:
                    bases = _a.sent();
                    new_state = NewState(request_tx, bases);
                    return [4 /*yield*/, forEach(new_state, function (state) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, StateData.put(state.hash, state)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, RefreshRequestRoot(request_tx, tx, index, RequestData)];
                case 9:
                    new_request = _a.sent();
                    return [2 /*return*/, [StateData, RequestData]];
            }
        });
    });
}
exports.AcceptRefreshTx = AcceptRefreshTx;
function CreateRequestTx(password, pre, next, pub_key, fee, solvency, type, token, base, input, new_token, code, result, StateData) {
    if (new_token === void 0) { new_token = []; }
    if (code === void 0) { code = []; }
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        var address, date, timestamp, input_hash, pre_1, base_state, purehash, pre_2, hash, signature, tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    address = CryptoSet.AddressFromPublic(pub_key);
                    date = new Date();
                    timestamp = date.getTime();
                    input_hash = _.toHash(JSON.stringify(input));
                    pre_1 = {
                        kind: "request",
                        meta: {
                            hash: "",
                            signature: ""
                        },
                        contents: {
                            purehash: "",
                            pre: pre,
                            next: next,
                            data: {
                                address: address,
                                pub_key: pub_key,
                                timestamp: timestamp,
                                fee: fee,
                                solvency: solvency,
                                type: type,
                                token: token,
                                base: base,
                                input_hash: input_hash,
                                output: result,
                                new_token: new_token
                            }
                        },
                        input_raw: input,
                        code: code
                    };
                    return [4 /*yield*/, map(base, function (key) { return __awaiter(_this, void 0, void 0, function () {
                            var state;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, StateData.get(key)];
                                    case 1:
                                        state = _a.sent();
                                        return [2 /*return*/, state];
                                }
                            });
                        }); })];
                case 1:
                    base_state = _a.sent();
                    purehash = _.toHash(JSON.stringify(pre_1.contents.data));
                    pre_2 = (function (pre_1, purehash) {
                        pre_1.contents.purehash = purehash;
                        return pre_1;
                    })(pre_1, purehash);
                    hash = _.toHash(JSON.stringify(pre_2.contents));
                    signature = CryptoSet.SignData(hash, password);
                    tx = (function (pre_2, hash, signature) {
                        pre_2.meta.hash = hash;
                        pre_2.meta.signature = signature;
                        return pre_2;
                    })(pre_2, hash, signature);
                    return [2 /*return*/, tx];
            }
        });
    });
}
exports.CreateRequestTx = CreateRequestTx;
function CreateRefreshTx(password, unit) {
    var contents = unit.contents.data;
    var hash = _.toHash(JSON.stringify(contents));
    var signature = CryptoSet.SignData(hash, password);
    var evidence = unit.meta.hash;
    var tx = {
        kind: "refresh",
        meta: {
            hash: hash,
            signature: signature
        },
        contents: contents,
        evidence: evidence
    };
    return tx;
}
exports.CreateRefreshTx = CreateRefreshTx;
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
