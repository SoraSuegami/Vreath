"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const secp256k1 = __importStar(require("secp256k1"));
exports.HashFromPass = (password) => {
    let sha256 = crypto.createHash('sha256');
    sha256.update(password);
    sha256.update(sha256.digest('hex'));
    const hash = sha256.digest('hex');
    return hash;
};
exports.GenerateKeys = (password) => {
    let Private;
    do {
        Private = crypto.randomBytes(32);
    } while (!secp256k1.privateKeyVerify(Private));
    const Public = secp256k1.publicKeyCreate(Private);
    const cipher = crypto.createCipher('aes-256-cbc', password);
    let crypted = cipher.update(Private.toString('hex'), 'hex', 'hex');
    crypted += cipher.final('hex');
    const hash = exports.HashFromPass(password);
    const private_filename = "./keys/private/" + hash + ".txt";
    const public_filename = "./keys/public/" + hash + ".txt";
    fs.writeFileSync(private_filename, crypted, 'hex');
    fs.writeFileSync(public_filename, Public.toString('hex'), 'hex');
    return {
        private: Private,
        public: Public
    };
};
exports.PullMyPrivate = (password) => {
    const hash = exports.HashFromPass(password);
    const filename = "./keys/private/" + hash + ".txt";
    const private_file = fs.readFileSync(filename, 'hex');
    const decipher = crypto.createDecipher('aes-256-cbc', password);
    let dec = decipher.update(private_file, 'hex', 'hex');
    dec += decipher.final('hex');
    return dec;
};
exports.PullMyPublic = (password) => {
    const hash = exports.HashFromPass(password);
    const filename = "./keys/public/" + hash + ".txt";
    const public_file = fs.readFileSync(filename, 'hex');
    return public_file;
};
exports.PublicFromPrivate = (Private) => {
    return secp256k1.publicKeyCreate(Buffer.from(Private, 'hex')).toString('hex');
};
exports.EncryptData = (data, mypass, Public) => {
    const Private = Buffer.from(exports.PullMyPrivate(mypass), 'hex');
    const ecdh = crypto.createECDH('secp256k1');
    const secret = secp256k1.ecdh(Buffer.from(Public, 'hex'), Private);
    const cipher = crypto.createCipher('aes-256-cbc', secret);
    let crypted = cipher.update(data, 'utf-8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
};
exports.DecryptData = (data, mypass, Public) => {
    try {
        const Private = Buffer.from(exports.PullMyPrivate(mypass), 'hex');
        const ecdh = crypto.createECDH('secp256k1');
        const secret = secp256k1.ecdh(Buffer.from(Public, 'hex'), Private);
        const decipher = crypto.createDecipher('aes-256-cbc', secret);
        let dec = decipher.update(data, 'hex', 'utf-8');
        dec += decipher.final('utf-8');
        return dec;
    }
    catch (e) {
        throw new Error(e);
    }
};
exports.SignData = (data, password) => {
    const Private = Buffer.from(exports.PullMyPrivate(password), 'hex');
    const hash = crypto.createHash("sha256").update(data).digest();
    const sign = secp256k1.sign(hash, Private);
    return sign.signature.toString('hex');
};
exports.verifyData = (data, sign, Public) => {
    const hash = crypto.createHash("sha256").update(data).digest();
    const verify = secp256k1.verify(hash, Buffer.from(sign, 'hex'), Buffer.from(Public, 'hex'));
    return verify;
};
exports.GenereateAddress = (id, Public) => {
    return "Vr:" + id + ":" + exports.HashFromPass(Public);
};
