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
const http = __importStar(require("http"));
const express_1 = __importDefault(require("express"));
const faye_1 = __importDefault(require("faye"));
const levelup_1 = __importDefault(require("levelup"));
const leveldown_1 = __importDefault(require("leveldown"));
const index_1 = require("./client/index");
const fs = __importStar(require("fs"));
const gen = __importStar(require("../genesis/index"));
const permessage_deflate_1 = __importDefault(require("permessage-deflate"));
const _ = __importStar(require("../core/basic"));
const P = __importStar(require("p-iteration"));
const readline_sync_1 = __importDefault(require("readline-sync"));
const socket_io_1 = __importDefault(require("socket.io"));
const jszip_1 = __importDefault(require("jszip"));
exports.port = process.env.vreath_port || "57750";
exports.ip = process.env.vreath_ip || "localhost";
const app = express_1.default();
const server = http.createServer(app);
const bayeux = new faye_1.default.NodeAdapter({ mount: '/pubsub' });
bayeux.addWebsocketExtension(permessage_deflate_1.default);
bayeux.attach(server);
const codes = {
    "native": "const main = () => {};",
    "unit": "const main = () => {};"
};
exports.json_read = (key, def) => {
    try {
        const path = __dirname + '/json/' + key + '.json';
        const get = JSON.parse(fs.readFileSync(path, 'utf-8') || JSON.stringify(def));
        return get;
    }
    catch (e) {
        console.log(e);
        return def;
    }
};
exports.json_write = (key, val) => {
    try {
        const path = __dirname + '/json/' + key + '.json';
        fs.writeFileSync(path, JSON.stringify(val, null, '    '));
    }
    catch (e) {
        console.log(e);
    }
};
app.use(express_1.default.static(__dirname + '/client'));
/*app.get('/',(req, res) => {
    console.log('calleddddd!')
    throw new Error('calleddddd!')
    res.sendFile(__dirname + '/client/index.html');
});*/
server.listen(exports.port);
const level_db = levelup_1.default(leveldown_1.default('./wallet/db'));
exports.store = new index_1.Store(true, exports.json_read, exports.json_write);
const io = socket_io_1.default(server);
io.on('connection', async (socket) => {
    socket.on('checkchain', async () => {
        console.log('checked');
        io.to(socket.id).emit('replacechain', _.copy(exports.store.chain));
    });
    socket.on('rebuildinfo', async () => {
        console.log('send rebuild info');
        const roots = _.copy(exports.store.roots);
        const S_Trie = index_1.trie_ins(roots.stateroot);
        const L_Trie = index_1.trie_ins(roots.locationroot);
        const states = Object.values(await S_Trie.filter());
        const locations = Object.values(await L_Trie.filter());
        const zip = new jszip_1.default();
        const folder = zip.folder('rebuild');
        folder.file('chain.json', JSON.stringify(_.copy(exports.store.chain)));
        folder.file('states.json', JSON.stringify(_.copy(states)));
        folder.file('locations.json', JSON.stringify(_.copy(locations)));
        folder.file('canidates.json', JSON.stringify(_.copy(exports.store.candidates)));
        const blob = await zip.generateAsync({ type: 'nodebuffer' });
        io.to(socket.id).emit('rebuildchain', blob);
    });
});
//export const client = new faye.Client('http://'+ip+':'+port+'/vreath');
server.on('close', () => {
    console.log('lose connection');
    exports.json_write("code", {});
    exports.json_write("pool", {});
    exports.json_write("chain", [gen.block]);
    exports.json_write("roots", gen.roots);
    exports.json_write("candidates", gen.candidates);
    exports.json_write("unit_store", {});
    exports.json_write('yet_data', []);
});
server.on('error', (e) => console.log(e));
process.on('SIGINT', () => {
    console.log('lose connection');
    exports.json_write("code", {});
    exports.json_write("pool", {});
    exports.json_write("chain", [gen.block]);
    exports.json_write("roots", gen.roots);
    exports.json_write("candidates", gen.candidates);
    exports.json_write("unit_store", {});
    exports.json_write('yet_data', []);
    process.exit(1);
});
/*client.subscribe('/data',async (data:Data)=>{
    if(data.type==="block") store.push_yet_data(_.copy(data));
    const S_Trie = trie_ins(store.roots.stateroot);
    const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.secret));
    const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0);
    const unit_amount = unit_state.amount || 0;
    if(data.type==="tx"&&unit_amount>0) store.push_yet_data(_.copy(data));
});

client.subscribe('/checkchain',(address:string)=>{
    console.log('checked')
    console.log(store.check_mode)
    if(!store.check_mode&&!store.replace_mode&&!store.return_chain) store.refresh_return_chain(true);
    return 0;
});

client.subscribe('/replacechain',async (chain:T.Block[])=>{
    try{
        console.log("replace:")
        if(!store.replace_mode&&store.check_mode&&!store.return_chain){
            await check_chain(_.copy(chain),_.copy(store.chain),_.copy(store.pool),_.copy(store.code),store.secret,_.copy(store.unit_store));
        }
        store.checking(false);
        return 0;
    }
    catch(e){throw new Error(e);}
});*/
(async () => {
    exports.json_write("code", {});
    exports.json_write("pool", {});
    exports.json_write("chain", [gen.block]);
    exports.json_write("roots", gen.roots);
    exports.json_write("candidates", gen.candidates);
    exports.json_write("unit_store", {});
    exports.json_write('yet_data', []);
    await index_1.set_config(level_db, exports.store);
    const secret = readline_sync_1.default.question("What is your secret?");
    exports.store.refresh_secret(secret);
    const gen_S_Trie = index_1.trie_ins("");
    await P.forEach(gen.state, async (s) => {
        await gen_S_Trie.put(s.owner, s);
    });
    /*const last_block:T.Block = _.copy(store.chain[store.chain.length-1]) || _.copy(gen.block);
    const last_address = CryptoSet.GenereateAddress(native,_.reduce_pub(last_block.meta.validatorPub));
    if(last_address!=store.my_address){
        store.checking(true);
        client.publish("/checkchain",last_address);
    }*/
    const balance = await index_1.get_balance(exports.store.my_address);
    exports.store.refresh_balance(balance);
    //setImmediate(compute_tx);
    //setImmediate(compute_yet);
    while (1) {
        await index_1.compute_tx();
        await index_1.compute_block();
    }
})();
/*if(cluster.isMaster){
    (async ()=>{
        json_write("./wallet/json/code.json",{});
        json_write("./wallet/json/pool.json",{});
        json_write("./wallet/json/chain.json",[gen.block]);
        json_write("./wallet/json/roots.json",gen.roots);
        json_write("./wallet/json/candidates.json",gen.candidates);
        json_write("./wallet/json/unit_store.json",{});
        const secret = readlineSync.question("What is your secret?");
        console.log(secret);
        store.commit('refresh_secret',secret);
        const gen_S_Trie = trie_ins("");
        await P.forEach(gen.state,async (s:T.State)=>{
            await gen_S_Trie.put(s.owner,s);
        });
        const last_block:T.Block = _.copy(store.state.chain[store.state.chain.length-1]) || _.copy(gen.block);
        const last_address = CryptoSet.GenereateAddress(native,_.reduce_pub(last_block.meta.validatorPub));
        console.log(last_address);
        if(last_address!=store.getters.my_address){
            store.commit('checking',true);
            client.publish("/checkchain",last_address);
        }
        const balance = await get_balance(store.getters.my_address);
        console.log(balance);
        store.commit("refresh_balance",balance);
        console.log('yet:')
        console.log(store.state.yet_data);
        for(let i=0; i<2; i++){
            cluster.fork();
        }
        cluster.workers[1].on('message',(msg)=>{
            console.log('receive-msg')
            if(msg.to===-1&&msg.kind==="new_block"&&msg.val!=null){
                store.commit('push_yet_data',_.copy(msg.val));
                await compute_yet();
            }
        });

        while(1){
            await compute_yet();
        }
    })()
}
else if(cluster.isWorker&&cluster.worker.id===0){

}
else if(cluster.isWorker&&cluster.worker.id===1){
    client.subscribe('/data',async (data:Data)=>{
        if(data.type==="tx") console.log(data.tx[0]);
        else if(data.type==="block") console.log(data.block[0]);
        if(data.type==="block"){
            process.send({
                to:-1,
                kind:'new_block',
                val:_.copy(data.block[0])
            })
        }
        const S_Trie = trie_ins(store.state.roots.stateroot);
        const unit_address = CryptoSet.GenereateAddress(unit,CryptoSet.PublicFromPrivate(store.state.secret));
        const unit_state:T.State = await S_Trie.get(unit_address) || StateSet.CreateState(0,unit_address,unit,0);
        const unit_amount = unit_state.amount || 0;
        if(data.type==="tx"&&unit_amount>0) store.commit('push_yet_data',_.copy(data));
    });

    client.subscribe('/checkchain',(address:string)=>{
        console.log('checked')
        console.log(store.state.check_mode)
        if(store.getters.my_address===address) client.publish('/replacechain',_.copy(store.state.chain));
        return 0;
    });

    client.subscribe('/replacechain',async (chain:T.Block[])=>{
        try{
            console.log("replace:")
            if(!store.state.replace_mode&&store.state.check_mode){
                console.log(chain);
                await check_chain(_.copy(chain),_.copy(store.state.chain),_.copy(store.state.pool),_.copy(store.state.code),store.state.secret,_.copy(store.state.unit_store));
            }
            store.commit('checking',false);
            console.log(store.state.yet_data);
            return 0;
        }
        catch(e){throw new Error(e);}
    });
}*/
