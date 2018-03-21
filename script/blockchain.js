const Trie = require('merkle-patricia-tree');
const Proof = require('merkle-patricia-tree/proof');
const fs = require('fs');
const crypto = require('crypto');

const CryptoSet = require('./crypto_set.js');
const Read = require('./read.js');
const Write = require('./write.js');

const levelup = require('levelup');
const leveldown = require('leveldown');
const rlp = require('rlp');
const db = levelup(leveldown('./db/blockchain'));

const currency_name = 'nix';
const dag_exchange = CryptoSet.AppAddress('TheDagExchange');
const dag_rate = 100;
const tx_rate = 10;
const lomgrange = 100;

const txlimit = 10;
const password = "Sora"
const beneficiaryPub = CryptoSet.PullMyPublic(password);
const beneficiary = CryptoSet.AddressFromPublic(beneficiaryPub);


function array_to_obj(array){
  return array.reduce((obj,val)=>{
    if(val[1][1]!=null){
      array_to_obj(val[1]);
    }
    obj[val[0]] = val[1];
    return obj
  },{});
}

function maybe(obj){
  try{
    JSON.parse(JSON.stringify(obj), function(key, val){
      if(val==null){
        console.log(true);
        return true;
      }
  });
  }
  catch(e){
    return true;
  }
}

//const first_trie = new Trie(db);
function ChangeTrie(StateData,state){
  const address = Buffer.from(state.address,'utf-8');
  const en_state = rlp.encode(JSON.stringify(state));
  return new Promise((resolve, reject)=>{
    StateData.put(address,en_state,()=>{
      resolve(StateData);
    });
  });
}


function GetState(StateData,address){
  const en_address = Buffer.from(address,'utf-8');
  return new Promise((resolve, reject)=>{
    StateData.get(en_address,(err,val)=>{
      if(val) resolve(val);
      else if(err) reject(err);
    });
  });
}


function toHash(str){
  var sha256 = crypto.createHash('sha256');
  sha256.update(str);
  const pre_hash = sha256.digest('hex');
  var sha512 = crypto.createHash('sha512');
  sha512.update(pre_hash);
  const hash = sha512.digest('hex');
  return hash;
}

function calculatePureHash(Tx){
  const array = Object.entries(Tx.meta||{}).filter(function(val){
    return (val[0]!="pure_hash"&&val[0]!="pre_hash"&&val[0]!="next_hash"&&val[0]!="hash");
  });
  const edit_tx = array_to_obj(array);
  return toHash(JSON.stringify(edit_tx));
}

function calculateHashForTx(Tx){
  const array = Object.entries(Tx.meta||{}).filter(function(val){
    return (val[0]!="hash"&&val[0]!="signature");
  });
  const edit_tx = array_to_obj(array);
  return toHash(JSON.stringify(edit_tx));
}


function TxJson(from,to,option,timestamp,fee,nonce,pure_hash,evidence,pre_tx="",next_tx="",hash){
  return{
    type:type,
    from:from,
    to:to,
    timestamp:timestamp,
    options:options,
    fee:fee,
    nonce:nonce,
    pure_hash:pure_hash,
    evidence:evidence,
    pre_tx:pre_tx,
    next_tx:next_tx,
    hash:hash
  }
}

function TxList(Txs){
  return{
    meta:{
      num:num,
      root_hash:root_hash
    },
    transactions:Txs
  }
}

function StateJson(address,nonce,balance,deposit,mortgage,used_hash,issue_token,storage,code){
  return{
    address:address,
    nonce:nonce,
    balance:balance,
    deposit:deposit,
    mortgage:mortgage,
    used_hash:used_hash,
    issue_token:issue_token,
    storage:storage,
    code:code,
    developer:developer
  }
}

function SetState(address,StateData){
  GetState(StateData,address).then(state=>{
  if(state==null){
    return StateJson(address,0,{},{},{},{},{},{},{},"");
  }
  else{
    return state;
  }
  }).catch(err=>{return false;});
}


function pull_tx_type(tx){
  return tx.type;
}
function pull_tx_from(tx){
  return tx.from;
}
function pull_tx_to(tx){
  return tx.to;
}
function pull_tx_timestamp(tx){
  return tx.timestamp;
}
function pull_tx_options(tx){
  return tx.options;
}
function pull_tx_fee(tx){
  return tx.fee;
}
function pull_tx_nonce(tx){
  return tx.nonce;
}
function pull_tx_pure_hash(tx){
  return tx.pure_hash;
}
function pull_tx_evidence(tx){
  return tx.evidence;
}
function pull_tx_pre_tx(tx){
  return tx.pre_tx;
}
function pull_tx_next_tx(tx){
  return tx.next_tx;
}
function pull_tx_hash(tx){
  return tx.hash;
}

function Confirmes(dag,DagData){
  const first_confirm = Object.values(DagData).find(function(val){
    return val[0][10]==this[0][11];
  },dag);
  const second_confirm = Object.values(DagData).find(function(val){
    return val[0][10]==this[0][11];
  },first_confirm);
  return second_confirm[0][10];
}


function inValidTx(tx,StateData,DagData,currency_name,tx_rate){
  const date = new Date();
  const from = pull_tx_from(tx);
  const state = SetState(from,StateData);
  const dag = DagData[pull_tx_evidence(tx)];
  if(maybe(tx)){
    console.error("invalid object");
    return false;
  }
  else if(pull_tx_timestamp(tx)>date.getTime()){
    console.error("invalid timestamp");
    return false;
  }
  else if(pull_tx_fee(tx)!=Buffer.from(tx).length){
    console.error("invalid fee");
    return false;
  }
  else if(pull_tx_nonce(tx)!=state.nonce){
    console.error("invalid nonce");
    return false;
  }
  else if(pull_tx_pure_hash(tx)!=calculatePureHash(tx)){
    console.error("invalid pure hash");
    return false;
  }
  else if((dag.meta.app!=from)||(state.used_hash.indexOf(pull_tx_evidence(tx))!=-1)||(Confirmes(dag,DagData)==null)||(dag.data.indexOf(tx)==-1)){
    console.error("invalid evidence");
    return false;
  }
  else if(pull_tx_hash(tx)!=calculateHashForTx(tx)){
    console.error("invalid hash");
    return false;
  }
  else if(1){
    const to = pull_tx_to(tx);
    const storage = state.storage;
    switch (pull_tx_type(tx)) {
      case "remit":
        const value = pull_tx_options(tx);
        Object.entries(value).reduce((state,val)=>{
          if(state.balance[val[0]]==null || state.balance[val[0]]<val[1]){
            console.error("invalid value");
            return false;
          }
        },state);
        break;
      case "register_code":
        const app = SetState(to,StateData);
        const code = pull_tx_options(tx);
        const code_id = code.code_id;
        const code_buf = Buffer.from(code.data);
        if(to.match(/^PH/)){
          console.error("You can't register code to this address");
          return false;
        }
        else if(app.code[code_id]!=null){
          console.error("This code id is already used");
          return false;
        }
        else if(code_buf.length!=code.size){
          console.error("invalid code size");
          return false;
        }
        else if(app.developer!=null&&app.developer!=from){
          console.error("invalid developer");
          return false;
        }
        break;
      case "issue_token":
        const token = pull_tx_options(tx);
        const token_name = from + '/' + token.id;
        const token_buf = Buffer.from(token_name);
        if(state.issue_token[token.id]!=null){
          console.error("This token is already issued");
          return false;
        }
        else if(token_buf.length>100){
          console.error("Too long token name");
          return false;
        }
        else if(token.mortgage>state.balance[currency_name]){
          console.error("You don't have enough mortgage");
          return false;
        }
        else if(token.increase!="freedom"||token.increase!="constant"||token.increase!="never"){
          console.error("invalid increase kind");
          return false;
        }
        else if(token.increase=="constant"&&state.code[token.code_id]==null){
          console.error("invalid code_id to issue this token");
          return false;
        }
        else if(token.amount<=0){
          console.error("invalid amount");
          return false;
        }
       break;
      case "increase_token":
        const inc = pull_tx_options(tx);
        const inc_token = state.issue_token[inc.token_id];
        if(inc_token==null){
          console.error("This token_id doesn't exist");
          return false;
        }
        else if(inc_token.increase=="never"){
          console.error("You'll never increase this token");
          return false;
        }
        else if(inc_token.increase=="constant"&&inc_token.code_id!=dag.meta.code_id){
          console.error("You can't increase this token by the evidence");
          return false;
        }
        else if(inc.amount<0){
          console.error("invalid increase amount");
          return false;
        }
        break;
      case "deposit":
        const deposit = pull_tx_options(tx);
        Object.entries(deposit).reduce((state,val)=>{
          if(state.balance[val[0]]==null || state.balance[val[0]]<val[1]){
            console.error("invalid deposit");
            return false;
          }
        },state);
        break;
      case "withdrawal":
        const withdrawal = pull_tx_options(tx);
        const savings  = SetState(to,StateData);
        Object.entries(withdrawal).reduce((save,val)=>{
          if(savings.balance[val[0]]==null || savings.balance[val[0]]<val[1]){
            console.error("invalid withdrawal");
            return false;
          }
        },savings);
        break;
      case "set_data":
        const set_data = pull_tx_options(tx);
        const set_number = Math.ceil(set_data.size/(38*Math.pow(10,6)));
        if(storage[set_data.hash]!=null){
          console.error("This hash is already added");
          return false;
        }
        else if(set_data.tip_hashs.length!=set_number){
          console.error("invalid number of tip_hashs");
          return false;
        }
        else if(set_data.save_number<=0){
          console.error("invalid number of savers");
          return false;
        }
        break;
      case "remove_data":
        const remove_data = pull_tx_options(tx);
        if(storage[remove_data.hash]==null){
          console.error("This hash doesn't exist");
          return false;
        }
        break;
      case "set_savers":
        const set_savers = pull_tx_options(tx);
        if(storage[set_savers.root_hash]==null){
          console.error("This hash doesn't exist");
          return false;
        }
        else if(set_savers.number<0||set_savers.number+1>storage[set_savers.root_hash].tips.length){
          console.error("This number doesn't exist in this hash");
          return false;
        }
        else if(set_savers.tip_hash!=storage[set_savers.root_hash].tips[set_savers.number].hash){
          console.error("invalid tip_hash");
          return false;
        }
        else if(storage[set_savers.root_hash].tips[set_savers.number].savers.length>=storage[set_savers.root_hash].save_number){
          console.error("You can't add savers to this tip");
          return false;
        }
        else if(1){
          Object.values(storage[set_savers.root_hash].tips[set_savers.number].savers).reduce((saver,val)=>{
            if(saver.address==val.address){
              console.error("Your address have already been added as saver");
              return false;
            }
            else if(saver.ip==val.ip){
              console.error("Your ip have already been added as saver");
              return false;
            }
          },set_savers.saver);
        }
        break;
      case "reset_savers":
        const reset_savers = pull_tx_options(tx);
        if(storage[reset_savers.root_hash]==null){
          console.error("This hash doesn't exist");
          return false;
        }
        break;
      default:
        console.error("invalid type");
        return false;
        break;
    }
  }
  else{
    return true;
  }
}

function GetTreeroot(pre) {
  if(union.length==1) return pre[0];
  else{
  const union = pre.forEach((val,index,array)=>{
    const i = Number(index);
    if(i==array.index-1) return this;
    else if(i%2==1){}
    else{
      const left = val;
      const right = (left,i,array)=>{
        if(array[i+1]==null) return "";
        else {return array[i+1]};
      };
      this.push(toHash(left+right));
    }
  },[]);
  return arguments.callee(union);
  }
}

function inValidTxList(list,StateData,DagData,currency_name,tx_rate){
  const tx_check = list.transactions.forEach(val=>{
    if(!inValidTx(val,StateData,DagData,currency_name,tx_rate)) return true;
  });
  const hashs = list.transactions.map(val=>{
    return pull_tx_hash(val);
  });
  const pure_hashs = list.transactions.map(val=>{
    return pull_tx_pure_hash(val);
  });
  const relation_check = list.transactions.forEach((val,index,array)=>{
    if(pull_tx_pre_tx(val)!=""&&pull_tx_pre_tx(val)!=this[index-1]) return true;
    else if(pull_tx_next_tx(val)!=""&&pull_tx_next_tx(val)!=this[index+1]) return true;
  },pure_hashs);
  if(list.meta.num!=list.transactions.length){
    console.error("invalid transactions number");
    return false;
  }
  else if(list.meta.root_hash!=GetTreeroot(hashs)){
    console.error("invalid transactions root hash");
    return false;
  }
  else if(tx_check||relation_check){
    console.error("It has invalid transaction");
    return false;
  }
  else{
    return true;
  }
}

function remit(tx,StateData){
  const from = pull_tx_from(tx);
  const to = pull_tx_to(tx);
  const from_to = {
    from:SetState(from,StateData),
    to:SetState(to,StateData)
  };
  const value = pull_tx_options(tx);
  const states = Object.entries(value).reduce((balances,val)=>{
    balances.from.balance[val[0]] -= val[1];
    balances.to.balance[val[0]] += val[1];
    return balance;
  },from_to);
  const new_state = Object.values(states).reduce((all_state,val)=>{
    ChangeTrie(all_state,val).then(result=>{return result;});
  },StateData);
  return new_state;
}


function register_code(tx,StateData){
  const from = pull_tx_from(tx);
  const to = pull_tx_to(tx);
  const code= pull_tx_options(tx);
  const app = Object.entries(code).reduce((state,val)=>{
    state[val[0]] = val[1];
  },SetState(to,StateData));
  const new_app = ((app,from) => {
    app.developer = from;
    return app;
  })(app,from);
  const new_state = ((StateData,new_app) => {
    ChangeTrie(StateData,new_app).then(result=>{return result;});
  })(StateData,new_app);
  return new_state;
}


function issue_token(tx,StateData,currency_name){
  const from = pull_tx_from(tx);
  const token= pull_tx_options(tx);
  const token_name = from + '/' + token.id;
  const app = SetState(from,StateData);
  const app_issue_token = ((app,token) =>{
    app.issue_token[token.id] = token;
    return app;
  })(app,token);
  const app_value = ((app_issue_token,token,currency_name) =>{
    app_issue_token.value[currency_name] -= token.mortgage;
    return app_issue_token;
  })(app_issue_token,token,currency_name);
  const app_mortgage = ((app_value,token) =>{
    app_value_token.mortgage[token.id] += token.mortgage;
    return app_value_token;
  })(app_value,token);
  const new_state = ((StateData,app_mortgage) =>{
    ChangeTrie(StateData,app_mortgage).then(result=>{return result;});
  })(StateData,app_mortgage);
  return new_state;
}


function increase_token(tx,StateData,currency_name){
  const from = pull_tx_from(tx);
  const inc = pull_tx_options(tx);
  const app = SetState(from,StateData);
  const app_mortgage = ((app,inc) =>{
    app.mortgage[inc.token_id] += inc.amount;
    return app;
  })(app,inc);
  const app_issue = ((app_mortgage,inc) =>{
    app_mortgage.issue_token[inc.token_id] += inc.amount;
    return app_mortgage;
  })(app_mortgage,inc);
  const new_state = ((StateData,app_issue) =>{
    ChangeTrie(StateData,app_issue).then(result=>{return result;});
  })(StateData,app_issue);
  return new_state;
}

function deposit(tx,StateData){
  const from = pull_tx_from(tx);
  const to = pull_tx_to(tx);
  const deposit = pull_tx_options(tx);
  const user = SetState(from,StateData);
  const app = SetState(to,StateData);
  const user_state = Object.entries(deposit).reduce((state,val)=>{
    return state.balance[val[0]] -= val[1];
  },user);
  const app_state = Object.entries(deposit).reduce((state,val)=>{
    return state.deposit[val[0]] += val[1];
  },app);
  const new_state = [user_state,app_state].reduce((state,val)=>{
    ChangeTrie(state,val).then(result=>{return result;});
  },StateData);
  return new_state;
}

function withdrawal(tx,StateData){
  const from = pull_tx_from(tx);
  const to = pull_tx_to(tx);
  const withdrawal = pull_tx_options(tx);
  const user = SetState(from,StateData);
  const app = SetState(to,StateData);
  const user_state = Object.entries(withdrawal).reduce((state,val)=>{
    return state.balance[val[0]] += val[1];
  },user);
  const app_state = Object.entries(withdrawal).reduce((state,val)=>{
    return state.deposit[val[0]] -= val[1];
  },app);
  const new_state = [user_state,app_state].reduce((state,val)=>{
    ChangeTrie(state,val).then(result=>{return result;});
  },StateData);
  return new_state;
}

function set_data(tx,StateData){
  const from = pull_tx_from(tx);
  const set_data = pull_tx_options(tx);
  const app = SetState(from,StateData);
  const new_storage = ((set_data,app)=>{
    app.storage[set_data.hash] = set_data;
    return app;
  })(set_data,app);
  const new_state = ((StateData,new_storage) =>{
    ChangeTrie(StateData,new_storage).then(result=>{return result;});
  })(StateData,new_storage);
  return new_state;
}


function remove_data(tx,StateData){
  const from = pull_tx_from(tx);
  const remove_hash = pull_tx_options(tx).root_hash;
  const app = SetState(from,StateData);
  const new_storage = ((remove_hash,app)=>{
    delete app.storage[remove_hash];
    return app;
  })(remove_hash,app);
  const new_state = ((StateData,new_storage) =>{
    ChangeTrie(StateData,new_storage).then(result=>{return result;});
  })(StateData,new_storage);
  return new_state;
}

function set_savers(tx,StateData){
  const from = pull_tx_from(tx);
  const set_savers = pull_tx_options(tx);
  const app = SetState(from,StateData);
  const new_savers = ((set_savers,app)=>{
    const add = {
      hash:set_savers.tip_hash,
      savers:{
        address:set_savers.saver.address,
        ip:set_savers.saver.ip,
        port:set_savers.saver.ip
      }
    };
    app.storage[set_savers.root_hash].tips[set_savers.number] = add;
    return app;
  })(set_savers,app);
  const new_state = ((StateData,new_savers) =>{
    ChangeTrie(StateData,new_savers).then(result=>{return result;});
  })(StateData,new_savers);
  return new_state;
}

function reset_savers(tx,StateData){
  const from = pull_tx_from(tx);
  const remove_savers = pull_tx_options(tx);
  const app = SetState(from,StateData);
  const new_savers = ((remove_savers,app)=>{
    delete app.storage[remove_savers.root_hash].tips
    return app;
  })(remove_savers,app);
  const new_state = ((StateData,new_savers) =>{
    ChangeTrie(StateData,new_savers).then(result=>{return result;});
  })(StateData,new_savers);
  return new_state;
}

function TxListtoPool(list,StateData,DagData,currency_name,tx_rate,Pool){
  if(!inValidTxList(list,StateData,DagData,currency_name,tx_rate)) return false;
  else if(Pool[list.meta.root_hash]!=null) return false;
  else{
    Pool[list.meta.root_hash] = list;
    return Pool;
  }
}



function BlockJson(index,parentHash,hash,timestamp,txnum,validator,validatorPub,signature,fee,dags,candidates,transactionsRoot,stateRoot,transactions){
  return{
    header:{
      index:index,
      parenthash:parenthash,
      hash:hash,
      timestamp:timestamp,
      txnum:txnum,
      validator:validator,
      validatorPub:validatorPub,
      signature:signature,
      fee:fee,
      dags:dags,
      candidates:candidates,
      transactionsRoot:transactionsRoot,
      stateRoot:stateRoot
    },
    transactions:transactions
  };
}

function calculateHashForBlock(block){
  const array = Object.entries(block.header||{}).filter(function(val){
    return (val[0]!="hash"&&val[0]!="signature");
  });
  const edit_block = array_to_obj(array);
  return toHash(JSON.stringify(edit_block));
}


function get_unicode(str){
  const result = str.split("").reduce((num,val)=>{
    return num + val.charCodeAt(0);
  },0);
  return result;
}

function elected(sorted,result,now=-1,i=0){
  if(result>sorted.length-1) console.error("invalid result");
  const new_now = now + Object.values(sorted)[i];
  if(new_now<result) return elected(sorted,result,new_now,i+1);
  else return Object.keys(sorted)[i];
}

function Proof_of_Stake_with_Dag(address,candidates,hash){
  if(candidates[address]==null) console.error("invalid address");
  const uni_hash = get_unicode(hash);
  const point = (address,candidates,uni_hash,i=1) =>{
    const sorted_array = Object.entries(candidates).sort((a,b)=>{
      return a[1]-b[1];
    });
    const sorted = array_to_obj(sorted_array);
    const all = Object.values(sorted).reduce((sum,val)=>{
      return sum + val;
    });
    const result = uni_hash % all;
    const this_elected = elected(sorted,result,-1,0);
    if(address==this_elected) return i;
    else{
      const new_candidates = array_to_obj(Object.entries(candidates).filter(val=>{
        return val[0]!=this_elected;
      }));
      return point(address,new_candidates,uni_hash,i+1);
    }
  };
  return point(address,candidates,uni_hash);
}


function inValidBlock(block,Blocks,StateData,dag_rate,DagData,Pool,dag_exchange){
  const header = block.header;
  const last = Blocks[Blocks.length-1];
  const date = new Date();
  const exist_check = block.transactions.forEach(val=>{
    if(this[val.meta.root_hash]==null) return true;
  },Pool);
  const tx_hashs = block.transactions.map(val=>{
    return val.meta.root_hash;
  });
  const tx_sum = block.transactions.reduce((sum,val)=>{
    return sum + val.meta.num;
  },0);
  const sorted_hashs = ((tx_hashs)=>{
    return tx_hashs.sort((a,b)=>{
      return get_unicode(a) - get_unicode(b);
    });
  })(tx_hashs);
  const dags = header.dags;
  const dag_sizes = ((dags,DagData)=>{
    const sizes = header.dags.reduce((size,hash)=>{
      return size + Buffer.from(DagData[hash]).length;
    },0);
    return sizes;
  })(dags,DagData);
  const valid_candidates = ((block,StateData,dag_exchange)=>{
    const uni = get_unicode(block.header.hash);
    const candidates = Object.values(StateData[dag_exchange]["storage"]).filter((val)=>{
      return val.tag.type = "bought";
    });
    if(candidates.length<=70) const judged = candidates;
    else{
      const edited = candidates.reduce((obj,val)=>{
        if(obj[val.user]==null) obj[val.user]=0;
        obj[val.user] ++;
        return obj;
      },{});

      const judged = (i,edited,uni,array)=>{
        const new_i = i + 1;
        const all = edited.reduce((sum,val)=>{
          return Object.values(val)[0] + sum
        },0);
        const n = uni % all;
        const result = elected(edited,n,-1,0);
        const new_array = array.push({[result]:edited[result]});
        if(i>=70) return new_array;
        else{
          const new_edited = edited.filter(val=>{
            return Object.keys(val)[0]!=result;
          });
          return judged(new_i,new_edited,uni,new_array);
        }
      };
      return judged(0,edited,uni,[]);
    }
  })(StateData);
  if(maybe(block)){
    console.error("invalid object");
    return false;
  }
  else if(exist_check){
    console.error("some transactions lists don't exist in the Pool");
    return false;
  }
  else if(header.index!=Blocks.length){
    console.error("invalid index");
    return false;
  }
  else if(header.parenthash!=last.header.hash){
    console.error("invalid parenthash");
    return false;
  }
  else if(header.hash!=calculateHashForBlock(block)){
    console.error("invalid hash");
    return false;
  }
  else if(header.timestamp>date.getTime()){
    console.error("invalid timestamp");
    return false;
  }
  else if(header.txnum!=tx_sum){
    console.error("invalid txnum");
    return false;
  }
  else if(header.validator.indexOf(/^PH/)==-1||last.candidates[header.validator]==null){
    console.error("invalid validator");
    return false;
  }
  else if(header.validator!=CryptoSet.AddressFromPublic(header.validatorPub)){
    console.error("invalid validatorPub");
    return false;
  }
  else if(!CryptoSet.verifyData(header.hash,header.signature,header.validatorPub)){
    console.error("invalid signature");
    return false;
  }
  else if(header.fee<0||dag_rate*dag_sizes<header.fee){
    console.error("invalid fee");
    return false;
  }
  else if(header.candidates!=valid_candidates){
    console.error("invalid candidates");
    return false;
  }
  else if(header.transactionsRoot!=GetTreeroot(sorted_hashs)){
    console.error("invalid transactionsRoot");
    return false;
  }
  else if(header.stateRoot!=StateData.root.toString('hex')){
    console.error("invalid stateRoot");
    return false;
  }
  else{
    return true;
  }
}

function default_state_change(tx,pre_StateData){
  const state = SetState(pull_tx_from(tx),pre_StateData);
  return (state)=>{
    state.nonce ++;
    return (state)=>{
      state.used_hash.push(pull_tx_evidence(tx));
      return state;
    }
  }
}


function ChangeState(tx,pre_StateData,currency_name){
  const new_state = ((state,tx) => {
    return (state,tx) =>{
      const first = state.nonce ++;
      return (first,tx) =>{
        const seconde = first.used_hash.push(pull_tx_evidence(tx));
        return seconde;
      }
    }
  })(SetState(pull_tx_from(tx),pre_StateData),tx);
  const StateData = ((pre,new_s)=>{
    ChangeTrie(pre,new_s).then(result=>{return result;});
  })(pre_StateData,new_state);
  switch (pull_tx_type(tx)) {
    case "remit":
      return remit(tx,StateData);
      break;
    case "register_code":
      return register_code(tx,StateData);
      break;
    case "issue_token":
     return issue_token(tx,StateData,currency_name);
     break;
    case "increase_token":
      return increase_token(tx,StateData,currency_name);
      break;
    case "deposit":
      return deposit(tx,StateData);
      break;
    case "withdrawal":
      return withdrawal(tx,StateData);
      break;
    case "set_data":
      return set_data(tx,StateData);
      break;
    case "remove_data":
      return remove_data(tx,StateData);
      break;
    case "set_savers":
      return set_savers(tx,StateData);
      break;
    case "reset_savers":
      return reset_savers(tx,StateData);
      break;
    default:
      return false;
      break;
    }
}

function ReducePool(list,Pool){
  const new_pool = Object.keys(Pool).filter(key=>{
    return key != this;
  },list.meta.root_hash);
  return new_pool;
}

function sacrifice_dags(block,StateData,dag_exchange){
  const exchange_state = ((StateData,address)=>{
    GetState(StateData,address).then(s=>{return s;}).catch(()=>{return StateJson(address,0,{},{},{},{},{},{},{},"");})
  })(StateData,dag_exchange);
  const new_storage = Object.entries(exchange_state.storage).reduce((obj,val)=>{
    if(val[1].tag.type!="bought" && block.header.dags.indexOf(val[1].tag.dag_hash)==-1 && val[1].user!=validator){
      obj[val[0]] = val[1];
    }
    else {
      const new_tag = {type:"sacrificed",dag_hash:val[1].tag.dag_hash};
      const pre_new = {
        user:validator,
        size:Buffer.from(JSON.stringify(new_tag)).length,
        tag:new_tag,
        tip_hashs:val[1].tip_hashs,
        save_number:val[1].save_number,
      };
      const hash = toHash(JSON.stringify(pre_new));
      const new_sto = {
        user:validator,
        hash:hash,
        size:Buffer.from(JSON.stringify(new_tag)).length,
        tag:new_tag,
        tip_hashs:val[1].tip_hashs,
        save_number:val[1].save_number,
      };
      obj[hash] = new_sto;
    }
    return obj
    },{});
    const new_state = ((s,n)=>{
      s.storage = n;
      return s;
    })(exchange_state,new_storage);
    ChangeTrie(StateData,new_state).then(result=>{return result});
}

function AddBlock(block,Blocks,StateData,dag_rate,DagData,currency_name,tx_rate,pre_Pool,dag_exchange){
  const Pool = block.transactions.forEach(val=>{
    if(this[val.meta.root_hash]==null){
      return TxListtoPool(val,StateData,DagData,currency_name,tx_rate,this)
    }
    else{
      return this;
    }
  },pre_Pool);
  const new_pool = block.transactions.reduce((pool,val)=>{
    return ReducePool(val,pool);
  },Pool);
  const sacrifice_state = sacrifice_dags(block,StateData,dag_exchange);
  if(!inValidBlock(block,Blocks,StateData,dag_rate,DagData,Pool,dag_exchange)){
    return {
      BlockChain:Blocks,
      State:sacrifice_state,
      Pool:new_pool
    };
  }
  else{
    const new_blockchain = Blocks.push(block);
    const new_state = block.transactions.reduce((state,val)=>{
      return val.transactions.reduce((s,v)=>{
        return ChangeState(v,s,currency_name);
      },state);
    },sacrifice_state);
    return {
      BlockChain:new_blockchain,
      State:new_state,
      Pool:new_pool
    };
  }
}

function ReplaceBlock(block,chain,lomgrange,StateData,dag_rate,DagData,currency_name,tx_rate,pre_Pool,dag_exchange){
  if(chain.length-lomgrange>block.header.index||chain.length>=block.header.index||chain[block.header.index-1]==null||block.header.index==null||block.header.validator==null){
    console.error("This is lomgrange attack!");
    return false;
  }
  const target = chain[block.header.index].header;
  const last = chain[block.header.index-1].header;
  const my_p = Proof_of_Stake_with_Dag(target.validator,last.candidates,target.hash);
  const new_p = Proof_of_Stake_with_Dag(block.header.validator,last.candidates,block.header.hash);
  if(new_p<my_p){
    const new_chain = chain.slice(0,block.header.index-1);
    const replaced = AddBlock(block,new_chain,StateData,dag_rate,DagData,currency_name,tx_rate,pre_Pool,dag_exchange);
    return replaced;
  }
  else {
    const sacrifice_state = sacrifice_dags(block,StateData,dag_exchange);
    return{
      BlockChain:chain,
      State:sacrifice_state,
      Pool:pre_pool
    };
  }
}
