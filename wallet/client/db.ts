import level from 'level-browserify'
import {Trie} from '../../core/merkle_patricia'

const db = level('./db');

export const get = async (key:string)=>{
    try{
        return await db.get(key,{asBuffer:false});
    }
    catch(e){
        console.log(e);
        return {};
    }
}

export const put = async (key:string,val:any)=>{
    try{
        await db.put(key,JSON.stringify(val));
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