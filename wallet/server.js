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
const merkle_patricia_1 = require("../core/merkle_patricia");
const DagSet = __importStar(require("../core/dag"));
const ChainSet = __importStar(require("../core/chain"));
const PoolSet = __importStar(require("../core/tx_pool"));
const con_1 = require("./con");
const CryptoSet = require('../core/crypto_set.js');
const { map, reduce, filter, forEach } = require('p-iteration');
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
con_1.db.close().then(() => {
    //execSync('./node_modules/.bin/electron .');
    const app = express();
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(bodyParser.json());
    app.post('/tx', async (req, res) => {
        await con_1.db.open();
        const tx = req.body;
        console.log(tx);
        const pool = JSON.parse(fs.readFileSync('./json/tx_pool.json', 'utf-8'));
        const chain = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
        const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
        const stateroot = roots.stateroot;
        const dag_root = roots.dag_root;
        const request_root = roots.request_root;
        const StateData = new merkle_patricia_1.Trie(con_1.db, stateroot);
        const DagData = new merkle_patricia_1.Trie(con_1.db, dag_root);
        const RequestData = new merkle_patricia_1.Trie(con_1.db, request_root);
        const new_pool = await PoolSet.Tx_to_Pool(pool, tx, con_1.tag_limit, con_1.key_currency, con_1.fee_by_size, chain, StateData, DagData, RequestData);
        console.log("OK");
        await con_1.db.close();
        fs.writeFileSync("./json/tx_pool.json", JSON.stringify(new_pool));
        res.json(new_pool);
    });
    app.post('/block', async (req, res) => {
        await con_1.db.open();
        const block = req.body;
        console.log(block);
        const chain = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
        const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
        const stateroot = roots.stateroot;
        const dag_root = roots.dag_root;
        const request_root = roots.request_root;
        const StateData = new merkle_patricia_1.Trie(con_1.db, stateroot);
        const DagData = new merkle_patricia_1.Trie(con_1.db, dag_root);
        const RequestData = new merkle_patricia_1.Trie(con_1.db, request_root);
        const accepted = await ChainSet.AcceptBlock(block, chain, con_1.tag_limit, con_1.fee_by_size, con_1.key_currency, StateData, DagData, RequestData);
        fs.writeFileSync("./json/blockchain.json", JSON.stringify(accepted.chain));
        const new_roots = ((pre, accepted) => {
            roots.stateroot = accepted.state;
            roots.request_root = accepted.request;
            return roots;
        })(roots, accepted);
        console.log(new_roots);
        await con_1.db.close();
        fs.writeFileSync("./json/root.json", JSON.stringify(new_roots));
        res.json(accepted);
    });
    app.post('/unit', async (req, res) => {
        await con_1.db.open();
        const unit = req.body;
        //console.log(unit);
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
        await con_1.db.close();
        fs.writeFileSync('./json/root.json', JSON.stringify(new_roots));
        const old_msgs = JSON.parse(fs.readFileSync('./wallet/messages.json', 'utf-8'));
        fs.writeFileSync('./wallet/messages.json', JSON.stringify(old_msgs.concat(unit.log_raw[0])));
        res.json(unit);
    });
    const server = app.listen(process.env.Phoenix_PORT, process.env.Phoenix_IP);
});
