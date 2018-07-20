import * as _ from './basic';
import * as T from './types';

export class vreath_vm_state{
    private _gas_sum:number;
    private _state_roots:string[] = [];

    constructor(private _states:T.State[],private _gas_limit:number){
        this._states = _states;
        this._gas_sum = 0;
        this._gas_limit = _gas_limit;
        this._state_roots = this._refresh_roots();
    }

    public gas_check(){
        this._gas_sum++;
        if(this._gas_sum>this._gas_limit) throw new Error('out of gas!');
    }

    private _refresh_roots():string[]{
        this._gas_sum = 0;
        const hash_map = this._states.map(s=>s.hash);
        return this._state_roots.concat(_.ObjectHash(this._states));
    }

    get states():T.State[]{
        return this._states;
    }

    get gas_sum():number{
        return this._gas_sum;
    }

    get state_roots():string[]{
        return this._state_roots;
    }

    public add_states(news:T.State[]){
        if(news.some(s=>s.hash!=_.ObjectHash(s.contents))) throw new Error("invalid state hash");
        this._states = this._states.concat(news);
        this._state_roots = this._refresh_roots();
    }

    public change_states(pres:T.State[],news:T.State[]){
        if(news.some(s=>s.hash!=_.ObjectHash(s.contents))) throw new Error("invalid state hash");
        pres.forEach((p,i)=>{
            const index = this._states.indexOf(p);
            this._states[index] = news[i];
        });
        this._state_roots = this._refresh_roots();
    }

    public delete_states(pres:T.State[]){
        pres.forEach((p,i)=>{
            const index = this._states.indexOf(p);
            if(index!=-1) this._states.splice(index,1);
        });
        this._state_roots = this._refresh_roots();
    }

    public create_state(owner:string[],token:string,amount:number,data:{[key:string]: string;},product:string[]):T.State{
        const contents:T.StateContent = {
            owner:owner,
            token:token,
            amount:amount,
            data:data,
            product:product
        }
        const hash = _.ObjectHash(contents);
        return {
            hash:hash,
            contents:contents
        }
    }
}
