var crypto = require("crypto");
var NodeRSA = require("node-rsa");
var fs = require("fs");
/*
var key = new NodeRSA({b: 512});
var Private = key.exportKey('pkcs8-private-pem');
console.log(Private);
var Public = key.exportKey('pkcs8-public-pem');
console.log(Public);
var password = "Pass!";
var cipher = crypto.createCipher('aes-256-cbc', password);
var crypted = cipher.update(Private, 'utf-8', 'hex');
crypted += cipher.final('hex');
console.log(crypted);
var decipher = crypto.createDecipher('aes-256-cbc', password);
var dec = decipher.update(crypted, 'hex', 'utf-8');
dec += decipher.final('utf-8');
console.log(dec);
*/
var HashFromPass = (password) =>{
  var sha256 = crypto.createHash('sha256');
  sha256.update(password);
  var pre_hash = sha256.digest('hex');
  var sha512 = crypto.createHash('sha512');
  sha512.update(pre_hash);
  var hash = sha512.digest('hex');
  return hash;
}
var GenerateKeys = (password) =>{
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
};

var PullMyPrivate = (password) =>{
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

var PullMyPublic = (password) =>{
  var hash = HashFromPass(password);
  var filename = "./keys/public/"+hash+".txt";
  var public_file = fs.readFileSync(filename,'utf-8');
  console.log(public_file.replace(/^-----BEGIN PUBLIC KEY-----/,"").replace(/-----END PUBLIC KEY-----$/,""));
  return public_file.replace(/^-----BEGIN PUBLIC KEY-----/,"").replace(/-----END PUBLIC KEY-----$/,"");
};

var PublicFromPrivate = (Private) =>{
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
};

/*console.log(key);
var text = 'Hello RSA!';
var encrypted = key.encrypt(text, 'base64');
console.log('encrypted: ', encrypted);
var decrypted = key.decrypt(encrypted, 'utf8');
console.log('decrypted: ', decrypted);
var sign = key.sign(text);
console.log(key.verify(text, sign));*/
