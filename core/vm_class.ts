import * as _ from './basic';
import * as T from './types';

export class vreath_vm_state{
    private _gas_sum:number;
    private _state_roots:string[] = [];

    constructor(private _states:T.State[],private _gas_limit:number,private _finish_flag:boolean=false,private _traced:string[]=[]){
        this._states = _states;
        this._gas_sum = 0;
        this._gas_limit = _gas_limit;
        this._finish_flag = _finish_flag;
        this._traced = _traced;
        this._refresh_roots();
    }

    public gas_check(){
        this._gas_sum++;
        if(this._gas_sum>this._gas_limit) throw new Error('out of gas!');
    }

    public end(){
        this._finish_flag = true;
    }

    private _check_traced(){
        const now_index = this._state_roots.length-1;
        if(this._traced.length>0&&this._state_roots[now_index]!=this._traced[now_index]) throw new Error('TraceError:'+now_index.toString());
    }

    private _refresh_roots(){
        this._gas_sum = 0;
        const hash_map = this._states.map(s=>s.hash);
        this._state_roots.push(_.ObjectHash(this._states));
        this._check_traced();
    }

    get states():T.State[]{
        return this._states;
    }

    get gas_sum():number{
        return this._gas_sum;
    }

    get flag():boolean{
        return this._finish_flag;
    }

    get state_roots():string[]{
        return this._state_roots;
    }

    public add_states(news:T.State[]){
        if(news.some(s=>s.hash!=_.ObjectHash(s.contents))) throw new Error("invalid state hash");
        this._states = this._states.concat(news);
        this._refresh_roots();
    }

    public change_states(pres:T.State[],news:T.State[]){
        if(news.some(s=>s.hash!=_.ObjectHash(s.contents))) throw new Error("invalid state hash");
        pres.forEach((p,i)=>{
            const index = this._states.indexOf(p);
            this._states[index] = news[i];
        });
        this._refresh_roots();
    }

    public delete_states(pres:T.State[]){
        pres.forEach((p,i)=>{
            const index = this._states.indexOf(p);
            if(index!=-1) this._states.splice(index,1);
        });
        this._refresh_roots();
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

export class vreath_vm_run{
    private finish_flag = true;
    constructor(private _code:string){
        this._code = code;
    }
    private end(){
        this.finish_flag = false;
    }
    public run(_vreath_state:vreath_vm_state):string[]{
        const vreath_state = _vreath_state;
        if(this.finish_flag){
            this.run(vreath_state);
        }
        return vreath_state.state_roots;
    }
}
