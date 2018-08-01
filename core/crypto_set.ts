import * as crypto from 'crypto'
import * as secp256k1 from 'secp256k1'

export const HashFromPass = (password:string)=>{
  let sha256 = crypto.createHash('sha256');
  sha256.update(password);
  const pre = sha256.digest('hex');
  let sha256_2 = crypto.createHash('sha256');
  sha256_2.update(pre);
  const hash = sha256_2.digest('hex');
  return hash;
}

export const GenerateKeys = ()=>{
  let Private
  do {
    Private = crypto.randomBytes(32)
  } while (!secp256k1.privateKeyVerify(Private));
  return Private.toString('hex');
}

/*export const GenerateKeys = (password:string)=>{
  let Private
  do {
    Private = crypto.randomBytes(32)
  } while (!secp256k1.privateKeyVerify(Private));
  const Public = secp256k1.publicKeyCreate(Private);
  const cipher = crypto.createCipher('aes-256-cbc', password);
  let crypted = cipher.update(Private.toString('hex'), 'hex', 'hex');
  crypted += cipher.final('hex');
  const hash = HashFromPass(password);
  const private_filename = "./keys/private/"+hash+".txt";
  const public_filename = "./keys/public/"+hash+".txt";
  return{
    private:Private,
    public:Public
  }
}*/


export const PublicFromPrivate = (Private:string):string=>{
  return secp256k1.publicKeyCreate(Buffer.from(Private,'hex')).toString('hex');
}

export const EncryptData = (data:string,Private:string,Public:string):string=>{
  const ecdh = crypto.createECDH('secp256k1');
  const secret = secp256k1.ecdh(Buffer.from(Public,'hex'),Private);
  const cipher = crypto.createCipher('aes-256-cbc', secret);
  let crypted = cipher.update(data, 'utf-8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
}

export const DecryptData = (data:string,Private:string,Public:string)=>{
  try{
  const ecdh = crypto.createECDH('secp256k1');
  const secret = secp256k1.ecdh(Buffer.from(Public,'hex'),Private);
  const decipher = crypto.createDecipher('aes-256-cbc', secret);
  let dec = decipher.update(data, 'hex', 'utf-8');
  dec += decipher.final('utf-8');
  return dec;
  }
  catch(e){throw new Error(e)}
}


export const SignData = (data:string,Private:string):string=>{
  const hash = crypto.createHash("sha256").update(data).digest();
  const sign = secp256k1.sign(Buffer.from(hash),Buffer.from(Private,'hex'));
  return sign.signature.toString('hex');
}


export const verifyData = (data:string,sign:string,Public:string)=>{
  const hash = crypto.createHash("sha256").update(data).digest();
  const verify = secp256k1.verify(hash,Buffer.from(sign,'hex'),Buffer.from(Public,'hex'));
  return verify
}

export const GenereateAddress = (id:string,Public:string)=>{
    return "Vr:"+id+":"+HashFromPass(Public);
}


