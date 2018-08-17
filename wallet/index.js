"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("../core/basic"));
const CryptoSet = __importStar(require("../core/crypto_set"));
const StateSet = __importStar(require("../core/state"));
const TxSet = __importStar(require("../core/tx"));
const BlockSet = __importStar(require("../core/block"));
const P = __importStar(require("p-iteration"));
const gen = __importStar(require("../genesis/index"));
const con_1 = require("./con");
const tx_pool_1 = require("../core/tx_pool");
const fs = __importStar(require("fs"));
const db = __importStar(require("./db"));
fs.writeFileSync('./json/tx_pool.json', "{}");
fs.writeFileSync('./json/root.json', JSON.stringify(gen.roots, null, '    '));
fs.writeFileSync('./json/candidates.json', JSON.stringify(gen.candidates, null, '    '));
fs.writeFileSync('./json/blockchain.json', JSON.stringify([gen.block], null, '    '));
const output_keys = (tx) => {
    if (tx.meta.kind === "request")
        return [];
    else if (tx.meta.data.type === "create" || tx.meta.data.type === "update") {
        const token = JSON.parse(tx.raw.raw[0]);
        return [token.token];
    }
    const states = tx.raw.raw.map(r => JSON.parse(r));
    return states.map(s => s.owner);
};
const pays = (tx, chain) => {
    if (tx.meta.kind === "request") {
        return [tx.meta.data.solvency];
    }
    else if (tx.meta.kind === "refresh") {
        const req_tx = TxSet.find_req_tx(tx, chain);
        return [req_tx.meta.data.solvency, tx.meta.data.payee];
    }
    else
        return [];
};
exports.pure_to_tx = (pure, block) => {
    const index = block.txs.concat(block.natives).concat(block.units).indexOf(pure);
    if (index === -1)
        return TxSet.empty_tx();
    const raw = block.raws[index];
    return {
        hash: pure.hash,
        meta: pure.meta,
        raw: raw
    };
};
exports.states_for_tx = async (tx, chain, S_Trie) => {
    const base = tx.meta.data.base;
    const outputs = output_keys(tx);
    const payes = pays(tx, chain);
    const concated = base.concat(outputs).concat(payes);
    const target = concated.reduce((result, key, index) => {
        if (result.filter(val => val === key).length >= 2)
            return result.filter((key, i) => index != i);
        else
            return result;
    }, concated);
    const states = Object.values(await S_Trie.filter((key) => {
        const i = target.indexOf(key);
        if (i != -1)
            return true;
        else
            return false;
    }));
    return states;
};
exports.locations_for_tx = async (tx, chain, L_Trie) => {
    const target = (() => {
        if (tx.meta.kind === "request")
            return tx;
        else
            return TxSet.find_req_tx(tx, chain);
    })();
    const result = Object.values(await L_Trie.filter(key => {
        if (target.meta.data.base.indexOf(key) != -1)
            return true;
        else if (target.meta.data.solvency === key && target.meta.data.base.indexOf(key) === -1)
            return true;
        else
            return false;
    }));
    return result;
};
exports.states_for_block = async (block, chain, S_Trie) => {
    const native_validator = CryptoSet.GenereateAddress(con_1.native, _.reduce_pub(block.meta.validatorPub));
    const native_validator_state = await S_Trie.get(native_validator) || [];
    const unit_validator = CryptoSet.GenereateAddress(con_1.unit, _.reduce_pub(block.meta.validatorPub));
    const unit_validator_state = await S_Trie.get(unit_validator) || [];
    const targets = block.txs.concat(block.natives).concat(block.units).map(pure => exports.pure_to_tx(pure, block));
    const tx_states = await P.reduce(targets, async (result, tx) => result.concat(await exports.states_for_tx(tx, chain, S_Trie)), []);
    const native_states = await P.map(block.natives, async (tx, i) => {
        const b = (() => {
            if (tx.meta.kind === "request")
                return block;
            else
                return chain[tx.meta.data.index];
        })();
        return await S_Trie.get(b.raws[b.txs.length + i].raw[1]) || StateSet.CreateState(0, b.raws[b.txs.length + i].raw[1], con_1.native, 0);
    });
    const unit_states = await P.map(block.units, async (tx, i) => {
        const b = (() => {
            if (tx.meta.kind === "request")
                return block;
            else
                return chain[tx.meta.data.index];
        })();
        const remiter = await S_Trie.get(b.raws[b.txs.length + b.natives.length + i].raw[1]) || StateSet.CreateState(0, b.raws[b.txs.length + b.natives.length + i].raw[1], con_1.unit, 0);
        const items = JSON.parse(b.raws[b.txs.length + b.natives.length + i].raw[2]) || [TxSet.empty_tx()];
        const sellers = await P.map(items, async (it) => await S_Trie.get(it.meta.data.payee) || StateSet.CreateState(0, it.meta.data.payee, con_1.unit, 0));
        return sellers.concat(remiter);
    }) || [];
    const native_token = await S_Trie.get(con_1.native);
    const unit_token = await S_Trie.get(con_1.unit);
    const concated = tx_states.concat(native_validator_state).concat(unit_validator_state).concat(native_states).concat(unit_states).concat(native_token).concat(unit_token);
    return concated.reduce((result, state, index) => {
        if (result.filter(val => _.ObjectHash(val) === _.ObjectHash(state)).length >= 2)
            return result.filter((val, i) => index != i);
        else
            return result;
    }, concated);
};
exports.locations_for_block = async (block, chain, L_Trie) => {
    const targets = block.txs.concat(block.natives).concat(block.units);
    const result = await P.reduce(targets, async (result, tx) => result.concat(await exports.locations_for_tx(tx, chain, L_Trie)), []);
    return result;
};
exports.tx_accept = async (tx, socket) => {
    console.log(tx);
    const chain = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8')) || [gen.block];
    const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8')) || gen.roots;
    const stateroot = roots.stateroot;
    const S_Trie = db.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie = db.trie_ins(locationroot);
    const pool = JSON.parse(fs.readFileSync('./json/tx_pool.json', 'utf-8')) || {};
    const states = await exports.states_for_tx(tx, chain, S_Trie);
    const locations = await exports.locations_for_tx(tx, chain, L_Trie);
    const new_pool = tx_pool_1.Tx_to_Pool(pool, tx, con_1.my_version, con_1.native, con_1.unit, chain, con_1.token_name_maxsize, states, locations);
    if (_.ObjectHash(new_pool) != _.ObjectHash(pool)) {
        fs.writeFileSync('./json/tx_pool.json', JSON.stringify(new_pool, null, '    '));
        console.log("receive valid tx");
        socket.broadcast.emit('tx', JSON.stringify(tx));
    }
};
exports.block_accept = async (block, socket) => {
    const chain = JSON.parse(fs.readFileSync('./json/blockchain.json', 'utf-8')) || [gen.block];
    console.log(block);
    const candidates = JSON.parse(fs.readFileSync('./json/candidates.json', 'utf-8')) || gen.candidates;
    const roots = JSON.parse(fs.readFileSync('./json/root.json', 'utf-8')) || gen.roots;
    const stateroot = roots.stateroot;
    const S_Trie = db.trie_ins(stateroot);
    const locationroot = roots.locationroot;
    const L_Trie = db.trie_ins(locationroot);
    const StateData = await exports.states_for_block(block, chain, S_Trie);
    const LocationData = await exports.locations_for_block(block, chain, L_Trie);
    const accepted = BlockSet.AcceptBlock(block, chain, 0, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, stateroot, locationroot, con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, StateData, LocationData);
    if (accepted.block.length > 0) {
        await P.forEach(accepted.state, async (state) => {
            if (state.kind === "state")
                await S_Trie.put(state.owner, state);
            else
                await S_Trie.put(state.token, state);
        });
        await P.forEach(accepted.location, async (loc) => {
            await L_Trie.put(loc.address, loc);
        });
        const new_roots = {
            stateroot: S_Trie.now_root(),
            locationroot: L_Trie.now_root()
        };
        const pool = JSON.parse(fs.readFileSync('./json/tx_pool.json', 'utf-8')) || {};
        const new_pool = ((p) => {
            block.txs.concat(block.natives).concat(block.units).forEach(tx => {
                delete p[tx.hash];
            });
            return p;
        })(pool);
        fs.writeFileSync('./json/tx_pool.json', JSON.stringify(new_pool, null, '    '));
        fs.writeFileSync('./json/root.json', JSON.stringify(new_roots, null, '    '));
        fs.writeFileSync('./json/candidates.json', JSON.stringify(accepted.candidates, null, '    '));
        fs.writeFileSync('./json/blockchain.json', JSON.stringify(chain.concat(accepted.block), null, '    '));
        console.log("received valid block");
        socket.broadcast.emit('block', JSON.stringify(block));
    }
    else
        console.log("receive invalid block");
};
const get_pre_info = async (block, chain) => {
    const pre_block = chain[chain.length - 1];
    const S_Trie = db.trie_ins(pre_block.meta.stateroot);
    const StateData = await exports.states_for_block(pre_block, chain, S_Trie);
    const L_Trie = db.trie_ins(pre_block.meta.locationroot);
    const LocationData = await exports.locations_for_block(pre_block, chain, L_Trie);
    const candidates = BlockSet.NewCandidates(con_1.unit, con_1.rate, StateData);
    const accepted = await BlockSet.AcceptBlock(block, chain, 0, con_1.my_version, con_1.block_time, con_1.max_blocks, con_1.block_size, candidates, S_Trie.now_root(), L_Trie.now_root(), con_1.native, con_1.unit, con_1.rate, con_1.token_name_maxsize, StateData, LocationData);
    await P.forEach(accepted.state, async (state) => {
        if (state.kind === "state")
            await S_Trie.put(state.owner, state);
        else
            await S_Trie.put(state.token, state);
    });
    await P.forEach(accepted.location, async (loc) => {
        await L_Trie.put(loc.address, loc);
    });
    const pre_root = {
        stateroot: S_Trie.now_root(),
        locationroot: L_Trie.now_root()
    };
    return [pre_root, accepted.candidates];
};
exports.check_chain = async (new_chain, my_chain, socket) => {
    if (new_chain.length > my_chain.length) {
        const news = new_chain.slice().reverse();
        let target = [];
        for (let index in news) {
            let i = Number(index);
            if (my_chain[news.length - i - 1] != null && _.ObjectHash(my_chain[news.length - i - 1]) === _.ObjectHash(news[i]))
                break;
            else if (news[i].meta.kind === "key")
                target.push(news[i]);
            else if (news[i].meta.kind === "micro")
                target.push(news[i]);
        }
        const add_blocks = target.slice().reverse();
        const back_chain = my_chain.slice(0, add_blocks[0].meta.index);
        fs.writeFileSync('./json/blockchain.json', JSON.stringify(back_chain, null, '    '));
        const info = await (async () => {
            if (back_chain.length === 1) {
                return {
                    roots: gen.roots,
                    candidates: gen.candidates
                };
            }
            console.log(back_chain.length);
            const pre_info = await get_pre_info(back_chain[back_chain.length - 1], back_chain);
            return {
                roots: pre_info[0],
                candidates: pre_info[1]
            };
        })();
        fs.writeFileSync('./json/root.json', JSON.stringify(info.roots, null, '    '));
        fs.writeFileSync('./json/candidates.json', JSON.stringify(info.candidates, null, '    '));
        await P.forEach(add_blocks, async (block) => {
            await exports.block_accept(block, socket);
        });
    }
};
