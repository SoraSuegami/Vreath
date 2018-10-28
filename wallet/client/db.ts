import level from 'level-browserify'
import {Trie} from '../../core/merkle_patricia'

const db = level('./vreath');

export const get = async <T>(key:string,def:T):Promise<T>=>{
    try{
        return JSON.parse(await db.get(key,{asBuffer:false}));
    }
    catch(e){
        return def;
    }
}

export const put = async <T>(key:string,val:T):Promise<void>=>{
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