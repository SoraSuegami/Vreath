declare function require(x: string): any;

import * as crypto from 'crypto'
import * as fs from 'fs'
import {execSync} from 'child_process'
import * as T from '../core/types'
import * as _ from '../core/basic'
import {Trie} from '../core/merkle_patricia'
import * as StateSet from '../core/state'
import * as DagSet from '../core/dag'
import * as TxSet from '../core/tx'
import * as ChainSet from '../core/chain'
import * as PoolSet from '../core/tx_pool'
import * as IpfsSet from '../core/ipfs'
import {db,tag_limit,key_currency,fee_by_size,log_limit,unit_token,group_size} from './con'
import * as R from 'ramda'
import * as util from 'util'

const CryptoSet = require('../core/crypto_set.js');
const {map,reduce,filter,forEach,find} = require('p-iteration');
const rlp = require('rlp');
const request = require('request');
/*const express = require('express');
const app = express();*/

const url = require('url');
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');


const lib_func = (name:string,args:any[])=>{
  switch(name){
    case "GetAddress":
      return CryptoSet.AddressFromPublic(CryptoSet.PullMyPublic.apply(this,args));
  }
};

const headers = {
  'Content-Type':'application/json'
}

/*const set = async ()=>{
  console.log(db)
  const StateData = new Trie(db);
  const pre_1:StateSet.State = {
    hash:"",
    amount:1000000,
    contents:{
      owner:"PHe71b07d255f652bf137074b5af146d",
      token:key_currency,
      tag:{},
      data:"",
      product:"",
    }
  };
  const state_hash = _.toHash(JSON.stringify(pre_1));
  const first_state:StateSet.State = {
    hash:state_hash,
    amount:1000000,
    contents:{
      owner:"PHe71b07d255f652bf137074b5af146d",
      token:key_currency,
      tag:{},
      data:"",
      product:"",
    }
  };
  //await StateData.put(first_state.hash,first_state);
  const filtered = await StateData.filter();
  console.log(filtered);
  console.log(StateData.now_root());
}
set().then(()=>{console.log('OK')})*/
/*
(async ()=>{
  const StateData = new Trie(db,genesis_root_json.stateroot);
  await StateData.delete("91dbfd9fb2c104eedac4ea7539bd62660363401854fc581912c4861c1c0b9ec8e981644cb97a29317688fa34fccd51ded5ea5146e5015a5a7cc16ec0bb52d738");
  const pre_1:StateSet.State = {
    hash:"",
    amount:1000000,
    contents:{
      owner:"PHe71b07d255f652bf137074b5af146d",
      token:key_currency,
      tag:{},
      data:"",
      product:"",
    }
  };
  const state_hash = _.toHash(JSON.stringify(pre_1));
  const first_state:StateSet.State = {
    hash:state_hash,
    amount:1000000,
    contents:{
      owner:"PHe71b07d255f652bf137074b5af146d",
      token:key_currency,
      tag:{},
      data:"",
      product:"",
    }
  };
  await StateData.put(first_state.hash,first_state);
  const filtered = await StateData.filter();
  console.log(filtered);
  console.log(StateData.now_root());
})()

/*app.set('a','b');
app.get('/', function (req, res) {
  res.send(module.parent.exports.set('a'));
});*/
//import * as express from 'express'

/*const first_token:StateSet.Token = {
  token:key_currency,
  issued:10,
  codehash:"d90a9e605f88735006abaf513d38f91212aa9b5e339b8babe5c034f32f98a9e7de7c8e010715aefbd49e734c2617098d560719d78617217131fcf9e118b96744",
  developer:""
};
let tokens_json = {};
tokens_json[_.toHash(first_token.token)] = first_token;
fs.writeFileSync("./json/token.json",JSON.stringify(tokens_json));*/
/*
const first_state:StateSet.State = {
  hash:"91dbfd9fb2c104eedac4ea7539bd62660363401854fc581912c4861c1c0b9ec8e981644cb97a29317688fa34fccd51ded5ea5146e5015a5a7cc16ec0bb52d738",
  amount:10,
  contents:{
    owner:"PHbe5d786186c2715f6cd0dee771c78d",
    token:key_currency,
    tag:{},
    data:"",
    product:"",
  }
};*//*
const genesis_root = "56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421";

let genesis_root_json = JSON.parse(fs.readFileSync("./json/root.json","utf-8"));

const first_StateData = new Trie(db,genesis_root_json.stateroot);

CryptoSet.GenerateKeys("phoenix");
const test_pub = CryptoSet.PullMyPublic("phoenix");
console.log(test_pub)
const test_address = CryptoSet.AddressFromPublic(test_pub);

const DagData = new Trie(db,genesis_root_json.dag_root);

async function first_set(){

  await first_StateData.put(first_state.hash,first_state);
  const first_dag = await DagSet.CreateUnit("phoenix",test_pub,"",0,"",genesis_root_json.dag_root,1,["Hello Phoenix"],db);
  await DagData.put(first_dag.meta.hash,first_dag);
  return [first_StateData,DagData];
}*/
/*first_set().then(result=>{
  const state_root = result[0].now_root();
  const dag_root = result[1].now_root();
  console.log(dag_root);
  genesis_root_json.stateroot = state_root;
  genesis_root_json.dag_root = dag_root;
  console.log(genesis_root_json);
  fs.writeFileSync("./json/root.json",JSON.stringify(genesis_root_json));
});*/
/*
const RequestData = new Trie(db);

const sacrifice_state:StateSet.State = {
  hash:"",
  amount:100,
  contents:{
    owner:"PHbe5d786186c2715f6cd0dee771c78d",
    token:"sacrifice",
    tag:{},
    data:"0beb01318795598921c9f1da8cd5ffb7bb4f38da697a701c31a8751d5e4ae4af461b98f9001737f7d791f7f7e852d32d18043d5ec59239b17423c0e568a49508",
    product:"",
  }
};

(async ()=>{
  /*await DagData.delete("0beb01318795598921c9f1da8cd5ffb7bb4f38da697a701c31a8751d5e4ae4af461b98f9001737f7d791f7f7e852d32d18043d5ec59239b17423c0e568a49508");
  const first_dag = await DagSet.CreateUnit("phoenix",test_pub,"",0,"",genesis_root_json.dag_root,1,["Hello Phoenix"],db);
  await DagData.put(first_dag.meta.hash,first_dag);
  const filtered = await DagData.filter();
  console.log(filtered);
  console.log(first_dag.meta.hash);*/
  /*const state:StateSet.State = await first_StateData.get("91dbfd9fb2c104eedac4ea7539bd62660363401854fc581912c4861c1c0b9ec8e981644cb97a29317688fa34fccd51ded5ea5146e5015a5a7cc16ec0bb52d738");
  const request_tx = await TxSet.CreateRequestTx("phoenix","","",test_pub,0.1,state.hash,"issue","sacrifice",[],["00d7955885c7b97eff849c23786ed0a1d4b1bb9f5a17bcbc1cdbe75c55edd810a8c53a40e78346a148f1bb64b22ba2d459f7491c21f8a5c910ee3cd73a00e5d9"],[],[],[sacrifice_state],genesis_root_json.stateroot,db);
  console.log(request_tx)
  await RequestData.put(request_tx.meta.hash,request_tx);
  const request_root = RequestData.now_root();
  genesis_root_json.request_root = request_root;
  fs.writeFileSync("./json/root.json",JSON.stringify(genesis_root_json));
  const block = ChainSet.CreateBlock("phoenix",[],genesis_root_json.stateroot,request_root,0.001,1,test_pub,[],[request_tx]);

  //fs.writeFileSync("./json/blockchain.json",JSON.stringify([block]));
  console.log(await first_StateData.filter());
  return ""
})()*/

// サーバーを起動する部分
//var server = app.listen(3000, "127.0.0.1");/*, function () {
  /*var host = server.address().address;
  var port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);*/
/*});*/




const electron = require("electron");


// アプリケーションをコントロールするモジュール
const main = electron.app;

// ウィンドウを作成するモジュール
const BrowserWindow = electron.BrowserWindow;

const ipc = electron.ipcMain;
// メインウィンドウはGCされないようにグローバル宣言
let mainWindow;

db.close().then(()=>{
//execSync('node ./wallet/server.js');
// 全てのウィンドウが閉じたら終了
main.on('window-all-closed', function() {
 if (process.platform != 'darwin') {
 main.quit();
 }
});

// Electronの初期化完了後に実行
main.on('ready', ()=>{
 // メイン画面の表示。ウィンドウの幅、高さを指定できる
 //execSync('node ./wallet/server.js');
 mainWindow = new BrowserWindow({width: 1000, height: 800, 'node_integration':false});
 mainWindow.loadURL('file://'+__dirname+'/src/index.html');
 /*const peer_json = [
   {ip:"127.0.0.1",port:51753},
   {ip:"localhost",port:51754}
 ];
 fs.writeFileSync("./json/peer.json",JSON.stringify(peer_json));*/
 const fsw = fs.watch('./wallet/messages.json',{},()=>{
  /* console.log('changed');
   const genesis_root_json = JSON.parse(fs.readFileSync("./json/root.json","utf-8"));
   const DagData = new Trie(db,genesis_root_json.dag_root);
   const filtered = await DagData.filter();
   const logs:string[] = R.values(filtered).reduce((logs:string[],unit:DagSet.Unit)=>{
     return logs.concat(unit.log_raw);
   },[]);
   //console.log(logs)
   await db.close();*/
   const messages = JSON.parse(fs.readFileSync('./wallet/messages.json','utf-8'));
   mainWindow.webContents.send('new_message', messages);
 });

 ipc.on('GetAddress', async (event, arg)=>{
    const result = ((arg)=>{
      const pub_key = CryptoSet.PullMyPublic(arg);
      if(pub_key==null) CryptoSet.GenerateKeys(arg);
      return CryptoSet.AddressFromPublic(CryptoSet.PullMyPublic(arg));
    })(arg);

    /*let unit_state:T.State = {
      hash:"",
      amount:1000,
      contents:{
        owner:result,
        token:unit_token,
        tag:{hash:_.toHash("")},
        data:_.toHash(""),
        product:""
      }
    }
    const unit_state_hash = _.toHash(JSON.stringify(unit_state));
    unit_state.hash = unit_state_hash;
    const genesis_root_json = JSON.parse(fs.readFileSync("./json/root.json","utf-8"));
    //console.log(genesis_root_json.stateroot)
    await db.open();
    const StateData = new Trie(db,genesis_root_json.stateroot);

    await StateData.put(unit_state_hash,unit_state);

    console.log(StateData.now_root());
    console.log(await StateData.filter())
    await db.close();*/
    /*await db.open();
    const genesis_root_json = JSON.parse(fs.readFileSync("./json/root.json","utf-8"));
    const StateData = new Trie(db,genesis_root_json.stateroot);
    let first_block:T.Block = JSON.parse(fs.readFileSync('./json/blockchain.json','utf-8'))[0];
    const parenthash = first_block.contents.parenthash;
    first_block.contents.stateroot = "de7cb42a9bfe40ef221773487dd80ba81968f3ee767378c55b73c0255d466c08";
    first_block.contents.stake_diff = Math.pow(10,-100);
    const Sacrifice:{[key:string]:T.State} = await StateData.filter((key:string,value):boolean=>{
      const state:T.State = value;
      return state.contents.token==unit_token&&state.amount>0;
    });
    const first_can = ChainSet.RightCandidates(Sacrifice,group_size,parenthash);
    fs.writeFileSync("./json/candidates.json",JSON.stringify(first_can));
    first_block.contents.candidates = _.toHash(JSON.stringify(first_can));
    first_block.contents.timestamp = ChainSet.PoS_mining(parenthash,result,1000,first_block.contents.stake_diff);
    first_block.meta.hash = _.toHash(JSON.stringify(first_block.contents));
    first_block.meta.validatorSign = CryptoSet.SignData(first_block.meta.hash,arg);
    console.log(first_block);
    fs.writeFileSync("./json/genesis_block.json",JSON.stringify([first_block]));
    await db.close();*/
    event.sender.send('R_GetAddress',result);
    /*
    const alias:T.RequestsAlias = {
      req:{
        state:'yet',
        index:0,
        hash:_.toHash("")
      },
      ref:{
        state:'yet',
        index:0,
        hash:_.toHash("")
      }
    };
    await db.open();
    const RequestData = new Trie(db);
    await RequestData.put("00ca49de7929c881ac8013534b477b986cad41dd34adcfab18c4938f642c4732953507a7d6639f83ebc86217311f64f8b79d04c486121ffe892d7ace48d44929",alias);
    console.log(await RequestData.filter());
    const root = RequestData.now_root();
    console.log(root);
    let first_block:T.Block = JSON.parse(fs.readFileSync('./json/blockchain.json','utf-8'))[0];
    console.log(first_block)
    first_block.contents.parenthash = _.toHash("");
    first_block.contents.request_root = root;
    first_block.contents.tx_root = ChainSet.GetTreeroot([])[0];
    const hash = _.toHash(JSON.stringify(first_block.contents));
    first_block.meta.hash = hash;
    console.log(first_block);
    fs.writeFileSync("./json/genesis_block.json",JSON.stringify([first_block]));
    await db.close();*/

  });

  ipc.on('GetBalance',async (event,address:string)=>{
    await db.open();
    const genesis_root_json = JSON.parse(fs.readFileSync("./json/root.json","utf-8"));
    const StateData = new Trie(db,genesis_root_json.stateroot);
    let sum = 0;
    const result:{[key:string]:StateSet.State;} = await StateData.filter((key:string,value:StateSet.State)=>{
      return address==value.contents.owner && key_currency==value.contents.token;
    });
    for(let key in result){
      sum += result[key].amount;
    }
    await db.close();
    event.sender.send('R_GetBalance',sum);
  });

  ipc.on('CreateRequestTx', async (event, arg)=>{
    await db.open();
    const genesis_root_json = JSON.parse(fs.readFileSync("./json/root.json","utf-8"));
    const password:string = arg[0];
    const amount:number = arg[1];
    const destination:string = arg[2];
    const pub_key:string = CryptoSet.PullMyPublic(password);
    const address:string = CryptoSet.AddressFromPublic(pub_key);
    const StateData = new Trie(db,genesis_root_json.stateroot);
    const result:{[key:string]:StateSet.State;} = await StateData.filter((key:string,value:StateSet.State)=>{
      return (address==value.contents.owner || destination==value.contents.owner) && key_currency==value.contents.token;
    });
    const states:{from:StateSet.State[],to:StateSet.State[],base:string[]} = R.values(result).reduce((reduced:{from:StateSet.State[],to:StateSet.State[],base:string[]},state:StateSet.State)=>{
      if(state.contents.owner===address){
        reduced.base[0] = state.hash;
        reduced.from.push(state);
        return reduced;
      }
      else if(state.contents.owner===destination){
        reduced.base[1] = state.hash;
        reduced.to.push(state);
        return reduced;
      }
      else return reduced;
    },{from:[],to:[],base:[]});
    const from = states.from[0];
    const to = states.to[0] || StateSet.CreateState(amount,destination,key_currency,{},_.toHash(""),"");
    const base = states.base;
    const new_state = ((from,to,amount)=>{
      from.amount = (-1)*amount;
      to.amount = amount;
      return [from,to];
    })(from,to,amount);
    const tx = await TxSet.CreateRequestTx(password,"","",pub_key,0,from.hash,"change",key_currency,base,[],[],[],new_state,StateData);
    const chain:ChainSet.Block[] = JSON.parse(fs.readFileSync("./json/blockchain.json","utf-8"));
    const candidates:T.Candidates[] = JSON.parse(fs.readFileSync("./json/candidates.json","utf-8"));
    const block = await ChainSet.CreateBlock(password,chain,genesis_root_json.stateroot,genesis_root_json.request_root,fee_by_size,1,1,from.hash,pub_key,unit_token,group_size,candidates,[tx],StateData);
    await db.close();
    const peers:{ip:string,port:number}[] = JSON.parse(fs.readFileSync("./json/peer.json","utf-8"));
    await forEach(peers,async (peer:{ip:string,port:number})=>{
      await util.promisify(request.post)({
        url:"http://"+peer.ip+":"+peer.port+"/tx",
        headers:headers,
        json:tx
      });
      console.log("tx_sended");
      await util.promisify(request.post)({
        url:"http://"+peer.ip+":"+peer.port+"/block",
        headers:headers,
        json:block
      });
      console.log("block_sended");
    });
    event.sender.send('R_CreateRequestTx',tx);
   });

  ipc.on('CreateUnit', async (event, arg)=>{
    await db.open();
    const genesis_root_json = JSON.parse(fs.readFileSync("./json/root.json","utf-8"));
    const password = arg[0];
    const log = arg[1];
    const pub_key = CryptoSet.PullMyPublic(password);
    const chain:ChainSet.Block[] = JSON.parse(fs.readFileSync("./json/blockchain.json","utf-8"));
    const RequestData = new Trie(db,genesis_root_json.request_root);
    const requests:{hash:string,index:number} = await reduce(chain,async (result:{hash:string,index:number},block:ChainSet.Block,index:number)=>{
      const reduced:{hash:string,index:number} = await reduce(block.transactions,async (r:{hash:string,index:number},tx:TxSet.Tx)=>{
        if(tx.kind=="refresh") return r;
        const req = await RequestData.get(tx.meta.hash);
        if(Object.keys(req).length!=0) return r;
        r.hash = tx.meta.hash;
        r.index = index;
        return r;
      },result);
      return reduced
    });
    const StateData = new Trie(db,genesis_root_json.stateroot);
    const payee:{[key:string]:StateSet.State;} = await StateData.filter((key:string,value:StateSet.State)=>{
      return value.contents.owner == CryptoSet.AddressFromPublic(pub_key);
    });
    const DagData = new Trie(db,genesis_root_json.dag_root);
    /*await DagData.delete("07adeb4ec8dba3f6c60e2148ad818f78e01e72955d1517b2710826db81e02c6a8e96a059175b6906e1922d5a1679a2ae6637cc7776af1bca98c94de22f54ce31");*/
    const unit = await DagSet.CreateUnit(password,pub_key,requests.hash,requests.index,R.values(payee)[0].hash,1,log,DagData);
    console.log(unit)
    const refresh = TxSet.CreateRefreshTx(password,unit);
    const candidates:T.Candidates[] = JSON.parse(fs.readFileSync("./json/candidates.json","utf-8"));
    const block = await ChainSet.CreateBlock(password,chain,genesis_root_json.stateroot,genesis_root_json.request_root,fee_by_size,1,1,R.values(payee)[0].hash,pub_key,unit_token,group_size,candidates,[refresh],StateData);
    console.log(block)
    /*await db.close();
    await db.open();
    const DagData = new Trie(db);
    await DagData.put(unit.meta.hash,unit);
    console.log(await DagData.filter());
    console.log(DagData.now_root())*/
    await db.close();
    const peers:{ip:string,port:number}[] = JSON.parse(fs.readFileSync("./json/peer.json","utf-8"));
    await forEach(peers, async (peer:{ip:string,port:number})=>{
      await util.promisify(request.post)({
        url:"http://"+peer.ip+":"+peer.port+"/unit",
        headers:headers,
        json:unit
      }).catch(e=>{console.log(e)});
    });
    console.log("unit sended");
    await forEach(peers, async (peer:{ip:string,port:number})=>{
      await util.promisify(request.post)({
        url:"http://"+peer.ip+":"+peer.port+"/tx",
        headers:headers,
        json:refresh
      }).catch(e=>{console.log(e)});
    });
    console.log("refresh sended")
    await forEach(peers, async (peer:{ip:string,port:number})=>{
      await util.promisify(request.post)({
        url:"http://"+peer.ip+":"+peer.port+"/block",
        headers:headers,
        json:block
      }).catch(e=>{console.log(e)});
    });
    console.log("block sended")
   });
// ウィンドウが閉じられたらアプリも終了
 mainWindow.on('closed', function() {
 fs.writeFileSync("./json/root.json",JSON.stringify(JSON.parse(fs.readFileSync("./json/genesis_root.json","utf-8"))));
 fs.writeFileSync("./json/blockchain.json",JSON.stringify(JSON.parse(fs.readFileSync("./json/genesis_block.json","utf-8"))));
 fs.writeFileSync("./json/candidates.json",JSON.stringify(JSON.parse(fs.readFileSync("./json/genesis_candidates.json","utf-8"))));
 fs.writeFileSync("./wallet/messages.json",JSON.stringify(JSON.parse(fs.readFileSync("./wallet/genesis_messages.json","utf-8"))));
 mainWindow = null;
 });

 const app = express();
 app.use(bodyParser.urlencoded({
     extended: true
 }));
 app.use(bodyParser.json());
 app.post('/tx', async (req,res)=>{
   await db.open();
   const tx:TxSet.Tx = req.body;
   console.log(tx);
   const pool:PoolSet.Pool = JSON.parse(fs.readFileSync('./json/tx_pool.json', 'utf-8'));
   const chain:ChainSet.Block[] = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
   const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
   const stateroot:string = roots.stateroot;
   const dag_root:string = roots.dag_root;
   const request_root:string = roots.request_root;
   const StateData = new Trie(db,stateroot);
   const DagData = new Trie(db,dag_root);
   const RequestData = new Trie(db,request_root);
   console.log(await StateData.filter())
   const new_pool:PoolSet.Pool = await PoolSet.Tx_to_Pool(pool,tx,tag_limit,key_currency,fee_by_size,chain,StateData,DagData,RequestData);
   console.log("OK")
   await db.close();
   fs.writeFileSync("./json/tx_pool.json",JSON.stringify(new_pool));
   res.json(new_pool);

 });

 app.post('/block',async (req,res)=>{
   await db.open();
   const block:ChainSet.Block = req.body;
   console.log(block)
   const chain:ChainSet.Block[] = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
   const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
   const candidates:T.Candidates[] = JSON.parse(fs.readFileSync("./json/candidates.json","utf-8"));
   const stateroot:string = roots.stateroot;
   const dag_root:string = roots.dag_root;
   const request_root:string = roots.request_root;
   const StateData = new Trie(db,stateroot);
   const DagData = new Trie(db,dag_root);
   const RequestData = new Trie(db,request_root);
   const accepted = await ChainSet.AcceptBlock(block,chain,tag_limit,fee_by_size,key_currency,unit_token,group_size,candidates,StateData,DagData,RequestData);
   fs.writeFileSync("./json/blockchain.json",JSON.stringify(accepted.chain));
   const new_roots = ((pre,accepted)=>{
     roots.stateroot = accepted.state;
     roots.request_root = accepted.request;
     return roots;
   })(roots,accepted);
   console.log(new_roots)
   await db.close();
   fs.writeFileSync("./json/root.json",JSON.stringify(new_roots));
   fs.writeFileSync("./json/candidates.json",JSON.stringify(accepted.candidates));
   res.json(accepted)
 });

 app.post('/unit',async (req,res)=>{
   await db.open()
   const unit:DagSet.Unit = req.body;
   //console.log(unit);
   const chain:ChainSet.Block[] = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
   const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
   const dag_root:string = roots.dag_root;
   const memory_root:string = roots.memory_root;
   const DagData = new Trie(db,dag_root);
   const MemoryData = new Trie(db,memory_root);
   const accepted = await DagSet.AcceptUnit(unit,log_limit,chain,DagData,MemoryData);
   const new_roots = ((pre,accepted)=>{
       roots.dag_root = accepted[0].now_root();
       roots.memory_root = accepted[1].now_root();
       return roots
   })(roots,accepted);
   await db.close();
   fs.writeFileSync('./json/root.json',JSON.stringify(new_roots));
   const old_msgs:string[] = JSON.parse(fs.readFileSync('./wallet/messages.json','utf-8'));
   fs.writeFileSync('./wallet/messages.json',JSON.stringify(old_msgs.concat(unit.log_raw[0])));
   res.json(unit);
 });

 const server = app.listen(process.env.Phoenix_PORT, process.env.Phoenix_IP);

});
});
