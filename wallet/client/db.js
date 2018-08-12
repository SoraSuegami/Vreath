"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const level_browserify_1 = __importDefault(require("level-browserify"));
const merkle_patricia_1 = require("../../core/merkle_patricia");
const db = level_browserify_1.default('./db');
exports.get = async (key) => {
    try {
        return await db.get(key);
    }
    catch (e) {
        console.log(e);
        return {};
    }
};
exports.put = async (key, val) => {
    try {
        await db.put(key, val);
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
