"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const state_1 = require("./state");
const candidates_1 = require("./candidates");
const block_1 = require("./block");
exports.state = state_1.genesis_state;
exports.roots = {
    stateroot: "f3a7e29e01052eeea4b84db142243d08839b0d87828d75c4615b40db4571e07f",
    locationroot: "56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
};
exports.candidates = candidates_1.genesis_candidates;
exports.block = block_1.genesis_block;
