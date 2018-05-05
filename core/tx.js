"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("./basic"));
const Trie = __importStar(require("./merkle_patricia"));
const { map, reduce, filter, forEach, find } = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
const rlp = require('rlp');
const CryptoSet = require('./crypto_set.js');
const tag_limit = 10000;
const key_currency = "nix";
function ValidRequestTx(tx, stateroot, tag_limit, key_currency, fee_by_size) {
    return __awaiter(this, void 0, void 0, function* () {
        const hash = tx.meta.hash;
        const signature = tx.meta.signature;
        const input_raw = tx.input_raw;
        const code = tx.code;
        const purehash = tx.contents.purehash;
        const pre = tx.contents.pre;
        const next = tx.contents.next;
        const address = tx.contents.data.address;
        const pub_key = tx.contents.data.pub_key;
        const timestamp = tx.contents.data.timestamp;
        const fee = tx.contents.data.fee;
        const solvency = tx.contents.data.solvency;
        const type = tx.contents.data.type;
        const token = tx.contents.data.token;
        const base = tx.contents.data.base;
        const input_hash = tx.contents.data.input_hash;
        const output = tx.contents.data.output;
        const new_token = tx.contents.data.new_token;
        const date = new Date();
        const StateData = new RadixTree({
            db: db,
            root: stateroot
        });
        const solvency_state = JSON.parse(rlp.decode(yield StateData.get(Trie.en_key(solvency))));
        const base_state = yield reduce(base, (array, id) => __awaiter(this, void 0, void 0, function* () {
            const geted = JSON.parse(rlp.decode(yield StateData.get(Trie.en_key(id))));
            if (geted != null)
                return array.concat(geted);
            else
                return array;
        }), []);
        const amount_result = output.reduce((sum, state) => {
            return sum + state.amount;
        }, 0);
        const new_state = ((tx, bases) => {
            if (type == "issue")
                return TxIsuue(tx, bases);
            else if (type == "change")
                return TxChange(tx, bases);
            else if (type == "scrap")
                return TxScrap(tx, bases);
            else
                return bases;
        })(tx, base_state);
        const state_check = new_state.some((state) => {
            if (state.hash == solvency_state.hash) {
                state.amount -= (fee + Buffer.from(JSON.stringify(tx)).length);
            }
            return state.amount < 0 || Buffer.from(JSON.stringify(state.contents.tag)).length > tag_limit;
        });
        if (hash != _.toHash(JSON.stringify(tx.contents))) {
            console.log("invalid hash");
            return false;
        }
        else if (address != token && CryptoSet.verifyData(hash, signature, pub_key) == false) {
            console.log("invalid signature");
            return false;
        }
        else if (purehash != _.toHash(JSON.stringify(tx.contents.data))) {
            console.log("invalid purehash");
            return false;
        }
        else if ((address != token && !address.match(/^PH/)) || address != token) {
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
        else if (solvency_state.contents.token != key_currency || solvency_state.amount < fee + Buffer.from(JSON.stringify(tx)).length) {
            console.log("invalid solvency");
            return false;
        }
        else if (base.length != base_state.length) {
            console.log("invalid input");
            return false;
        }
        else if (input_hash != _.toHash(JSON.stringify(input_raw))) {
            console.log("invalid input");
            return false;
        }
        else if (type == 'issue' && amount_result <= 0) {
            console.log("invalid type issue");
            return false;
        }
        else if (type == 'change' && amount_result != 0) {
            console.log("invalid type change");
            return false;
        }
        else if (type == 'scrap' && amount_result >= 0) {
            console.log("invalid type scrap");
            return false;
        }
        else if (state_check) {
            console.log("invalid result");
            return false;
        }
        else {
            return true;
        }
    });
}
exports.ValidRequestTx = ValidRequestTx;
/*function isRequest(tx:Tx):tx is RequestTx{
  tx.contents.data
}*/
//const isRequest = (tx:Tx):tx is RequestTx => tx.kind === "request";
function ValidRefreshTx(tx, dag_root, chain, stateroot, request_root, key_currency, fee_by_size) {
    return __awaiter(this, void 0, void 0, function* () {
        const hash = tx.meta.hash;
        const signature = tx.meta.signature;
        const evidence = tx.evidence;
        const address = tx.contents.address;
        const pub_key = tx.contents.pub_key;
        const timestamp = tx.contents.timestamp;
        const request = tx.contents.request;
        const index = tx.contents.index;
        const payee = tx.contents.payee;
        const date = new Date();
        const DagData = new RadixTree({
            db: db,
            root: dag_root
        });
        const unit = JSON.parse(rlp.decode(yield DagData.get(Trie.en_key(evidence))));
        const request_tx = chain[index].transactions.reduce((result, tx) => {
            if (tx.kind == "request" && tx.meta.hash == request)
                return result.concat(tx);
        }, [])[0];
        const token = request_tx.contents.data.token;
        const StateData = new RadixTree({
            db: db,
            root: stateroot
        });
        const payee_state = JSON.parse(rlp.decode(yield StateData.get(Trie.en_key(tx.contents.payee))));
        const solvency_state = JSON.parse(rlp.decode(yield StateData.get(Trie.en_key(request_tx.contents.data.solvency))));
        const base_state = yield reduce(request_tx.contents.data.base, (array, id) => __awaiter(this, void 0, void 0, function* () {
            const geted = JSON.parse(rlp.decode(yield StateData.get(Trie.en_key(id))));
            if (geted != null)
                return array.concat(geted);
            else
                return array;
        }), []);
        const new_request_state = ((tx, bases) => {
            if (type == "issue")
                return TxIsuue(tx, bases);
            else if (type == "change")
                return TxChange(tx, bases);
            else if (type == "scrap")
                return TxScrap(tx, bases);
            else
                return bases;
        })(tx, base_state);
        const state_check = new_request_state.some((state) => {
            if (state.hash == solvency_state.hash) {
                state.amount -= (fee + Buffer.from(JSON.stringify(tx)).length);
            }
            else if (state.hash == payee_state.hash) {
                state.amount -= ((-1) * fee + Buffer.from(JSON.stringify(tx)).length);
            }
            return state.amount < 0 || Buffer.from(JSON.stringify(state.contents.tag)).length > tag_limit;
        });
        const RequestsAlias = new RadixTree({
            db: db,
            root: request_root
        });
        const get_request = yield RequestsAlias.get(Trie.en_key(request_tx.meta.hash));
        if (hash != _.toHash(JSON.stringify(tx.contents))) {
            console.log("invalid hash");
            return false;
        }
        else if (address != token && CryptoSet.verifyData(hash, signature, pub_key) == false) {
            console.log("invalid signature");
            return false;
        }
        else if ((address != token && !address.match(/^PH/)) || address != token) {
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
        else if (unit.contents.data != tx.contents) {
            console.log("invalid evidence");
            return false;
        }
        else if (payee_state.contents.token != key_currency || payee_state.amount < fee_by_size * Buffer.from(JSON.stringify(tx)).length) {
            console.log("invalid payee");
            return false;
        }
        else if (solvency_state.contents.token != key_currency || solvency_state.amount < request_tx.contents.data.fee) {
            console.log("invalid fee");
            return false;
        }
        else if (request_tx.contents.data.base.length != base_state.length) {
            console.log("invalid input");
            return false;
        }
        else if (state_check) {
            console.log("invalid result");
            return false;
        }
        else if (get_request != null) {
            console.log("This request is already refreshed");
            return false;
        }
        else {
            return true;
        }
    });
}
exports.ValidRefreshTx = ValidRefreshTx;
function TxIsuue(tx, bases) {
    if (tx.contents.data.type != "issue")
        return bases;
    const outputs = tx.contents.data.output;
    const refreshed = bases.map((state, i) => {
        const target = outputs[i];
        state.amount += target.amount;
        state.contents = target.contents;
        return state;
    });
    return refreshed.concat(outputs.slice(outputs.length));
}
function TxChange(tx, bases) {
    if (tx.contents.data.type != "change")
        return bases;
    const outputs = tx.contents.data.output;
    const refreshed = bases.map((state, i) => {
        const target = outputs[i];
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
    return bases.map((state, i) => {
        const output = tx.contents.data.output[i];
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
    return __awaiter(this, void 0, void 0, function* () {
        if (request.meta.hash != refresh.contents.request)
            return root;
        const Aliases = new RadixTree({
            db: db,
            root: root
        });
        const alias = {
            index: index,
            hash: refresh.meta.hash
        };
        yield Aliases.set(Trie.en_key(request.meta.hash), rlp.encode(JSON.stringify(alias)));
        const new_root = yield Aliases.flush();
        return new_root;
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
function Fee_to_Verifier(solvency, payee, key_currency) {
    return __awaiter(this, void 0, void 0, function* () {
        if (solvency.contents.token != key_currency || payee.contents.token != key_currency)
            return [solvency, payee];
        solvency.amount -= request.contents.data.fee;
        payee.amount += request.contents.data.fee;
        return [solvency, payee];
    });
}
function Fee_to_Validator(pay_state, validator_state, fee, key_currency) {
    return __awaiter(this, void 0, void 0, function* () {
        if (pay_state.contents.token != key_currency || validator_state.contents.token != key_currency)
            return [pay_state, validator_state];
        pay_state.amount -= fee;
        validator_state.amount += fee;
        return [pay_state, validator_state];
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
function AcceptRequestTx(tx, chain, validator, request_root, key_currency) {
    return __awaiter(this, void 0, void 0, function* () {
        const stateroot = chain[chain.length - 1].contents.stateroot;
        const StateData = new RadixTree({
            db: db,
            root: stateroot
        });
        const for_fee_state = yield map([tx.contents.data.solvency, validator], (key) => __awaiter(this, void 0, void 0, function* () {
            const state = yield JSON.parse(rlp.decode(yield StateData.get(Trie.en_key(key))));
            return state;
        }));
        const validator_fee_payed = yield Fee_to_Validator(for_fee_state[0], for_fee_state[1], Buffer.from(JSON.stringify(tx)).length, key_currency);
        yield StateData.set(Trie.en_key(_.toHash(validator_fee_payed[0].contents)), rlp.encode(JSON.stringify(validator_fee_payed[0])));
        yield StateData.set(Trie.en_key(_.toHash(validator_fee_payed[1].contents)), rlp.encode(JSON.stringify(validator_fee_payed[1])));
        const new_stateroot = yield StateData.flush();
        return [new_stateroot, request_root];
    });
}
exports.AcceptRequestTx = AcceptRequestTx;
function AcceptRefreshTx(tx, chain, validator, index, request_root, key_currency) {
    return __awaiter(this, void 0, void 0, function* () {
        const request_tx = chain[index].transactions.reduce((result, t) => {
            if (t.kind == "request" && t.meta.hash == tx.contents.request)
                return result.concat(t);
        }, [])[0];
        const new_request_root = yield RefreshRequestRoot(request_tx, tx, index, request_root);
        const stateroot = chain[chain.length - 1].contents.stateroot;
        const StateData = new RadixTree({
            db: db,
            root: stateroot
        });
        const bases = yield map(request_tx.contents.data.base, (key) => __awaiter(this, void 0, void 0, function* () {
            const state = JSON.parse(rlp.decode(yield StateData.get(Trie.en_key(key))));
            return state;
        }));
        const new_state = NewState(request_tx, bases);
        const new_state_hashs = new_state.map((state) => {
            return state.hash;
        });
        const for_fee = [request_tx.contents.data.solvency, tx.contents.payee, validator].map((key) => {
            const index = new_state_hashs.indexOf(key);
            if (index == -1)
                return key;
            else
                return new_state_hashs[index];
        });
        const for_fee_state = yield map(for_fee, (key) => __awaiter(this, void 0, void 0, function* () {
            const state = JSON.parse(rlp.decode(yield StateData.get(Trie.en_key(key))));
            return state;
        }));
        const verifier_fee_payed = yield Fee_to_Verifier(for_fee_state[0], for_fee_state[1], key_currency);
        const validator_fee_payed = yield Fee_to_Validator(verifier_fee_payed[1], for_fee_state[2], Buffer.from(JSON.stringify(tx)).length, key_currency);
        yield StateData.set(Trie.en_key(_.toHash(verifier_fee_payed[0].contents)), rlp.encode(JSON.stringify(verifier_fee_payed[0])));
        yield StateData.set(Trie.en_key(_.toHash(validator_fee_payed[0].contents)), rlp.encode(JSON.stringify(validator_fee_payed[0])));
        yield StateData.set(Trie.en_key(_.toHash(validator_fee_payed[1].contents)), rlp.encode(JSON.stringify(validator_fee_payed[1])));
        const new_stateroot = yield StateData.flush();
        return [new_stateroot, new_request_root];
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
