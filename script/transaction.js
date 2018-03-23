const crypto = require('crypto');

const CryptoSet = require('./crypto_set.js');
const _ = require('./basic.js');
const TxSet = require('./transaction.js');
const StateSet = require('./state.js');
const Read = require('./read.js');
const Write = require('./write.js');

const currency_name = 'nix';
const dag_exchange = CryptoSet.AppAddress('TheDagExchange');
const dag_rate = 100;
const tx_rate = 10;
const lomgrange = 100;
const txlimit = 10;

function calculatePureHash(Tx){
  const array = Object.entries(Tx||{}).filter(function(val){
    return (val[0]!="pure_hash"&&val[0]!="pre_tx"&&val[0]!="next_tx"&&val[0]!="hash");
  });
  const edit_tx = _.array_to_obj(array);
  return _.toHash(JSON.stringify(edit_tx));
}

function calculateHashForTx(Tx){
  const array = Object.entries(Tx||{}).filter(function(val){
    return (val[0]!="hash"&&val[0]!="signature");
  });
  const edit_tx = _.array_to_obj(array);
  return _.toHash(JSON.stringify(edit_tx));
}


function TxJson(type,from,to,options,timestamp,fee,nonce,pure_hash,evidence,pre_tx="",next_tx="",hash){
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

function Confirmes(dag,DagData){
  const first_confirm = Object.values(DagData).find(function(val){
    return val[0][10]==this[0][11];
  },dag);
  const second_confirm = Object.values(DagData).find(function(val){
    return val[0][10]==this[0][11];
  },first_confirm);
  return second_confirm[0][10];
}

function good_fee(tx,tx_rate){
  const filtered = Object.entries(tx||{}).filter(function(val){
    return (val[0]!="fee"&&val[0]!="nonce"&&val[0]!="pure_hash"&&val[0]!="pre_tx"&&val[0]!="next_tx"&&val[0]!="hash");
  });
  return Buffer.from(JSON.stringify(_.array_to_obj(filtered))).length*tx_rate;
};

function inValidTx(tx,StateData,DagData,currency_name,tx_rate){
  const date = new Date();
  const from = tx.from;
  const state = StateSet.SetState(from,StateData);
  const dag = DagData[tx.evidence];
  const evidence_check = dag.data.outputs.data.reduce((res,val)=>{
    if(res) return res;
    else if((val==tx&&val.evidence==tx.evidence)||val.evidence==null){
      res = false;
      return res;
    }
    else return res;
  },false);

  if(_.maybe(tx)){
    console.error("invalid object");
    return false;
  }
  else if(tx.timestamp>date.getTime()){
    console.error("invalid timestamp");
    return false;
  }
  else if(tx.fee!=good_fee(tx,tx_rate)){
    console.error("invalid fee");
    return false;
  }
  else if(tx.nonce!=state.nonce){
    console.error("invalid nonce");
    return false;
  }
  else if(tx.pure_hash!=calculatePureHash(tx)){
    console.error("invalid pure hash");
    return false;
  }
  else if((dag.meta.app!=from)||(state.used_hash.indexOf(tx.evidence)!=-1)||(Confirmes(dag,DagData)==null)||(dag.data.outputs.data.indexOf(tx)==-1)||(evidence_check)){
    console.error("invalid evidence");
    return false;
  }
  else if(tx.hash!=calculateHashForTx(tx)){
    console.error("invalid hash");
    return false;
  }
  else if(1){
    const to = tx.to;
    const storage = state.storage;
    switch (tx.type) {
      case "remit":
        const value = tx.options;
        Object.entries(value).reduce((state,val)=>{
          if(state.balance[val[0]]==null || state.balance[val[0]]<val[1]){
            console.error("invalid value");
            return false;
          }
        },state);
        break;
      case "register_code":
        const app = StateSet.SetState(to,StateData);
        const code = tx.options;
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
        const token = tx.options;
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
        const inc = tx.options;
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
        const deposit = tx.options;
        Object.entries(deposit).reduce((state,val)=>{
          if(state.balance[val[0]]==null || state.balance[val[0]]<val[1]){
            console.error("invalid deposit");
            return false;
          }
        },state);
        break;
      case "withdrawal":
        const withdrawal = tx.options;
        const savings  = StateSet.SetState(to,StateData);
        Object.entries(withdrawal).reduce((save,val)=>{
          if(savings.balance[val[0]]==null || savings.balance[val[0]]<val[1]){
            console.error("invalid withdrawal");
            return false;
          }
        },savings);
        break;
      case "set_data":
        const set_data = tx.options;
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
        const remove_data = tx.options;
        if(storage[remove_data.hash]==null){
          console.error("This hash doesn't exist");
          return false;
        }
        break;
      case "set_savers":
        const set_savers = tx.options;
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
        const reset_savers = tx.options;
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
  if(pre.length==1) return pre[0];
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
      this.push(_.toHash(left+right));
    }
  },[]);
  return arguments.callee(union);
  }
}

function TxList(Txs){
  if(Txs.length==0){
    return{
      meta:{
        num:0,
        root_hash:toHash("")
      },
      transactions:[]
    }
  }
  const num = Txs.length;
  const hashs = Txs.map(val=>{
    return val.hash;
  });
  const root_hash = GetTreeroot(hashs);
  return{
    meta:{
      num:num,
      root_hash:root_hash
    },
    transactions:Txs
  }
}

function inValidTxList(list,StateData,DagData,currency_name,tx_rate){
  const tx_check = list.transactions.forEach(val=>{
    if(!inValidTx(val,StateData,DagData,currency_name,tx_rate)) return true;
  });
  const hashs = list.transactions.map(val=>{
    return val.hash;
  });
  const pure_hashs = list.transactions.map(val=>{
    return val.pure_hash;
  });
  const relation_check = list.transactions.forEach((val,index,array)=>{
    if(val.pre_tx!=""&&val.pre_tx!=this[index-1]) return true;
    else if(val.next_tx!=""&&val.next_tx!=this[index+1]) return true;
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

function TxListtoPool(list,StateData,DagData,currency_name,tx_rate,Pool){
  if(!inValidTxList(list,StateData,DagData,currency_name,tx_rate)) return false;
  else if(Pool[list.meta.root_hash]!=null) return false;
  else{
    Pool[list.meta.root_hash] = list;
    return Pool;
  }
}

function CreateTx(type,from,to,option,tx_rate,evidence,pre_tx="",next_tx="",StateData){
  const date = new Date();
  const timestamp = date.getTime();
  const first = TxJson(type,from,to,option,timestamp,"","","",evidence,"","","");
  const fee = good_fee(first,tx_rate);
  const state = StateSet.SetState(from,StateData);
  const nonce = state.nonce;
  const second = TxJson(type,from,to,option,timestamp,fee,nonce,"",evidence,"","","");
  const pure_hash = calculatePureHash(second);
  const third = TxJson(type,from,to,option,timestamp,fee,nonce,pure_hash,evidence,pre_tx,next_tx,"");
  const hash = calculateHashForTx(third);
  const new_tx = TxJson(type,from,to,option,timestamp,fee,nonce,pure_hash,evidence,pre_tx,next_tx,hash);
  return new_tx;
}

function CreateTxList(txs,StateData,DagData,currency_name,tx_rate,Pool){
  const list = TxList(txs);
  return TxListtoPool(list,StateData,DagData,currency_name,tx_rate,Pool);
}

/*
const password = 'Sora';
const my_pub = CryptoSet.PullMyPublic(password);
const my_address = CryptoSet.AddressFromPublic(my_pub);
CryptoSet.GenerateKeys("Test");
const test_pub = CryptoSet.PullMyPublic("Test");
const test_address = CryptoSet.AddressFromPublic(test_pub);
const t = CreateTx("remit",my_address,test_address,{nix:100},tx_rate,"","","",Read.State());
console.log(t);
*/



module.exports = {
  GetTreeroot:GetTreeroot,
  TxListtoPool:TxListtoPool,
  CreateTx:CreateTx
};
