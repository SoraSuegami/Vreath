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
const TxSet = __importStar(require("./tx"));
const R = __importStar(require("ramda"));
const { map, reduce, filter, forEach, some } = require('p-iteration');
//const RadixTree = require('dfinity-radix-tree');
//const levelup = require('levelup');
//const leveldown = require('leveldown');
//const db = levelup(leveldown('./db/state'));
const rlp = require('rlp');
const dgw = require('../dark-gravity-wave-js/index');
const CryptoSet = require('./crypto_set.js');
/*export type AddressAlias = {
  kind:string;
  key:string;
}*/
/*export type RequestsAlias = {
  index:number;
  hash:string;
}

type Candidates = {
  address: string;
  amount: number;
}

type BlockMeta = {
  hash: string;
  validatorSign: string;
}

type BlockContents = {
  index:number;
  parenthash:string;
  timestamp: number;
  stateroot: string;
  request_root: string;
  //addressroot: string;
  //used_dagroot: string;
  //used_txroot: string;
  //evidences: string[];
  tx_root: string;
  fee:number;
  difficulty:number;
  validator: string;
  validatorPub: string;
  candidates: Candidates[];
}

export type Block = {
  meta:BlockMeta;
  contents:BlockContents;
  transactions: TxSet.Tx[];
}*/
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
                        return _.toHash("");
                    else
                        return array[i + 1];
                })(left, i, array);
                return result.concat(_.toHash(left + right));
            }
            else
                return result;
        }, []);
        return GetTreeroot(union);
    }
}
exports.GetTreeroot = GetTreeroot;
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
exports.HextoNum = HextoNum;
/*export function NumtoHex(num:number) {
    return parseInt('0x' + (('0000' + num.toString(16).toUpperCase()).substr(-4)),16);
}*/
async function Pow_diff(chain, time, DagData) {
    const getted = await map(chain, async (block) => {
        return await reduce(block.transactions, async (r, tx, index) => {
            if (tx.kind != "refresh")
                return r;
            const unit = await DagData.get(tx.evidence);
            if (Object.keys(unit).length == 0)
                return r;
            console.log(tx.kind);
            const new_timestamp = (r.timestamp * index + unit.contents.data.timestamp) / (index + 1);
            const new_target = (r.target * index + unit.contents.difficulty) / (index + 1);
            r.timestamp = new_timestamp;
            r.target = new_target;
            return r;
        }, { timestamp: 0, target: 0 });
    });
    let sum = 0;
    const edited = getted.reverse().map((obj) => {
        if (_.toHash(JSON.stringify(obj)) == _.toHash(JSON.stringify({ timestamp: 0, target: 0 }))) {
            sum += time * 1000;
            return obj;
        }
        obj.timestamp += sum;
        return obj;
    });
    const removed = edited.reverse().filter((obj) => {
        return _.toHash(JSON.stringify(obj)) != _.toHash(JSON.stringify({ timestamp: 0, target: 0 }));
    });
    /*const hexed = removed.map((obj:{timestamp:number,target:number})=>{
      obj.target = NumtoHex(obj.target)
      return obj
    });*/
    console.log(removed);
    console.log(time);
    console.log(removed.length < 24);
    if (removed.length < 24)
        return chain[chain.length - 1].contents.difficulty;
    else
        return dgw.getTarget(removed, time);
}
function State_diff(chain, time) {
    const getted = chain.map((block) => {
        return { timestamp: block.contents.timestamp, target: block.contents.stake_diff };
    });
    console.log(getted.length < 24);
    console.log(getted);
    if (getted.length < 24)
        return chain[chain.length - 1].contents.stake_diff;
    else
        return dgw.getTarget(getted, time);
}
function SortCandidates(candidates) {
    return candidates.sort((a, b) => {
        return HextoNum(a.address) - HextoNum(b.address);
    });
}
/*async function TxCheckintoChain(txs:TxSet.Tx[],parents_dag,used_tx){
  return await some(txs, async (tx:TxSet.Tx)=>{
    const not_confirmed_check = await NotDoubleConfirmed(tx.meta.evidence,parents_dag);
    const used_tx_check = await TxUsed(tx.meta.hash,used_tx);
    return not_confirmed_check==true || used_tx_check==true;
  });
}*/
function SplitArray(scaled, group_size) {
    let result = [{}];
    let i = 0;
    let sum = 0;
    while (i < scaled.length) {
        let can = scaled[i];
        let added = can.amount + sum;
        if (added > group_size) {
            result[result.length - 1][can.address] = can.amount - added + group_size;
            result.push({});
            sum = 0;
            //console.log(sum);
            //scaled.shift();
            scaled.push({ address: can.address, amount: added - group_size });
        }
        else {
            result[result.length - 1][can.address] = can.amount;
            sum += can.amount;
            //scaled.shift();
            //console.log(sum);
        }
        /*console.log("result:");
        console.log(result);
        console.log("scaled:");
        console.log(scaled);*/
        //console.log(scaled);
        i++;
    }
    return result;
    /*return scaled.reduce((result:{[key:string]:number;}[],can)=>{
      const added:number = can.amount + result[result.length-1].reduce((sum:number,c:T.Candidates)=>{return sum+c.amount});
      if(added>group_size){
        result[result.length-1][can.address] = can.amount - added + group_size;
  
        result.push({[can.address]:added-group_size});
        return result;
      }
      else{
        result[result.length-1][can.address] = can.amount;
        return result;
      }
    });*/
}
function elected(sorted, standard) {
    return sorted.reduce((result, can, index) => {
        const pre_sum = sorted.slice(0, index).reduce((sum, c) => {
            return sum + c.amount;
        });
        if (can.amount + pre_sum >= standard) {
            return { address: can.address, amount: standard - pre_sum };
        }
        else {
            return {};
        }
    });
}
function RightCandidates(Sacrifice, group_size, parenthash) {
    const collected = R.values(Sacrifice).reduce((result, state) => {
        const address = state.contents.owner;
        const amount = state.amount;
        if (result[address] == null)
            result[address] = { address: address, amount: 0 };
        result[address]["amount"] += amount;
        return result;
    }, {});
    const sorted = SortCandidates(R.values(collected));
    const sacrifice_sum = sorted.reduce((sum, can) => {
        return sum + can.amount;
    }, 0);
    const scaled = sorted.map((can) => {
        can.amount *= group_size;
        return can;
    });
    const splited = SplitArray(scaled, sacrifice_sum);
    const right_candidates = splited.map((can) => {
        const this_sum = R.values(can).reduce((sum, amount) => {
            return sum + amount;
        });
        const candidates = Object.entries(can).map((c) => {
            return { address: c[0], amount: c[1] };
        });
        return elected(candidates, HextoNum(parenthash) % this_sum);
    });
    const formated = right_candidates.reduce((result, can) => {
        if (!(can.address in result)) {
            result[can.address] = 0;
        }
        result[can.address] += can.amount / group_size;
        return result;
    }, {});
    return Object.entries(formated).reduce((result, can) => {
        return result.concat({ address: can[0], amount: can[1] });
    }, []);
}
exports.RightCandidates = RightCandidates;
function PoS_mining(parenthash, address, balance, difficulty) {
    let date;
    let timestamp;
    console.log(difficulty);
    do {
        date = new Date();
        timestamp = date.getTime();
    } while (HextoNum(_.toHash(parenthash + address + timestamp.toString())) > Math.pow(2, 256) * Math.exp(166) * balance / difficulty);
    console.log(HextoNum(_.toHash(parenthash + address + timestamp.toString())));
    console.log(Math.pow(2, 256) * Math.exp(166) * balance / difficulty);
    return timestamp;
}
exports.PoS_mining = PoS_mining;
console.log(Math.log(100000000));
async function ValidBlock(block, chain, fee_by_size, pow_time, block_time, key_currency, unit_token, tag_limit, group_size, last_candidates, StateData, DagData, RequestData) {
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
    const stake_diff = block.contents.stake_diff;
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
    const right_stateroot = StateData.now_root();
    const right_request_root = RequestData.now_root();
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
    const right_pow_diff = await Pow_diff(chain, pow_time, DagData);
    const right_stake_diff = State_diff(chain, block_time);
    //const right_validator = elected(SortCandidates(last.contents.candidates),_.get_unicode(block.meta.hash));
    /*const PnsData = await World.get(Trie.en_key('pns'));
    const pns:AddressAlias[] = await AddressState.get(Trie.en_key('pns'));
    const sacrifice_holders = await reduce(pns,async (result,alias:AddressAlias)=>{
      const state:StateSet.T_state = await PnsData.get(Trie.en_key(alias.key));
      if(result[state.contents.tag.])
    },{});*/
    /*const check_SD:Trie = StateData.checkpoint();
    const check_RD:Trie =  RequestData.checkpoint();
    console.log('checked');
    console.log(check_SD)
    const commit_SD:Trie = await StateData.commit();
    const commit_RD:Trie = await RequestData.commit();
    console.log("committed");
    console.log(commit_SD)*/
    let changed = [StateData, RequestData];
    const valid_txs = await some(txs, async (tx) => {
        try {
            if (tx.kind == "request" && (await TxSet.ValidRequestTx(tx, tag_limit, key_currency, fee_by_size, changed[0], changed[1]))) {
                const news = await TxSet.AcceptRequestTx(tx, chain, validator, key_currency, fee_by_size, changed[0], changed[1]);
                changed[0] = news[0];
                changed[1] = news[1];
                return false;
            }
            else if (tx.kind == "refresh" && (await TxSet.ValidRefreshTx(tx, chain, key_currency, fee_by_size, tag_limit, changed[0], DagData, changed[1]))) {
                const news = await TxSet.AcceptRefreshTx(tx, chain, validator, key_currency, fee_by_size, changed[0], changed[1]);
                changed[0] = news[0];
                changed[1] = news[1];
                return false;
            }
            else {
                return true;
            }
        }
        catch (e) {
            console.log(e);
        }
    });
    /*ori_SD = await StateData.revert();
    ori_RD = await RequestData.revert();
    console.log(await ori_SD.filter());*/
    const Sacrifice = await StateData.filter((key, value) => {
        const state = value;
        return state.contents.token == unit_token && state.amount > 0;
    });
    const right_candidates = RightCandidates(Sacrifice, group_size, parenthash);
    const validator_state = await StateData.get(validator);
    const address = validator_state.contents.owner;
    const sacrifice_amount = last_candidates.reduce((amount, can) => {
        if (can.address == address)
            return can.amount;
        else
            return 0;
    });
    const this_candidates = last_candidates.map((can) => {
        return can.address;
    });
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
    else if (timestamp > date.getTime() || (HextoNum(_.toHash(parenthash + address + timestamp.toString())) > Math.pow(2, 256) * sacrifice_amount / stake_diff)) {
        console.log("invalid timestamp");
        return false;
    }
    else if (stateroot != right_stateroot) {
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
    else if (request_root != right_request_root) {
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
        return false;
    }
    else if (difficulty != right_pow_diff) {
        console.log("invalid difficulty");
        return false;
    }
    else if (stake_diff != right_stake_diff) {
        console.log("invalid stake_diff");
        return false;
    }
    else if (candidates != _.toHash(JSON.stringify(right_candidates))) {
        console.log("invalid candidates");
        return false;
    }
    else if (validator_state.contents.token != key_currency || sacrifice_amount <= 0 || this_candidates.indexOf(address) == -1) {
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
async function AcceptBlock(block, chain, tag_limit, fee_by_size, pow_time, block_time, key_currency, unit_token, group_size, last_candidates, StateData, DagData, RequestData) {
    const stateroot = block.contents.stateroot;
    const request_root = block.contents.request_root;
    const validator = block.contents.validator;
    if (!await ValidBlock(block, chain, fee_by_size, pow_time, block_time, key_currency, unit_token, tag_limit, group_size, last_candidates, StateData, DagData, RequestData))
        return { chain: chain, state: stateroot, request: request_root, candidates: last_candidates };
    console.log("OK");
    console.log(await StateData.filter());
    const Sacrifice = await StateData.filter((key, value) => {
        const state = value;
        return state.contents.token == unit_token && state.amount > 0;
    });
    const new_candidates = RightCandidates(Sacrifice, group_size, block.contents.parenthash);
    console.log(new_candidates);
    /*
    const news:Trie[] = await reduce(block.transactions, async (states,tx:TxSet.Tx)=>{
      if(tx.kind=="request"){
        return await TxSet.AcceptRequestTx(tx,chain,validator,key_currency,states[0],states[1]);
      }
      else if(tx.kind=="refresh"){
        return await TxSet.AcceptRefreshTx(tx,chain,validator,key_currency,states[0],states[1]);
      }
      else{
        return states
      }
    },[StateData,RequestData]);*/
    const new_chain = chain.concat(block);
    return {
        chain: new_chain,
        state: StateData.now_root(),
        request: RequestData.now_root(),
        candidates: new_candidates
    };
}
exports.AcceptBlock = AcceptBlock;
async function CreateBlock(password, chain, stateroot, request_root, fee_by_size, pow_time, block_time, validator, validatorPub, unit_token, group_size, last_candidates, txs, StateData, DagData) {
    const last = chain[chain.length - 1];
    const index = chain.length;
    const parenthash = last.meta.hash;
    const tx_hash_map = txs.map((tx) => {
        return tx.meta.hash;
    });
    const tx_root = GetTreeroot(tx_hash_map)[0];
    const fee = txs.reduce((sum, tx) => {
        return (sum + fee_by_size * Buffer.from(JSON.stringify(tx)).length);
    }, 0);
    const difficulty = await Pow_diff(chain, pow_time, DagData);
    const stake_diff = State_diff(chain, block_time);
    const Sacrifice = await StateData.filter((key, value) => {
        const state = value;
        return state.contents.token == unit_token && state.amount > 0;
    });
    const candidates = _.toHash(JSON.stringify(RightCandidates(Sacrifice, group_size, parenthash)));
    const validator_state = await StateData.get(validator);
    const address = validator_state.contents.owner;
    console.log(last_candidates);
    const sacrifice_amount = last_candidates.reduce((amount, can) => {
        if (can.address == address)
            return can.amount;
        else
            return 0;
    }, 0);
    const timestamp = PoS_mining(parenthash, validator, sacrifice_amount, stake_diff);
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
            stake_diff: stake_diff,
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
