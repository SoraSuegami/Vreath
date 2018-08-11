"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_socket_io_1 = require("rxjs-socket.io");
const index_1 = require("./index");
const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_port || "localhost";
const socket = new rxjs_socket_io_1.IO();
socket.connect('http://' + ip + ':' + port);
const onTx = new rxjs_socket_io_1.ioEvent('tx');
const onBlock = new rxjs_socket_io_1.ioEvent('block');
const tx$ = socket.listenToEvent(onTx).event$.subscribe(async (tx) => {
    await index_1.tx_accept(tx);
});
const block$ = socket.listenToEvent(onBlock).event$.subscribe(async (block) => {
    await index_1.block_accept(block);
});
