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

const en_key = (key:string):string=>{
  const result:string[] =  key.split("").reduce((array:string[],val:string)=>{
    const asclled:string = val.charCodeAt(0).toString(16);
    const splited:string[] = asclled.split("").reduce((a:string[],v:string)=>{
      const new_a = a.concat(v);
      return new_a;
    },[]);
    const new_array = array.concat(splited);
    return new_array;
  },[]);
  return result;
};
