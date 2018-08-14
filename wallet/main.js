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
    socket.on('tx', async (msg) => {
        const tx = JSON.parse(msg);
        await index_1.tx_accept(tx, socket);
    });
    socket.on('block', async (msg) => {
        const block = JSON.parse(msg);
        await index_1.block_accept(block, socket);
    });
});
