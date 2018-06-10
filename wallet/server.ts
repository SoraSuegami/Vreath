declare function require(x: string): any;

import * as crypto from 'crypto'
import * as fs from 'fs'
import {execSync} from 'child_process'
import * as _ from '../core/basic'
import {Trie} from '../core/merkle_patricia'
import * as StateSet from '../core/state'
import * as DagSet from '../core/dag'
import * as TxSet from '../core/tx'
import * as ChainSet from '../core/chain'
import * as PoolSet from '../core/tx_pool'
import * as IpfsSet from '../core/ipfs'
import {db,tag_limit,key_currency,fee_by_size,log_limit} from './con'

const CryptoSet = require('../core/crypto_set.js');
const {map,reduce,filter,forEach} = require('p-iteration');
const rlp = require('rlp');



const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');


/*app.get('',(req,res)=>{
  res.send("Hello");
});*/

/*app.get('json',(req,res)=>{
  const json = JSON.parse(fs.readdirSync('./json','utf-8'));
  res.json(json);
});*/
db.close().then(()=>{
//execSync('./node_modules/.bin/electron .');
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
  const stateroot:string = roots.stateroot;
  const dag_root:string = roots.dag_root;
  const request_root:string = roots.request_root;
  const StateData = new Trie(db,stateroot);
  const DagData = new Trie(db,dag_root);
  const RequestData = new Trie(db,request_root);
  const accepted = await ChainSet.AcceptBlock(block,chain,tag_limit,fee_by_size,key_currency,StateData,DagData,RequestData);
  fs.writeFileSync("./json/blockchain.json",JSON.stringify(accepted.chain));
  const new_roots = ((pre,accepted)=>{
    roots.stateroot = accepted.state;
    roots.request_root = accepted.request;
    return roots;
  })(roots,accepted);
  console.log(new_roots)
  await db.close();
  fs.writeFileSync("./json/root.json",JSON.stringify(new_roots));
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
