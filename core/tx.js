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
const IpfsSet = __importStar(require("./ipfs"));
const { map, reduce, filter, forEach } = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
const CryptoSet = require('./crypto_set.js');
function get_raws(node, states) {
    return __awaiter(this, void 0, void 0, function* () {
        yield node.on('ready');
        const result = yield map(states, (state) => __awaiter(this, void 0, void 0, function* () {
            const ipfshash = state.contents.data.ipfshash;
            const cated = yield node.cat(ipfshash);
            return cated.toString('utf-8');
        }));
        return result;
    });
}
function ValidTx(tx, dag_root, stateroot) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const unit = yield DagData.get(Trie.en_key(evidence));
        const input_state = yield reduce(unit.contents.input.token_id, (array, id) => __awaiter(this, void 0, void 0, function* () {
            const geted = yield StateData.get(Trie.en_key(id));
            if (geted != null)
                return array.concat(geted);
            else
                return array;
        }), []);
        const state_check = yield output.some((state, i) => {
            return state.contents.data.selfhash != _.toHash(this[i]) || Buffer.from(JSON.stringify(state.contents.tag)).length > 1000;
        }, yield get_raws(IpfsSet.node, output));
        const pre_amount = input_state.reduce((sum, state) => {
            return sum + state.amount;
        }, 0);
        const new_amount = output.reduce((sum, state) => {
            return sum + state.amount;
        }, 0);
        if (hash != _.toHash(JSON.stringify(tx.data))) {
            console.log("invalid hash");
            return false;
        }
        else if (address != token && CryptoSet.verifyData(hash, signature, pub_key) == false) {
            console.log("invalid signature");
            return false;
        }
        else if (unit.contents.output.tx.indexOf(_.toHash(JSON.stringify(tx.data))) == -1 || address != unit.contents.address) {
            console.log("invalid evidence");
            return false;
        }
        else if (purehash != _.toHash(JSON.stringify(tx.data.contents))) {
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
        /*else if(token!=t_state.token){
          console.log("invalid token name");
          return false;
        }*/
        else if (input.length != input_state.length) {
            console.log("invalid input");
            return false;
        }
        else if (state_check) {
            console.log("invalid output");
            return false;
        }
        else if (type == 'issue' && pre_amount >= new_amount) {
            console.log("invalid type");
            return false;
        }
        else if (type == 'change' && pre_amount != new_amount) {
            console.log("invalid type");
            return false;
        }
        else if (type == 'scrap' && pre_amount <= new_amount) {
            console.log("invalid type");
            return false;
        }
        else {
            return true;
        }
    });
}
function TxIsuue(tx, inputs) {
    if (tx.data.contents.type != "issue")
        return inputs;
    const outputs = tx.data.contents.output;
    return outputs;
}
function TxChange(tx, inputs) {
    if (tx.data.contents.type != "change")
        return inputs;
    return inputs.map((state, i) => {
        const output = tx.data.contents.output[i];
        state.amount += output.amount;
        state.contents = output.contents;
        return state;
    });
}
function TxScrap(tx, inputs) {
    if (tx.data.contents.type != "scrap")
        return inputs;
    else
        return [];
}
function TxCreate(tx, inputs) {
    if (tx.data.contents.type != "create")
        return inputs;
    const outputs = tx.data.contents.output;
    return outputs;
}
