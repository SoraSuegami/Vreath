"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const level_browserify_1 = __importDefault(require("level-browserify"));
const merkle_patricia_1 = require("../../core/merkle_patricia");
const db = level_browserify_1.default('./vreath');
exports.get = async (key, def) => {
    try {
        return JSON.parse(await db.get(key, { asBuffer: false }));
    }
    catch (e) {
        return def;
    }
};
exports.put = async (key, val) => {
    try {
        await db.put(key, JSON.stringify(val));
    }
    catch (e) {
        console.log(e);
    }
};
exports.del = async (key) => {
    try {
        await db.del(key);
    }
    catch (e) {
        console.log(e);
    }
};
exports.trie_ins = (root) => {
    try {
        return new merkle_patricia_1.Trie(db, root);
    }
    catch (e) {
        console.log(e);
        return new merkle_patricia_1.Trie(db);
    }
};
