/*const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));*/
import * as DagSet from './dag'
import * as StateSet from './state'

const {map,reduce,filter,forEach} = require('p-iteration');
const RadixTree = require('dfinity-radix-tree');
const levelup = require('levelup');
const leveldown = require('leveldown');
const db = levelup(leveldown('./db/state'));
const rlp = require('rlp');

export const en_key = (key:string):string[]=>{
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

const en_value = (value:any):string=>{
  return rlp.encode(JSON.stringify(value));
}

export async function ChangeTrie(unit:DagSet.Unit,world_root:string){
  const trie = new RadixTree({
    db: db,
    root: world_root
  });
  const token:string = unit.contents.token;
  const input_ids:string[] = unit.contents.input.contents.token_id;
  const outputs:DagSet.OutputCon = unit.contents.output.contents;

  const token_root:string = await trie.get(en_key(token));
  const token_trie = new RadixTree({
    db: db,
    root: token_root
  });
  const removed = await reduce(input_ids,async (Trie,key:string)=>{
    await Trie.delete(en_key(key));
    return Trie;
  },token_trie);
  const seted = await reduce(outputs.states,async (Trie,state:StateSet.T_state)=>{
    await Trie.set(en_key(state.hash),rlp.encode(JSON.stringify(state)));
    return Trie;
  },removed);
  const new_token_root = await seted.flush();
  const new_token = await trie.set(en_key(token),new_token_root);
  const new_world_root = await new_token.flush();
  return new_world_root;
}
