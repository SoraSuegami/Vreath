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
const { map, reduce, filter, forEach, some } = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
const CryptoSet = require('./crypto_set.js');
function ChildHashs(parent, parents_dag) {
    return __awaiter(this, void 0, void 0, function* () {
        const hashs = yield parents_dag.get(Trie.en_key(parent));
        return hashs;
    });
}
function NotDoubleConfirmed(hash, DagData, parents_dag) {
    return __awaiter(this, void 0, void 0, function* () {
        const children = yield ChildHashs(hash, parents_dag);
        if (children.length == 0)
            return true;
        return yield some(children, (key) => __awaiter(this, void 0, void 0, function* () {
            const grandchildren = yield ChildHashs(key, parents_dag);
            return grandchildren.length == 0;
        }));
    });
}
function SortCandidates(candidates) {
    return candidates.sort((a, b) => {
        return _.get_unicode(a.address) - _.get_unicode(b.address);
    });
}
function elected(sorted, result, now = -1, i = 0) {
    if (result > sorted.length - 1)
        return "";
    const new_now = now + sorted[i].amount;
    if (new_now < result)
        return elected(sorted, result, new_now, i + 1);
    else
        return sorted[i].address;
}
function ValidBlock(block, chain, nowroot, nowaddressroot, dag_root, parents_dag_root) {
    return __awaiter(this, void 0, void 0, function* () {
        const hash = block.meta.hash;
        const validatorSign = block.meta.validatorSign;
        const index = block.contents.index;
        const parenthash = block.contents.parenthash;
        const timestamp = block.contents.timestamp;
        const stateroot = block.contents.stateroot;
        const addressroot = block.contents.addressroot;
        const evidences = block.contents.evidences;
        const validator = block.contents.validator;
        const validatorPub = block.contents.validatorPub;
        const candidates = block.contents.candidates;
        const last = chain[chain.length - 1];
        const date = new Date();
        const DagData = new RadixTree({
            db: db,
            root: dag_root
        });
        const parents_dag = new RadixTree({
            db: db,
            root: parents_dag_root
        });
        const not_confirmed_check = yield some(evidences, (key) => __awaiter(this, void 0, void 0, function* () {
            const check = yield NotDoubleConfirmed(key, DagData, parents_dag);
            return check;
        }));
        const right_validator = elected(SortCandidates(last.contents.candidates), _.get_unicode(block.meta.hash));
        const AddressState = new RadixTree({
            db: db,
            root: nowaddressroot
        });
        const World = new RadixTree({
            db: db,
            root: nowroot
        });
        /*const PnsData = await World.get(Trie.en_key('pns'));
        const pns:AddressAlias[] = await AddressState.get(Trie.en_key('pns'));
        const sacrifice_holders = await reduce(pns,async (result,alias:AddressAlias)=>{
          const state:StateSet.T_state = await PnsData.get(Trie.en_key(alias.key));
          if(result[state.contents.tag.])
        },{});*/
        if (hash != _.toHash(JSON.stringify(block.contents))) {
            console.log("invalid hash");
            return false;
        }
        else if (CryptoSet.verifyData(hash, validatorSign, validatorPub) == false) {
            console.log("invalid signature");
            return false;
        }
        else if (index != chain.length) {
            console.log("invalid index");
            return false;
        }
        else if (parenthash != last.meta.hash) {
            console.log("invalid parenthash");
            return false;
        }
        else if (timestamp > date.getTime()) {
            console.log("invalid timestamp");
            return false;
        }
        else if (stateroot != nowroot) {
            console.log("invalid stateroot");
            return false;
        }
        else if (addressroot != nowaddressroot) {
            console.log("invalid addressroot");
            return false;
        }
        else if (not_confirmed_check) {
            console.log("invalid evidences");
            return false;
        }
        else if (validator != right_validator) {
            console.log("invalid validator");
            return false;
        }
        else if (validator != CryptoSet.AddressFromPublic(validatorPub)) {
            console.log("invalid validator pub_key");
            return false;
        }
    });
}
