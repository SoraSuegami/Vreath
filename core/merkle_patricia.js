"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const merkle_patricia_tree_1 = __importDefault(require("merkle-patricia-tree"));
const rlp_1 = __importDefault(require("rlp"));
const es6_promise_1 = require("es6-promise");
const util_promisify_1 = __importDefault(require("util.promisify"));
const en_key = (key) => {
    return rlp_1.default.encode(key);
};
const de_key = (key) => {
    return rlp_1.default.decode(key);
};
const en_value = (value) => {
    return rlp_1.default.encode(JSON.stringify(value));
};
const de_value = (value) => {
    return JSON.parse(rlp_1.default.decode(value));
};
class Trie {
    constructor(db, root = "") {
        if (root == "")
            this.trie = new merkle_patricia_tree_1.default(db);
        else
            this.trie = new merkle_patricia_tree_1.default(db, Buffer.from(root, 'hex'));
    }
    async get(key) {
        const result = await util_promisify_1.default(this.trie.get).bind(this.trie)(en_key(key));
        if (result == null)
            return null;
        return de_value(result);
    }
    async put(key, value) {
        await util_promisify_1.default(this.trie.put).bind(this.trie)(en_key(key), en_value(value));
        return this.trie;
    }
    async delete(key) {
        await util_promisify_1.default(this.trie.del).bind(this.trie)(en_key(key));
        return this.trie;
    }
    now_root() {
        return this.trie.root.toString("hex");
    }
    checkpoint() {
        this.trie.checkpoint();
        return this.trie;
    }
    async commit() {
        await util_promisify_1.default(this.trie.commit).bind(this.trie)();
        return this.trie;
    }
    async revert() {
        await util_promisify_1.default(this.trie.revert).bind(this.trie)();
        return this.trie;
    }
    async filter(check = (key, value) => { return true; }) {
        let result = {};
        const stream = this.trie.createReadStream();
        return new es6_promise_1.Promise((resolve, reject) => {
            try {
                stream.on('data', (data) => {
                    const key = de_key(data.key);
                    const value = de_value(data.value);
                    if (check(key, value))
                        result[key] = value;
                });
                stream.on('end', (val) => {
                    resolve(result);
                });
            }
            catch (e) {
                reject(e);
            }
        });
    }
}
exports.Trie = Trie;
