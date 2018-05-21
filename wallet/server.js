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
const DagSet = __importStar(require("../core/dag"));
const ChainSet = __importStar(require("../core/chain"));
const PoolSet = __importStar(require("../core/tx_pool"));
const con_1 = require("./con");
con_1.db.close();
const CryptoSet = require('../core/crypto_set.js');
const { map, reduce, filter, forEach } = require('p-iteration');
const rlp = require('rlp');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const request = require('request');
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.get('', (req, res) => {
    res.send("Hello");
});
/*app.get('json',(req,res)=>{
  const json = JSON.parse(fs.readdirSync('./json','utf-8'));
  res.json(json);
});*/
app.post('/tx', (req, res) => {
    const tx = req.body;
    const pool = JSON.parse(fs.readFileSync('./json/tx_pool.json', 'utf-8'));
    const chain = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
    const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
    const stateroot = roots.stateroot;
    const dag_root = roots.dag_root;
    const request_root = roots.request_root;
    PoolSet.Tx_to_Pool(pool, tx, stateroot, con_1.tag_limit, con_1.key_currency, con_1.fee_by_size, dag_root, chain, request_root, con_1.db).then((new_pool) => {
        fs.writeFileSync("./json/tx_pool.json", JSON.stringify(new_pool));
        res.json(new_pool);
    }).catch(err => { console.log(err); });
});
app.post('/block', (req, res) => {
    const block = req.body;
    console.log(block);
    const chain = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
    const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
    const stateroot = roots.stateroot;
    const dag_root = roots.dag_root;
    const request_root = roots.request_root;
    ChainSet.AcceptBlock(block, chain, con_1.tag_limit, request_root, con_1.fee_by_size, con_1.key_currency, dag_root, con_1.db).then(accepted => {
        console.dir(accepted);
        fs.writeFileSync("./json/blockchain.json", JSON.stringify(accepted.chain));
        const new_roots = ((pre, accepted) => {
            roots.stateroot = accepted.stateroot;
            roots.request_root = accepted.request_root;
            return roots;
        })(roots, accepted);
        console.log(new_roots);
        fs.writeFileSync("./json/root.json", JSON.stringify(new_roots));
        res.json(accepted);
    }).catch(e => { console.log(e); });
});
app.post('/unit', (req, res) => {
    const unit = req.body;
    const chain = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8'));
    const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8'));
    const dag_root = roots.dag_root;
    const memory_root = roots.memory_root;
    DagSet.AcceptUnit(unit, dag_root, memory_root, con_1.log_limit, chain, con_1.db).then(accepted => {
        const new_roots = ((pre, accepted) => {
            roots.dag_root = accepted[0];
            roots.memory_root = accepted[1];
            return roots;
        })(roots, accepted);
        fs.writeFileSync('./json/root.json', JSON.stringify(new_roots));
    }).catch(e => { console.log(e); });
});
const server = app.listen(process.env.Phoenix_PORT, process.env.Phoenix_IP);
