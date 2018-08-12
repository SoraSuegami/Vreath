import Merkle from 'merkle-patricia-tree'
import rlp from 'rlp'
import {Promise} from 'es6-promise'
import promisify from 'util.promisify'

const en_key = (key:string):string=>{
  return rlp.encode(key);
}

const de_key = (key:string):string=>{
  return rlp.decode(key).toString();
}

const en_value = (value:any):string=>{
  return rlp.encode(JSON.stringify(value));
}

const de_value = (value:any)=>{
  return JSON.parse(rlp.decode(value));
}

export class Trie {
  private trie:any;
  constructor(db:any,root:string=""){
    if(root=="") this.trie = new Merkle(db);
    else this.trie = new Merkle(db,Buffer.from(root,'hex'));
  }

  async get(key:string){
    const result = await promisify(this.trie.get).bind(this.trie)(en_key(key));
    if(result==null) return null;
    return de_value(result);
  }

  async put(key:string,value:any){
    await promisify(this.trie.put).bind(this.trie)(en_key(key),en_value(value));
    return this.trie;
  }

  async delete(key:string){
    await promisify(this.trie.del).bind(this.trie)(en_key(key));
    return this.trie;
  }

  now_root():string{
    return this.trie.root.toString("hex");
  }

  checkpoint(){
    this.trie.checkpoint();
    return this.trie;
  }

  async commit(){
    await promisify(this.trie.commit).bind(this.trie)();
    return this.trie;
  }

  async revert(){
    await promisify(this.trie.revert).bind(this.trie)();
    return this.trie;
  }

  async filter(check:(key:string,value:any)=>boolean=(key:string,value)=>{return true}){
    let result:{[key:string]:any;} = {};
    const stream = this.trie.createReadStream();
    return new Promise<{[key:string]:any;}>((resolve,reject)=>{
      try{
        stream.on('data',(data:{key:string,value:any})=>{
          const key = de_key(data.key);
          const value = de_value(data.value);
          if(check(key,value)) result[key] = value;
        });

        stream.on('end',(val:{key:string,value:any})=>{
          resolve(result);
        });
      }
      catch(e){reject(e)}
    });
  }
}