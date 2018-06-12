"use strict";
exports.__esModule = true;
var crypto = require("crypto");
var CryptoSet = require('./crypto_set.js');
exports.toHash = function (str) {
    var sha256 = crypto.createHash('sha256');
    sha256.update(str);
    var pre_hash = sha256.digest('hex');
    var sha512 = crypto.createHash('sha512');
    sha512.update(pre_hash);
    var hash = sha512.digest('hex');
    return hash;
};
exports.get_unicode = function (str) {
    var result = str.split("").reduce(function (num, val) {
        return num + val.charCodeAt(0);
    }, 0);
    return result;
};
exports.object_hash_check = function (hash, obj) {
    return hash != exports.toHash(JSON.stringify(obj));
};
exports.sign_check = function (address, token, hash, signature, pub_key) {
    return address != token && CryptoSet.verifyData(hash, signature, pub_key) == false;
};
exports.address_check = function (address, token) {
    return address != token && !address.match(/^PH/);
};
exports.pub_key_check = function (address, token, pub_key) {
    return address != token && address != CryptoSet.AddressFromPublic(pub_key);
};
exports.time_check = function (timestamp) {
    var date = new Date();
    return timestamp > date.getTime();
};
