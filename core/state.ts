declare function require(x: string): any;

import * as crypto from 'crypto'
import * as _ from './basic'
import {Trie} from './merkle_patricia'
import * as StateSet from './state'
import * as DagSet from './dag'
import * as ChainSet from './chain'
import * as IpfsSet from './ipfs'

const CryptoSet = require('./crypto_set.js');
const {map,reduce,filter,forEach} = require('p-iteration');
//const RadixTree = require('dfinity-radix-tree');
//const levelup = require('levelup');
//const leveldown = require('leveldown');
//const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');

// These are for test.
const password = 'Sora';
const my_pub = CryptoSet.PullMyPublic(password);
const my_address = CryptoSet.AddressFromPublic(my_pub);
CryptoSet.GenerateKeys("Test");
const test_pub = CryptoSet.PullMyPublic("Test");
const test_address = CryptoSet.AddressFromPublic(test_pub);
// These are for test.

export type StateContent = {
  owner: string;
  token: string;
  tag: {[key:string]: any;};
  data: string;
  product: string;
};

export type State = {
  hash: string;
  amount: number;
  contents: StateContent;
};

/*export type Code = (input:DagSet.Input,raw:string[],states:{dag:any;world:any;t_state:Token,tokens:any},library:{crypto:any,map:any,reduce:any,filter:any,forEach:any,some:any})=>DagSet.Output;*/

export type Token = {
  token: string;
  issued: number;
  codehash:string;
  developer: string;
};



/*export type Token = {
  token: string;
  issued: number;
  stateroot: string;
  issue_code: string;
  change_code: string;
  scrap_code: string;
  create_code: string;
  developer: string;
};*/

function FunctoStr(func):string{
  return func.toString().replace(/^\(\)\s=>\s{/,"").replace(/}$/,"");
}

export function CreateState(amount:number,owner:string,token:string,tag:{[key:string]:any},data:string,product:string){
  const pre_1:State = {
    hash:"",
    amount:amount,
    contents:{
      owner:owner,
      token:token,
      tag:tag,
      data:data,
      product:product
    }
  }
  const hash = _.toHash(JSON.stringify(pre_1.contents));
  const state = ((pre_1,hash)=>{
    pre_1.hash = hash;
    return pre_1;
  })(pre_1,hash);
  return state;
}

/*async function empty_tree(db){
  const key_currency_tree = new RadixTree({
    db: db
  });
  const empty_tree = await key_currency_tree.emptyTreeState();
  const empty_tree_root = await empty_tree.flush();
  return empty_tree_root;
}*/
/*
const key_change_code = async ()=>{
  const lib = require('./library_for_js');
  const new_states = (async()=>{
    if(token_state.token==raw.from||raw.from==null||raw.to==null||raw.amount==null||raw.pub_key==null||raw.sign==null||lib.CryptoSet.verifyData(lib.toHash(raw.from+raw.to+raw.amount+raw.pub_key),raw.sign,raw.pub_key)==false) return [];
    else{
      const changed = await lib.reduce(input.token_id, async(change,id,i,array)=>{
        const state = await tokens.get(lib.en_key(id));
        if(i==array.length-1&&change.sum<raw.amount){
          change.result = [];
          return change;
        }
        else if(state.contents.owner==raw.from&&change.sum+state.contents.amount>raw.amount){
          state.contents.owner = raw.to;
          state.contents.amount = raw.amount;
          const add_state_con = {
            owner: raw.to,
            amount: change.sum+state.contents.amount-raw.amount,
            tag: {},
            data: {selfhash:"",ipfshash:""}
          };
          const add_state = {
            hash: lib.toHash(JSON.stringify(add_state_con)),
            contents:add_state_con
          }
          change.result.push(state).push(add_state);
        }
        else if(state.contents.owner==raw.from&&change.sum+state.contents.amount<=raw.amount){
          state.contents.owner = raw.to;
          change.result.push(state);
          return change;
        }
      },{sum:0,result:[]});
    return changed.result;
    }
  })();
  return {
    states:await new_states,
    app_rate:0,
    new_token:[],
    log:""
  };
};

const create_new_token = async ()=>{
  const lib = require('./library_for_js');
  const result = (async ()=>{
    const exsit = await AddressState.get(lib.en_key(raw.token));
    const check_hash = lib.toHash(raw.token+raw.issued+raw.stateroot+raw.issue_code+raw.change_code+raw.scrap_code+raw.create_code+raw.developer+raw.pub_key) || "";
    if(raw.token==null||raw.issued==null||raw.stateroot==null||raw.issue_code==null||raw.change_code==null||raw.scrap_code==null||raw.create_code==null||raw.developer==null||raw.pub_key==null||raw.sign==null||lib.CryptoSet.verifyData(check_hash,raw.sign,raw.pub_key)==false||exsit!=null) return [];
    else{
      const new_token = {
        token: raw.token,
        issued: raw.issued,
        stateroot: raw.stateroot,
        issue_code: raw.issue_code,
        change_code: raw.change_code,
        scrap_code: raw.scrap_code,
        create_code: raw.create_code,
        developer: raw.developer
      };
      return [new_token];
    }
  })();
  return{
    states:[],
    app_rate:0,
    new_token:await result,
    log:""
  }
};


const PNS_register = async ()=>{
  const lib = require('./library_for_js');
  const new_states = (async ()=>{
    const exsit = await AddressState.get(lib.en_key(raw.token));
    const exist_check = exist.some((obj)=>{
      if(obj.kind==token_state.token){
        return true;
      }
      else return false
    });
    if(raw.name==null||raw.token==null||raw.developer==null||raw.pub_key==null||raw.sign==null||lib.CryptoSet.verifyData(lib.toHash(raw.name+raw.token+raw.developer+raw.pub_key),raw.sign,raw.pub_key)==false||exist_check==true) return [];
    else{
      const selfhash = lib.toHash(raw.token);
      const ipfshash = lib.ipfs_hash(selfhash);
      const created_con = {
        owner:raw.developer,
        amount:1,
        tag:{name:raw.name},
        data:{selfhash:selfhash,Ipfshash:ipfshash}
      }
      const created = {
        hash:lib.toHash(JSON.stringify(created_con)),
        contents:created_con
      }
      return [created];
    }
  })();
  return{
    states:await new_states,
    app_rate:0,
    new_token:[],
    log:""
  };
};

const PNS_change = async ()=>{
  const lib = require('./library_for_js');
  const new_states = (async ()=>{
    const exsit = await AddressState.get(lib.en_key(raw.token));
    const exist_check = exist.some((obj)=>{
      if(obj.kind==token_state.token){
        return true;
      }
      else return false;
    });
    const pre_state = await tokens.get(lib.en_key(raw.pre));
    if(raw.name==null||raw.token==null||raw.developer==null||raw.pub_key==null||raw.sign==null||raw.pre==null||lib.CryptoSet.verifyData(lib.toHash(raw.name+raw.token+raw.developer+raw.pub_key),raw.sign,raw.pub_key)==false||exsit_check==true||raw.name!=pre_state.contents.tag.name) return [];
    else{
      const selfhash = lib.toHash(raw.token);
      const ipfshash = lib.ipfs_hash(selfhash);
      const changed_con = {
        owner:raw.developer,
        amount:1,
        tag:{name:raw.name},
        data:{selfhash:selfhash,Ipfshash:ipfshash}
      }
      const created = {
        hash:lib.toHash(JSON.stringify(created_con)),
        contents:created_con
      }
      return [created];
    }
  })();
  return{
    states:await new_states,
    app_rate:0,
    new_token:[],
    log:""
  };
};

const buy_dags = async ()=>{
  const lib = require('./library_for_js');
  const new_states = (async ()=>{
    const aliases = await AddressState.get(lib.en_key(token_state.token));
    const already_check = await lib.some(aliases,async (alias)=>{
    const state = await tokens.get(lib.en_key(alias.key));
    if(alias.kind==token_state.token&&raw.unit==state.contents.tag.unit) return true;
    else return false;
    });
    if(raw.address==null||raw.unit==null||raw.pub_key==null||raw.sign==null||lib.CryptoSet.verifyData(lib.toHash(raw.address+raw.unit+raw.pub_key),raw.sign,raw.pub_key)==false||already_check==true) return [];
    else{
      const new_state_con = {
        owner:raw.address,
        amount:1,
        tag:{},
        data:{selfhash:"",ipfshash:""}
      }
      const common_con = {
        owner:token_state.token,
        amount:0,
        tag:{unit:raw.unit,type:"bought",value:1},
        data:{selfhash:"",ipfshash:""}
      }
    }

    const exist_check = exist.some((obj)=>{
      if(obj.kind==token_state.token){
        return true;
      }
      else return false
    });

    if(raw.name==null||raw.token==null||raw.developer==null||raw.pub_key==null||raw.sign==null||lib.CryptoSet.verifyData(lib.toHash(raw.name+raw.token+raw.developer+raw.pub_key),raw.sign,raw.pub_key)==false||exist_check==true) return [];
    else{
      const selfhash = lib.toHash(raw.token);
      const ipfshash = lib.ipfs_hash(selfhash);
      const created_con = {
        owner:raw.developer,
        amount:1,
        tag:{name:raw.name},
        data:{selfhash:selfhash,Ipfshash:ipfshash}
      }
      const created = {
        hash:lib.toHash(JSON.stringify(created_con)),
        contents:created_con
      }
      return [created];
    }
  })();
  return{
    states:await new_states,
    app_rate:0,
    new_token:[],
    log:""
  };
};*/
/*
empty_tree(db).then(root=>{
  const KeyCurrency:Token = {
    token:'nix_0.0.1',
    issued:70000000,
    stateroot:root,
    issue_code:"",
    change_code:FunctoStr(key_change_code),
    scrap_code:"",
    create_code:FunctoStr(create_new_token),
    developer:my_address
  };

  const PNS:Token = {
    token:'pns',
    issued:0,
    stateroot:root,
    issue_code:FunctoStr(PNS_register),
    change_code:FunctoStr(PNS_change),
    scrap_code:"",
    create_code:"",
    developer:my_address
  };

  const Sacrifice:Token = {
    token:'sacrifice_0.0.1',
    issued:0,
    stateroot:root,
    issue_code:FunctoStr(PNS_register),
    change_code:FunctoStr(PNS_change),
    scrap_code:"",
    create_code:"",
    developer:my_address
  };
});*/
