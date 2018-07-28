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
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const level_browserify_1 = __importDefault(require("level-browserify"));
const con_1 = require("../con");
const _ = __importStar(require("../../core/basic"));
const merkle_patricia_1 = require("../../core/merkle_patricia");
const tx_pool_1 = require("../../core/tx_pool");
const BlockSet = __importStar(require("../../core/block"));
let db = level_browserify_1.default('./trie');
let roots = JSON.parse(localStorage.getItem('root') || "{stateroot:_.toHash(''),locationroot:_.toHash('')}");
let StateData;
if (roots.stateroot != _.toHash(''))
    StateData = new merkle_patricia_1.Trie(db, roots.stateroot);
else
    StateData = new merkle_patricia_1.Trie(db);
let LocationData;
if (roots.locationroot != _.toHash(''))
    LocationData = new merkle_patricia_1.Trie(db, roots.locationroot);
else
    LocationData = new merkle_patricia_1.Trie(db);
console.log(StateData.now_root());
let pool = JSON.parse(localStorage.getItem("tx_pool") || "{}");
let chain = JSON.parse(localStorage.getItem("blockchain") || "[]");
let candidates = JSON.parse(localStorage.getItem("candidates") || "[]");
const my_shard_id = 0;
const port = "57750";
const ip = "localhost";
const option = {
    'force new connection': true,
    port: port
};
const socket = socket_io_client_1.default.connect(ip, option);
socket.on('connect', () => {
    try {
        socket.on('tx', async (msg) => {
            const tx = JSON.parse(msg);
            const new_pool = await tx_pool_1.Tx_to_Pool(pool, tx, con_1.my_version, con_1.native, con_1.unit, chain, con_1.token_name_maxsize, StateData, LocationData);
            pool = new_pool;
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
        });
    }
    catch (e) {
        console.log(e);
    }
});
