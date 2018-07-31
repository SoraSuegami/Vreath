import * as fs from 'fs'
import express from 'express'
import * as http from 'http'
import socket from 'socket.io'
import levelup from 'levelup'
import leveldown from 'leveldown'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate} from './con'
import * as _ from '../core/basic'
import * as T from '../core/types'
import {Trie} from '../core/merkle_patricia'
import {Tx_to_Pool} from '../core/tx_pool'
import * as BlockSet from '../core/block'

const app = express();
const server = new http.Server(app);
const io = socket(server);

const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_port || "localhost";
server.listen(port,()=>{
    console.log(port);
});

let db = levelup(leveldown('./db'));

type Roots = {
    stateroot:string;
    locationroot:string;
}
let roots:Roots = JSON.parse(fs.readFileSync("./json/root.json","utf-8")) || {stateroot:_.toHash(''),locationroot:_.toHash('')};
let StateData = new Trie(db,roots.stateroot);
let LocationData = new Trie(db,roots.locationroot);
let pool:T.Pool = JSON.parse(fs.readFileSync("./json/tx_pool.json","utf-8")) || {};
let chain:T.Block[] = JSON.parse(fs.readFileSync("./json/blockchain.json","utf-8")) || [];
let candidates:T.Candidates[] = JSON.parse(fs.readFileSync("./json/candidates.json","utf-8")) || [];

const my_shard_id = 0;

app.use(express.static(__dirname+'/client'));

app.get('/',(req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});

io.on('connect',async (socket:any)=>{
    try{
        socket.on('tx',async (msg:string)=>{
            const tx:T.Tx = JSON.parse(msg);
            const new_pool = await Tx_to_Pool(pool,tx,my_version,native,unit,chain,token_name_maxsize,StateData,LocationData);
            pool = new_pool;
            socket.emit('tx',msg);
        });

        socket.on('block',async (msg:string)=>{
            const block:T.Block = JSON.parse(msg);
            let code:string = "";
            let pre_StateData:Trie = StateData;
            const fraud = block.meta.fraud
            if(fraud.flag===true){
                const target_tx = chain[fraud.index].txs.filter(tx=>tx.hash===fraud.hash)[0];
                code = fs.readFileSync("./contract_modules/"+target_tx.meta.data.token+".js","utf-8") || "";
                pre_StateData = new Trie(db,chain[fraud.index].meta.stateroot);
            }
            const checked = await BlockSet.AcceptBlock(block,chain,my_shard_id,my_version,block_time,max_blocks,block_size,candidates,roots.stateroot,roots.locationroot,code,gas_limit,native,unit,rate,token_name_maxsize,StateData,pre_StateData,LocationData);
            StateData = checked.state;
            LocationData = checked.location;
            candidates = checked.candidates;
            chain = checked.chain;
            socket.emit('block',msg);
        });
    }
    catch(e){
        console.log(e);
    }
});