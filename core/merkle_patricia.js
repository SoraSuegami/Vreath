"use strict";
/*const Trie = require('merkle-patricia-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
trie = new Trie(db,Buffer.from('2b77e8547bc55e2a95227c939f9f9d67952de1e970a017e0910be510b090aff3','hex'));
trie.put('test', 'one', function () {
  console.log(trie.root.toString('hex'));
});
const geted  = trie.get('test');
geted.then((err,val)=>{
  console.log(val.toString('utf-8'));
})

const stream = trie.createReadStream();
stream.on('data', function (data) {
  console.log('key:' + data.key.toString('hex'));
  console.log(data.value.toString());
});*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const { map, reduce, filter, forEach } = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const rlp = require('rlp');
exports.en_key = (key) => {
    const result = key.split("").reduce((array, val) => {
        const asclled = val.charCodeAt(0).toString(16);
        const splited = asclled.split("").reduce((a, v) => {
            const new_a = a.concat(v);
            return new_a;
        }, []);
        const new_array = array.concat(splited);
        return new_array;
    }, []);
    return result;
};
const en_value = (value) => {
    return rlp.encode(JSON.stringify(value));
};
function ChangeTrie(unit, world_root, addressroot) {
    return __awaiter(this, void 0, void 0, function* () {
        const trie = new RadixTree({
            db: db,
            root: world_root
        });
        const token = unit.contents.token;
        const input_ids = unit.contents.input.token_id;
        const outputs = unit.contents.output;
        const token_root = yield trie.get(exports.en_key(token));
        const token_trie = new RadixTree({
            db: db,
            root: token_root
        });
        const removed = yield reduce(input_ids, (Trie, key) => __awaiter(this, void 0, void 0, function* () {
            yield Trie.delete(exports.en_key(key));
            return Trie;
        }), token_trie);
        const seted = yield reduce(outputs.states, (Trie, state) => __awaiter(this, void 0, void 0, function* () {
            yield Trie.set(exports.en_key(state.hash), state);
            return Trie;
        }), removed);
        const new_token_root = yield seted.flush();
        const new_token = yield trie.set(exports.en_key(token), new_token_root);
        const new_world_root = yield new_token.flush();
        const AddressData = new RadixTree({
            db: db,
            root: addressroot
        });
        const address_aliases = yield AddressData.get(exports.en_key(unit.contents.address));
        const address_added = outputs.states.reduce((aliases, state) => {
            return aliases.concat({
                kind: token,
                key: state.hash
            });
        }, address_aliases);
        const new_address_data = address_added.reduce((new_aliases, alias) => {
            if (alias.kind == unit.contents.token && input_ids.indexOf(alias.key) == -1) {
                return new_aliases.concat(alias);
            }
        }, []);
        yield AddressData.set(exports.en_key(unit.contents.address), state);
        const new_address_root = yield AddressData.flush();
        return { worldroot: new_world_root, addressroot: new_address_root };
    });
}
exports.ChangeTrie = ChangeTrie;
