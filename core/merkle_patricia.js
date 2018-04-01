"use strict";
/*const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));*/
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const textEncoding = require('text-encoding');
const TextEncoder = textEncoding.TextEncoder;
const rlp = require('rlp');
const en_key = (key) => {
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
