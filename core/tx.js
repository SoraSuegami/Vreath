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
exports.empty_tx = () => {
    const data = {
        address: "",
        pub_key: [],
        timestamp: 0,
        log_hash: "",
        gas: 0,
        solvency: "[]",
        type: "change",
        token: "",
        base: [],
        input: "",
        request: _.toHash(""),
        index: 0,
        payee: "[]",
        output: ""
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
        address: CryptoSet.GenereateAddress("", _.toHash("")),
        state: "yet",
        index: 0,
        hash: _.toHash("")
    };
};
const requested_check = (base, LocationData) => {
    const addresses = LocationData.map(l => l.address);
    return base.some(key => {
        const index = addresses.indexOf(key);
        const val = LocationData[index];
        if (index === -1)
            return false;
        else if (val.state === "yet")
            return false;
        else
            return true;
    });
};
const hashed_pub_check = (state, pubs) => {
    return state.owner.split(':')[2] != _.toHash(_.reduce_pub(pubs));
};
const refreshed_check = (base, index, tx_hash, LocationData) => {
    const addresses = LocationData.map(l => l.address);
    return base.some(key => {
        const i = addresses.indexOf(key);
        const val = LocationData[i];
        if (i === -1)
            return true;
        else if (val.state === "yet" && val.index === index && val.hash === tx_hash)
            return true;
        else
            return false;
    });
};
const state_check = (state, token_name_maxsize) => {
    const hash_size = Buffer.from(_.toHash("")).length;
    return _.address_form_check(state.owner, token_name_maxsize) || state.amount < 0 ||
        Object.entries(state.data).some((obj) => { return Buffer.from(obj[0]).length > hash_size || Buffer.from(obj[1]).length > hash_size; }) ||
        state.product.some(pro => Buffer.from(pro).length > token_name_maxsize);
};
const base_declaration_check = (target, bases, StateData) => {
    const getted = StateData.filter(s => { return s.kind === "state" && s.owner === target.owner; })[0];
    return getted != null && bases.indexOf(target.owner) === -1;
};
const output_check = (type, base_states, output_raw, token_name_maxsize, StateData) => {
    if (type === "create") {
        const token_state = JSON.parse(output_raw[0]);
        const code = output_raw[1];
        const getted = StateData.filter(s => { return s.kind === "token" && s.token === token_state.token; })[0];
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
        const getted = StateData.filter(s => { return s.kind === "token" && s.token === key; })[0];
        const dev_check = token_state.developer.some((dev) => {
            return _.address_form_check(dev, token_name_maxsize);
        });
        const comm = getted.committed.some((c) => {
            return token_state.committed.indexOf(c) === -1;
        });
        if (getted == null || dev_check || token_state.deposited < 0 || comm)
            return true;
        else
            return false;
    }
    else {
        const new_states = output_raw.reduce((arr, o) => {
            return arr.concat(JSON.parse(o));
        }, []);
        const bases = base_states.map(s => s.owner);
        const nonce_check = base_states.some((b, i) => b.nonce + 1 != new_states[i].nonce);
        if (new_states.some((s) => { return state_check(s, token_name_maxsize) || base_declaration_check(s, bases, StateData); }) || nonce_check)
            return true;
        const pre_amount = base_states.reduce((sum, s) => { return sum + s.amount; }, 0);
        const new_amount = new_states.reduce((sum, s) => { return sum + s.amount; }, 0);
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
        num = _.Hex_to_Num(request) + nonce + _.Hex_to_Num(refresher) + _.Hex_to_Num(output);
    } while (num > target);
    return nonce;
};
exports.find_req_tx = (ref_tx, chain) => {
    const index = ref_tx.meta.data.index || 0;
    const req_pure = chain[index].txs.filter(tx => tx.hash === ref_tx.meta.data.request).concat(chain[index].natives.filter(tx => tx.hash === ref_tx.meta.data.request)).concat(chain[index].units.filter(tx => tx.hash === ref_tx.meta.data.request))[0];
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
const ValidNative = (req_tx, ref_tx, chain, StateData) => {
    try {
        const base_state = StateData.filter(s => { return s.kind === "state" && s.owner === req_tx.meta.data.base[0]; })[0] || StateSet.CreateState();
        const new_state = JSON.parse(ref_tx.raw.raw[0]) || StateSet.CreateState();
        if (_.ObjectHash(base_state) === _.ObjectHash(StateSet.CreateState()) || _.ObjectHash(new_state) === _.ObjectHash(StateSet.CreateState()))
            return true;
        const inputs = req_tx.raw.raw;
        const type = inputs[0];
        const other = inputs[1];
        const amount = Number(inputs[2]);
        const empty_token = StateSet.CreateToken();
        const valid_state = ((state) => {
            state.nonce++;
            state.amount += amount;
            return state;
        })(Object.assign({}, base_state));
        switch (type) {
            case "remit":
                return req_tx.meta.data.type != "scrap" || base_state.owner != req_tx.meta.data.address || new_state.amount - base_state.amount != amount || _.ObjectHash(valid_state) != _.ObjectHash(new_state) || amount >= 0;
            case "deposit":
                if (req_tx.meta.data.type != "scrap" || base_state.owner != req_tx.meta.data.address || amount >= 0 || new_state.amount - base_state.amount != amount || req_tx.meta.next.flag != true || _.ObjectHash(valid_state) != _.ObjectHash(new_state))
                    return true;
                const depo_meta = search_related_tx(chain, req_tx.meta.next.hash, 'pre', req_tx.meta.purehash);
                const depo_raw = search_related_raw(chain, req_tx.meta.next.hash, 'pre', req_tx.meta.purehash);
                const depo_token_info = JSON.parse(depo_raw.raw[0]) || empty_token;
                return !(depo_meta.data.type === "update" && depo_token_info != empty_token && depo_token_info.token === req_tx.meta.data.token && amount + depo_token_info.deposited === 0 && other === depo_token_info.token && valid_state.amount > 0);
            case "withdrawal":
                if (req_tx.meta.data.type != "issue" || base_state.owner != req_tx.meta.data.address || amount <= 0 || new_state.amount - base_state.amount != amount || req_tx.meta.pre.flag != true || _.ObjectHash(valid_state) != _.ObjectHash(new_state))
                    return true;
                const with_meta = search_related_tx(chain, req_tx.meta.next.hash, 'pre', req_tx.meta.purehash);
                const with_raw = search_related_raw(chain, req_tx.meta.next.hash, 'next', req_tx.meta.purehash);
                const with_token_info = JSON.parse(with_raw.raw[0]) || empty_token;
                const pre_token_info = StateData.filter(s => { return s.kind === "token" && s.token === with_token_info.token; })[0] || empty_token;
                return !(with_meta.data.type === "update" && with_token_info != empty_token && pre_token_info != empty_token && with_token_info.token === req_tx.meta.data.token && amount + with_token_info.deposited === 0 && other === with_token_info.token && valid_state.amount > 0 && pre_token_info.deposited - amount > 0);
            default:
                return true;
        }
    }
    catch (e) {
        console.log(e);
        return true;
    }
};
const ValidUnit = (req_tx, ref_tx, chain, StateData) => {
    try {
        const base_state = StateData.filter(s => { return s.kind === "state" && s.owner === req_tx.meta.data.base[0]; })[0] || StateSet.CreateState();
        const new_state = JSON.parse(ref_tx.raw.raw[0]) || StateSet.CreateState();
        if (_.ObjectHash(base_state) != _.ObjectHash(StateSet.CreateState()) || _.ObjectHash(new_state) != _.ObjectHash(StateSet.CreateState()))
            return true;
        const inputs = req_tx.raw.raw;
        const type = inputs[0];
        const remiter = inputs[1];
        const item_refs = JSON.parse(inputs[2]) || [exports.empty_tx()];
        const prices = item_refs.map(ref => ref.meta.unit_price);
        const price_sum = prices.reduce((sum, p) => { return sum + p; }, 0);
        const valid_state = prices.reduce((state, price) => {
            state.nonce++;
            state.amount += price;
            return state;
        }, base_state);
        const mined_check = item_refs.some(ref => {
            const request = ref.meta.data.request;
            const nonce = ref.meta.nonce;
            const payee = ref.meta.data.payee;
            const output = ref.meta.data.output;
            const pow_target = chain[ref.meta.data.index].meta.pow_target;
            return _.Hex_to_Num(request) + nonce + _.Hex_to_Num(JSON.stringify(payee)) + _.Hex_to_Num(output) > pow_target;
        });
        const empty_state = StateSet.CreateState();
        const empty_token = StateSet.CreateToken();
        switch (type) {
            case "buy":
                const remit_state = StateData.filter(s => { return s.kind === "state" && s.owner === remiter; })[0] || empty_state;
                const commit_token = StateData.filter(s => { return s.kind === "token" && s.token === req_tx.meta.data.token; })[0] || empty_token;
                const committed = item_refs.map(item => item.hash).some(key => {
                    return commit_token.committed.indexOf(key) != -1;
                });
                return mined_check || req_tx.meta.data.type != "issue" || base_state.owner != req_tx.meta.data.address || new_state.amount - base_state.amount != item_refs.length || req_tx.meta.pre.flag != true || valid_state != new_state || remit_state === empty_state || commit_token === empty_token || remit_state.amount - price_sum < 0 || committed;
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
    else if (address.length === 0 || _.address_check(address, _.reduce_pub(pub_key), token)) {
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
    else if (log_hash != _.ObjectHash(log_raw)) {
        console.log("invalid log hash");
        return false;
    }
    else {
        return true;
    }
};
exports.ValidRequestTx = (tx, my_version, native, unit, StateData, LocationData) => {
    const tx_meta = tx.meta;
    const kind = tx_meta.kind;
    const tx_data = tx_meta.data;
    const address = tx_data.address;
    const pub_key = tx_data.pub_key;
    const gas = tx_data.gas;
    const solvency = tx_data.solvency;
    const token = tx_data.token;
    const base = tx_data.base;
    const input = tx_data.input;
    const raw_data = tx.raw.raw;
    const solvency_state = StateData.filter(s => {
        return s.kind === "state" && s.token === native && s.owner === solvency && s.amount >= _.tx_fee(tx) + gas;
    })[0];
    const base_states = base.map(key => {
        return StateData.filter(s => { return s.kind === "state" && s.owner === key; })[0] || StateSet.CreateState();
    });
    if (!exports.ValidTxBasic(tx, my_version)) {
        return false;
    }
    else if (kind != "request") {
        console.log("invalid kind");
        return false;
    }
    else if (solvency_state == null || hashed_pub_check(solvency_state, pub_key) || requested_check([solvency], LocationData)) {
        console.log("invalid solvency");
        return false;
    }
    else if (base_states.indexOf(StateSet.CreateState()) != -1) {
        console.log("invalid base");
        return false;
    }
    else if (requested_check(base, LocationData)) {
        console.log("base states are already requested");
        return false;
    }
    else if (input != _.ObjectHash(raw_data)) {
        console.log("invalid input hash");
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
exports.ValidRefreshTx = (tx, chain, my_version, native, unit, token_name_maxsize, StateData, LocationData) => {
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
    const payee_state = StateData.filter(s => {
        return s.kind === "state" && s.owner === payee && s.amount + req_tx.meta.data.gas >= _.tx_fee(tx) && s.token === native;
    })[0];
    const base_states = req_tx.meta.data.base.map(key => {
        return StateData.filter(s => { return s.kind === "state" && s.owner === key; })[0] || StateSet.CreateState();
    });
    const pres = list_up_related(chain, req_tx.meta, "pre", []);
    const nexts = list_up_related(chain, req_tx.meta, "next", []);
    if (!exports.ValidTxBasic(tx, my_version)) {
        return false;
    }
    else if (kind != "refresh") {
        console.log("invalid kind");
        return false;
    }
    else if (_.Hex_to_Num(request) + nonce + _.Hex_to_Num(JSON.stringify(payee)) + _.Hex_to_Num(output) > pow_target) {
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
    else if (refreshed_check(req_tx.meta.data.base, index, request, LocationData)) {
        console.log("base states are already refreshed");
        return false;
    }
    else if (refreshed_check([req_tx.meta.data.solvency], index, request, LocationData)) {
        console.log("invalid solvency");
        return false;
    }
    else if (payee_state == null || hashed_pub_check(payee_state, pub_key)) {
        console.log("invalid payee");
        return false;
    }
    else if (output != _.ObjectHash(output_raw)) {
        console.log("invalid output hash");
        return false;
    }
    else if (output_check(req_tx.meta.data.type, base_states, output_raw, token_name_maxsize, StateData)) {
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
    else if (token === native && ValidNative(req_tx_full, tx, chain, StateData)) {
        console.log("invalid native txs");
        return false;
    }
    else if (token === unit && ValidUnit(req_tx_full, tx, chain, StateData)) {
        console.log("invalid unit txs");
        return false;
    }
    else {
        return true;
    }
};
exports.CreateRequestTx = (pub_key, solvency, gas, type, token, base, input_raw, log, version, pre, next, feeprice) => {
    const address = CryptoSet.GenereateAddress(token, _.reduce_pub(pub_key));
    const date = new Date();
    const timestamp = date.getTime();
    const input = _.ObjectHash(input_raw);
    const log_hash = _.ObjectHash(log);
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
        output: empty.meta.data.output
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
exports.CreateRefreshTx = (version, unit_price, pub_key, target, feeprice, request, index, payee, output_raw, log_raw, chain) => {
    const req_tx = _.find_tx(chain, request).meta;
    const token = req_tx.data.token;
    const address = CryptoSet.GenereateAddress(token, _.reduce_pub(pub_key));
    const date = new Date();
    const timestamp = date.getTime();
    const output = _.ObjectHash(output_raw);
    const log_hash = _.ObjectHash(log_raw);
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
        output: output
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
    if (solvency.owner === validator.owner)
        return [solvency, validator];
    solvency.amount -= fee;
    validator.amount += fee;
    return [solvency, validator];
};
exports.PayGas = (solvency, payee, gas) => {
    if (solvency.owner === payee.owner)
        return [solvency, payee];
    solvency.amount -= gas;
    payee.amount += gas;
    return [solvency, payee];
};
exports.PayStates = (solvency_state, payee_state, validator_state, gas, fee) => {
    const after_gas = exports.PayGas(solvency_state, payee_state, gas);
    const after_fee = exports.PayFee(after_gas[1], validator_state, fee);
    if (solvency_state.owner === payee_state.owner && payee_state.owner === validator_state.owner)
        return [solvency_state];
    else if (solvency_state.owner === payee_state.owner)
        return after_fee;
    else if (payee_state.owner === validator_state.owner)
        return after_gas;
    else if (solvency_state.owner === validator_state.owner)
        return after_fee;
    return [after_gas[0], after_fee[1], after_fee[2]];
};
exports.AcceptRequestTx = (tx, validator, index, StateData, LocationData) => {
    const solvency_state = StateData.filter(s => s.owner === tx.meta.data.solvency)[0];
    const validator_state = StateData.filter(s => s.owner === validator)[0];
    const fee = _.tx_fee(tx);
    const after = exports.PayFee(solvency_state, validator_state, fee);
    const StateData_added = StateData.map(s => {
        if (s.owner === after[0].owner)
            return after[0];
        else if (s.owner === after[1].owner)
            return after[1];
        else
            return s;
    });
    const LocationData_added = tx.meta.data.base.reduce((loc, key) => {
        const new_loc = {
            address: key,
            state: "already",
            index: index,
            hash: tx.hash
        };
        const mapped = LocationData.map(l => {
            if (l.address === key)
                return new_loc;
            else
                return l;
        });
        if (_.ObjectHash(mapped) === _.ObjectHash(LocationData))
            return LocationData.concat(new_loc);
        else
            return mapped;
    }, LocationData);
    return [StateData_added, LocationData_added];
};
exports.AcceptRefreshTx = (ref_tx, chain, validator, native, unit, StateData, LocationData) => {
    const req_tx = exports.find_req_tx(ref_tx, chain);
    if (req_tx.meta.data.type === "create") {
        const token_info = JSON.parse(req_tx.raw.raw[0]);
        const StateData_create = StateData.map(s => {
            if (s.kind === "token" && s.token === token_info.token)
                return token_info;
            else
                return s;
        });
        return [StateData_create, LocationData];
    }
    else if (req_tx.meta.data.type === "update") {
        const token_info = JSON.parse(req_tx.raw.raw[0]);
        const pre_token = StateData.filter(s => { return s.kind === "token" && s.token === token_info.token; })[0];
        const change = {
            nonce: pre_token.nonce + 1,
            issued: pre_token.issued + token_info.issued,
            committed: pre_token.committed.concat(token_info.committed)
        };
        const new_token = Object.assign(change, pre_token);
        const StateData_update = StateData.map(s => {
            if (s.kind === "token" && s.token === token_info.token)
                return new_token;
            else
                return s;
        });
        return [StateData_update, LocationData];
    }
    else {
        const token_info = StateData.filter(s => { return s.kind === "token" && s.token === req_tx.meta.data.token; })[0];
        const base_states = req_tx.meta.data.base.map((key) => {
            return StateData.filter(s => { return s.kind === "state" && s.owner === key; })[0];
        });
        const new_states = ref_tx.raw.raw.map(obj => JSON.parse(obj));
        const pre_amount_sum = base_states.reduce((sum, state) => sum + state.amount, 0);
        const new_amount_sum = new_states.reduce((sum, state) => sum + state.amount, 0);
        const new_token_info = Object.assign({ nonce: token_info.nonce + 1, issued: token_info.issued + new_amount_sum - pre_amount_sum }, token_info);
        const solvency_state = StateData.filter(s => { return s.kind === "state" && s.owner === req_tx.meta.data.solvency; })[0] || StateSet.CreateState(0, req_tx.meta.data.solvency, native, 0, {}, []);
        const payee_state = StateData.filter(s => { return s.kind === "state" && s.owner === ref_tx.meta.data.payee; })[0] || StateSet.CreateState(0, ref_tx.meta.data.payee, native, 0, {}, []);
        const validator_state = StateData.filter(s => { return s.kind === "state" && s.owner === validator; })[0] || StateSet.CreateState(0, validator, native, 0, {}, []);
        const tx_fee = _.tx_fee(ref_tx);
        const payed = exports.PayStates(solvency_state, payee_state, validator_state, ref_tx.meta.data.gas, tx_fee);
        const payed_owners = payed.map(s => s.owner);
        const StateData_payed = StateData.map(s => {
            const index = payed_owners.indexOf(s.owner);
            if (index === -1)
                return s;
            return payed[index];
        });
        const StateData_deleted = StateData_payed.filter(s => {
            return s.kind === "token" || req_tx.meta.data.base.indexOf(s.owner) === -1;
        }).map(s => {
            if (s.kind === "token" && s.token === req_tx.meta.data.token)
                return new_token_info;
            else
                return s;
        });
        const owners = StateData_deleted.map(s => s.owner);
        const StateData_added = ref_tx.raw.raw.reduce((states, val) => {
            const state = JSON.parse(val);
            if (state == null)
                return states;
            const index = owners.indexOf(state.owner);
            if (index != -1) {
                return states.map((val, i) => { if (index === i)
                    return state;
                else
                    return val; });
            }
            else
                return states.concat(state);
        }, StateData_deleted);
        const loc_addresses = LocationData.map(l => l.address);
        const LocationData_added = req_tx.meta.data.base.reduce((locs, key) => {
            const index = loc_addresses.indexOf(key);
            const pre_loc = locs[index];
            const new_loc = Object.assign({ state: "yet" }, pre_loc);
            return locs.map((val, i) => { if (index === i)
                return new_loc;
            else
                return val; });
        }, LocationData);
        if (req_tx.meta.data.token === native && req_tx.meta.data.type === "scrap" && req_tx.raw.raw[0] === "remit") {
            const receiver = req_tx.raw.raw[1];
            const amount = -1 * Number(req_tx.raw.raw[2]);
            const receiver_state = StateData_added.filter(s => { return s.kind === "state" && s.owner === receiver; })[0] || StateSet.CreateState(0, receiver, native, 0, {}, []);
            const recieved = Object.assign({ nonce: receiver_state.nonce + 1, amount: receiver_state.amount + amount }, receiver_state);
            const native_info = StateData_added.filter(s => { return s.kind === "token" && s.token === native; })[0];
            const native_added = Object.assign({ nonce: native_info.nonce + 1 }, native_info);
            const StateData_native = StateData_added.map(s => {
                if (s.kind === "state" && s.owner === receiver)
                    return recieved;
                else if (s.kind === "token" && s.token === native)
                    return native_added;
                else
                    return s;
            });
            return [StateData_native, LocationData_added];
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
            const remiter_state = StateData_added.filter(s => { return s.kind === "state" && s.owner === remiter; })[0];
            const remited = {
                nonce: remiter_state.nonce + 1,
                amount: remiter_state.amount - price_sum
            };
            const new_remiter = Object.assign(remited, remiter_state);
            const unit_address = CryptoSet.GenereateAddress(unit, _.reduce_pub(req_tx.meta.data.pub_key));
            const unit_state = StateData_added.filter(s => { return s.kind === "state" && s.owner === unit_address; })[0] || StateSet.CreateState(0, unit_address, unit, 0, {}, []);
            const issued_unit = {
                nonce: unit_state.nonce + 1,
                amount: unit_state.amount + item_refs.length
            };
            const new_unit_state = Object.assign(issued_unit, unit_state);
            const owners = StateData_added.map(s => s.owner);
            const StateData_unit_remit = ((states) => {
                const index = owners.indexOf(unit_address);
                if (index != -1)
                    return states.map((val, i) => { if (index === i)
                        return new_unit_state;
                    else
                        return val; });
                else
                    return states.concat(new_unit_state);
            })(StateData.map((val, i) => { if (i === owners.indexOf(remiter))
                return new_remiter;
            else
                return val; }));
            const StateData_unit_recieve = sellers.reduce((states, seller) => {
                const index = owners.indexOf(seller);
                const amount = item_refs[index].meta.unit_price;
                if (index == -1)
                    return states.concat(StateSet.CreateState(0, seller, native, amount, {}, []));
                const pre = states[index];
                const recieved = {
                    nonce: pre.nonce,
                    amount: pre.amount + amount
                };
                return states.map((val, i) => { if (index === i)
                    return Object.assign(recieved, pre);
                else
                    return val; });
            }, StateData_unit_remit);
            const pre_native = StateData.filter(s => { return s.kind === "token" && s.token === native; })[0];
            const new_native = Object.assign({ nonce: pre_native.nonce + item_refs.length }, pre_native);
            const pre_unit = StateData.filter(s => { return s.kind === "token" && s.token === unit; })[0];
            const new_unit = Object.assign({ nonce: pre_unit.nonce + 1, issued: pre_unit.issued + item_refs.length }, pre_native);
            const StateData_unit = StateData_unit_recieve.map((val, i) => { if (i === owners.indexOf(native))
                return new_native;
            else
                return val; }).map((val, i) => { if (i === owners.indexOf(unit))
                return new_unit;
            else
                return val; });
            return [StateData_unit, LocationData_added];
        }
        return [StateData_added, LocationData_added];
    }
};
