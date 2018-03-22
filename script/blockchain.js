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
const password = "Sora"
const beneficiaryPub = CryptoSet.PullMyPublic(password);
const beneficiary = CryptoSet.AddressFromPublic(beneficiaryPub);

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
  return _.toHash(JSON.stringify(edit_block));
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
    const sorted = _.array_to_obj(sorted_array);
    const all = Object.values(sorted).reduce((sum,val)=>{
      return sum + val;
    });
    const result = uni_hash % all;
    const this_elected = elected(sorted,result,-1,0);
    if(address==this_elected) return i;
    else{
      const new_candidates = _.array_to_obj(Object.entries(candidates).filter(val=>{
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
    if(candidates.length<=70){const judged = candidates;}
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
  if(_.maybe(block)){
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
  else if(header.transactionsRoot!=TxSet.GetTreeroot(sorted_hashs)){
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

function ReducePool(list,Pool){
  const new_pool = Object.keys(Pool).filter(key=>{
    return key != this;
  },list.meta.root_hash);
  return new_pool;
}


function AddBlock(block,Blocks,StateData,dag_rate,DagData,currency_name,tx_rate,pre_Pool,dag_exchange){
  const Pool = block.transactions.forEach(val=>{
    if(this[val.meta.root_hash]==null){
      return TxSet.TxListtoPool(val,StateData,DagData,currency_name,tx_rate,this)
    }
    else{
      return this;
    }
  },pre_Pool);
  const new_pool = block.transactions.reduce((pool,val)=>{
    return ReducePool(val,pool);
  },Pool);
  const sacrifice_state = StateSet.sacrifice_dags(block,StateData,dag_exchange);
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
        return StateSet.ChangeState(v,s,currency_name);
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
    const sacrifice_state = StateSet.sacrifice_dags(block,StateData,dag_exchange);
    return{
      BlockChain:chain,
      State:sacrifice_state,
      Pool:pre_pool
    };
  }
}
