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
const faye_1 = __importDefault(require("faye"));
const permessage_deflate_1 = __importDefault(require("permessage-deflate"));
exports.port = process.env.vreath_port || "57750";
exports.ip = process.env.vreath_ip || "localhost";
const app = express_1.default();
const server = http.createServer(app);
const io = socket_io_1.default(server);
const bayeux = new faye_1.default.NodeAdapter({ mount: '/vreath' });
bayeux.addWebsocketExtension(permessage_deflate_1.default);
bayeux.attach(server);
app.use(express_1.default.static(__dirname + '/client'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});
exports.client = new faye_1.default.Client('http://' + exports.ip + ':' + exports.port + '/vreath');
exports.client.subscribe('/data', async (data) => {
    console.log(data);
});
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
server.listen(exports.port);
