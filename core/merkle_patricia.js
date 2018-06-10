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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var util = require("util");
var PromiseSet = require("es6-promise");
var Merkle = require('merkle-patricia-tree');
var _a = require('p-iteration'), map = _a.map, reduce = _a.reduce, filter = _a.filter, forEach = _a.forEach;
var promise = PromiseSet.Promise;
/*const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));*/
var rlp = require('rlp');
/*export const en_key = (key:string):string[]=>{
  const result:string[] =  key.split("").reduce((array:string[],val:string)=>{
    const asclled:string = val.charCodeAt(0).toString(16);
    const splited:string[] = asclled.split("").reduce((a:string[],v:string)=>{
      const new_a = a.concat(v);
      return new_a;
    },[]);
    const new_array = array.concat(splited);
    return new_array;
  },[]);
  return result;
};*/
var en_key = function (key) {
    return rlp.encode(key);
};
var de_key = function (key) {
    return rlp.decode(key);
};
var en_value = function (value) {
    return rlp.encode(JSON.stringify(value));
};
var de_value = function (value) {
    return JSON.parse(rlp.decode(value));
};
var Trie = /** @class */ (function () {
    function Trie(db, root) {
        if (root === void 0) { root = ""; }
        if (root == "")
            this.trie = new Merkle(db);
        else
            this.trie = new Merkle(db, Buffer.from(root, 'hex'));
    }
    Trie.prototype.get = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, util.promisify(this.trie.get).bind(this.trie)(en_key(key))];
                    case 1:
                        result = _a.sent();
                        if (result == null)
                            return [2 /*return*/, {}];
                        return [2 /*return*/, de_value(result)];
                }
            });
        });
    };
    Trie.prototype.put = function (key, value) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, util.promisify(this.trie.put).bind(this.trie)(en_key(key), en_value(value))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.trie];
                }
            });
        });
    };
    Trie.prototype["delete"] = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, util.promisify(this.trie.del).bind(this.trie)(en_key(key))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.trie];
                }
            });
        });
    };
    Trie.prototype.now_root = function () {
        return this.trie.root.toString("hex");
    };
    Trie.prototype.checkpoint = function () {
        this.trie.checkpoint();
        return this.trie;
    };
    Trie.prototype.commit = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, util.promisify(this.trie.commit).bind(this.trie)()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.trie];
                }
            });
        });
    };
    Trie.prototype.revert = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, util.promisify(this.trie.revert).bind(this.trie)()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, this.trie];
                }
            });
        });
    };
    Trie.prototype.filter = function (check) {
        if (check === void 0) { check = function (key, value) { return true; }; }
        return __awaiter(this, void 0, void 0, function () {
            var result, stream;
            return __generator(this, function (_a) {
                result = {};
                stream = this.trie.createReadStream();
                /*stream.on('data',(data)=>{
                  const key = de_key(data.key);
                  const value = de_value(data.value);
                  if(check(key,value)) result[key] = value;
                });
                return result;*/
                return [2 /*return*/, new promise(function (resolve, reject) {
                        stream.on('data', function (data) {
                            var key = de_key(data.key);
                            var value = de_value(data.value);
                            if (check(key, value))
                                result[key] = value;
                        });
                        stream.on('end', function (val) {
                            resolve(result);
                        });
                    })];
            });
        });
    };
    return Trie;
}());
exports.Trie = Trie;
/*export async function ChangeTrie(unit:DagSet.Unit,world_root:string,addressroot:string){
  const trie = new RadixTree({
    db: db,
    root: world_root
  });
  const token:string = unit.contents.token;
  const input_ids:string[] = unit.contents.input.token_id;
  const outputs:DagSet.Output = unit.contents.output;

  const token_root:string = await trie.get(en_key(token));
  const token_trie = new RadixTree({
    db: db,
    root: token_root
  });
  const removed = await reduce(input_ids,async (Trie,key:string)=>{
    await Trie.delete(en_key(key));
    return Trie;
  },token_trie);
  const seted = await reduce(outputs.states,async (Trie,state:StateSet.State)=>{
    await Trie.set(en_key(state.hash),state);
    return Trie;
  },removed);
  const new_token_root = await seted.flush();
  const new_token = await trie.set(en_key(token),new_token_root);
  const new_world_root = await new_token.flush();
  const AddressData = new RadixTree({
    db: db,
    root: addressroot
  });
  const address_aliases:ChainSet.AddressAlias[] = await AddressData.get(en_key(unit.contents.address));
  const address_added =outputs.states.reduce((aliases,state:StateSet.State)=>{
    return aliases.concat({
      kind:token,
      key:state.hash
    });
  },address_aliases);
  const new_address_data = address_added.reduce((new_aliases:ChainSet.AddressAlias[],alias:ChainSet.AddressAlias)=>{
    if(alias.kind==unit.contents.token&&input_ids.indexOf(alias.key)==-1){
      return new_aliases.concat(alias)
    }
  },[]);
  await AddressData.set(en_key(unit.contents.address),state);
  const new_address_root = await AddressData.flush();
  return {worldroot:new_world_root,addressroot:new_address_root};
}*/
