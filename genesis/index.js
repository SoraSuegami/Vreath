"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const state_1 = require("./state");
const candidates_1 = require("./candidates");
const block_1 = require("./block");
exports.state = state_1.genesis_state;
exports.roots = {
    stateroot: "5e67c96a8d4a580a15417dd11406bd68bf824ceba43ecfaf656c93dd59126f7b",
    locationroot: "56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
};
exports.candidates = candidates_1.genesis_candidates;
exports.block = block_1.genesis_block;
