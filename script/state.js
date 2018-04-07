//const Proof = require('merkle-patricia-tree/proof');
const fs = require('fs');
const crypto = require('crypto');

const CryptoSet = require('./crypto_set.js');
const _ = require('./basic.js');
const TxSet = require('./transaction.js');
const StateSet = require('./state.js');
const Read = require('./read.js');
const Write = require('./write.js');

//const levelup = require('levelup');
//const leveldown = require('leveldown');
const rlp = require('rlp');
//const db = levelup(leveldown('./db/blockchain'));

const currency_name = 'nix';
const dag_exchange = CryptoSet.AppAddress('TheDagExchange');
const dag_rate = 100;
const tx_rate = 10;
const lomgrange = 100;
const txlimit = 10;

function GetState(StateData,address){
  const en_address = Buffer.from(address,'utf-8');
  return new Promise((resolve, reject)=>{
    StateData.get(en_address,(err,val)=>{
      if(val) resolve(JSON.parse(rlp.decode(val)));
      else if(err) reject(err);
    });
  });
}

function StateJson(address,nonce,balance,deposit,mortgage,used_hash,issue_token,storage,code,developer){
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

function remit(tx,StateData){
  const from = tx.from;
  const to = tx.to;
  const from_to = {
    from:SetState(from,StateData),
    to:SetState(to,StateData)
  };
  const value = tx.options;
  const states = Object.entries(value).reduce((balances,val)=>{
    balances.from.balance[val[0]] -= val[1];
    balances.to.balance[val[0]] += val[1];
    return balance;
  },from_to);
  const new_state = Object.values(states).reduce((all_state,val)=>{
    return Write.State(all_state,val);
  },StateData);
  return new_state;
}


function register_code(tx,StateData){
  const from = tx.from;
  const to = tx.to;
  const code= tx.options;
  const app = Object.entries(code).reduce((state,val)=>{
    state[val[0]] = val[1];
  },SetState(to,StateData));
  const new_app = ((app,from) => {
    app.developer = from;
    return app;
  })(app,from);
  const new_state = ((StateData,new_app) => {
    return Write.State(StateData,new_app)
  })(StateData,new_app);
  return new_state;
}


function issue_token(tx,StateData,currency_name){
  const from = tx.from;
  const token= tx.options;
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
    return Write.State(StateData,app_mortgage);
  })(StateData,app_mortgage);
  return new_state;
}


function increase_token(tx,StateData,currency_name){
  const from = tx.from;
  const inc = tx.options;
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
    return Write.State(StateData,app_issue);
  })(StateData,app_issue);
  return new_state;
}

function deposit(tx,StateData){
  const from = tx.from;
  const to = tx.to;
  const deposit = tx.options;
  const user = SetState(from,StateData);
  const app = SetState(to,StateData);
  const user_state = Object.entries(deposit).reduce((state,val)=>{
    return state.balance[val[0]] -= val[1];
  },user);
  const app_state = Object.entries(deposit).reduce((state,val)=>{
    return state.deposit[val[0]] += val[1];
  },app);
  const new_state = [user_state,app_state].reduce((state,val)=>{
    return Write.State(state,val);
  },StateData);
  return new_state;
}

function withdrawal(tx,StateData){
  const from = tx.from;
  const to = tx.to;
  const withdrawal = tx.options;
  const user = SetState(from,StateData);
  const app = SetState(to,StateData);
  const user_state = Object.entries(withdrawal).reduce((state,val)=>{
    return state.balance[val[0]] += val[1];
  },user);
  const app_state = Object.entries(withdrawal).reduce((state,val)=>{
    return state.deposit[val[0]] -= val[1];
  },app);
  const new_state = [user_state,app_state].reduce((state,val)=>{
    return Write.State(state,val);
  },StateData);
  return new_state;
}

function set_data(tx,StateData){
  const from = tx.from;
  const set_data = tx.options;
  const app = SetState(from,StateData);
  const new_storage = ((set_data,app)=>{
    app.storage[set_data.hash] = set_data;
    return app;
  })(set_data,app);
  const new_state = ((StateData,new_storage) =>{
    return Write.State(StateData,new_storage);
  })(StateData,new_storage);
  return new_state;
}


function remove_data(tx,StateData){
  const from = tx.from;
  const remove_hash = tx.options.root_hash;
  const app = SetState(from,StateData);
  const new_storage = ((remove_hash,app)=>{
    delete app.storage[remove_hash];
    return app;
  })(remove_hash,app);
  const new_state = ((StateData,new_storage) =>{
    return Write.State(StateData,new_storage);
  })(StateData,new_storage);
  return new_state;
}

function set_savers(tx,StateData){
  const from = tx.from;
  const set_savers = tx.options;
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
    return Write.State(StateData,new_savers);
  })(StateData,new_savers);
  return new_state;
}

function reset_savers(tx,StateData){
  const from = tx.from;
  const remove_savers = tx.options;
  const app = SetState(from,StateData);
  const new_savers = ((remove_savers,app)=>{
    delete app.storage[remove_savers.root_hash].tips
    return app;
  })(remove_savers,app);
  const new_state = ((StateData,new_savers) =>{
    return Write.State(StateData,new_savers);
  })(StateData,new_savers);
  return new_state;
}

function default_state_change(tx,pre_StateData){
  const state = SetState(tx.from,pre_StateData);
  return (state)=>{
    state.nonce ++;
    return (state)=>{
      state.used_hash.push(tx.evidence);
      return state;
    }
  }
}


function ChangeState(tx,pre_StateData,currency_name){
  const new_state = ((state,tx) => {
    return (state,tx) =>{
      const first = state.nonce ++;
      return (first,tx) =>{
        const seconde = first.used_hash.push(tx.evidence);
        return seconde;
      }
    }
  })(SetState(tx.from,pre_StateData),tx);
  const StateData = ((pre,new_s)=>{
    return Write.State(pre,new_s);
  })(pre_StateData,new_state);
  switch (tx.type) {
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
      const hash = _.toHash(JSON.stringify(pre_new));
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
    return Write.State(StateData,new_state);
}


const password = 'Sora';
const my_pub = CryptoSet.PullMyPublic(password);
const my_address = CryptoSet.AddressFromPublic(my_pub);
CryptoSet.GenerateKeys("Test");
const test_pub = CryptoSet.PullMyPublic("Test");
const test_address = CryptoSet.AddressFromPublic(test_pub);

const first_state = StateJson(my_address,0,{nix:10000000},{},{},{},{},{},{},"");

//console.log(Write.State(Read.State(),first_state));
Write.State(Read.State(),first_state).then(res=>{
  console.log(res);
  console.log(Read.State().root.toString('hex'));
  GetState(Read.State(),first_state.address).then(s=>{console.log(s);});
});
//GetState(Read.State(),first_state.address).then(s=>{console.log(s);});

module.exports = {
  SetState:SetState,
  ChangeState:ChangeState,
  sacrifice_dags:sacrifice_dags
}
