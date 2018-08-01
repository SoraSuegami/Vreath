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
import * as CryptoSet from '../core/crypto_set'
import * as TxSet from '../core/tx'
import * as BlockSet from '../core/block'
import * as Genesis from '../genesis/index'
import { version } from '../node_modules/@types/esprima';

(async ()=>{
const app = express();
const server = new http.Server(app);
const io = socket(server);

const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_port || "localhost";
server.listen(port,()=>{
    console.log(port);
});

let db = levelup(leveldown('./server/db'));

const my_private = "a611b2b5da5da90b280475743675dd36444fde49d3166d614f5d9d7e1763768a"
const my_public = "03a3faee4aa614d1725801681b246fdf778c7b23102e8e5113e0e3e5e18100db3f"
const my_address = CryptoSet.GenereateAddress(native,my_public);


type Roots = {
    stateroot:string;
    locationroot:string;
}
let roots:Roots = JSON.parse(fs.readFileSync("./json/root.json","utf-8")) || {stateroot:_.toHash(''),locationroot:_.toHash('')};
let StateData:Trie;
let LocationData:Trie;
if(roots.stateroot!=_.toHash('')){
    StateData = new Trie(db,roots.stateroot);
}
else{
    StateData = new Trie(db);
    await StateData.put(JSON.stringify(Genesis.state[0].contents.owner),Genesis.state[0]);
    await StateData.put(JSON.stringify(Genesis.state[1].contents.owner),Genesis.state[1]);
    await StateData.put(Genesis.state[2].token,Genesis.state[2]);
    await StateData.put(Genesis.state[3].token,Genesis.state[3]);
    roots.stateroot = StateData.now_root();
}
if(roots.locationroot!=_.toHash('')){
    LocationData = new Trie(db,roots.locationroot);
}
else{
    LocationData = new Trie(db);
    roots.locationroot = LocationData.now_root();
}

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
            if(Object.keys(pool).length>5){
                const block = await BlockSet.CreateKeyBlock(my_version,my_shard_id,chain,BlockSet.empty_fraud(),100000000000000000000000000000000,10000000,native,[my_public],_.ObjectHash(candidates),roots.stateroot,roots.locationroot,{states:[],inputs:[]},StateData);
                const accepted = await BlockSet.AcceptBlock(block,chain,my_shard_id,my_version,block_time,max_blocks,block_size,candidates,roots.stateroot,roots.locationroot,"",gas_limit,native,unit,rate,token_name_maxsize,StateData,StateData,LocationData);
                if(accepted.chain.length===chain.length){ console.log("fail to create valid block"); return 0};
                block.txs.forEach(tx=>delete pool[tx.hash]);
                StateData = accepted.state;
                LocationData = accepted.location;
                candidates = accepted.candidates;
                chain = accepted.chain;
                roots.stateroot = accepted.state.now_root();
                roots.locationroot = accepted.location.now_root();
                socket.emit('block',JSON.stringify(block));
            }
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
            const accepted = await BlockSet.AcceptBlock(block,chain,my_shard_id,my_version,block_time,max_blocks,block_size,candidates,roots.stateroot,roots.locationroot,code,gas_limit,native,unit,rate,token_name_maxsize,StateData,pre_StateData,LocationData);
            if(chain.length===accepted.chain.length){console.log("receive invalid block"); return 0;}
            block.txs.forEach(tx=>delete pool[tx.hash]);
            StateData = accepted.state;
            LocationData = accepted.location;
            candidates = accepted.candidates;
            chain = accepted.chain;
            socket.emit('block',msg);
        });
    }
    catch(e){
        console.log(e);
    }
});
})()