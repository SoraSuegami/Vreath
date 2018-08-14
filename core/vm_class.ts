import * as _ from './basic';
import * as T from './types';
import {CreateState} from './state'

export class vreath_vm_state{
    private _gas_sum:number = 0;

    constructor(private _states:T.State[],private _gas_limit:number){
        this._states = _states;
        this._gas_limit = _gas_limit;
    }

    public gas_check(){
        this._gas_sum++;
        if(this._gas_sum>this._gas_limit) throw new Error('out of gas!');
    }

    get states():T.State[]{
        return this._states;
    }

    get gas_sum():number{
        return this._gas_sum;
    }

    public add_states(news:T.State[]){
        this._states = this._states.concat(news);
    }

    public change_states(pres:T.State[],news:T.State[]){
        news.forEach((n,i)=>{
            this._states[i] = n;
        });
    }

    public delete_states(pres:T.State[]){
        pres.forEach((p,i)=>{
            const index = this._states.indexOf(p);
            if(index!=-1) this._states.splice(index,1);
        });
    }

    public create_state(nonce:number,owner:string,token:string,amount:number,data:{[key:string]: string;},product:string[]):T.State{
        return CreateState(nonce,owner,token,amount,data,product);
    }
}
