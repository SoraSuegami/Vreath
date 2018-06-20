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
const StateSet = __importStar(require("./state"));
const { map, reduce, filter, forEach, find, some } = require('p-iteration');
//const RadixTree = require('dfinity-radix-tree');
//const levelup = require('levelup');
//const leveldown = require('leveldown');
//const db = levelup(leveldown('./db/state'));
const rlp = require('rlp');
const CryptoSet = require('./crypto_set.js');
/*type TxMeta = {
  hash:string;
  signature:string;
  evidence:string;
}*/
/*type TxMeta = {
  hash:string;
  signature:string;
}

type TxContents = {
  address:string;
  pub_key:string;
  timestamp:number;
  type:TxTypes;
  token:string;
  input:string[];
  output:StateSet.State[];
  new_token:StateSet.Token[];
  pre:string;
}

export type TxData = {
  purehash:string;
  contents:TxContents;
}

/*export type Tx = {
  meta:TxMeta;
  data:TxData;
}*/
/*export type RequestData = {
  address:string;
  pub_key:string;
  timestamp:number;
  fee:number;
  solvency:string;
  type:TxTypes;
  token:string;
  base:string[];
  input_hash:string;
  output:StateSet.State[];
  new_token:StateSet.Token[];
}

type RequestContents = {
  purehash:string;
  pre:string;
  next:string;
  data:RequestData;
}

export type RequestTx = {
  kind:"request";
  meta:TxMeta;
  contents:RequestContents;
  input_raw:any[];
  code:string[];
}

export type RefreshContents = {
  address:string;
  pub_key:string;
  timestamp:number;
  request:string;
  index:number;
  payee:string;
}

export type RefreshTx = {
  kind:"refresh";
  meta:TxMeta;
  contents:RefreshContents;
  evidence:string;
}

export type Tx = RequestTx | RefreshTx;*/
async function ValidRequestTx(tx, tag_limit, key_currency, fee_by_size, StateData, RequestsAlias) {
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
    const stateroot = StateData.now_root();
    const solvency_state = await StateData.get(solvency);
    const base_state = await reduce(base, async (array, id) => {
        const geted = await StateData.get(id);
        if (Object.keys(geted).length != 0)
            return array.concat(geted);
        else
            return array;
    }, []);
    const amount_result = output.reduce((sum, state) => {
        return Number(sum) + Number(state.amount);
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
    const base_check = await some(output, async (state) => {
        const pre_state = await StateData.get(state.hash);
        return Object.keys(pre_state).length != 0 && base.indexOf(state.hash) == -1;
    });
    /*await forEach(base, async (key:string)=>{
      await StateData.delete(key);
    })*/
    const requested_check = await some(base, async (key) => {
        const requested = await RequestsAlias.get(key);
        if (Object.keys(requested).length == 0)
            return false;
        else if (requested.req.state == "yet")
            return false;
        else
            return true;
    });
    const state_check = new_state.some((state, index) => {
        if (state.hash == solvency_state.hash) {
            state.amount -= (fee + fee_by_size * Buffer.from(JSON.stringify(tx)).length);
        }
        return state.amount < 0 || (base_state[index] != null && base_state[index].contents.owner != state.contents.owner) || Buffer.from(JSON.stringify(state.contents.tag)).length > tag_limit || ![0, 128].includes(Buffer.from(state.contents.data).length);
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
    else if (solvency_state.contents.token != key_currency || solvency_state.amount < fee + fee_by_size * Buffer.from(JSON.stringify(tx)).length) {
        console.log("invalid solvency");
        return false;
    }
    else if (base.length != base_state.length || base_check) {
        console.log("invalid base");
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
    else if (requested_check) {
        console.log("some states are already requested");
        return false;
    }
    else if (state_check) {
        console.log("invalid result");
        return false;
    }
    else {
        return true;
    }
}
exports.ValidRequestTx = ValidRequestTx;
/*function isRequest(tx:Tx):tx is RequestTx{
  tx.contents.data
}*/
//const isRequest = (tx:Tx):tx is RequestTx => tx.kind === "request";
async function ValidRefreshTx(tx, chain, key_currency, fee_by_size, tag_limit, StateData, DagData, RequestsAlias) {
    //console.log("validrefresh")
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
    //await db.close();
    //await db.open();
    const unit = await DagData.get(evidence);
    console.log(unit);
    const request_tx = chain[index].transactions.reduce((result, tx) => {
        if (tx.kind == "request" && tx.meta.hash == request)
            return result.concat(tx);
        else
            return result;
    }, [])[0];
    const token = request_tx.contents.data.token;
    //await db.close();
    //await db.open();
    //console.log(await StateData.get(tx.contents.payee))
    const payee_state = await StateData.get(tx.contents.payee);
    //console.log(payee_state)
    const solvency_state = await StateData.get(request_tx.contents.data.solvency);
    const base_state = await reduce(request_tx.contents.data.base, async (array, id) => {
        const geted = await StateData.get(id);
        if (geted != null)
            return array.concat(geted);
        else
            return array;
    }, []);
    const new_request_state = ((tx, bases) => {
        const type = tx.contents.data.type;
        if (type == "issue")
            return TxIsuue(tx, bases);
        else if (type == "change")
            return TxChange(tx, bases);
        else if (type == "scrap")
            return TxScrap(tx, bases);
        else
            return bases;
    })(request_tx, base_state);
    const fee = request_tx.contents.data.fee;
    const refreshed_check = await some(new_request_state, async (state) => {
        const key = state.hash;
        const aliase = await RequestsAlias.get(key);
        return Object.keys(aliase).length != 0 && aliase.ref.state == "already";
    });
    /*await forEach(base, async (key:string)=>{
      await StateData.delete(key);
    })*/
    const state_check = new_request_state.some((state) => {
        if (state.hash == solvency_state.hash) {
            state.amount -= (fee + fee_by_size * Buffer.from(JSON.stringify(tx)).length);
        }
        else if (state.hash == payee_state.hash) {
            state.amount -= ((-1) * fee + fee_by_size * Buffer.from(JSON.stringify(tx)).length);
        }
        return state.amount < 0 || Buffer.from(JSON.stringify(state.contents.tag)).length > tag_limit || ![0, 128].includes(Buffer.from(state.contents.data).length);
    });
    //const get_request = await RequestsAlias.get(request_tx.meta.hash);
    if (hash != _.toHash(JSON.stringify(tx.contents))) {
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
    else if (_.toHash(JSON.stringify(unit.contents.data)) != _.toHash(JSON.stringify(tx.contents))) {
        console.log(unit);
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
        console.log("invalid base");
        return false;
    }
    else if (refreshed_check) {
        console.log("This request is already refreshed");
        return false;
    }
    else if (state_check) {
        console.log("invalid result");
        return false;
    }
    else {
        return true;
    }
}
exports.ValidRefreshTx = ValidRefreshTx;
function ChangeState(amount, contents) {
    return StateSet.CreateState(amount, contents.owner, contents.token, contents.tag, contents.data, contents.product);
}
exports.ChangeState = ChangeState;
function TxIsuue(tx, bases) {
    if (tx.contents.data.type != "issue")
        return bases;
    const outputs = tx.contents.data.output;
    const refreshed = bases.map((state, i) => {
        const target = outputs[i];
        return ChangeState(state.amount + target.amount, target.contents);
    });
    return refreshed.concat(outputs.slice(bases.length, outputs.length));
}
function TxChange(tx, bases) {
    if (tx.contents.data.type != "change")
        return bases;
    const outputs = tx.contents.data.output;
    //console.log(bases)
    //console.log(outputs)
    const refreshed = bases.map((state, i) => {
        const target = outputs[i];
        return ChangeState(Number(state.amount) + Number(target.amount), target.contents);
    });
    //console.log(refreshed);
    return refreshed.concat(outputs.slice(bases.length, outputs.length));
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
async function RequestRequestRoot(request, index, Aliases) {
    const req = {
        state: "already",
        index: index,
        hash: request.meta.hash
    };
    const ref = {
        state: "yet",
        index: index,
        hash: request.meta.hash
    };
    const obj = {
        req: req,
        ref: ref
    };
    await forEach(request.contents.data.base, async (key) => {
        await Aliases.delete(key);
        await Aliases.put(key, obj);
    });
    return Aliases;
}
async function RefreshRequestRoot(request, refresh, index, Aliases) {
    const req = {
        state: "yet",
        index: index,
        hash: refresh.meta.hash
    };
    const ref = {
        state: "already",
        index: index,
        hash: refresh.meta.hash
    };
    const obj = {
        req: req,
        ref: ref
    };
    await forEach(request.contents.data.output, async (state) => {
        await Aliases.delete(state.hash);
        await Aliases.put(state.hash, obj);
    });
    return Aliases;
}
/*
async function RefreshRequestRoot(request:T.RequestTx,refresh:T.RefreshTx,index:number,Aliases:Trie){
  console.log(Aliases.now_root())
  if(request.meta.hash!=refresh.contents.request) return Aliases;
  const new_Aliases =
  const alias:T.RequestsAlias = {
    index: index,
    hash: refresh.meta.hash
  };
  await Aliases.put(request.meta.hash,alias);
  console.log(await Aliases.filter());
  return Aliases;
}*/
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
async function Fee_to_Verifier(solvency, payee, fee, key_currency) {
    if (solvency.contents.token != key_currency || payee.contents.token != key_currency || solvency.hash == payee.hash)
        return [solvency, payee];
    solvency.amount -= fee;
    payee.amount += fee;
    return [solvency, payee];
}
async function Fee_to_Validator(pay_state, validator_state, fee, key_currency) {
    if (pay_state.contents.token != key_currency || validator_state.contents.token != key_currency || pay_state.hash == validator_state.hash)
        return [pay_state, validator_state];
    pay_state.amount -= fee;
    validator_state.amount += fee;
    return [pay_state, validator_state];
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
async function AcceptRequestTx(tx, chain, validator, key_currency, fee_by_size, StateData, RequestData) {
    const for_fee_state = await map([tx.contents.data.solvency, validator], async (key) => {
        const state = await StateData.get(key);
        return state;
    });
    const validator_fee_payed = await Fee_to_Validator(for_fee_state[0], for_fee_state[1], fee_by_size * Buffer.from(JSON.stringify(tx)).length, key_currency);
    await StateData.put(_.toHash(JSON.stringify(validator_fee_payed[0].contents)), validator_fee_payed[0]);
    await StateData.put(_.toHash(JSON.stringify(validator_fee_payed[1].contents)), validator_fee_payed[1]);
    const new_RequestData = await RequestRequestRoot(tx, chain.length, RequestData);
    return [StateData, new_RequestData];
}
exports.AcceptRequestTx = AcceptRequestTx;
async function AcceptRefreshTx(tx, chain, validator, key_currency, fee_by_size, StateData, RequestData) {
    const index = tx.contents.index;
    const request_tx = chain[index].transactions.reduce((result, t) => {
        if (t.kind == "request" && t.meta.hash == tx.contents.request)
            return result.concat(t);
        else
            return result;
    }, [])[0];
    const for_fee = [request_tx.contents.data.solvency, tx.contents.payee, validator];
    const for_fee_state = await map(for_fee, async (key) => {
        const state = await StateData.get(key);
        return state;
    });
    console.log("for_fee_state:");
    console.log(for_fee_state);
    const verifier_fee_payed = await Fee_to_Verifier(for_fee_state[0], for_fee_state[1], request_tx.contents.data.fee, key_currency);
    const validator_fee_payed = await Fee_to_Validator(verifier_fee_payed[1], for_fee_state[2], fee_by_size * Buffer.from(JSON.stringify(tx)).length, key_currency);
    const states_for_fee = [verifier_fee_payed[0], validator_fee_payed[0], validator_fee_payed[1]];
    const hash_for_fee = states_for_fee.map((state) => {
        return _.toHash(JSON.stringify(state.contents));
    });
    await StateData.put(hash_for_fee[0], states_for_fee[0]);
    await StateData.put(hash_for_fee[1], states_for_fee[1]);
    await StateData.put(hash_for_fee[2], states_for_fee[2]);
    const bases = await map(request_tx.contents.data.base, async (key) => {
        const state = await StateData.get(key);
        const already = hash_for_fee.indexOf(state.hash);
        if (already != -1)
            return states_for_fee[already];
        else
            return state;
    });
    const new_state = NewState(request_tx, bases);
    await forEach(request_tx.contents.data.base, async (key) => {
        await StateData.delete(key);
    });
    await forEach(new_state, async (state) => {
        await StateData.put(state.hash, state);
    });
    const new_RequestData = await RefreshRequestRoot(request_tx, tx, chain.length, RequestData);
    return [StateData, new_RequestData];
}
exports.AcceptRefreshTx = AcceptRefreshTx;
async function CreateRequestTx(password, pre, next, pub_key, fee, solvency, type, token, base, input, new_token = [], code = [], result, StateData) {
    const address = CryptoSet.AddressFromPublic(pub_key);
    const date = new Date();
    const timestamp = date.getTime();
    const input_hash = _.toHash(JSON.stringify(input));
    const pre_1 = {
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
    const base_state = await map(base, async (key) => {
        const state = await StateData.get(key);
        return state;
    });
    //const output = NewState(pre_1,base_state);
    /*const pre_2 = ((pre_1,output)=>{
      pre_1.contents.data.output = output;
      return pre_1
    })(pre_1,output);*/
    const purehash = _.toHash(JSON.stringify(pre_1.contents.data));
    const pre_2 = ((pre_1, purehash) => {
        pre_1.contents.purehash = purehash;
        return pre_1;
    })(pre_1, purehash);
    const hash = _.toHash(JSON.stringify(pre_2.contents));
    const signature = CryptoSet.SignData(hash, password);
    const tx = ((pre_2, hash, signature) => {
        pre_2.meta.hash = hash;
        pre_2.meta.signature = signature;
        return pre_2;
    })(pre_2, hash, signature);
    return tx;
}
exports.CreateRequestTx = CreateRequestTx;
function CreateRefreshTx(password, unit) {
    const contents = unit.contents.data;
    const hash = _.toHash(JSON.stringify(contents));
    const signature = CryptoSet.SignData(hash, password);
    const evidence = unit.meta.hash;
    const tx = {
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
