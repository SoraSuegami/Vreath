"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const util = __importStar(require("util"));
const Merkle = require('merkle-patricia-tree');
const rlp = require('rlp');
const en_key = (key) => {
    return rlp.encode(key);
};
const de_key = (key) => {
    return rlp.decode(key);
};
const en_value = (value) => {
    return rlp.encode(JSON.stringify(value));
};
const de_value = (value) => {
    return JSON.parse(rlp.decode(value));
};
class Trie {
    constructor(db, root = "") {
        if (root == "")
            this.trie = new Merkle(db);
        else
            this.trie = new Merkle(db, Buffer.from(root, 'hex'));
    }
    async get(key) {
        const result = await util.promisify(this.trie.get).bind(this.trie)(en_key(key));
        if (result == null)
            return null;
        return de_value(result);
    }
    async put(key, value) {
        await util.promisify(this.trie.put).bind(this.trie)(en_key(key), en_value(value));
        return this.trie;
    }
    async delete(key) {
        await util.promisify(this.trie.del).bind(this.trie)(en_key(key));
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
        await util.promisify(this.trie.commit).bind(this.trie)();
        return this.trie;
    }
    async revert() {
        await util.promisify(this.trie.revert).bind(this.trie)();
        return this.trie;
    }
    async filter(check = (key, value) => { return true; }) {
        let result = {};
        const stream = this.trie.createReadStream();
        return new Promise((resolve, reject) => {
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
