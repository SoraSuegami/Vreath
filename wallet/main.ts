import * as rx from 'rxjs'
import socket from 'socket.io'
import * as http from 'http'
import express from 'express'
import {tx_accept,block_accept} from './index'
import * as T from '../core/types'

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
        await tx_accept(tx,socket);
    });
    socket.on('block', async (msg:string)=>{
        const block:T.Block = JSON.parse(msg);
        await block_accept(block,socket);
    });
});