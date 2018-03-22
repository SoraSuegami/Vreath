const crypto = require('crypto');

function array_to_obj(array){
  return array.reduce((obj,val)=>{
    if(val[1] instanceof Object){
      val[1]=array_to_obj(Object.entries(val[1]));
    }
    obj[val[0]] = val[1];
    return obj
  },{});
}

function maybe(obj){
  try{
    JSON.parse(JSON.stringify(obj), function(key, val){
      if(val==null){
        console.log(true);
        return true;
      }
  });
  }
  catch(e){
    return true;
  }
}


function toHash(str){
  var sha256 = crypto.createHash('sha256');
  sha256.update(str);
  const pre_hash = sha256.digest('hex');
  var sha512 = crypto.createHash('sha512');
  sha512.update(pre_hash);
  const hash = sha512.digest('hex');
  return hash;
}

module.exports = {
  array_to_obj:array_to_obj,
  maybe:maybe,
  toHash:toHash
};
