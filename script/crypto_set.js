var crypto = require("crypto");
var fs = require("fs");
var secp256k1 = require('secp256k1');
/*
function test(){
  console.log("Hello");
  return 1;
}
function FuncStr(func){
  console.log(func.toString());
}
FuncStr(test);*/
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
//console.log(GenerateKeys('Sora'));

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
//console.log(PullMyPrivate("Sora"));
//console.log(PullMyPublic("Sora"));
//console.log(PublicFromPrivate(PullMyPrivate("Sora")));

function EncryptData(data,mypass,Public){
  if(data==null)return false;
  var Private = PullMyPrivate(mypass);
  var secret = secp256k1.ecdh(Public,Private);
  var cipher = crypto.createCipher('aes-256-cbc', secret);
  var crypted = cipher.update(data, 'utf-8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}
var ecdh = crypto.createECDH('secp256k1');
//GenerateKeys("test");
//EncryptData("HelloWorld","Sora",PullMyPublic("test"))

function DecryptData(data,mypass,Public){
  if(data==null)return false;
  var Private = PullMyPrivate(mypass);
  var secret = secp256k1.ecdh(Public,Private);
  var decipher = crypto.createDecipher('aes-256-cbc', secret);
  var dec = decipher.update(data, 'hex', 'utf-8');
  dec += decipher.final('utf-8');
  return dec;
}

//console.log(DecryptData(EncryptData("HelloWorld","Sora",PullMyPublic("test")),"test",PullMyPublic("Sora")));

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

/*
function GenerateKeys(password){
  var Private = crypto.randomBytes(32);
  var Public = eccrypto.getPublic(Private);
  var cipher = crypto.createCipher('aes-256-cbc', password);
  var crypted = cipher.update(Private.toString('hex'), 'hex', 'hex');
  crypted += cipher.final('hex');
  var hash = HashFromPass(password);
  var private_filename = "./keys/private/"+hash+".txt";
  var public_filename = "./keys/public/"+hash+".txt";
  fs.writeFileSync(private_filename,crypted,'hex');
  fs.writeFileSync(public_filename,Public.toString('hex'),'hex');
  //var edit_private = Private.replace(/^-----BEGIN PRIVATE KEY-----/,"").replace(/-----END PRIVATE KEY-----$/,"");
  //var edit_public =  Public.replace(/^-----BEGIN PUBLIC KEY-----/,"").replace(/-----END PUBLIC KEY-----$/,"");
  return{
    private:Private,
    public:Public
  }
}
console.log(GenerateKeys("Sora"));


function PullMyPrivate(password){
  var hash = HashFromPass(password);
  var filename = "./keys/private/"+hash+".txt";
  var private_file = fs.readFileSync(filename,'hex');
  decipher = crypto.createDecipher('aes-256-cbc', password);
  dec = decipher.update(private_file, 'hex', 'hex');
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
  var Public = eccrypto.getPublic(Private);
  return Public;
}

console.log(PullMyPrivate("Sora"));
console.log(PublicFromPrivate(PullMyPrivate("Sora")));

function EncryptData(data,Public){
  if(data==null)return false;
  var encrypt_data;
  eccrypto.encrypt(Public, Buffer(data)).then(function(encrypted){
    encrypt_data = encrypted;
  }).catch(function(err){
    console.log(err);
  });
  console.log(encrypt_data);
  return encrypted;
}
EncryptData("Hello",PullMyPublic("Sora"));

function DecryptData(data,Private){
  if(data==null)return false;
  var decrypt_data;
  eccrypto.decrypt(Private,data).then(function(decrypted){
    decrypt_data = decrypted;
  });
  return decrypt_data.toString();
}

function SignData(data,password){
  if(data==null)return false;
  var Private = PullMyPrivate(password);
  data = crypto.createHash("sha256").update(data).digest();
  eccrypto.sign(Private, data).then(function(sign){
    var sign_data = sign;
  });
  return sign_data;
}

function verifyData(data,sign,Public){
  if(data==null||sign==null)return false;
  eccrypto.verify(Public, data, sign).then(function(){
    return true;
  }).catch(function(){
    return false;
  });
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
*/
/*
function GenerateKeys(password){
  var key = new NodeRSA({b: 512});
  var Private = key.exportKey('pkcs8-private-pem');
  var Public = key.exportKey('pkcs8-public-pem');
  var cipher = crypto.createCipher('aes-256-cbc', password);
  var crypted = cipher.update(Private, 'utf-8', 'hex');
  crypted += cipher.final('hex');
  var hash = HashFromPass(password);
  var private_filename = "./keys/private/"+hash+".txt";
  var public_filename = "./keys/public/"+hash+".txt";
  fs.writeFileSync(private_filename,crypted);
  fs.writeFileSync(public_filename,Public);
  var edit_private = Private.replace(/^-----BEGIN PRIVATE KEY-----/,"").replace(/-----END PRIVATE KEY-----$/,"");
  var edit_public =  Public.replace(/^-----BEGIN PUBLIC KEY-----/,"").replace(/-----END PUBLIC KEY-----$/,"");
  return{
    private:edit_private,
    public:edit_public
  }
}

function PullMyPrivate(password){
  var hash = HashFromPass(password);
  var filename = "./keys/private/"+hash+".txt";
  var private_file = fs.readFileSync(filename,'utf-8');
  decipher = crypto.createDecipher('aes-256-cbc', password);
  dec = decipher.update(private_file, 'hex', 'utf-8');
  dec += decipher.final('utf-8');
  return dec.replace(/^-----BEGIN PRIVATE KEY-----/,"").replace(/-----END PRIVATE KEY-----$/,"");
}

function PullMyPublic(password){
  var hash = HashFromPass(password);
  var filename = "./keys/public/"+hash+".txt";
  var public_file = fs.readFileSync(filename,'utf-8');
  return public_file.replace(/^-----BEGIN PUBLIC KEY-----/,"").replace(/-----END PUBLIC KEY-----$/,"");
}

function PublicFromPrivate(Private){
  if(Private.match(/^-----BEGIN PUBLIC KEY-----/)&&Private.match(/-----END PUBLIC KEY-----$/)){
    var key = new NodeRSA(Private);
  }
  else{
    var key = new NodeRSA('-----BEGIN PRIVATE KEY-----\n'+Private+'-----END PRIVATE KEY-----');
  }
  var Public = key.exportKey('pkcs8-public-pem');
  var edit_public =  Public.replace(/^-----BEGIN PUBLIC KEY-----/,"").replace(/-----END PUBLIC KEY-----$/,"");
  return edit_public
}

function EncryptData(data,Public){
  if(data==null)return false;
  else if(Public.match(BofPub)==null&&Public.match(EofPub)==null) {
    Public = '-----BEGIN PUBLIC KEY-----\n'+Public+'-----END PUBLIC KEY-----';
    var key = new NodeRSA(Public);
  }
  else{
    var key = new NodeRSA(Public);
  }
  var encrypted = key.encrypt(data, 'base64');
  return encrypted;
}

function DecryptData(data,Private){
  if(data==null)return false;
  else if (Private.match(BofPri)==null&&Private.match(EofPri)==null) {
    Private = '-----BEGIN PRIVATE KEY-----\n'+Private+'-----END PRIVATE KEY-----'
    var key = new NodeRSA(Private);
  }
  else{
    var key = new NodeRSA(Private);
  }
  var decrypted = key.decrypted(data,'utf-8');
  return decrypted;
}

function SignData(data,password){
  if(data==null)return false;
  Private = PullMyPrivate(password);
  Private = '-----BEGIN PRIVATE KEY-----\n'+Private+'-----END PRIVATE KEY-----'
  var key = new NodeRSA(Private);
  var sign = key.sign(data);
  return sign;
}
function verifyData(data,sign,Public){
  if(data==null||sign==null)return false;
  else if(Public.match(BofPub)==null&&Public.match(EofPub)==null) {
    Public = '-----BEGIN PUBLIC KEY-----\n'+Public+'-----END PUBLIC KEY-----';
    var key = new NodeRSA(Public);
  }
  else{
    var key = new NodeRSA(Public);
  }
  return key.verify(data, sign);
}
function AddressFromPublic(Public) {
  if(Public.match(BofPub)&&Public.match(EofPub)) {
    Public.replace(BofPub,"").replace(EofPub,"");
  }
  var hashed = HashFromPass(Public).substr(0,60);
  hashed = HashFromPass(hashed).substr(0,30);
  var address = "PH"+hashed;
  return address;
}
function SystemAddress(name){
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
  AddressFromPublic:AddressFromPublic
};
*/
