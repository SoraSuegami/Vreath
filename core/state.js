"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const CryptoSet = require('./crypto_set.js');
const { map, reduce, filter, forEach } = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
// These are for test.
const password = 'Sora';
const my_pub = CryptoSet.PullMyPublic(password);
const my_address = CryptoSet.AddressFromPublic(my_pub);
CryptoSet.GenerateKeys("Test");
const test_pub = CryptoSet.PullMyPublic("Test");
const test_address = CryptoSet.AddressFromPublic(test_pub);
function FunctoStr(func) {
    return func.toString().replace(/^\(\)\s=>\s{/, "").replace(/}$/, "");
}
function empty_tree(db) {
    return __awaiter(this, void 0, void 0, function* () {
        const key_currency_tree = new RadixTree({
            db: db
        });
        const empty_tree = yield key_currency_tree.emptyTreeState();
        const empty_tree_root = yield empty_tree.flush();
        return empty_tree_root;
    });
}
const key_change_code = () => __awaiter(this, void 0, void 0, function* () {
    const lib = require('./library_for_js');
    const new_states = (() => __awaiter(this, void 0, void 0, function* () {
        if (token_state.token == raw.from || raw.from == null || raw.to == null || raw.amount == null || raw.pub_key == null || raw.sign == null || lib.CryptoSet.verifyData(lib.toHash(raw.from + raw.to + raw.amount + raw.pub_key), raw.sign, raw.pub_key) == false)
            return [];
        else {
            const changed = yield lib.reduce(input.token_id, (change, id, i, array) => __awaiter(this, void 0, void 0, function* () {
                const state = yield tokens.get(lib.en_key(id));
                if (i == array.length - 1 && change.sum < raw.amount) {
                    change.result = [];
                    return change;
                }
                else if (state.contents.owner == raw.from && change.sum + state.contents.amount > raw.amount) {
                    state.contents.owner = raw.to;
                    state.contents.amount = raw.amount;
                    const add_state_con = {
                        owner: raw.to,
                        amount: change.sum + state.contents.amount - raw.amount,
                        tag: {},
                        data: { selfhash: "", ipfshash: "" }
                    };
                    const add_state = {
                        hash: lib.toHash(JSON.stringify(add_state_con)),
                        contents: add_state_con
                    };
                    change.result.push(state).push(add_state);
                }
                else if (state.contents.owner == raw.from && change.sum + state.contents.amount <= raw.amount) {
                    state.contents.owner = raw.to;
                    change.result.push(state);
                    return change;
                }
            }), { sum: 0, result: [] });
            return changed.result;
        }
    }))();
    return {
        states: yield new_states,
        app_rate: 0,
        new_token: [],
        log: ""
    };
});
const create_new_token = () => __awaiter(this, void 0, void 0, function* () {
    const lib = require('./library_for_js');
    const result = (() => __awaiter(this, void 0, void 0, function* () {
        const exsit = yield AddressState.get(lib.en_key(raw.token));
        const check_hash = lib.toHash(raw.token + raw.issued + raw.stateroot + raw.issue_code + raw.change_code + raw.scrap_code + raw.create_code + raw.developer + raw.pub_key) || "";
        if (raw.token == null || raw.issued == null || raw.stateroot == null || raw.issue_code == null || raw.change_code == null || raw.scrap_code == null || raw.create_code == null || raw.developer == null || raw.pub_key == null || raw.sign == null || lib.CryptoSet.verifyData(check_hash, raw.sign, raw.pub_key) == false || exsit != null)
            return [];
        else {
            const new_token = {
                token: raw.token,
                issued: raw.issued,
                stateroot: raw.stateroot,
                issue_code: raw.issue_code,
                change_code: raw.change_code,
                scrap_code: raw.scrap_code,
                create_code: raw.create_code,
                developer: raw.developer
            };
            return [new_token];
        }
    }))();
    return {
        states: [],
        app_rate: 0,
        new_token: yield result,
        log: ""
    };
});
const PNS_register = () => __awaiter(this, void 0, void 0, function* () {
    const lib = require('./library_for_js');
    const new_states = (() => __awaiter(this, void 0, void 0, function* () {
        const exsit = yield AddressState.get(lib.en_key(raw.token));
        const exist_check = exist.some((obj) => {
            if (obj.kind == token_state.token) {
                return true;
            }
            else
                return false;
        });
        if (raw.name == null || raw.token == null || raw.developer == null || raw.pub_key == null || raw.sign == null || lib.CryptoSet.verifyData(lib.toHash(raw.name + raw.token + raw.developer + raw.pub_key), raw.sign, raw.pub_key) == false || exist_check == true)
            return [];
        else {
            const selfhash = lib.toHash(raw.token);
            const ipfshash = lib.ipfs_hash(selfhash);
            const created_con = {
                owner: raw.developer,
                amount: 1,
                tag: { name: raw.name },
                data: { selfhash: selfhash, Ipfshash: ipfshash }
            };
            const created = {
                hash: lib.toHash(JSON.stringify(created_con)),
                contents: created_con
            };
            return [created];
        }
    }))();
    return {
        states: yield new_states,
        app_rate: 0,
        new_token: [],
        log: ""
    };
});
const PNS_change = () => __awaiter(this, void 0, void 0, function* () {
    const lib = require('./library_for_js');
    const new_states = (() => __awaiter(this, void 0, void 0, function* () {
        const exsit = yield AddressState.get(lib.en_key(raw.token));
        const exist_check = exist.some((obj) => {
            if (obj.kind == token_state.token) {
                return true;
            }
            else
                return false;
        });
        const pre_state = yield tokens.get(lib.en_key(raw.pre));
        if (raw.name == null || raw.token == null || raw.developer == null || raw.pub_key == null || raw.sign == null || raw.pre == null || lib.CryptoSet.verifyData(lib.toHash(raw.name + raw.token + raw.developer + raw.pub_key), raw.sign, raw.pub_key) == false || exsit_check == true || raw.name != pre_state.contents.tag.name)
            return [];
        else {
            const selfhash = lib.toHash(raw.token);
            const ipfshash = lib.ipfs_hash(selfhash);
            const changed_con = {
                owner: raw.developer,
                amount: 1,
                tag: { name: raw.name },
                data: { selfhash: selfhash, Ipfshash: ipfshash }
            };
            const created = {
                hash: lib.toHash(JSON.stringify(created_con)),
                contents: created_con
            };
            return [created];
        }
    }))();
    return {
        states: yield new_states,
        app_rate: 0,
        new_token: [],
        log: ""
    };
});
const buy_dags = () => __awaiter(this, void 0, void 0, function* () {
    const lib = require('./library_for_js');
    const new_states = (() => __awaiter(this, void 0, void 0, function* () {
        const aliases = yield AddressState.get(lib.en_key(token_state.token));
        const already_check = yield lib.some(aliases, (alias) => __awaiter(this, void 0, void 0, function* () {
            const state = yield tokens.get(lib.en_key(alias.key));
            if (alias.kind == token_state.token && raw.unit == state.contents.tag.unit)
                return true;
            else
                return false;
        }));
        if (raw.address == null || raw.unit == null || raw.pub_key == null || raw.sign == null || lib.CryptoSet.verifyData(lib.toHash(raw.address + raw.unit + raw.pub_key), raw.sign, raw.pub_key) == false || already_check == true)
            return [];
        else {
            const new_state_con = {
                owner: raw.address,
                amount: 1,
                tag: {},
                data: { selfhash: "", ipfshash: "" }
            };
            const common_con = {
                owner: token_state.token,
                amount: 0,
                tag: { unit: raw.unit, type: "bought", value: 1 },
                data: { selfhash: "", ipfshash: "" }
            };
        }
        const exist_check = exist.some((obj) => {
            if (obj.kind == token_state.token) {
                return true;
            }
            else
                return false;
        });
        if (raw.name == null || raw.token == null || raw.developer == null || raw.pub_key == null || raw.sign == null || lib.CryptoSet.verifyData(lib.toHash(raw.name + raw.token + raw.developer + raw.pub_key), raw.sign, raw.pub_key) == false || exist_check == true)
            return [];
        else {
            const selfhash = lib.toHash(raw.token);
            const ipfshash = lib.ipfs_hash(selfhash);
            const created_con = {
                owner: raw.developer,
                amount: 1,
                tag: { name: raw.name },
                data: { selfhash: selfhash, Ipfshash: ipfshash }
            };
            const created = {
                hash: lib.toHash(JSON.stringify(created_con)),
                contents: created_con
            };
            return [created];
        }
    }))();
    return {
        states: yield new_states,
        app_rate: 0,
        new_token: [],
        log: ""
    };
});
empty_tree(db).then(root => {
    const KeyCurrency = {
        token: 'nix_0.0.1',
        issued: 70000000,
        stateroot: root,
        issue_code: "",
        change_code: FunctoStr(key_change_code),
        scrap_code: "",
        create_code: FunctoStr(create_new_token),
        developer: my_address
    };
    const PNS = {
        token: 'pns',
        issued: 0,
        stateroot: root,
        issue_code: FunctoStr(PNS_register),
        change_code: FunctoStr(PNS_change),
        scrap_code: "",
        create_code: "",
        developer: my_address
    };
    const Sacrifice = {
        token: 'sacrifice_0.0.1',
        issued: 0,
        stateroot: root,
        issue_code: FunctoStr(PNS_register),
        change_code: FunctoStr(PNS_change),
        scrap_code: "",
        create_code: "",
        developer: my_address
    };
});
