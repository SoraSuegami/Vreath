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
const p_iteration_1 = require("p-iteration");
exports.empty_tx = () => {
    const data = {
        address: [],
        pub_key: [],
        timestamp: 0,
        log_hash: [],
        gas: 0,
        solvency: _.toHash(""),
        type: "change",
        token: "",
        base: [],
        input: [],
        request: _.toHash(""),
        index: 0,
        payee: _.toHash(""),
        output: [],
        trace: []
    };
    const meta = {
        kind: "request",
        version: 0,
        purehash: _.ObjectHash(data),
        nonce: 0,
        pre: {
            flag: false,
            hash: _.toHash("")
        },
        next: {
            flag: false,
            hash: _.toHash("")
        },
        feeprice: 0,
        data: data
    };
    const raw = {
        signature: [],
        raw: [],
        log: []
    };
    const hash = _.ObjectHash(meta);
    return {
        hash: hash,
        meta: meta,
        raw: raw
    };
};
exports.tx_to_pure = (tx) => {
    return {
        hash: tx.hash,
        meta: tx.meta
    };
};
exports.empty_tx_pure = () => {
    const tx = exports.empty_tx();
    return exports.tx_to_pure(tx);
};
const empty_location = () => {
    return {
        state: "yet",
        index: 0,
        hash: _.toHash("")
    };
};
const requested_check = async (base, LocationData) => {
    return await p_iteration_1.some(base, async (key) => {
        const getted = await LocationData.get(key);
        if (getted == null)
            return false;
        else if (getted.state == "yet")
            return false;
        else
            return true;
    });
};
const hashed_pub_check = (state, pubs) => {
    return state.contents.owner.some((address, index) => {
        return _.toHash(pubs[index]) != address.split(':')[2];
    });
};
const refreshed_check = async (base, index, tx_hash, LocationData) => {
    return await p_iteration_1.some(base, async (key) => {
        const getted = await LocationData.get(key);
        if (getted == null)
            return true;
        else if (getted.state == "already" && getted.index == index && getted.hash == tx_hash)
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
        const code = output_raw[1];
        const key = token_state.token;
        const getted = await StateData.get(key);
        const dev_check = token_state.developer.some((dev) => {
            return _.address_form_check(dev, token_name_maxsize);
        });
        if (getted != null || dev_check || token_state.nonce != 0 || token_state.issued < 0 || token_state.code != _.toHash(code))
            return true;
        else
            return false;
    }
    else if (type === "update") {
        const token_state = JSON.parse(output_raw[0]);
        const key = token_state.token;
        const empty = StateSet.CreateToken();
        const getted = await StateData.get(key) || empty;
        const dev_check = token_state.developer.some((dev) => {
            return _.address_form_check(dev, token_name_maxsize);
        });
        const comm = token_state.committed.some((c) => {
            return getted.committed.indexOf(c) != -1;
        });
        if (key != token_state.token || getted == empty || dev_check || getted.deposited - token_state.deposited < 0)
            return true;
        else
            return false;
    }
    else {
        const new_states = output_raw.map((o) => {
            return JSON.parse(o);
        });
        const base_hashes = base_states.map(s => s.hash);
        if (await p_iteration_1.some(new_states, async (s) => { state_check(s, token_name_maxsize) || await base_declaration_check(s, base_hashes, StateData); }))
            return true;
        const pre_amount = base_states.reduce((sum, s) => { return sum + s.contents.amount; }, 0);
        const new_amount = new_states.reduce((sum, s) => { return sum + s.contents.amount; }, 0);
        return (type === "issue" && pre_amount >= new_amount) || (type === "change" && pre_amount != new_amount) || (type === "scrap" && pre_amount <= new_amount);
    }
};
const search_related_tx = (chain, hash, order, caller_hash) => {
    for (let block of chain) {
        if (block.meta.kind === "key")
            continue;
        for (let tx of block.txs) {
            if (tx.meta.kind == "request" && tx.meta.purehash === hash && tx.meta[order].flag === true && tx.meta[order].hash === caller_hash)
                return tx.meta;
        }
    }
    return exports.empty_tx_pure().meta;
};
const list_up_related = (chain, tx, order, result = []) => {
    if (tx.pre.flag === false)
        return result;
    const ori_order = order;
    if (order == 'pre')
        order = 'next';
    else
        order = 'pre';
    const searched = search_related_tx(chain, tx.pre.hash, order, tx.purehash);
    if (searched === exports.empty_tx_pure().meta || searched.kind != "request")
        return [];
    const new_pres = result.concat(searched);
    return list_up_related(chain, searched, ori_order, new_pres);
};
const mining = (request, refresher, output, target) => {
    let nonce = -1;
    let num;
    do {
        nonce++;
        num = _.Hex_to_Num(request) + nonce + _.Hex_to_Num(refresher) + _.Hex_to_Num(_.ObjectHash(output));
    } while (num > target);
    return nonce;
};
exports.find_req_tx = (ref_tx, chain) => {
    const index = ref_tx.meta.data.index || 0;
    const req_pure = chain[index].txs.filter(tx => tx.hash === ref_tx.meta.data.request)[0];
    if (req_pure == null)
        return exports.empty_tx();
    const req_raw = chain[index].raws[chain[index].txs.indexOf(req_pure)];
    return {
        hash: req_pure.hash,
        meta: req_pure.meta,
        raw: req_raw
    };
};
const search_related_raw = (chain, hash, order, caller_hash) => {
    for (let block of chain) {
        if (block.meta.kind === "key")
            continue;
        for (let i in block.txs) {
            const tx = block.txs[i];
            if (tx.meta.kind == "request" && tx.meta.purehash === hash && tx.meta[order].flag === true && tx.meta[order].hash === caller_hash)
                return block.raws[i];
        }
    }
    return exports.empty_tx().raw;
};
const ValidNative = async (req_tx, ref_tx, chain, StateData) => {
    try {
        const base_state = await StateData.get(req_tx.meta.data.base[0]);
        const new_states = JSON.parse(ref_tx.raw.raw[0]);
        if (base_state == null || new_states == null)
            return true;
        const inputs = req_tx.raw.raw;
        const type = inputs[0];
        const other = inputs[1];
        const amount = Number(inputs[2]);
        const nonce = Number(inputs[3]);
        switch (type) {
            case "remit":
                if (base_state.contents.owner === req_tx.meta.data.address && base_state.contents.amount - new_states.contents.amount === amount && req_tx.meta.next.flag === true)
                    return false;
                const next_meta = search_related_tx(chain, req_tx.meta.next.hash, 'pre', req_tx.meta.purehash);
                const next_raw = search_related_raw(chain, req_tx.meta.next.hash, 'pre', req_tx.meta.purehash);
                const next_inputs = next_raw.raw;
                const next_type = next_inputs[0];
                const next_other = next_inputs[1];
                const next_amount = Number(next_inputs[2]);
                const next_nonce = Number(next_inputs[3]);
                return !(next_meta.data.token === req_tx.meta.data.token && next_meta.data.address === req_tx.meta.data.address && next_type === "receive" && next_other === req_tx.meta.data.base[0] && amount === next_amount && nonce === next_nonce);
            case "receive":
                if (new_states.contents.amount - base_state.contents.amount === amount && req_tx.meta.next.flag === true)
                    return false;
                const pre_meta = search_related_tx(chain, req_tx.meta.pre.hash, 'next', req_tx.meta.purehash);
                const pre_raw = search_related_raw(chain, req_tx.meta.pre.hash, 'next', req_tx.meta.purehash);
                const pre_inputs = pre_raw.raw;
                const pre_type = pre_inputs[0];
                const pre_other = pre_inputs[1];
                const pre_amount = Number(pre_inputs[2]);
                const pre_nonce = Number(pre_inputs[3]);
                return !(pre_meta.data.token === req_tx.meta.data.token && pre_meta.data.address === req_tx.meta.data.address && pre_type === "remit" && pre_other === req_tx.meta.data.base[0] && amount === pre_amount && nonce === pre_nonce);
        }
    }
    catch (e) {
        console.log(e);
        return true;
    }
};
const ValidUnit = async (req_tx, ref_tx, chain, StateData) => {
    try {
        const base_state = await StateData.get(req_tx.meta.data.base[0]);
        const new_states = JSON.parse(ref_tx.raw.raw[0]);
        if (base_state == null || new_states == null)
            return true;
        const inputs = req_tx.raw.raw;
        const request = inputs[0];
        const refresher = inputs[1];
    }
    catch (e) {
        console.log(e);
        return true;
    }
};
exports.ValidTxBasic = (tx, my_version) => {
    const hash = tx.hash;
    const tx_meta = tx.meta;
    const version = tx_meta.version;
    const purehash = tx_meta.purehash;
    const pre = tx_meta.pre;
    const next = tx_meta.next;
    const tx_data = tx_meta.data;
    const address = tx_data.address;
    const token = tx_data.token;
    const pub_key = tx_data.pub_key;
    const timestamp = tx_data.timestamp;
    const log_hash = tx_data.log_hash;
    const raw = tx.raw;
    const sign = raw.signature;
    const raw_data = raw.raw;
    const log_raw = raw.log;
    if (_.object_hash_check(hash, tx.meta)) {
        console.log("invalid hash");
        return false;
    }
    else if (version != my_version) {
        console.log("different version");
        return false;
    }
    else if (_.object_hash_check(purehash, tx_data)) {
        console.log("invalid purehash");
        return false;
    }
    else if (_.hash_size_check(hash) || _.hash_size_check(purehash) || _.hash_size_check(pre.hash) || _.hash_size_check(next.hash)) {
        console.log("invalid hash size");
        return false;
    }
    else if (address.some((add, i) => { return _.address_check(add, pub_key[i], token); })) {
        console.log("invalid address");
        return false;
    }
    else if (pub_key.some((pub) => { return pub != _.toHash(''); })) {
        console.log("invalid pub_key");
        return false;
    }
    else if (_.time_check(timestamp)) {
        console.log("invalid timestamp");
        return false;
    }
    else if (address.some((ad, i) => { return _.sign_check(ad, token, hash, sign[i], pub_key[i]); })) {
        console.log("invalid signature");
        return false;
    }
    else if (raw_data.some((r, i) => { return r != _.toHash(raw_data[i]); })) {
        console.log("invalid input hash");
        return false;
    }
    else if (log_hash.some((l, i) => { return l != _.toHash(log_raw[i]); })) {
        console.log("invalid log hash");
        return false;
    }
    else {
        return true;
    }
};
exports.ValidRequestTx = async (tx, my_version, native, unit, StateData, LocationData) => {
    const tx_meta = tx.meta;
    const kind = tx_meta.kind;
    const tx_data = tx_meta.data;
    const address = tx_data.address;
    const pub_key = tx_data.pub_key;
    const gas = tx_data.gas;
    const solvency = tx_data.solvency;
    const token = tx_data.token;
    const base = tx_data.base;
    const solvency_state = await StateData.get(solvency) || StateSet.CreateState(0, address, native, {}, []);
    if (!exports.ValidTxBasic(tx, my_version)) {
        return false;
    }
    else if (kind != "request") {
        console.log("invalid kind");
        return false;
    }
    else if (solvency_state.contents.amount < _.tx_fee(tx) + gas || hashed_pub_check(solvency_state, pub_key) || solvency_state.contents.token != native || await requested_check([solvency], LocationData)) {
        console.log("invalid solvency");
        return false;
    }
    else if (await requested_check(base, LocationData)) {
        console.log("base states are already requested");
        return false;
    }
    else if ((token === native || token === unit) && base.length != 1) {
        console.log("invalid natives txs");
        return false;
    }
    else {
        return true;
    }
};
exports.ValidRefreshTx = async (tx, chain, my_version, pow_target, native, token_name_maxsize, StateData, LocationData) => {
    const hash = tx.hash;
    const tx_meta = tx.meta;
    const nonce = tx_meta.nonce;
    const kind = tx_meta.kind;
    const tx_data = tx_meta.data;
    const address = tx_data.address;
    const pub_key = tx_data.pub_key;
    const request = tx_data.request;
    const index = tx_data.index;
    const payee = tx_data.payee;
    const output = tx_data.output;
    const trace = tx_data.trace;
    const raw = tx.raw;
    const output_raw = raw.raw;
    const req_tx = _.find_tx(chain, request);
    const req_raw = chain[index].raws[chain[index].txs.indexOf(req_tx)];
    const req_tx_full = {
        hash: req_tx.hash,
        meta: req_tx.meta,
        raw: req_raw
    };
    const token = req_tx.meta.data.token;
    const payee_state = await StateData.get(payee) || StateSet.CreateState(0, address, native, {}, []);
    const base_states = await p_iteration_1.reduce(req_tx.meta.data.base, async (result, key) => {
        const getted = await StateData.get(key);
        if (getted)
            return result.concat(getted);
    }, []);
    const pres = list_up_related(chain, req_tx.meta, "pre", []);
    const nexts = list_up_related(chain, req_tx.meta, "next", []);
    if (!exports.ValidTxBasic(tx, my_version)) {
        return false;
    }
    else if (kind != "refresh") {
        console.log("invalid kind");
        return false;
    }
    else if (_.Hex_to_Num(request) + nonce + _.Hex_to_Num(payee) + _.Hex_to_Num(_.ObjectHash(output)) > pow_target) {
        console.log("invalid nonce");
        return false;
    }
    else if (index < 0 || index > chain.length - 1) {
        console.log("invalid request index");
        return false;
    }
    else if (req_tx == exports.empty_tx_pure() || chain[tx.meta.data.index].txs.indexOf(req_tx) === -1) {
        console.log("invalid request hash");
        return false;
    }
    else if (await refreshed_check(req_tx.meta.data.base, index, request, LocationData)) {
        console.log("base states are already refreshed");
        return false;
    }
    else if (await refreshed_check([req_tx.meta.data.solvency], index, request, LocationData)) {
        console.log("invalid solvency");
        return false;
    }
    else if (payee_state.contents.amount + req_tx.meta.data.gas < _.tx_fee(tx) || hashed_pub_check(payee_state, pub_key) || payee_state.contents.token != native) {
        console.log("invalid payee");
        return false;
    }
    else if (trace[0] != _.ObjectHash(req_tx.meta.data.base) || trace[trace.length - 1] != _.ObjectHash(output)) {
        console.log("invalid trace");
        return false;
    }
    else if (await output_check(req_tx.meta.data.type, base_states, output_raw, token_name_maxsize, StateData)) {
        console.log("invalid output");
        return false;
    }
    else if (req_tx.meta.pre.flag === true && pres.length === 0) {
        console.log("invalid pre txs");
        return false;
    }
    else if (req_tx.meta.next.flag === true && nexts.length === 0) {
        console.log("invalid next txs");
        return false;
    }
    else if (token === native && await ValidNative(req_tx_full, tx, chain, StateData)) {
        console.log("invalid native txs");
        return false;
    }
    else {
        return true;
    }
};
exports.CreateRequestTx = (pub_key, solvency, gas, type, token, base, input_raw, log, version, pre, next, feeprice) => {
    const address = pub_key.map(p => CryptoSet.GenereateAddress(token, p));
    const date = new Date();
    const timestamp = date.getTime();
    const input = input_raw.map(i => _.toHash(i));
    const log_hash = log.map(l => _.toHash(l));
    const empty = exports.empty_tx();
    const data = {
        address: address,
        pub_key: pub_key,
        timestamp: timestamp,
        log_hash: log_hash,
        gas: gas,
        solvency: solvency,
        type: type,
        token: token,
        base: base,
        input: input,
        request: empty.meta.data.request,
        index: empty.meta.data.index,
        payee: empty.meta.data.payee,
        output: empty.meta.data.output,
        trace: empty.meta.data.trace
    };
    const purehash = _.ObjectHash(data);
    const meta = {
        kind: "request",
        version: version,
        purehash: purehash,
        nonce: empty.meta.nonce,
        pre: pre,
        next: next,
        feeprice: feeprice,
        data: data
    };
    const hash = _.ObjectHash(meta);
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
exports.CreateRefreshTx = (version, pub_key, target, feeprice, request, index, payee, output_raw, trace, log_raw, chain) => {
    const req_tx = _.find_tx(chain, request).meta;
    const address = pub_key.map(p => CryptoSet.GenereateAddress(req_tx.data.token, p));
    const date = new Date();
    const timestamp = date.getTime();
    const output = output_raw.map(o => _.toHash(o));
    const log_hash = log_raw.map(l => _.toHash(l));
    const empty = exports.empty_tx_pure();
    const data = {
        address: address,
        pub_key: pub_key,
        timestamp: timestamp,
        log_hash: log_hash,
        gas: empty.meta.data.gas,
        solvency: empty.meta.data.solvency,
        type: empty.meta.data.type,
        token: empty.meta.data.token,
        base: empty.meta.data.base,
        input: empty.meta.data.input,
        request: request,
        index: index,
        payee: payee,
        output: output,
        trace: trace
    };
    const nonce = mining(request, payee, output, target);
    const meta = {
        kind: "refresh",
        version: version,
        purehash: _.ObjectHash(data),
        nonce: nonce,
        pre: empty.meta.pre,
        next: empty.meta.next,
        feeprice: feeprice,
        data: data
    };
    const hash = _.ObjectHash(meta);
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
    const addresses = tx.meta.data.address;
    const index = addresses.indexOf(my_address);
    const sign = CryptoSet.SignData(tx.hash, my_pass);
    tx.raw.signature[index] = sign;
    return tx;
};
exports.PayFee = (solvency, validator, fee) => {
    if (solvency.hash === validator.hash)
        return [solvency, validator];
    solvency.contents.amount -= fee;
    solvency.hash = _.ObjectHash(solvency.contents);
    validator.contents.amount += fee;
    validator.hash = _.ObjectHash(validator.contents);
    return [solvency, validator];
};
exports.PayGas = (solvency, payee, gas) => {
    if (solvency.hash === payee.hash)
        return [solvency, payee];
    solvency.contents.amount -= gas;
    solvency.hash = _.ObjectHash(solvency.contents);
    payee.contents.amount += gas;
    payee.hash = _.ObjectHash(payee.contents);
    return [solvency, payee];
};
exports.PayStates = (solvency_state, payee_state, validator_state, gas, fee) => {
    const after_gas = exports.PayGas(solvency_state, payee_state, gas);
    const after_fee = exports.PayFee(after_gas[1], validator_state, fee);
    if (solvency_state.hash === payee_state.hash && payee_state.hash === validator_state.hash)
        return [solvency_state];
    else if (solvency_state.hash === payee_state.hash)
        return after_fee;
    else if (payee_state.hash === validator_state.hash)
        return after_gas;
    else if (solvency_state.hash === validator_state.hash)
        return after_fee;
    return [after_gas[0], after_fee[1], after_fee[2]];
};
exports.AcceptRequestTx = async (tx, my_version, native, unit, validator, index, StateData, LocationData) => {
    if (!await exports.ValidRequestTx(tx, my_version, native, unit, StateData, LocationData))
        return [StateData, LocationData];
    const solvency_state = await StateData.get(tx.meta.data.solvency);
    const validator_state = await StateData.get(validator);
    const fee = _.tx_fee(tx);
    const after = exports.PayFee(solvency_state, validator_state, fee);
    await StateData.put(after[0].hash, after[0]);
    await StateData.put(after[1].hash, after[1]);
    await p_iteration_1.ForEach(tx.meta.data.base, async (key) => {
        let get_loc = await LocationData.get(key) || empty_location();
        get_loc = {
            state: "already",
            index: index,
            hash: tx.hash
        };
        await LocationData.put(key, get_loc);
    });
    return [StateData, LocationData];
};
exports.AcceptRefreshTx = async (ref_tx, chain, my_version, pow_target, native, token_name_maxsize, StateData, LocationData) => {
    if (!await exports.ValidRefreshTx(ref_tx, chain, my_version, pow_target, native, token_name_maxsize, StateData, LocationData))
        return [StateData, LocationData];
    const req_tx = exports.find_req_tx(ref_tx, chain);
    if (req_tx.meta.data.type === "create") {
        const token_info = JSON.parse(req_tx.raw.raw[0]);
        await StateData.put(token_info.token, token_info);
    }
    else if (req_tx.meta.data.type === "update") {
        const token_info = JSON.parse(req_tx.raw.raw[0]);
        let pre_token = await StateData.get(token_info.token);
        pre_token.nonce++;
        pre_token.deposited += token_info.deposited;
        await StateData.put(token_info.token, pre_token);
    }
    else {
        let token_info = await StateData.get(req_tx.meta.data.token);
        token_info.nonce++;
        const base_states = await p_iteration_1.map(req_tx.meta.data.base, async (key) => {
            return await StateData.get(key);
        });
        const new_states = ref_tx.raw.raw.map(obj => JSON.parse(obj));
        const pre_amount_sum = base_states.reduce((sum, state) => sum + state.contents.amount, 0);
        const new_amount_sum = new_states.reduce((sum, state) => sum + state.contents.amount, 0);
        token_info.issued += (new_amount_sum - pre_amount_sum);
        await StateData.put(req_tx.meta.data.token, token_info);
        await p_iteration_1.ForEach(req_tx.meta.data.base, async (key) => {
            await StateData.delete(key);
            await LocationData.delete(key);
        });
        await p_iteration_1.ForEach(ref_tx.raw.raw, async (val) => {
            const state = JSON.parse(val);
            await StateData.put(state.hash, state);
        });
    }
    return [StateData, LocationData];
};
