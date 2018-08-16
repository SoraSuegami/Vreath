import * as rx from 'rxjs'
import socket from 'socket.io'
import * as http from 'http'
import express from 'express'
import {tx_accept,block_accept,check_chain} from './index'
import * as T from '../core/types'
import * as fs from 'fs'
import * as gen from '../genesis/index';

const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_port || "localhost";

const app = express();
const server = new http.Server(app);
const io = socket(server);

server.listen(port);
app.use(express.static(__dirname+'/client'));
app.get('/',(req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});

io.on('connect',(socket)=>{
    socket.on('tx', async (msg:string)=>{
        const tx:T.Tx = JSON.parse(msg);
        await tx_accept(tx,io);
    });
    socket.on('block', async (msg:string)=>{
        const block:T.Block = JSON.parse(msg);
        await block_accept(block,io);
    });
    socket.on('checkchain', async (msg:string)=>{
        socket.emit('replacechain',fs.readFileSync('./json/blockchain.json','utf-8'));
    });
    socket.on('replacechain', async (msg:string)=>{
        const new_chain:T.Block[] = JSON.parse(msg);
        const my_chain:T.Block[] = JSON.parse(fs.readFileSync('./json/blockchain.json','utf-8')) || [gen.block];
        await check_chain(new_chain.slice(),my_chain.slice(),socket);
    });
});