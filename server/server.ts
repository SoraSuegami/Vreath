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
import {RunVM} from '../core/code'
import {map,forEach} from 'p-iteration'

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
let codes:{[key:string]:string} = JSON.parse(fs.readFileSync("./json/code.json","utf-8")) || {};

const my_shard_id = 0;

app.use(express.static(__dirname+'/client'));

app.get('/',(req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});

const pow_target = 100000000000000000000000000000000;
const pos_diff = 10000000

const random_chose = (array:any[], num:number)=>{
    let a = array;
    let t = [];
    let r = [];
    let l = a.length;
    let n = num < l ? num : l;
    while (n-- > 0) {
      let i = Math.random() * l | 0;
      r[n] = t[i] || a[i];
      --l;
      t[i] = t[l] || a[l];
    }
    return r;
  }

io.on('connect',async (socket:any)=>{
    try{
        socket.on('tx',async (msg:string)=>{
            const tx:T.Tx = JSON.parse(msg);
            const new_pool = await Tx_to_Pool(pool,tx,my_version,native,unit,chain,token_name_maxsize,StateData,LocationData);
            pool = new_pool;
            socket.emit('tx',msg);
            if(Object.keys(pool).length>=1){
                const created = await BlockSet.CreateKeyBlock(my_version,my_shard_id,chain,BlockSet.empty_fraud(),pow_target,pos_diff,native,[my_public],_.ObjectHash(candidates),roots.stateroot,roots.locationroot,{states:[],inputs:[]},StateData);
                const block = await BlockSet.SignBlock(created,my_private,my_public);
                const accepted = await BlockSet.AcceptBlock(block,chain,my_shard_id,my_version,block_time,max_blocks,block_size,candidates,roots.stateroot,roots.locationroot,"",gas_limit,native,unit,rate,token_name_maxsize,StateData,StateData,LocationData);
                if(accepted.chain.length===0){ console.log("fail to create valid block"); return 0};
                block.txs.forEach(tx=>delete pool[tx.hash]);
                socket.emit('block',JSON.stringify(block));
                StateData = accepted.state;
                LocationData = accepted.location;
                candidates = accepted.candidates;
                chain = chain.concat(accepted.chain);
                roots.stateroot = accepted.state.now_root();
                roots.locationroot = accepted.location.now_root();

                let micro_created:T.Block = BlockSet.empty_block();
                let microblock:T.Block = BlockSet.empty_block();
                console.log(pool)
                do{
                    const splited:T.Tx[] = random_chose(Object.values(pool),block_size/100);
                    const reduced = splited.reduce((result:{txs:T.Tx[],natives:T.Tx[],units:T.Tx[]},tx)=>{
                        if(tx.meta.data.token===native) result.natives.push(tx);
                        else if(tx.meta.data.token===unit) result.units.push(tx);
                        else result.txs.push(tx);
                        return result;
                    },{txs:[],natives:[],units:[]});
                    let txs = reduced.txs;
                    let natives = reduced.natives;
                    let units = reduced.units;
                    micro_created = BlockSet.CreateMicroBlock(my_version,my_shard_id,chain,BlockSet.empty_fraud(),pow_target,pos_diff,[my_public],_.ObjectHash(candidates),roots.stateroot,roots.locationroot,txs,natives,units,{states:[],inputs:[]},block_time);
                    microblock = await BlockSet.SignBlock(micro_created,my_private,my_public);
                    console.log(microblock);
                    let micro_acc = await BlockSet.AcceptBlock(microblock,chain,my_shard_id,my_version,block_time,max_blocks,block_size,candidates,roots.stateroot,roots.locationroot,"",gas_limit,native,unit,rate,token_name_maxsize,StateData,StateData,LocationData);
                    if(micro_acc.chain.length===0){console.log("fail to create micro block"); break;}
                    splited.forEach(tx=>{delete pool[tx.hash]});
                    StateData = micro_acc.state;
                    LocationData = micro_acc.location;
                    candidates = micro_acc.candidates;
                    chain = chain.concat(micro_acc.chain);
                    socket.emit('block',JSON.stringify(microblock));
                }while(Object.keys(pool).length>0);
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
            if(accepted.chain.length===0){console.log("receive invalid block"); return 0;}
            block.txs.forEach(tx=>delete pool[tx.hash]);
            StateData = accepted.state;
            LocationData = accepted.location;
            candidates = accepted.candidates;
            chain = chain.concat(accepted.chain);
            socket.emit('block',msg);

            const reqs_pure = block.txs.filter(tx=>tx.meta.kind==="request");
            if(reqs_pure.length>0){
                console.log('create ref!!');
                const reqs_raw = reqs_pure.map((req,i)=>block.raws[i]);
                const reqs = reqs_pure.map((pure,i):T.Tx=>{
                    return{
                        hash:pure.hash,
                        meta:pure.meta,
                        raw:reqs_raw[i]
                    }
                });
                await forEach(reqs,async (req:T.Tx)=>{
                    const code = codes[req.meta.data.token];
                    const base_states:T.State[] = await map(req.meta.data.base,async (base:string)=>{return await StateData.get(base)});
                    const runed = await RunVM(0,code,base_states,0,req.raw.raw,req,[],gas_limit);
                    const output = runed.states.map(s=>_.ObjectHash(s));
                    const created = TxSet.CreateRefreshTx(my_version,10,[my_public],pow_target,10,req.hash,block.meta.index,JSON.stringify([my_address]),output,runed.traced,[],chain);
                    const ref = TxSet.SignTx(created,my_private,my_address);
                    console.log(ref);
                    if(!await TxSet.ValidRefreshTx(ref,chain,my_version,native,unit,token_name_maxsize,StateData,LocationData)){console.log("fail to create valid refresh tx"); return 0;}
                    pool[ref.hash] = ref;
                    socket.emit('tx',JSON.stringify(ref));
                })
            }
        });
    }
    catch(e){
        console.log(e);
    }
});
})()