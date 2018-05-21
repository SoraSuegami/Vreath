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
const merkle_patricia_1 = require("./merkle_patricia");
const TxSet = __importStar(require("./tx"));
const R = __importStar(require("ramda"));
const { map, reduce, filter, forEach, some } = require('p-iteration');
//const RadixTree = require('dfinity-radix-tree');
//const levelup = require('levelup');
//const leveldown = require('leveldown');
//const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
const rlp = require('rlp');
const CryptoSet = require('./crypto_set.js');
exports.fee_by_size = 10;
function GetTreeroot(pre) {
    if (pre.length == 0)
        return [_.toHash("")];
    else if (pre.length == 1)
        return pre;
    else {
        const union = pre.reduce((result, val, index, array) => {
            const i = Number(index);
            if (i % 2 == 0) {
                const left = val;
                const right = ((left, i, array) => {
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
    return candidates.sort((a, b) => {
        return HextoNum(a.address) - HextoNum(b.address);
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
/*async function TxCheckintoChain(txs:TxSet.Tx[],parents_dag,used_tx){
  return await some(txs, async (tx:TxSet.Tx)=>{
    const not_confirmed_check = await NotDoubleConfirmed(tx.meta.evidence,parents_dag);
    const used_tx_check = await TxUsed(tx.meta.hash,used_tx);
    return not_confirmed_check==true || used_tx_check==true;
  });
}*/
async function ValidBlock(block, chain, now_stateroot, now_request_root, dag_root, fee_by_size, key_currency, tag_limit, db) {
    await db.open();
    const hash = block.meta.hash;
    const validatorSign = block.meta.validatorSign;
    const index = block.contents.index;
    const parenthash = block.contents.parenthash;
    const timestamp = block.contents.timestamp;
    const stateroot = block.contents.stateroot;
    /*const addressroot = block.contents.addressroot;
    const used_dagroot = block.contents.used_dagroot;
    const used_txroot = block.contents.used_txroot;*/
    const request_root = block.contents.request_root;
    const tx_root = block.contents.tx_root;
    const fee = block.contents.fee;
    const difficulty = block.contents.difficulty;
    const validator = block.contents.validator;
    const validatorPub = block.contents.validatorPub;
    const candidates = block.contents.candidates;
    const txs = block.transactions;
    const last = chain[chain.length - 1];
    const date = new Date();
    /*const DagData = new RadixTree({
      db: db,
      root: dag_root
    });*/
    /*const parents_dag = new RadixTree({
      db: db,
      root: parents_dag_root
    });*/
    /*const AddressState = new RadixTree({
      db: db,
      root: now_addressroot
    });*/
    const StateData = new merkle_patricia_1.Trie(db, now_stateroot);
    /*const UsedTx = new RadixTree({
      db: db,
      root: now_used_txroot
    });*/
    /*const evidences = txs.reduce((result:string[],tx:TxSet.Tx)=>{
      return result.concat(tx.meta.evidence);
    },[]);
  
    const evidences_units = await reduce(evidences, async (array:DagSet.Unit[],key:string)=>{
      const unit:DagSet.Unit = await DagData.get(Trie.en_key(key));
      return array.concat(unit)
    },[]);*/
    /*const input_check = await some(evidences_units,(unit:DagSet.Unit)=>{
      const this_token:StateSet.Token = await World.get(Trie.en_key(unit.contents.token));
      return await some(unit.contents.input.token_id,(id:string)=>{
        const tokens =  new RadixTree({
          db: db,
          root:this
        });
        const input = await tokens.get(Trie.en_key(id));
        return input==null;
      },this_token.stateroot);
    });*/
    const tx_hash_map = txs.map((tx) => {
        return tx.meta.hash;
    });
    /*
    const RequestStates = new RadixTree({
      db: db,
      root: now_request_root
    });
  
    const request_map = await map(txs,async (tx:TxSet.Tx)=>{
      if(tx.kind=="request") return tx;
      else if(tx.kind=="refresh"){
        const request:TxSet.RequestTx = chain[tx.contents.index].transactions.reduce((result:TxSet.RequestTx[],t:TxSet.Tx)=>{
          if(t.kind=="request"&&t.meta.hash==tx.contents.request) return result.concat(t);
        },[])[0];
        const state:"waiting" | "refreshed" = await RequestStates.get(Trie.en_key(request.meta.hash));
        if(state=="waiting") return request
        else return ""
      }
      else return "";
    })
  
    const fee_sum = request_map.filter(t=>t!="").reduce((sum:number,tx:TxSet.RequestTx)=>{
      return sum + tx.contents.data.fee;
    });*/
    const size_sum = txs.reduce((sum, tx) => {
        return sum + Buffer.from(JSON.stringify(tx)).length;
    }, 0);
    const right_validator = elected(SortCandidates(last.contents.candidates), _.get_unicode(block.meta.hash));
    const validator_state = await StateData.get(validator);
    const address = validator_state.contents.owner;
    /*const PnsData = await World.get(Trie.en_key('pns'));
    const pns:AddressAlias[] = await AddressState.get(Trie.en_key('pns'));
    const sacrifice_holders = await reduce(pns,async (result,alias:AddressAlias)=>{
      const state:StateSet.T_state = await PnsData.get(Trie.en_key(alias.key));
      if(result[state.contents.tag.])
    },{});*/
    let changed_roots = [stateroot, request_root];
    const valid_txs = await some(txs, async (tx) => {
        if (tx.kind == "request" && (await TxSet.ValidRequestTx(tx, changed_roots[0], tag_limit, key_currency, fee_by_size, db))) {
            const new_roots = await TxSet.AcceptRequestTx(tx, chain, validator, changed_roots[0], changed_roots[1], key_currency, db);
            changed_roots[0] = new_roots[0];
            changed_roots[1] = new_roots[1];
            return false;
        }
        else if (tx.kind == "refresh" && (await TxSet.ValidRefreshTx(tx, dag_root, chain, changed_roots[0], changed_roots[1], key_currency, fee_by_size, tag_limit, db))) {
            const new_roots = await TxSet.AcceptRefreshTx(tx, chain, validator, changed_roots[0], changed_roots[1], key_currency, db);
            changed_roots[0] = new_roots[0];
            changed_roots[1] = new_roots[1];
            return false;
        }
        else {
            return true;
        }
    });
    const Sacrifice = await StateData.filter((key, value) => {
        const state = value;
        return state.contents.token == "sacrifice" && state.amount > 0;
    });
    const collected = R.values(Sacrifice).reduce((result, state) => {
        const address = state.contents.owner;
        const amount = state.amount;
        if (result[address] == null)
            result[address] = { address: address, amount: 0 };
        result[address]["amount"] += amount;
        return result;
    }, {});
    const sorted = SortCandidates(R.values(collected));
    await db.close();
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
    else if (stateroot != now_stateroot) {
        console.log("invalid stateroot");
        return false;
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
    else if (request_root != now_request_root) {
        console.log("invalid request_root");
        return false;
    }
    else if (tx_root != GetTreeroot(tx_hash_map)[0]) {
        console.log("invalid tx_root");
        return false;
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
        return false;
    }
    else if (address != CryptoSet.AddressFromPublic(validatorPub)) {
        console.log("invalid validator pub_key");
        return false;
    }
    else if (valid_txs) {
        console.log("invalid transactions");
        return false;
    }
    else {
        return true;
    }
}
async function AcceptBlock(block, chain, tag_limit, request_root, fee_by_size, key_currency, dag_root, db) {
    const stateroot = block.contents.stateroot;
    const validator = block.contents.validator;
    if (!await ValidBlock(block, chain, stateroot, request_root, dag_root, fee_by_size, key_currency, tag_limit, db))
        return [chain, stateroot, request_root];
    const new_roots = await reduce(block.transactions, async (roots, tx) => {
        if (tx.kind == "request") {
            return await TxSet.AcceptRequestTx(tx, chain, validator, roots[0], roots[1], key_currency, db);
        }
        else if (tx.kind == "refresh") {
            return await TxSet.AcceptRefreshTx(tx, chain, validator, roots[0], roots[1], key_currency, db);
        }
        else {
            return roots;
        }
    }, [stateroot, request_root]);
    const new_chain = chain.concat(block);
    return {
        chain: new_chain,
        stateroot: new_roots[0],
        request_root: new_roots[1]
    };
}
exports.AcceptBlock = AcceptBlock;
function CreateBlock(password, chain, stateroot, request_root, fee_by_size, difficulty, validator, validatorPub, candidates, txs) {
    const last = chain[chain.length - 1];
    const index = chain.length;
    const parenthash = last.meta.hash;
    const date = new Date();
    const timestamp = date.getTime();
    const tx_hash_map = txs.map((tx) => {
        return tx.meta.hash;
    });
    const tx_root = GetTreeroot(tx_hash_map)[0];
    const fee = txs.reduce((sum, tx) => {
        return (sum + fee_by_size * Buffer.from(JSON.stringify(tx)).length);
    }, 0);
    const pre_1 = {
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
    const hash = _.toHash(JSON.stringify(pre_1.contents));
    const signature = CryptoSet.SignData(hash, password);
    const block = ((pre_1, hash, signature) => {
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
