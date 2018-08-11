import levelup from 'levelup'
import leveldown from 'leveldown'
import {Trie} from '../core/merkle_patricia'

const db = levelup(leveldown('./db'));

export const get = async (key:string)=>{
    try{
        return await db.get(key);
    }
    catch(e){
        console.log(e);
        return {};
    }
}

export const put = async (key:string,val:any)=>{
    try{
        await db.put(key,val);
    }
    catch(e){
        console.log(e);
    }
}

export const del = async (key:string)=>{
    try{
        await db.del(key);
    }
    catch(e){
        console.log(e);
    }
}

export const trie_ins = (root:string)=>{
    try{
        return new Trie(db,root);
    }
    catch(e){
        console.log(e);
        return new Trie(db);
    }
}