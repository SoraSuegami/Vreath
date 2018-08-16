"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const state_1 = require("./state");
const candidates_1 = require("./candidates");
const block_1 = require("./block");
exports.state = state_1.genesis_state;
exports.roots = {
    stateroot: "467dd369487cbf99225b9e7e32cccfb2d31b4955aa3fcb2d10278d1f44cf3682",
    locationroot: "56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
};
exports.candidates = candidates_1.genesis_candidates;
exports.block = block_1.genesis_block;
