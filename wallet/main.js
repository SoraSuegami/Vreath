"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = __importDefault(require("socket.io"));
const http = __importStar(require("http"));
const express_1 = __importDefault(require("express"));
const index_1 = require("./index");
const fs = __importStar(require("fs"));
const gen = __importStar(require("../genesis/index"));
const con_1 = require("./con");
const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_port || "localhost";
const app = express_1.default();
const server = new http.Server(app);
const io = socket_io_1.default(server);
server.listen(port);
app.use(express_1.default.static(__dirname + '/client'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});
io.on('connect', (socket) => {
    socket.emit('checkchain');
    socket.on('tx', async (msg) => {
        const tx = JSON.parse(msg);
        await index_1.tx_accept(tx, io);
    });
    socket.on('block', async (msg) => {
        const block = JSON.parse(msg);
        if (block.meta.version >= con_1.compatible_version)
            await index_1.block_accept(block, io);
    });
    socket.on('checkchain', async (msg) => {
        socket.emit('replacechain', fs.readFileSync('./json/blockchain.json', 'utf-8'));
    });
    socket.on('replacechain', async (msg) => {
        const new_chain = JSON.parse(msg);
        const my_chain = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8')) || [gen.block];
        await index_1.check_chain(new_chain.slice(), my_chain.slice(), io);
    });
});
