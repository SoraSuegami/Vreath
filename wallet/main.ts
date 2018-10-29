import * as http from 'http'
import express from 'express'
import faye from 'faye'
import levelup from 'levelup'
import leveldown from 'leveldown'
import {Store,Data,set_config,trie_ins,compute_tx,tx_accept,block_accept,check_chain,unit_buying,send_key_block,send_micro_block,get_balance,send_request_tx,send_refresh_tx} from './client/index'
import * as T from '../core/types'
import * as fs from 'fs'
import * as gen from '../genesis/index'
import deflate from 'permessage-deflate'
import Vue from 'vue'
import Vuex from 'vuex'
import * as _ from '../core/basic'
import * as CryptoSet from '../core/crypto_set'
import * as StateSet from '../core/state'
import * as TxSet from '../core/tx'
import * as BlockSet from '../core/block'
import BigNumber from 'bignumber.js';
import {my_version,native,unit,token_name_maxsize,block_time,max_blocks,block_size,gas_limit,rate,compatible_version} from './con'
import * as P from 'p-iteration'
import readlineSync from 'readline-sync'
import * as cluster from 'cluster'
import socket from 'socket.io'


export const port = process.env.vreath_port || "57750";
export const ip = process.env.vreath_ip || "localhost";


const app = express();
const server = http.createServer(app);
const bayeux = new faye.NodeAdapter({mount: '/pubsub'});
bayeux.addWebsocketExtension(deflate);
bayeux.attach(server);




const codes = {
    "native":"const main = () => {};",//"function main(){const state = vreath.states[0];const type = input[0];const other = input[1];const amount = Number(input[2]);switch (type) {case 'remit':if (tx.meta.data.type != 'scrap' || state.owner != tx.meta.data.address || amount >= 0 || state.amount < amount) {console.log('error'); return 0;} const remited = vreath.create_state(state.nonce + 1, state.owner, state.token, state.amount + amount, state.data, state.product);console.log(remited);vreath.change_states([state], [remited]);}}",
    "unit":"const main = () => {};"
}


export const json_read = <T>(key:string,def:T):T=>{
    try{
        const path =  __dirname+'/json/'+key+'.json'
        const get:T = JSON.parse(fs.readFileSync(path,'utf-8')||JSON.stringify(def));
        return get;
    }
    catch(e){
        console.log(e);
        return def;
    }
}

export const json_write = <T>(key:string,val:T):void=>{
    try{
        const path = __dirname+'/json/'+key+'.json'
        fs.writeFileSync(path,JSON.stringify(val,null, '    '));
    }
    catch(e){
        console.log(e);
    }
}

app.use(express.static(__dirname+'/client'));
/*app.get('/',(req, res) => {
    console.log('calleddddd!')
    throw new Error('calleddddd!')
    res.sendFile(__dirname + '/client/index.html');
});*/



server.listen(port);

const level_db = levelup(leveldown('./wallet/db'));
export const store = new Store(true,json_read,json_write);

const io = socket(server);

io.on('connection',async (socket)=>{
    socket.on('checkchain',async ()=>{
        console.log('checked')
        io.to(socket.id).emit('replacechain',_.copy(store.chain));
    });
});

//export const client = new faye.Client('http://'+ip+':'+port+'/vreath');

server.on('close',()=>{
    console.log('lose connection');
    json_write("code",{});
    json_write("pool",{});
    json_write("chain",[gen.block]);
    json_write("roots",gen.roots);
    json_write("candidates",gen.candidates);
    json_write("unit_store",{});
    json_write('yet_data',[]);
});

server.on('error',(e)=>console.log(e));

process.on('SIGINT',()=>{
    console.log('lose connection');
    json_write("code",{});
    json_write("pool",{});
    json_write("chain",[gen.block]);
    json_write("roots",gen.roots);
    json_write("candidates",gen.candidates);
    json_write("unit_store",{});
    json_write('yet_data',[]);
    process.exit(1);
});

/*client.subscribe('/data',async (data:Data)=>{
    if(data.type==="block") store.push_yet_data(_.copy(data));
    const S_Trie = trie_ins(store.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.secret));
    const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0);
    const unit_amount = unit_state.amount || 0;
    if(data.type==="tx"&&unit_amount>0) store.push_yet_data(_.copy(data));
});

client.subscribe('/checkchain',(address:string)=>{
    console.log('checked')
    console.log(store.check_mode)
    if(!store.check_mode&&!store.replace_mode&&!store.return_chain) store.refresh_return_chain(true);
    return 0;
});

client.subscribe('/replacechain',async (chain:T.Block[])=>{
    try{
        console.log("replace:")
        if(!store.replace_mode&&store.check_mode&&!store.return_chain){
            await check_chain(_.copy(chain),_.copy(store.chain),_.copy(store.pool),_.copy(store.code),store.secret,_.copy(store.unit_store));
        }
        store.checking(false);
        return 0;
    }
    catch(e){throw new Error(e);}
});*/

(async ()=>{
    json_write("code",{});
    json_write("pool",{});
    json_write("chain",[gen.block]);
    json_write("roots",gen.roots);
    json_write("candidates",gen.candidates);
    json_write("unit_store",{});
    json_write('yet_data',[]);
    await set_config(level_db,store);
    const secret = readlineSync.question("What is your secret?");
    store.refresh_secret(secret);
    const gen_S_Trie = trie_ins("");
    await P.forEach(gen.state,async (s:T.State)=>{
        await gen_S_Trie.put(s.owner,s);
    });
    /*const last_block:T.Block = _.copy(store.chain[store.chain.length-1]) || _.copy(gen.block);
    const last_address = CryptoSet.GenereateAddress(native,_.reduce_pub(last_block.meta.validatorPub));
    if(last_address!=store.my_address){
        store.checking(true);
        client.publish("/checkchain",last_address);
    }*/
    const balance = await get_balance(store.my_address);
    store.refresh_balance(balance);
    setImmediate(compute_tx);
    //setImmediate(compute_yet);
})()


/*if(cluster.isMaster){
    (async ()=>{
        json_write("./wallet/json/code.json",{});
        json_write("./wallet/json/pool.json",{});
        json_write("./wallet/json/chain.json",[gen.block]);
        json_write("./wallet/json/roots.json",gen.roots);
        json_write("./wallet/json/candidates.json",gen.candidates);
        json_write("./wallet/json/unit_store.json",{});
        const secret = readlineSync.question("What is your secret?");
        console.log(secret);
        store.commit('refresh_secret',secret);
        const gen_S_Trie = trie_ins("");
        await P.forEach(gen.state,async (s:T.State)=>{
            await gen_S_Trie.put(s.owner,s);
        });
        const last_block:T.Block = _.copy(store.state.chain[store.state.chain.length-1]) || _.copy(gen.block);
        const last_address = CryptoSet.GenereateAddress(native,_.reduce_pub(last_block.meta.validatorPub));
        console.log(last_address);
        if(last_address!=store.getters.my_address){
            store.commit('checking',true);
            client.publish("/checkchain",last_address);
        }
        const balance = await get_balance(store.getters.my_address);
        console.log(balance);
        store.commit("refresh_balance",balance);
        console.log('yet:')
        console.log(store.state.yet_data);
        for(let i=0; i<2; i++){
            cluster.fork();
        }
        cluster.workers[1].on('message',(msg)=>{
            console.log('receive-msg')
            if(msg.to===-1&&msg.kind==="new_block"&&msg.val!=null){
                store.commit('push_yet_data',_.copy(msg.val));
                await compute_yet();
            }
        });

        while(1){
            await compute_yet();
        }
    })()
}
else if(cluster.isWorker&&cluster.worker.id===0){

}
else if(cluster.isWorker&&cluster.worker.id===1){
    client.subscribe('/data',async (data:Data)=>{
        if(data.type==="tx") console.log(data.tx[0]);
        else if(data.type==="block") console.log(data.block[0]);
        if(data.type==="block"){
            process.send({
                to:-1,
                kind:'new_block',
                val:_.copy(data.block[0])
            })
        }
        const S_Trie = trie_ins(store.state.roots.stateroot);
        const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.state.secret));
        const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0);
        const unit_amount = unit_state.amount || 0;
        if(data.type==="tx"&&unit_amount>0) store.commit('push_yet_data',_.copy(data));
    });

    client.subscribe('/checkchain',(address:string)=>{
        console.log('checked')
        console.log(store.state.check_mode)
        if(store.getters.my_address===address) client.publish('/replacechain',_.copy(store.state.chain));
        return 0;
    });

    client.subscribe('/replacechain',async (chain:T.Block[])=>{
        try{
            console.log("replace:")
            if(!store.state.replace_mode&&store.state.check_mode){
                console.log(chain);
                await check_chain(_.copy(chain),_.copy(store.state.chain),_.copy(store.state.pool),_.copy(store.state.code),store.state.secret,_.copy(store.state.unit_store));
            }
            store.commit('checking',false);
            console.log(store.state.yet_data);
            return 0;
        }
        catch(e){throw new Error(e);}
    });
}*/
