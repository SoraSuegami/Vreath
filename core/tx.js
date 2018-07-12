"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("./basic"));
const CryptoSet = __importStar(require("./crypto_set"));
const StateSet = __importStar(require("./state"));
const { reduce, some } = require('p-iteration');
const tx_fee = (tx) => {
    const price = tx.meta.feeprice;
    delete tx.meta.feeprice;
    delete tx.raw.signature;
    const target = JSON.stringify(tx.meta) + JSON.stringify(tx.raw);
    return price * Buffer.from(target).length;
};
const requested_check = async (base, LocationData) => {
    return await some(base, async (key) => {
        const getted = await LocationData.get(key);
        if (getted == null)
            return false;
        else if (getted.req.state == "yet")
            return false;
        else
            return true;
    });
};
const commited_check = async (token, commit, StateData) => {
    const token_state = await StateData.get(CryptoSet.GenereateAddress(token, _.toHash('')));
    if (token_state == null)
        return true;
    const committed = token_state.committed;
    return commit.some((c) => {
        return committed.indexOf(c) != -1;
    });
};
const hashed_pub_check = (state, pubs) => {
    return state.contents.owner.some((address, index) => {
        return _.toHash(pubs[index]) != address.split(':')[2];
    });
};
const refreshed_check = async (base, index, tx_hash, LocationData) => {
    return await some(base, async (key) => {
        const getted = await LocationData.get(key);
        if (getted == null)
            return true;
        else if (getted.ref.state == "yet" && getted.req.state == "already" && getted.req.index == index && getted.req.hash == tx_hash)
            return false;
        else
            return true;
    });
};
const state_check = (state, token_name_maxsize) => {
    const hash_size = Buffer.from(_.toHash("")).length;
    return _.object_hash_check(state.hash, state.contents) ||
        state.contents.owner.some(ow => _.address_form_check(ow, token_name_maxsize)) ||
        state.contents.amount < 0 ||
        Object.entries(state.contents.data).some((obj) => { return Buffer.from(obj[0]).length > hash_size || Buffer.from(obj[1]).length > hash_size; }) ||
        state.contents.product.some(pro => Buffer.from(pro).length > token_name_maxsize);
};
const base_declaration_check = async (target, base_hashes, StateData) => {
    const getted = await StateData.get(target.hash);
    return getted != null && base_hashes.indexOf(target.hash) === -1;
};
const output_check = async (type, base_states, output_raw, token_name_maxsize, StateData) => {
    if (type === "create") {
        const token_state = JSON.parse(output_raw[0]);
        const key = CryptoSet.GenereateAddress(token_state.token, _.toHash(''));
        const getted = await StateData.get(key);
        const dev_check = token_state.developer.some((dev) => {
            return dev === key || _.address_form_check(dev, token_name_maxsize);
        });
        if (getted != null || token_state.issued < 0 || dev_check)
            return true;
        else
            return false;
    }
    else {
        const new_states = output_raw.map((o) => {
            return JSON.parse(o);
        });
        const base_hashes = base_states.map(s => s.hash);
        if (await some(new_states, async (s) => { state_check(s, token_name_maxsize) || await base_declaration_check(s, base_hashes, StateData); }))
            return true;
        const pre_amount = base_states.reduce((sum, s) => { return sum + s.contents.amount; }, 0);
        const new_amount = new_states.reduce((sum, s) => { return sum + s.contents.amount; }, 0);
        return (type === "issue" && pre_amount >= new_amount) || (type === "change" && pre_amount != new_amount) || (type === "scrap" && pre_amount <= new_amount);
    }
};
const search_related_tx = (chain, hash, order, caller_hash) => {
    return chain.reverse().reduce((result, block) => {
        return result.concat(block.txs.filter((tx) => {
            return tx.kind === "request" && tx.purehash === hash && tx[order].flag === true && tx[order].hash === caller_hash;
        }));
    }, []);
};
const list_up_related = (chain, tx, order, result = []) => {
    if (tx.pre.flag === false)
        return result;
    const ori_order = order;
    if (order == 'pre')
        order = 'next';
    else
        order = 'pre';
    const searched = search_related_tx(chain, tx.pre.hash, order, tx.purehash)[0];
    if (searched === null || searched.kind != "request")
        return [];
    const new_pres = result.concat(searched);
    return list_up_related(chain, searched, ori_order, new_pres);
};
const mining = (meta, target) => {
    let hash;
    let num;
    do {
        hash = _.toHash(JSON.stringify(meta));
        num = _.Hex_to_Num(hash);
        meta.nonce++;
    } while (num > target);
    return {
        nonce: meta.nonce,
        hash: hash
    };
};
exports.ValidRequestTx = async (tx, key_currency, StateData, LocationData) => {
    const hash = tx.hash;
    const tx_meta = tx.meta;
    const purehash = tx_meta.purehash;
    const pre = tx_meta.pre;
    const next = tx_meta.next;
    const tx_data = tx_meta.data;
    const address = tx_data.address;
    const pub_key = tx_data.pub_key;
    const timestamp = tx_data.timestamp;
    const gas = tx_data.gas;
    const solvency = tx_data.solvency;
    const token = tx_data.token;
    const base = tx_data.base;
    const commit = tx_data.commit;
    const input = tx_data.input;
    const log_hash = tx_data.log_hash;
    const raw = tx.raw;
    const sign = raw.signature;
    const input_raw = raw.raw;
    const log_raw = raw.log;
    const date = new Date();
    const solvency_state = await StateData.get(solvency) || StateSet.CreateState(0, address, key_currency, {}, []);
    const solvency_hashed_pubs = solvency_state.contents.owner.map(o => o.split(':')[2]);
    if (_.object_hash_check(hash, tx.meta)) {
        console.log("invalid hash");
        return false;
    }
    else if (_.object_hash_check(purehash, tx_data)) {
        console.log("invalid purehash");
        return false;
    }
    else if (_.hash_size_check(hash) || _.hash_size_check(purehash) || _.hash_size_check(pre) || _.hash_size_check(next)) {
        console.log("invalid hash size");
        return false;
    }
    else if (address.some((ad, i) => { return _.address_check(ad, pub_key[i], token); })) {
        console.log("invalid address");
        return false;
    }
    else if (pub_key.some((pub) => { return pub != _.toHash(''); })) {
        console.log("invalid pub_key");
        return false;
    }
    else if (timestamp > date.getTime()) {
        console.log("invalid timestamp");
        return false;
    }
    else if (solvency_state.contents.amount < tx_fee(tx) + gas || hashed_pub_check(solvency_state, pub_key) || solvency_state.contents.token != key_currency || await requested_check([solvency], LocationData)) {
        console.log("invalid solvency");
        return false;
    }
    else if (await requested_check(base, LocationData)) {
        console.log("base states are already requested");
        return false;
    }
    else if (await commited_check(token, commit, StateData)) {
        console.log("commits are already committed");
        return false;
    }
    else if (address.some((ad, i) => { return _.sign_check(ad, token, hash, sign[i], pub_key[i]); })) {
        console.log("invalid signature");
        return false;
    }
    else if (input.some((inp, i) => { return _.object_hash_check(inp, input_raw[i]); })) {
        console.log("invalid input hash");
        return false;
    }
    else if (log_hash.some((l, i) => { return _.object_hash_check(l, log_raw[i]); })) {
        console.log("invalid log hash");
        return false;
    }
    else {
        return true;
    }
};
exports.ValidRefreshTx = async (tx, chain, pow_target, key_currency, token_name_maxsize, StateData, LocationData) => {
    const hash = tx.hash;
    const tx_meta = tx.meta;
    const address = tx_meta.address;
    const pub_key = tx_meta.pub_key;
    const timestamp = tx_meta.timestamp;
    const request = tx_meta.request;
    const index = tx_meta.index;
    const payee = tx_meta.payee;
    const output = tx_meta.output;
    const log_hash = tx_meta.log_hash;
    const raw = tx.raw;
    const output_raw = raw.raw;
    const log_raw = raw.log;
    const req_tx = chain[index].txs.filter((tx) => {
        return tx.kind === "request" && _.toHash(JSON.stringify(tx)) === request;
    })[0];
    const token = req_tx.data.token;
    const date = new Date();
    const payee_state = await StateData.get(payee) || StateSet.CreateState(0, address, key_currency, {}, []);
    const base_states = await reduce(req_tx.data.base, async (result, key) => {
        const getted = await StateData.get(key);
        if (getted)
            return result.concat(getted);
    }, []);
    const pres = list_up_related(chain, req_tx, "pre", []);
    const nexts = list_up_related(chain, req_tx, "next", []);
    if (_.object_hash_check(hash, tx_meta)) {
        console.log("invalid hash");
        return false;
    }
    else if (_.Hex_to_Num(hash) > pow_target) {
        console.log("invalid nonce");
        return false;
    }
    else if (index < 0 || index > chain.length - 1) {
        console.log("invalid request index");
        return false;
    }
    else if (req_tx == null) {
        console.log("invalid request hash");
        return false;
    }
    else if (address.some((ad, i) => { return _.address_check(ad, pub_key[i], token); })) {
        console.log("invalid address");
        return false;
    }
    else if (pub_key.some((pub) => { return pub != _.toHash(''); })) {
        console.log("invalid pub_key");
        return false;
    }
    else if (timestamp > date.getTime()) {
        console.log("invalid timestamp");
        return false;
    }
    else if (await refreshed_check(req_tx.data.base, index, request, LocationData)) {
        console.log("base states are already refreshed");
        return false;
    }
    else if (await refreshed_check([req_tx.data.solvency], index, request, LocationData)) {
        console.log("invalid solvency");
        return false;
    }
    else if (payee_state.contents.amount + req_tx.data.gas < tx_fee(tx) || hashed_pub_check(payee_state, pub_key) || payee_state.contents.token != key_currency) {
        console.log("invalid payee");
        return false;
    }
    else if (output.some((o, i) => { return _.object_hash_check(o, output_raw[i]); })) {
        console.log("invalid output check");
        return false;
    }
    else if (log_hash.some((l, i) => { return _.object_hash_check(l, log_raw[i]); })) {
        console.log("invalid log hash");
        return false;
    }
    else if (await output_check(req_tx.data.type, base_states, output_raw, token_name_maxsize, StateData)) {
        console.log("invalid output");
        return false;
    }
    else if (req_tx.pre.flag === true && pres.length === 0) {
        console.log("invalid pre txs");
        return false;
    }
    else if (req_tx.next.flag === true && nexts.length === 0) {
        console.log("invalid next txs");
        return false;
    }
    else {
        return true;
    }
};
exports.CreateRequestTx = (pub_key, solvency, gas, type, token, base, commit, input_raw, log, pre, next, feeprice) => {
    const address = pub_key.map(p => CryptoSet.GenereateAddress(token, p));
    const date = new Date();
    const timestamp = date.getTime();
    const input = input_raw.map(i => _.toHash(i));
    const log_hash = log.map(l => _.toHash(l));
    const data = {
        address: address,
        pub_key: pub_key,
        timestamp: timestamp,
        gas: gas,
        solvency: solvency,
        type: type,
        token: token,
        base: base,
        commit: commit,
        input: input,
        log_hash: log_hash
    };
    const purehash = _.toHash(JSON.stringify(data));
    const meta = {
        kind: "request",
        purehash: purehash,
        pre: pre,
        next: next,
        feeprice: feeprice,
        data: data
    };
    const hash = _.toHash(JSON.stringify(meta));
    const tx = {
        hash: hash,
        meta: meta,
        raw: {
            signature: [],
            raw: input_raw,
            log: log
        }
    };
    return tx;
};
exports.CreateRefreshTx = (pub_key, target, feeprice, request, index, payee, output_raw, log_raw, chain) => {
    const req_tx = chain[index].txs.filter((tx) => {
        return tx.kind === "request" && _.toHash(JSON.stringify(tx)) === request;
    })[0];
    const address = pub_key.map(p => CryptoSet.GenereateAddress(req_tx.data.token, p));
    const date = new Date();
    const timestamp = date.getTime();
    const output = output_raw.map(o => _.toHash(o));
    const log_hash = log_raw.map(l => _.toHash(l));
    let meta = {
        kind: "refresh",
        address: address,
        pub_key: pub_key,
        nonce: 0,
        feeprice: feeprice,
        timestamp: timestamp,
        request: request,
        index: index,
        payee: payee,
        output: output,
        log_hash: log_hash
    };
    const mined = mining(meta, target);
    meta.nonce = mined.nonce;
    const hash = mined.hash;
    const raw = {
        signature: [],
        raw: output_raw,
        log: log_raw
    };
    const tx = {
        hash: hash,
        meta: meta,
        raw: raw
    };
    return tx;
};
exports.SignTx = (tx, my_pass, my_address) => {
    let addresses;
    if (tx.meta.kind === "request") {
        addresses = tx.meta.data.address;
    }
    else {
        addresses = tx.meta.address;
    }
    const index = addresses.indexOf(my_address);
    const sign = CryptoSet.SignData(tx.hash, my_pass);
    tx.raw.signature[index] = sign;
    return tx;
};
