const levelup = require('levelup');
const leveldown = require('leveldown');
export let db = levelup(leveldown('./db'));
db.close();
export const tag_limit = 10000;
export const key_currency = "nix";
export const fee_by_size = 0.0001;
export const log_limit = 10000000;