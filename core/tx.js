"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { map, reduce, filter, forEach } = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const IPFS = require('ipfs');
const CryptoSet = require('./crypto_set.js');
