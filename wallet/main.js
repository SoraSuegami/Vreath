"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const _ = __importStar(require("../core/basic"));
const merkle_patricia_1 = require("../core/merkle_patricia");
const StateSet = __importStar(require("../core/state"));
const DagSet = __importStar(require("../core/dag"));
const TxSet = __importStar(require("../core/tx"));
const ChainSet = __importStar(require("../core/chain"));
const PoolSet = __importStar(require("../core/tx_pool"));
const con_1 = require("./con");
const access_block_1 = require("./access_block");
const R = __importStar(require("ramda"));
const util = __importStar(require("util"));
const CryptoSet = require('../core/crypto_set.js');
const { map, reduce, filter, forEach, find } = require('p-iteration');
const rlp = require('rlp');
const request = require('request');
/*const express = require('express');
const app = express();*/
const url = require('url');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const my_pass = process.env.Phoenix_PASS;
const my_pub = CryptoSet.PullMyPublic(my_pass);
const my_address = CryptoSet.AddressFromPublic(my_pub);
const lib_func = (name, args) => {
    switch (name) {
        case "GetAddress":
            return CryptoSet.AddressFromPublic(CryptoSet.PullMyPublic.apply(this, args));
    }
};
const headers = {
    'Content-Type': 'application/json'
};
/*const set = async ()=>{

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
};*/ /*
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
function AddZero(host) {
    const splited = host.split(".");
    return splited.map((part) => {
        const figure = part.length;
        return "0".repeat(3 - figure) + "part";
    });
}
function IP_to_Number_Str(host) {
    const add_zero = AddZero(host.split(":")[0]);
    return add_zero.join("");
}
function AccessBlock(host) {
    //const hostname = req.headers.host;
    if (host.match("localhost"))
        return false;
    const target = IP_to_Number_Str(host);
    return access_block_1.block_ips.some((ips, index) => {
        return Number(target) >= Number(IP_to_Number_Str(ips[0])) && Number(target) <= Number(IP_to_Number_Str(ips[1]));
    });
}
const electron = require("electron");
// アプリケーションをコントロールするモジュール
const main = electron.app;
// ウィンドウを作成するモジュール
const BrowserWindow = electron.BrowserWindow;
const ipc = electron.ipcMain;
// メインウィンドウはGCされないようにグローバル宣言
let mainWindow;
//execSync('node ./wallet/server.js');
// 全てのウィンドウが閉じたら終了
main.on('window-all-closed', function () {
    if (process.platform != 'darwin') {
        main.quit();
    }
});
// Electronの初期化完了後に実行
main.on('ready', async () => {
    await con_1.db.open();
    // メイン画面の表示。ウィンドウの幅、高さを指定できる
    //execSync('node ./wallet/server.js');
    mainWindow = new BrowserWindow({ width: 1000, height: 800, 'node_integration': false });
    mainWindow.loadURL('file://' + __dirname + '/src/index.html');
    /*const peer_json = [
      {ip:"127.0.0.1",port:51753},
      {ip:"localhost",port:51754}
    ];
    fs.writeFileSync("./json/peer.json",JSON.stringify(peer_json));*/
    const fsw = fs.watch('./wallet/messages.json', {}, () => {
        /* console.log('changed');
         const genesis_root_json = JSON.parse(fs.readFileSync("./json/root.json","utf-8"));
         const DagData = new Trie(db,genesis_root_json.dag_root);
         const filtered = await DagData.filter();
         const logs:string[] = R.values(filtered).reduce((logs:string[],unit:DagSet.Unit)=>{
           return logs.concat(unit.log_raw);
         },[]);
         //console.log(logs)
         await db.close();*/
        const messages = JSON.parse(fs.readFileSync('./wallet/messages.json', 'utf-8'));
        mainWindow.webContents.send('new_message', messages);
    });
    ipc.on('GetAddress', async (event, arg) => {
        const result = ((arg) => {
            try {
                const pub_key = CryptoSet.PullMyPublic(arg);
                return CryptoSet.AddressFromPublic(pub_key);
            }
            catch (e) {
                CryptoSet.GenerateKeys(arg);
                return CryptoSet.AddressFromPublic(CryptoSet.PullMyPublic(arg));
            }
        })(arg);
        /*const timestamp = ChainSet.PoS_mining('2f6c5d2f6d5a5011f9f498476cf424b57b6ad5f90cf225c03525de77b78ed45ec57f6d9ebddaa20a130f555cb871f00bbefd5d3fea501b24ca5d5578122acfd2',result,1000,100000000)
        const obj:T.Block = {
          meta:{
            hash:'df85d50bb06ec1b3769a8278955755d665fe40a6242c2de1b0afed3f9f676a4b3095c246cf96cdd4bd0d90513ef13b794a9f509f68057cb184e0b667127a0ee4',
            validatorSign: 'c64e39cc57b817a4038c908166c30ac58c5560c7ff6cd13b981244053f4c8bfa185a4a151b99cf671f23a064427e93fdff8b2032da412eff3544829daa1f7a88'
          },
          contents:{
            index: 0,
            parenthash: '2f6c5d2f6d5a5011f9f498476cf424b57b6ad5f90cf225c03525de77b78ed45ec57f6d9ebddaa20a130f555cb871f00bbefd5d3fea501b24ca5d5578122acfd2',
            timestamp: timestamp,
            stateroot: 'de7cb42a9bfe40ef221773487dd80ba81968f3ee767378c55b73c0255d466c08',
            request_root: 'f820892fd5424e56cb52261fd307310d58f5111f45dfa6fa28579c7a6d64c69f',
            tx_root: '2f6c5d2f6d5a5011f9f498476cf424b57b6ad5f90cf225c03525de77b78ed45ec57f6d9ebddaa20a130f555cb871f00bbefd5d3fea501b24ca5d5578122acfd2',
            fee: 0,
            difficulty: 1,
            stake_diff: 100000000,
            validator: '00ca49de7929c881ac8013534b477b986cad41dd34adcfab18c4938f642c4732953507a7d6639f83ebc86217311f64f8b79d04c486121ffe892d7ace48d44929',
            validatorPub: '03f01fe2646308acd463c15da8ac33f5ac09da2eccb440915cd26c7a9d13f5d14c',
            candidates: '25b8f2e7f0bdc1b366d7daa6f34af46fc2094b87863b096a0fa972c266f9a50f1a511dce0eb1f57c23d759dd668de8a2ec497616e547d685c751a440882ebd59'
          },
          transactions:[]
        };
        console.log(obj);
        fs.writeFileSync("./json/genesis_block.json",JSON.stringify([obj]));*/
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
        event.sender.send('R_GetAddress', result);
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
    ipc.on('GetBalance', async (event, address) => {
        const root_json = JSON.parse(fs.readFileSync("./json/root.json", "utf-8"));
        const StateData = new merkle_patricia_1.Trie(con_1.db, root_json.stateroot);
        let sum = 0;
        const result = await StateData.filter((key, value) => {
            return address == value.contents.owner && con_1.key_currency == value.contents.token;
        });
        for (let key in result) {
            sum += result[key].amount;
        }
        event.sender.send('R_GetBalance', sum);
    });
    ipc.on('CreateRequestTx', async (event, arg) => {
        const root_json = JSON.parse(fs.readFileSync("./json/root.json", "utf-8"));
        const password = arg[0];
        const amount = arg[1];
        const destination = arg[2];
        const pub_key = CryptoSet.PullMyPublic(password);
        const address = CryptoSet.AddressFromPublic(pub_key);
        const StateData = new merkle_patricia_1.Trie(con_1.db, root_json.stateroot);
        const result = await StateData.filter((key, value) => {
            return (address == value.contents.owner || destination == value.contents.owner) && con_1.key_currency == value.contents.token;
        });
        const states = R.values(result).reduce((reduced, state) => {
            if (state.contents.owner === address) {
                reduced.base[0] = state.hash;
                reduced.from.push(state);
                return reduced;
            }
            else if (state.contents.owner === destination) {
                reduced.base[1] = state.hash;
                reduced.to.push(state);
                return reduced;
            }
            else
                return reduced;
        }, { from: [], to: [], base: [] });
        const from = states.from[0];
        const to = states.to[0] || StateSet.CreateState(amount, destination, con_1.key_currency, {}, _.toHash(""), "");
        const base = states.base;
        const new_state = ((from, to, amount) => {
            from.amount = (-1) * amount;
            to.amount = amount;
            return [from, to];
        })(from, to, amount);
        const tx = await TxSet.CreateRequestTx(password, "", "", pub_key, 0, from.hash, "change", con_1.key_currency, base, [], [], [], new_state, StateData);
        /*const chain:ChainSet.Block[] = JSON.parse(fs.readFileSync("./json/blockchain.json","utf-8"));
        const candidates:T.Candidates[] = JSON.parse(fs.readFileSync("./json/candidates.json","utf-8"));
        const block = await ChainSet.CreateBlock(password,chain,root_json.stateroot,root_json.request_root,fee_by_size,1,1,from.hash,pub_key,unit_token,group_size,candidates,[tx],StateData);*/
        const peers = JSON.parse(fs.readFileSync("./json/peer.json", "utf-8"));
        await forEach(peers, async (peer) => {
            await util.promisify(request.post)({
                url: "http://" + peer.ip + ":" + peer.port + "/tx",
                headers: headers,
                json: tx
            });
            console.log("tx_sended");
        });
        event.sender.send('R_CreateRequestTx', tx);
    });
    ipc.on('CreateUnit', async (event, arg) => {
        const root_json = JSON.parse(fs.readFileSync("./json/root.json", "utf-8"));
        const password = arg[0];
        const pub_key = CryptoSet.PullMyPublic(password);
        const destination = arg[2];
        //const log = [CryptoSet.EncryptData(arg[1][0],password,pub_key)];
        const log = arg[1];
        const chain = JSON.parse(fs.readFileSync("./json/blockchain.json", "utf-8"));
        const RequestData = new merkle_patricia_1.Trie(con_1.db, root_json.request_root);
        const requests = await reduce(chain, async (result, block, index) => {
            const reduced = await reduce(block.transactions, async (r, tx) => {
                if (tx.kind == "refresh")
                    return r;
                const req = await RequestData.get(tx.meta.hash);
                if (Object.keys(req).length != 0)
                    return r;
                r.hash = tx.meta.hash;
                r.index = index;
                return r;
            }, result);
            return reduced;
        });
        const StateData = new merkle_patricia_1.Trie(con_1.db, root_json.stateroot);
        const payee = await StateData.filter((key, value) => {
            return value.contents.owner == CryptoSet.AddressFromPublic(pub_key);
        });
        const DagData = new merkle_patricia_1.Trie(con_1.db, root_json.dag_root);
        /*await DagData.delete("07adeb4ec8dba3f6c60e2148ad818f78e01e72955d1517b2710826db81e02c6a8e96a059175b6906e1922d5a1679a2ae6637cc7776af1bca98c94de22f54ce31");*/
        const unit = await DagSet.CreateUnit(password, pub_key, requests.hash, requests.index, R.values(payee)[0].hash, log, chain, DagData);
        console.log(unit);
        const refresh = TxSet.CreateRefreshTx(password, unit);
        /*const candidates:T.Candidates[] = JSON.parse(fs.readFileSync("./json/candidates.json","utf-8"));
        const block = await ChainSet.CreateBlock(password,chain,root_json.stateroot,root_json.request_root,fee_by_size,1,1,R.values(payee)[0].hash,pub_key,unit_token,group_size,candidates,[refresh],StateData);
        console.log(block)*/
        /*await db.close();
        await db.open();
        const DagData = new Trie(db);
        await DagData.put(unit.meta.hash,unit);
        console.log(await DagData.filter());
        console.log(DagData.now_root())*/
        const old_msgs = JSON.parse(fs.readFileSync('./wallet/messages.json', 'utf-8'));
        //fs.writeFileSync('./wallet/messages.json',JSON.stringify(old_msgs.concat(arg[1])));
        const peers = JSON.parse(fs.readFileSync("./json/peer.json", "utf-8"));
        await forEach(peers, async (peer) => {
            await util.promisify(request.post)({
                url: "http://" + peer.ip + ":" + peer.port + "/unit",
                headers: headers,
                json: unit
            }).catch(e => { console.log(e); });
        });
        console.log("unit sended");
        await forEach(peers, async (peer) => {
            await util.promisify(request.post)({
                url: "http://" + peer.ip + ":" + peer.port + "/tx",
                headers: headers,
                json: refresh
            }).catch(e => { console.log(e); });
        });
        console.log("refresh sended");
        /*await forEach(peers, async (peer:{ip:string,port:number})=>{
          await util.promisify(request.post)({
            url:"http://"+peer.ip+":"+peer.port+"/block",
            headers:headers,
            json:block
          }).catch(e=>{console.log(e)});
        });
        console.log("block sended")*/
    });
    // ウィンドウが閉じられたらアプリも終了
    mainWindow.on('closed', function () {
        fs.writeFileSync("./json/root.json", JSON.stringify(JSON.parse(fs.readFileSync("./json/genesis_root.json", "utf-8"))));
        fs.writeFileSync("./json/blockchain.json", JSON.stringify(JSON.parse(fs.readFileSync("./json/genesis_block.json", "utf-8"))));
        fs.writeFileSync("./json/candidates.json", JSON.stringify(JSON.parse(fs.readFileSync("./json/genesis_candidates.json", "utf-8"))));
        fs.writeFileSync("./wallet/messages.json", JSON.stringify(JSON.parse(fs.readFileSync("./wallet/genesis_messages.json", "utf-8"))));
        fs.writeFileSync("./json/tx_pool.json", JSON.stringify(JSON.parse(fs.readFileSync("./json/genesis_pool.json", "utf-8"))));
        mainWindow = null;
    });
    const app = express();
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(bodyParser.json());
    app.use((req, res, next) => {
        if (AccessBlock(req.headers.host)) {
            res.send(400);
        }
        else {
            next();
        }
    });
    app.post('/tx', async (req, res) => {
        const tx = req.body;
        console.log(tx);
        const pool = JSON.parse(fs.readFileSync('./json/tx_pool.json', 'utf-8'));
        const pre_pool_hash = _.toHash(JSON.stringify(pool));
        const chain = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
        const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
        const stateroot = roots.stateroot;
        const dag_root = roots.dag_root;
        const request_root = roots.request_root;
        const StateData = new merkle_patricia_1.Trie(con_1.db, stateroot);
        const DagData = new merkle_patricia_1.Trie(con_1.db, dag_root);
        const RequestData = new merkle_patricia_1.Trie(con_1.db, request_root);
        const new_pool = await PoolSet.Tx_to_Pool(pool, tx, con_1.tag_limit, con_1.key_currency, con_1.fee_by_size, chain, StateData, DagData, RequestData);
        fs.writeFileSync("./json/tx_pool.json", JSON.stringify(new_pool));
        if (pre_pool_hash != _.toHash(JSON.stringify(new_pool))) {
            console.log("let's block");
            const last_candidates = JSON.parse(fs.readFileSync('./json/candidates.json', 'utf-8'));
            if (last_candidates.some((can) => { return can.address == my_address; })) {
                const validator_state = await StateData.filter((key, val) => {
                    return val.contents.owner == my_address && val.contents.token == con_1.key_currency;
                });
                const most = R.values(validator_state).sort((a, b) => {
                    return b.amount - a.amount;
                })[0];
                const block = await ChainSet.CreateBlock(my_pass, chain, stateroot, request_root, con_1.fee_by_size, con_1.pow_time, con_1.block_time, most.hash, my_pub, con_1.unit_token, con_1.group_size, last_candidates, R.values(new_pool), StateData, DagData);
                const peers = JSON.parse(fs.readFileSync("./json/peer.json", "utf-8"));
                await forEach(peers, async (peer) => {
                    await util.promisify(request.post)({
                        url: "http://" + peer.ip + ":" + peer.port + "/block",
                        headers: headers,
                        json: block
                    });
                    console.log("block_sended");
                });
            }
        }
        res.json(new_pool);
    });
    app.post('/block', async (req, res) => {
        const block = req.body;
        console.log(block);
        const chain = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
        const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
        const candidates = JSON.parse(fs.readFileSync("./json/candidates.json", "utf-8"));
        const stateroot = roots.stateroot;
        const dag_root = roots.dag_root;
        const request_root = roots.request_root;
        const StateData = new merkle_patricia_1.Trie(con_1.db, stateroot);
        const DagData = new merkle_patricia_1.Trie(con_1.db, dag_root);
        const RequestData = new merkle_patricia_1.Trie(con_1.db, request_root);
        const accepted = await ChainSet.AcceptBlock(block, chain, con_1.tag_limit, con_1.fee_by_size, con_1.pow_time, con_1.block_time, con_1.key_currency, con_1.unit_token, con_1.group_size, candidates, StateData, DagData, RequestData);
        fs.writeFileSync("./json/blockchain.json", JSON.stringify(accepted.chain));
        const new_roots = ((pre, accepted) => {
            roots.stateroot = accepted.state;
            roots.request_root = accepted.request;
            return roots;
        })(roots, accepted);
        console.log(new_roots);
        fs.writeFileSync("./json/root.json", JSON.stringify(new_roots));
        fs.writeFileSync("./json/candidates.json", JSON.stringify(accepted.candidates));
        let pool = JSON.parse(fs.readFileSync('./json/tx_pool.json', 'utf-8'));
        block.transactions.forEach((t) => {
            delete pool[t.meta.hash];
        });
        fs.writeFileSync("./json/tx_pool.json", JSON.stringify(pool));
        res.json(accepted);
    });
    app.post('/unit', async (req, res) => {
        const unit = req.body;
        //console.log(unit)
        const chain = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
        const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
        const dag_root = roots.dag_root;
        const memory_root = roots.memory_root;
        const DagData = new merkle_patricia_1.Trie(con_1.db, dag_root);
        const MemoryData = new merkle_patricia_1.Trie(con_1.db, memory_root);
        const accepted = await DagSet.AcceptUnit(unit, con_1.log_limit, chain, DagData, MemoryData);
        const new_roots = ((pre, accepted) => {
            roots.dag_root = accepted[0].now_root();
            roots.memory_root = accepted[1].now_root();
            return roots;
        })(roots, accepted);
        fs.writeFileSync('./json/root.json', JSON.stringify(new_roots));
        const decrypted = CryptoSet.DecryptData(unit.log_raw[0], my_pass, my_pub);
        //console.log(decrypted)
        if (1) {
            const old_msgs = JSON.parse(fs.readFileSync('./wallet/messages.json', 'utf-8'));
            fs.writeFileSync('./wallet/messages.json', JSON.stringify(old_msgs.concat((unit.log_raw[0]))));
        }
        console.log("unit accepted");
        res.json(unit);
    });
    const server = app.listen(process.env.Phoenix_PORT, process.env.Phoenix_IP);
});
