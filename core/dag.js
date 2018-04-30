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
const { map, reduce, filter, forEach, some } = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
const { NodeVM, VMScript } = require('vm2');
const CryptoSet = require('./crypto_set.js');
const node = new IPFS();
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
const HashForUnit = (unit) => {
    return _.toHash(unit.meta.nonce + unit.meta.parenthash + JSON.stringify(unit.contents));
};
const RunCode = (input, token_state, type, raw, db, dag_root, worldroot, addressroot) => {
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
    const vm = new NodeVM({
        sandbox: {
            input: input,
            token_state: token_state,
            DagState: Dag,
            WorldState: World,
            AddressState: Address,
            RawData: raw
        },
        require: {
            external: true,
            root: "./library_for_js.js"
        }
    });
    const code = token_state[type];
    const script = new VMScript("module.exports = (()=>{" + code + "})()");
    const result = vm.run(script);
    return result;
};
function input_raws(node, datahashs) {
    return __awaiter(this, void 0, void 0, function* () {
        yield node.on('ready');
        const result = yield map(datahashs, (hashs) => __awaiter(this, void 0, void 0, function* () {
            const ipfshash = hashs.ipfshash;
            const cated = yield node.cat(ipfshash);
            return cated.toString('utf-8');
        }));
        return result;
    });
}
function ValidUnit(unit, dag_root, parents_dag_root, worldroot, addressroot, block, difficulty, key_currency) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const parent = yield DagData.get(Trie.en_key(parenthash));
        const before_dag_data = new RadixTree({
            db: db,
            root: block.contents.parenthash
        });
        const before_address_data = new RadixTree({
            db: db,
            root: block.contents.addressroot
        });
        const state_hashs = yield before_address_data.get(Trie.en_key(address));
        const balance = yield reduce(state_hashs, (sum, key) => __awaiter(this, void 0, void 0, function* () {
            const state = yield before_dag_data.get(Trie.en_key(key));
            if (state.contents.owner == address && state.contents.token == key_currency) {
                return sum + state.amount;
            }
            else
                return sum;
        }), 0);
        const valid_input_check = yield input.options.some((hashs, i) => {
            return hashs.selfhash != _.toHash(this[i]);
        }, yield input_raws(IpfsSet.node, input.options));
        const valid_log_check = output.log.some((log) => {
            return Buffer.from(JSON.stringify(log)).length > 10000000;
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
        else if (parenthash != parent.meta.hash) {
            console.log("invalid parenthash");
            return false;
        }
        else if (address != token && !address.match(/^PH/)) {
            console.log("invalid address");
            return false;
        }
        else if (timestamp > date.getTime()) {
            console.log("invalid timestamp");
            return false;
        }
        else if (address != token && address != CryptoSet.AddressFromPublic(pub_key)) {
            console.log("invalid pub_key");
            return false;
        }
        else if (last.index != block.contents.index || last.hash != block.meta.hash) {
            console.log("invalid last");
            return false;
        }
        else if (fee < 0 || fee > balance) {
            console.log("invalid fee");
            return false;
        }
        else if (yield valid_input_check) {
            console.log("invalid input");
            return false;
        }
        else if (valid_log_check) {
            console.log("Too big log");
            return false;
        }
        /*else if(others_check){
          console.log("invalid quotation units");
        }*/
        /*else if(_.toHash(JSON.stringify(output))!=_.toHash(JSON.stringify(RunCode(input,t_state,codetype,raw_inputs,db,dag_root,worldroot,addressroot)))){
          console.log("invalid result");
          return false;
        }*/
        else {
            return true;
        }
    });
}
function AddUnittoDag(unit, dag_root, parents_dag_root, worldroot, addressroot, block, difficulty, key_currency) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ValidUnit(unit, dag_root, parents_dag_root, worldroot, addressroot, block, difficulty, key_currency))
            return dag_root;
        const dag = new RadixTree({
            db: db,
            root: dag_root
        });
        const new_dag = yield dag.set(Trie.en_key(unit.meta.hash), unit);
        const new_world_root = yield new_dag.flush();
        return new_world_root;
    });
}
function CreateUnit(password, address, token, pub_key, codetype, input) {
    return __awaiter(this, void 0, void 0, function* () {
    });
}
