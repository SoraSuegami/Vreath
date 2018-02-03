var crypto = require("crypto");
var NodeRSA = require("node-rsa");
var fs = require("fs");

var BofPri = /^-----BEGIN PRIVATE KEY-----/;
var EofPri = /-----END PRIVATE KEY-----$/;
var BofPub = /^-----BEGIN PRIVATE KEY-----/;
var EofPub = /-----END PUBLIC KEY-----$/;
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
  console.log(private_file);
  decipher = crypto.createDecipher('aes-256-cbc', password);
  dec = decipher.update(private_file, 'hex', 'utf-8');
  dec += decipher.final('utf-8');
  console.log(dec.replace(/^-----BEGIN PRIVATE KEY-----/,"").replace(/-----END PRIVATE KEY-----$/,""));
  return dec.replace(/^-----BEGIN PRIVATE KEY-----/,"").replace(/-----END PRIVATE KEY-----$/,"");
}

function PullMyPublic(password){
  var hash = HashFromPass(password);
  var filename = "./keys/public/"+hash+".txt";
  var public_file = fs.readFileSync(filename,'utf-8');
  console.log(public_file.replace(/^-----BEGIN PUBLIC KEY-----/,"").replace(/-----END PUBLIC KEY-----$/,""));
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
  console.log(edit_public);
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
  console.log('encrypted: ', encrypted);
  return encrypted;
}

function DecryptData(data,Private){
  if(data==null)return false;
  else if (Private.match(BofPri)==null&&Private.match(EofPri)==null) {
    Private = '-----BEGIN PRIVATE KEY-----\n'+Private+'-----END PRIVATE KEY-----'
    var key = new NodeRSA(Private);
  }
  else{
    console.log(Private);
    var key = new NodeRSA(Private);
  }
  var decrypted = key.decrypted(data,'utf-8');
  console.log('decrypted: ', decrypted);
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

module.exports ={
  HashFromPass:HashFromPass,
  GenerateKeys:GenerateKeys,
  PullMyPrivate:PullMyPrivate,
  PullMyPublic:PullMyPublic,
  PublicFromPrivate:PublicFromPrivate,
  EncryptData:EncryptData,
  DecryptData:DecryptData,
  SignData:SignData,
  verifyData:verifyData
};
