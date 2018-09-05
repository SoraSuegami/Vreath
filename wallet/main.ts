import * as rx from 'rxjs'
import socket from 'socket.io'
import * as http from 'http'
import express from 'express'
import faye from 'faye'
import {tx_accept,block_accept,check_chain} from './index'
import * as T from '../core/types'
import * as fs from 'fs'
import * as gen from '../genesis/index';
import {compatible_version} from './con'
import deflate from 'permessage-deflate'

export const port = process.env.vreath_port || "57750";
export const ip = process.env.vreath_port || "localhost";

const app = express();
const server = http.createServer(app);
const io = socket(server);
const bayeux = new faye.NodeAdapter({mount: '/vreath'});
bayeux.addWebsocketExtension(deflate);
bayeux.attach(server);


app.use(express.static(__dirname+'/client'));
app.get('/',(req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});

export const client = new faye.Client('http://'+ip+':'+port+'/vreath');

client.subscribe('/tx',async (tx:T.Tx)=>{
    console.log(tx)
});

client.subscribe('/block',async (block:T.Block)=>{
    console.log(block)
})
/*
const client = redis.createClient({host:ip,port:Number(port)});

client.subscribe('tx');
client.subscribe('block');
client.subscribe('checkchain');
client.subscribe('replacechain');

client.on('tx', async (msg:string)=>{
    const tx:T.Tx = JSON.parse(msg);
    await tx_accept(tx,client);
});
client.on('block', async (msg:string)=>{
    const block:T.Block = JSON.parse(msg);
    if(block.meta.version>=compatible_version) await block_accept(block,client);
});
client.on('checkchain', async (msg:string)=>{
    client.publish('replacechain',fs.readFileSync('./json/blockchain.json','utf-8'));
});
client.on('replacechain', async (msg:string)=>{
    const new_chain:T.Block[] = JSON.parse(msg);
    const my_chain:T.Block[] = JSON.parse(fs.readFileSync('./json/blockchain.json','utf-8')) || [gen.block];
    await check_chain(new_chain.slice(),my_chain.slice(),client);
});*/

/*PubSub.subscribe('tx',async (msg:string)=>{
    const tx:T.Tx = JSON.parse(msg);
    await tx_accept(tx,io);
});

PubSub.subscribe('block',async (msg:string)=>{
    const block:T.Block = JSON.parse(msg);
    if(block.meta.version>=compatible_version) await block_accept(block,io);
});

PubSub.subscribe('checkchain',async (msg:string)=>{
    PubSub.publish('replacechain',fs.readFileSync('./json/blockchain.json','utf-8'));
});*/

/*io.on('connect',(socket)=>{
    socket.emit('checkchain');
    socket.on('tx', async (msg:string)=>{
        const tx:T.Tx = JSON.parse(msg);
        await tx_accept(tx,io);
    });
    socket.on('block', async (msg:string)=>{
        const block:T.Block = JSON.parse(msg);
        if(block.meta.version>=compatible_version) await block_accept(block,io);
    });
    socket.on('checkchain', async (msg:string)=>{
        socket.emit('replacechain',fs.readFileSync('./json/blockchain.json','utf-8'));
    });
    socket.on('replacechain', async (msg:string)=>{
        const new_chain:T.Block[] = JSON.parse(msg);
        const my_chain:T.Block[] = JSON.parse(fs.readFileSync('./json/blockchain.json','utf-8')) || [gen.block];
        await check_chain(new_chain.slice(),my_chain.slice(),io);
    });
});*/

server.listen(port);