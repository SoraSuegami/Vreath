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
const CryptoSet = __importStar(require("../core/crypto_set"));
const BlockSet = __importStar(require("../core/block"));
const Genesis = __importStar(require("../genesis/index"));
(async () => {
    const app = express_1.default();
    const server = new http.Server(app);
    const io = socket_io_1.default(server);
    const port = process.env.vreath_port || "57750";
    const ip = process.env.vreath_port || "localhost";
    server.listen(port, () => {
        console.log(port);
    });
    let db = levelup_1.default(leveldown_1.default('./server/db'));
    const my_private = "a611b2b5da5da90b280475743675dd36444fde49d3166d614f5d9d7e1763768a";
    const my_public = "03a3faee4aa614d1725801681b246fdf778c7b23102e8e5113e0e3e5e18100db3f";
    const my_address = CryptoSet.GenereateAddress(con_1.native, my_public);
    let roots = JSON.parse(fs.readFileSync("./json/root.json", "utf-8")) || { stateroot: _.toHash(''), locationroot: _.toHash('') };
    let StateData;
    let LocationData;
    if (roots.stateroot != _.toHash('')) {
        StateData = new merkle_patricia_1.Trie(db, roots.stateroot);
    }
    else {
        StateData = new merkle_patricia_1.Trie(db);
        await StateData.put(JSON.stringify(Genesis.state[0].contents.owner), Genesis.state[0]);
        await StateData.put(JSON.stringify(Genesis.state[1].contents.owner), Genesis.state[1]);
        await StateData.put(Genesis.state[2].token, Genesis.state[2]);
        await StateData.put(Genesis.state[3].token, Genesis.state[3]);
        roots.stateroot = StateData.now_root();
    }
    if (roots.locationroot != _.toHash('')) {
        LocationData = new merkle_patricia_1.Trie(db, roots.locationroot);
    }
    else {
        LocationData = new merkle_patricia_1.Trie(db);
        roots.locationroot = LocationData.now_root();
    }
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
                if (Object.keys(pool).length > 5) {
                    const block = await BlockSet.CreateKeyBlock(con_1.my_version, my_shard_id, chain, BlockSet.empty_fraud(), 100000000000000000000000000000000, 10000000, con_1.native, [my_public], _.ObjectHash(candidates), roots.stateroot, roots.locationroot, { states: [], inputs: [] }, StateData);
                    const accepted = await BlockSet.AcceptBlock(block, chain, my_shard_id, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, roots.stateroot, roots.locationroot, "", con_1.gas_limit, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, StateData, StateData, LocationData);
                    if (accepted.chain.length === chain.length) {
                        console.log("fail to create valid block");
                        return 0;
                    }
                    ;
                    block.txs.forEach(tx => delete pool[tx.hash]);
                    StateData = accepted.state;
                    LocationData = accepted.location;
                    candidates = accepted.candidates;
                    chain = accepted.chain;
                    roots.stateroot = accepted.state.now_root();
                    roots.locationroot = accepted.location.now_root();
                    socket.emit('block', JSON.stringify(block));
                }
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
                const accepted = await BlockSet.AcceptBlock(block, chain, my_shard_id, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, roots.stateroot, roots.locationroot, code, con_1.gas_limit, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, StateData, pre_StateData, LocationData);
                if (chain.length === accepted.chain.length) {
                    console.log("receive invalid block");
                    return 0;
                }
                block.txs.forEach(tx => delete pool[tx.hash]);
                StateData = accepted.state;
                LocationData = accepted.location;
                candidates = accepted.candidates;
                chain = accepted.chain;
                socket.emit('block', msg);
            });
        }
        catch (e) {
            console.log(e);
        }
    });
})();
