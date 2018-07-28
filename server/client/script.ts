import * as fs from 'fs'
import io from 'socket.io-client'
import level from 'level-browserify'
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate} from '../con'
import * as _ from '../../core/basic'
import * as T from '../../core/types'
import {Trie} from '../../core/merkle_patricia'
import {Tx_to_Pool} from '../../core/tx_pool'
import * as BlockSet from '../../core/block'

let db = level('./trie');

type Roots = {
    stateroot:string;
    locationroot:string;
};
let roots:Roots = JSON.parse(localStorage.getItem('root')||"{stateroot:_.toHash(''),locationroot:_.toHash('')}");
let StateData:Trie;
if(roots.stateroot!=_.toHash('')) StateData = new Trie(db,roots.stateroot);
else StateData = new Trie(db);
let LocationData:Trie;
if(roots.locationroot!=_.toHash('')) LocationData = new Trie(db,roots.locationroot);
else LocationData = new Trie(db);
console.log(StateData.now_root());
let pool:T.Pool = JSON.parse(localStorage.getItem("tx_pool")||"{}");
let chain:T.Block[] = JSON.parse(localStorage.getItem("blockchain")||"[]");
let candidates:T.Candidates[] = JSON.parse(localStorage.getItem("candidates")||"[]");

const my_shard_id = 0;

const port = "57750";
const ip = "localhost";
const option = {
    'force new connection':true,
    port:port
};

const socket = io.connect(ip,option);
socket.on('connect',()=>{
    try{
        socket.on('tx',async (msg:string)=>{
            const tx:T.Tx = JSON.parse(msg);
            const new_pool = await Tx_to_Pool(pool,tx,my_version,native,unit,chain,token_name_maxsize,StateData,LocationData);
            pool = new_pool;
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
        });
    }
    catch(e){
        console.log(e);
    }
});