var crypto = require("crypto");
var fs = require("fs");
var secp256k1 = require('secp256k1');

function HashFromPass(password){
  var sha256 = crypto.createHash('sha256');
  sha256.update(password);
  var pre_hash = sha256.digest('hex');
  var sha512 = crypto.createHash('sha512');
  sha512.update(pre_hash);
  var hash = sha512.digest('hex');
  return hash;
}

function GenerateKeys(password){
  let Private
  do {
    Private = crypto.randomBytes(32)
  } while (!secp256k1.privateKeyVerify(Private));
  var Public = secp256k1.publicKeyCreate(Private);
  var cipher = crypto.createCipher('aes-256-cbc', password);
  var crypted = cipher.update(Private.toString('hex'), 'hex', 'hex');
  crypted += cipher.final('hex');
  var hash = HashFromPass(password);
  var private_filename = "./keys/private/"+hash+".txt";
  var public_filename = "./keys/public/"+hash+".txt";
  fs.writeFileSync(private_filename,crypted,'hex');
  fs.writeFileSync(public_filename,Public.toString('hex'),'hex');
  return{
    private:Private,
    public:Public
  }
}


function PullMyPrivate(password){
  var hash = HashFromPass(password);
  var filename = "./keys/private/"+hash+".txt";
  var private_file = fs.readFileSync(filename,'hex');
  var decipher = crypto.createDecipher('aes-256-cbc', password);
  var dec = decipher.update(private_file, 'hex', 'hex');
  dec += decipher.final('hex');
  return Buffer.from(dec,'hex');
}

function PullMyPublic(password){
  var hash = HashFromPass(password);
  var filename = "./keys/public/"+hash+".txt";
  var public_file = fs.readFileSync(filename,'hex');
  return Buffer.from(public_file,'hex');
}

function PublicFromPrivate(Private){
  var Public = secp256k1.publicKeyCreate(Private);
  return Public;
}

function EncryptData(data,mypass,Public){
  if(data==null)return false;
  var Private = PullMyPrivate(mypass);
  var ecdh = crypto.createECDH('secp256k1');
  var secret = secp256k1.ecdh(Public,Private);
  var cipher = crypto.createCipher('aes-256-cbc', secret);
  var crypted = cipher.update(data, 'utf-8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

function DecryptData(data,mypass,Public){
  if(data==null)return false;
  var Private = PullMyPrivate(mypass);
  var ecdh = crypto.createECDH('secp256k1');
  var secret = secp256k1.ecdh(Public,Private);
  var decipher = crypto.createDecipher('aes-256-cbc', secret);
  var dec = decipher.update(data, 'hex', 'utf-8');
  dec += decipher.final('utf-8');
  return dec;
}


function SignData(data,password){
  if(data==null)return false;
  var Private = PullMyPrivate(password);
  data = crypto.createHash("sha256").update(data).digest();
  var sign = secp256k1.sign(data,Private);
  return sign.signature;
}

function verifyData(data,sign,Public){
  if(data==null||sign==null)return false;
  data = crypto.createHash("sha256").update(data).digest();
  var verify = secp256k1.verify(data,sign,Public);
  return verify
}

function AddressFromPublic(Public) {
  var hashed = HashFromPass(Public).substr(0,60);
  hashed = HashFromPass(hashed).substr(0,30);
  var address = "PH"+hashed;
  return address;
}

function AppAddress(name){
  var add;
  if(Buffer.byteLength(name,'utf-8')>30){
    name.substr(0,30);
    add=28;
  }
  else if(Buffer.byteLength(name,'utf-8')>=0){
    add=58-Buffer.byteLength(name,'utf-8');
  }
  else{
    return false;
  }
  var hashed = HashFromPass(name).substr(0,add);
  var address = 'PS' + name + hashed;
  return address;
}

module.exports ={
  HashFromPass:HashFromPass,
  GenerateKeys:GenerateKeys,
  PullMyPrivate:PullMyPrivate,
  PullMyPublic:PullMyPublic,
  PublicFromPrivate:PublicFromPrivate,
  EncryptData:EncryptData,
  DecryptData:DecryptData,
  SignData:SignData,
  verifyData:verifyData,
  AddressFromPublic:AddressFromPublic,
  AppAddress:AppAddress
};
