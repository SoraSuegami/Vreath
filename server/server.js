"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const express_1 = __importDefault(require("express"));
const http = __importStar(require("http"));
const socket_io_1 = __importDefault(require("socket.io"));
const levelup_1 = __importDefault(require("levelup"));
const leveldown_1 = __importDefault(require("leveldown"));
const con_1 = require("./con");
const _ = __importStar(require("../core/basic"));
const merkle_patricia_1 = require("../core/merkle_patricia");
const tx_pool_1 = require("../core/tx_pool");
const BlockSet = __importStar(require("../core/block"));
const app = express_1.default();
const server = new http.Server(app);
const io = socket_io_1.default(server);
const port = process.env.vreath_port || "57750";
const ip = process.env.vreath_port || "localhost";
server.listen(port, () => {
    console.log(port);
});
let db = levelup_1.default(leveldown_1.default('./db'));
let roots = JSON.parse(fs.readFileSync("./json/root.json", "utf-8")) || { stateroot: _.toHash(''), locationroot: _.toHash('') };
let StateData = new merkle_patricia_1.Trie(db, roots.stateroot);
let LocationData = new merkle_patricia_1.Trie(db, roots.locationroot);
let pool = JSON.parse(fs.readFileSync("./json/tx_pool.json", "utf-8")) || {};
let chain = JSON.parse(fs.readFileSync("./json/blockchain.json", "utf-8")) || [];
let candidates = JSON.parse(fs.readFileSync("./json/candidates.json", "utf-8")) || [];
const my_shard_id = 0;
app.use(express_1.default.static(__dirname + '/client'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});
io.on('connect', async (socket) => {
    try {
        socket.on('tx', async (msg) => {
            const tx = JSON.parse(msg);
            const new_pool = await tx_pool_1.Tx_to_Pool(pool, tx, con_1.my_version, con_1.native, con_1.unit, chain, con_1.token_name_maxsize, StateData, LocationData);
            pool = new_pool;
            socket.emit('tx', msg);
        });
        socket.on('block', async (msg) => {
            const block = JSON.parse(msg);
            let code = "";
            let pre_StateData = StateData;
            const fraud = block.meta.fraud;
            if (fraud.flag === true) {
                const target_tx = chain[fraud.index].txs.filter(tx => tx.hash === fraud.hash)[0];
                code = fs.readFileSync("./contract_modules/" + target_tx.meta.data.token + ".js", "utf-8") || "";
                pre_StateData = new merkle_patricia_1.Trie(db, chain[fraud.index].meta.stateroot);
            }
            const checked = await BlockSet.AcceptBlock(block, chain, my_shard_id, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, roots.stateroot, roots.locationroot, code, con_1.gas_limit, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, StateData, pre_StateData, LocationData);
            StateData = checked.state;
            LocationData = checked.location;
            candidates = checked.candidates;
            chain = checked.chain;
            socket.emit('block', msg);
        });
    }
    catch (e) {
        console.log(e);
    }
});
