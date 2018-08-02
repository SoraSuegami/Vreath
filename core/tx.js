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
        solvency: "[]",
        type: "change",
        token: "",
        base: [],
        input: [],
        request: _.toHash(""),
        index: 0,
        payee: "[]",
        output: [],
        trace: []
    };
    const meta = {
        kind: "request",
        version: 0,
        purehash: _.ObjectHash(data),
        nonce: 0,
        unit_price: 0,
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
exports.empty_location = () => {
    return {
        state: "yet",
        index: 0,
        hash: _.toHash("")
    };
};
const requested_check = async (base, LocationData) => {
    return await p_iteration_1.some(base, async (key) => {
        const getted = await LocationData.get(key) || exports.empty_location();
        if (getted === exports.empty_location())
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
        const getted = await LocationData.get(key) || exports.empty_location();
        if (getted === exports.empty_location())
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
const base_declaration_check = async (target, bases, StateData) => {
    const getted = await StateData.get(JSON.stringify(target.contents.owner));
    return getted != null && bases.indexOf(JSON.stringify(target.contents.owner)) === -1;
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
        const bases = base_states.map(s => JSON.stringify(s.contents.owner));
        const nonce_check = base_states.some((b, i) => b.contents.nonce + 1 != new_states[i].contents.nonce);
        if (await p_iteration_1.some(new_states, async (s) => { state_check(s, token_name_maxsize) || await base_declaration_check(s, bases, StateData); }) || nonce_check)
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
const ValidNative = async (req_tx, ref_tx, base_state, chain, StateData) => {
    try {
        console.log(base_state);
        const new_state = JSON.parse(ref_tx.raw.raw[0]);
        if (base_state == null || new_state == null)
            return true;
        const inputs = req_tx.raw.raw;
        const type = inputs[0];
        const other = inputs[1];
        const amount = Number(inputs[2]);
        const empty_token = StateSet.CreateToken();
        const valid_state = ((state) => {
            state.contents.amount += amount;
            const hash = _.ObjectHash(state.contents);
            state.hash = hash;
            return state;
        })(base_state);
        switch (type) {
            case "remit":
                console.log(new_state.contents.amount - base_state.contents.amount);
                console.log(amount);
                return req_tx.meta.data.type != "scrap" || base_state.contents.owner != req_tx.meta.data.address || new_state.contents.amount - base_state.contents.amount != amount || valid_state != new_state || amount >= 0;
            case "deposit":
                if (req_tx.meta.data.type != "scrap" || base_state.contents.owner != req_tx.meta.data.address || amount >= 0 || new_state.contents.amount - base_state.contents.amount != amount || req_tx.meta.next.flag != true || valid_state != new_state)
                    return true;
                const depo_meta = search_related_tx(chain, req_tx.meta.next.hash, 'pre', req_tx.meta.purehash);
                const depo_raw = search_related_raw(chain, req_tx.meta.next.hash, 'pre', req_tx.meta.purehash);
                const depo_token_info = JSON.parse(depo_raw.raw[0]) || empty_token;
                return !(depo_meta.data.type === "update" && depo_token_info != empty_token && depo_token_info.token === req_tx.meta.data.token && amount + depo_token_info.deposited === 0 && other === depo_token_info.token && valid_state.contents.amount > 0);
            case "withdrawal":
                if (req_tx.meta.data.type != "issue" || base_state.contents.owner != req_tx.meta.data.address || amount <= 0 || new_state.contents.amount - base_state.contents.amount != amount || req_tx.meta.pre.flag != true || valid_state != new_state)
                    return true;
                const with_meta = search_related_tx(chain, req_tx.meta.next.hash, 'pre', req_tx.meta.purehash);
                const with_raw = search_related_raw(chain, req_tx.meta.next.hash, 'next', req_tx.meta.purehash);
                const with_token_info = JSON.parse(with_raw.raw[0]) || empty_token;
                const pre_token_info = await StateData.get(with_token_info.token) || empty_token;
                return !(with_meta.data.type === "update" && with_token_info != empty_token && pre_token_info != empty_token && with_token_info.token === req_tx.meta.data.token && amount + with_token_info.deposited === 0 && other === with_token_info.token && valid_state.contents.amount > 0 && pre_token_info.deposited - amount > 0);
            default:
                return true;
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
        const new_state = JSON.parse(ref_tx.raw.raw[0]);
        if (base_state == null || new_state == null)
            return true;
        const inputs = req_tx.raw.raw;
        const type = inputs[0];
        const remiter = inputs[1];
        const item_refs = JSON.parse(inputs[2]) || [exports.empty_tx()];
        const prices = item_refs.map(ref => ref.meta.unit_price);
        const price_sum = prices.reduce((sum, p) => { return sum + p; }, 0);
        const valid_state = prices.reduce((state, price) => {
            state.contents.amount += price;
            const hash = _.ObjectHash(state.contents);
            state.hash = hash;
            return state;
        }, base_state);
        const mined_check = item_refs.some(ref => {
            const request = ref.meta.data.request;
            const nonce = ref.meta.nonce;
            const payee = ref.meta.data.payee;
            const output = ref.meta.data.output;
            const pow_target = chain[ref.meta.data.index].meta.pow_target;
            return _.Hex_to_Num(request) + nonce + _.Hex_to_Num(JSON.stringify(payee)) + _.Hex_to_Num(_.ObjectHash(output)) > pow_target;
        });
        const empty_state = StateSet.CreateState();
        const empty_token = StateSet.CreateToken();
        switch (type) {
            case "buy":
                const remit_state = await StateData.get(remiter) || empty_state;
                const commit_token = await StateData.get(req_tx.meta.data.token) || empty_token;
                const committed = item_refs.map(item => item.hash).some(key => {
                    return commit_token.committed.indexOf(key) != -1;
                });
                return mined_check || req_tx.meta.data.type != "issue" || base_state.contents.owner != req_tx.meta.data.address || new_state.contents.amount - base_state.contents.amount != item_refs.length || req_tx.meta.pre.flag != true || valid_state != new_state || remit_state === empty_state || commit_token === empty_token || remit_state.contents.amount - price_sum < 0 || committed;
            default:
                return true;
        }
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
    const input = tx_data.input;
    const log_hash = tx_data.log_hash;
    const raw = tx.raw;
    const sign = raw.signature;
    const raw_data = raw.raw;
    const log_raw = raw.log;
    if (_.object_hash_check(hash, tx_meta)) {
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
    else if (address.length === 0 || address.some((add, i) => { return _.address_check(add, pub_key[i], token); })) {
        console.log("invalid address");
        return false;
    }
    else if (_.time_check(timestamp)) {
        console.log("invalid timestamp");
        return false;
    }
    else if (sign.length === 0 || sign.some((s, i) => { return _.sign_check(hash, s, pub_key[i]); })) {
        console.log("invalid signature");
        return false;
    }
    else if (input.some((inp, i) => { return inp != _.toHash(raw_data[i]); })) {
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
    const solvency_state = await StateData.get(solvency) || StateSet.CreateState();
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
exports.ValidRefreshTx = async (tx, chain, my_version, native, unit, token_name_maxsize, StateData, LocationData) => {
    const hash = tx.hash;
    const tx_meta = tx.meta;
    const nonce = tx_meta.nonce;
    const unit_price = tx_meta.unit_price;
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
    const pow_target = chain[index].meta.pow_target;
    const req_tx = _.find_tx(chain, request);
    const req_raw = (() => {
        const txs_index = chain[index].txs.indexOf(req_tx);
        if (txs_index != -1)
            return chain[index].raws[txs_index];
        const natives_index = chain[index].natives.indexOf(req_tx);
        if (natives_index != -1)
            return chain[index].raws[natives_index];
        const units_index = chain[index].units.indexOf(req_tx);
        if (units_index != -1)
            return chain[index].raws[units_index];
        return exports.empty_tx().raw;
    })();
    const req_tx_full = {
        hash: req_tx.hash,
        meta: req_tx.meta,
        raw: req_raw
    };
    const token = req_tx.meta.data.token;
    const payee_state = await StateData.get(payee) || StateSet.CreateState();
    const base_states = await p_iteration_1.reduce(req_tx.meta.data.base, async (result, key) => {
        const getted = await StateData.get(key);
        if (getted)
            return result.concat(getted);
    }, []);
    console.log(base_states);
    const pres = list_up_related(chain, req_tx.meta, "pre", []);
    const nexts = list_up_related(chain, req_tx.meta, "next", []);
    if (!exports.ValidTxBasic(tx, my_version)) {
        return false;
    }
    else if (kind != "refresh") {
        console.log("invalid kind");
        return false;
    }
    else if (_.Hex_to_Num(request) + nonce + _.Hex_to_Num(JSON.stringify(payee)) + _.Hex_to_Num(_.ObjectHash(output)) > pow_target) {
        console.log("invalid nonce");
        return false;
    }
    else if (unit_price < 0) {
        console.log("invalid unit_price");
        return false;
    }
    else if (index < 0 || index > chain.length - 1) {
        console.log("invalid request index");
        return false;
    }
    else if (req_tx == exports.empty_tx_pure() || (chain[tx.meta.data.index].txs.indexOf(req_tx) === -1 && chain[tx.meta.data.index].natives.indexOf(req_tx) === -1 && chain[tx.meta.data.index].units.indexOf(req_tx) === -1)) {
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
    else if (trace[0] != _.ObjectHash(base_states.map(b => _.ObjectHash(b))) || trace[trace.length - 1] != _.ObjectHash(output)) {
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
    else if (token === native && await ValidNative(req_tx_full, tx, base_states[0], chain, StateData)) {
        console.log("invalid native txs");
        return false;
    }
    else if (token === unit && await ValidUnit(req_tx_full, tx, chain, StateData)) {
        console.log("invalid unit txs");
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
        unit_price: empty.meta.unit_price,
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
exports.CreateRefreshTx = (version, unit_price, pub_key, target, feeprice, request, index, payee, output_raw, trace, log_raw, chain) => {
    const req_tx = _.find_tx(chain, request).meta;
    const address = pub_key.map(p => CryptoSet.GenereateAddress(req_tx.data.token, p));
    const date = new Date();
    const timestamp = date.getTime();
    const token = req_tx.data.token;
    const output = output_raw.map(o => _.ObjectHash(JSON.parse(o)));
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
        token: token,
        base: empty.meta.data.base,
        input: empty.meta.data.input,
        request: request,
        index: index,
        payee: payee,
        output: output,
        trace: trace
    };
    const nonce = mining(request, JSON.stringify(payee), output, target);
    const meta = {
        kind: "refresh",
        version: version,
        purehash: _.ObjectHash(data),
        nonce: nonce,
        unit_price: unit_price,
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
exports.SignTx = (tx, my_private, my_address) => {
    const addresses = tx.meta.data.address;
    const index = addresses.indexOf(my_address);
    if (index === -1)
        return tx;
    const sign = CryptoSet.SignData(tx.hash, my_private);
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
exports.AcceptRequestTx = async (tx, validator, index, StateData, LocationData) => {
    const solvency_state = await StateData.get(tx.meta.data.solvency);
    const validator_state = await StateData.get(JSON.stringify(validator));
    const fee = _.tx_fee(tx);
    const after = exports.PayFee(solvency_state, validator_state, fee);
    await StateData.put(JSON.stringify(after[0].contents.owner), after[0]);
    await StateData.put(JSON.stringify(after[1].contents.owner), after[1]);
    await p_iteration_1.forEach(tx.meta.data.base, async (key) => {
        let get_loc = await LocationData.get(key) || exports.empty_location();
        get_loc = {
            state: "already",
            index: index,
            hash: tx.hash
        };
        await LocationData.put(key, get_loc);
    });
    return [StateData, LocationData];
};
exports.AcceptRefreshTx = async (ref_tx, chain, native, unit, StateData, LocationData) => {
    const req_tx = exports.find_req_tx(ref_tx, chain);
    if (req_tx.meta.data.type === "create") {
        const token_info = JSON.parse(req_tx.raw.raw[0]);
        await StateData.put(token_info.token, token_info);
    }
    else if (req_tx.meta.data.type === "update") {
        const token_info = JSON.parse(req_tx.raw.raw[0]);
        let pre_token = await StateData.get(token_info.token);
        pre_token.nonce++;
        pre_token.committed = pre_token.committed.concat(token_info.committed);
        await StateData.put(token_info.token, pre_token);
        const deposit_amount = token_info.deposited;
        let native_info = await StateData.get(native);
        native_info.deposited++;
        native_info.deposited += deposit_amount;
        await StateData.put(native, native_info);
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
        await p_iteration_1.forEach(req_tx.meta.data.base, async (key) => {
            await StateData.delete(key);
            await LocationData.delete(key);
        });
        await p_iteration_1.forEach(ref_tx.raw.raw, async (val) => {
            const state = JSON.parse(val);
            await StateData.put(JSON.stringify(state.contents.owner), state);
        });
        if (req_tx.meta.data.token === native && req_tx.meta.data.type === "scrap" && req_tx.raw.raw[0] === "remit") {
            const receiver = req_tx.raw.raw[1];
            const amount = -1 * Number(req_tx.raw.raw[2]);
            let receiver_state = await StateData.get(receiver);
            receiver_state.contents.nonce++;
            receiver_state.contents.amount += amount;
            await StateData.put(receiver, receiver_state);
            token_info.nonce++;
            token_info.issued += amount;
        }
        else if (req_tx.meta.data.token === unit && req_tx.meta.data.type === "issue" && req_tx.raw.raw[0] === "buy") {
            const inputs = req_tx.raw.raw;
            const remiter = inputs[1];
            const item_refs = JSON.parse(inputs[2]) || [exports.empty_tx()];
            const hashes = item_refs.map(ref => ref.hash);
            const sellers = item_refs.map(ref => ref.meta.data.payee);
            const price_sum = item_refs.reduce((sum, ref) => {
                return sum + ref.meta.unit_price;
            }, 0);
            const remiter_state = await StateData.get(remiter);
            await StateData.delete(remiter);
            const new_remiter = StateSet.CreateState(remiter_state.contents.nonce + 1, remiter_state.contents.owner, remiter_state.contents.token, remiter_state.contents.amount - price_sum, remiter_state.contents.data, remiter_state.contents.product);
            await StateData.put(JSON.stringify(new_remiter.contents.owner), new_remiter);
            await p_iteration_1.forEach(sellers, async (key, i) => {
                const pre = await StateData.get(key);
                await StateData.delete(key);
                const new_amount = pre.contents.amount + item_refs[i].meta.unit_price;
                const new_state = StateSet.CreateState(pre.contents.nonce + 1, pre.contents.owner, pre.contents.token, new_amount, pre.contents.data, pre.contents.product);
                await StateData.put(new_state.hash, new_state);
            });
            let native_info = await StateData.get(native);
            native_info.nonce += (sellers.length + 1);
            await StateData.put(native, native_info);
            let unit_info = await StateData.get(unit);
            unit_info.committed = unit_info.committed.concat(hashes);
            await StateData.put(unit, unit_info);
        }
        await StateData.put(req_tx.meta.data.token, token_info);
    }
    return [StateData, LocationData];
};
