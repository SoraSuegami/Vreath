import * as rx from 'rxjs'
import {IO, ioEvent} from 'rxjs-socket.io'
import {tx_accept,block_accept} from './index'
import * as T from '../core/types'

const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_port || "localhost";

const socket = new IO();
socket.connect('http://'+ip+':'+port);
const onTx: ioEvent = new ioEvent('tx');
const onBlock: ioEvent = new ioEvent('block');

const tx$: rx.Subscription = socket.listenToEvent(onTx).event$.subscribe(async (tx:T.Tx)=>{
    await tx_accept(tx);
});

const block$: rx.Subscription = socket.listenToEvent(onBlock).event$.subscribe(async (block:T.Block)=>{
    await block_accept(block);
});
