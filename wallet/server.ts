declare function require(x: string): any;

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as _ from '../core/basic'
import {Trie} from '../core/merkle_patricia'
import * as StateSet from '../core/state'
import * as DagSet from '../core/dag'
import * as TxSet from '../core/tx'
import * as ChainSet from '../core/chain'
import * as PoolSet from '../core/tx_pool'
import * as IpfsSet from '../core/ipfs'
import {db,tag_limit,key_currency,fee_by_size,log_limit} from './con'
db.close();

const CryptoSet = require('../core/crypto_set.js');
const {map,reduce,filter,forEach} = require('p-iteration');
const rlp = require('rlp');



const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const request = require('request');

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.get('',(req,res)=>{
  res.send("Hello");
});

/*app.get('json',(req,res)=>{
  const json = JSON.parse(fs.readdirSync('./json','utf-8'));
  res.json(json);
});*/

app.post('/tx', (req,res)=>{
  const tx:TxSet.Tx = req.body;
  const pool:PoolSet.Pool = JSON.parse(fs.readFileSync('./json/tx_pool.json', 'utf-8'));
  const chain:ChainSet.Block[] = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
  const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
  const stateroot:string = roots.stateroot;
  const dag_root:string = roots.dag_root;
  const request_root:string = roots.request_root;
  PoolSet.Tx_to_Pool(pool,tx,stateroot,tag_limit,key_currency,fee_by_size,dag_root,chain,request_root,db).then((new_pool:PoolSet.Pool)=>{
    fs.writeFileSync("./json/tx_pool.json",JSON.stringify(new_pool));
    res.json(new_pool);
  }).catch(err=>{console.log(err)});
});

app.post('/block',(req,res)=>{
  const block:ChainSet.Block = req.body;
  console.log(block)
  const chain:ChainSet.Block[] = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
  const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
  const stateroot:string = roots.stateroot;
  const dag_root:string = roots.dag_root;
  const request_root:string = roots.request_root;
  ChainSet.AcceptBlock(block,chain,tag_limit,request_root,fee_by_size,key_currency,dag_root,db).then(accepted=>{
    console.dir(accepted);
    fs.writeFileSync("./json/blockchain.json",JSON.stringify(accepted.chain));
    const new_roots = ((pre,accepted)=>{
      roots.stateroot = accepted.stateroot;
      roots.request_root = accepted.request_root;
      return roots;
    })(roots,accepted);
    console.log(new_roots);
    fs.writeFileSync("./json/root.json",JSON.stringify(new_roots));
    res.json(accepted)
  }).catch(e=>{console.log(e)})
});

app.post('/unit',(req,res)=>{
  const unit:DagSet.Unit = req.body;
  const chain:ChainSet.Block[] = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
  const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
  const dag_root:string = roots.dag_root;
  const memory_root:string = roots.memory_root;
  DagSet.AcceptUnit(unit,dag_root,memory_root,log_limit,chain,db).then(accepted=>{
    const new_roots = ((pre,accepted)=>{
      roots.dag_root = accepted[0];
      roots.memory_root = accepted[1];
      return roots
    })(roots,accepted);
    fs.writeFileSync('./json/root.json',JSON.stringify(new_roots));
  }).catch(e=>{console.log(e)})
});

const server = app.listen(process.env.Phoenix_PORT, process.env.Phoenix_IP);
