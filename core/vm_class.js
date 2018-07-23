"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("./basic"));
class vreath_vm_state {
    constructor(_states, _gas_limit, _finish_flag = false, _traced = []) {
        this._states = _states;
        this._gas_limit = _gas_limit;
        this._finish_flag = _finish_flag;
        this._traced = _traced;
        this._state_roots = [];
        this._states = _states;
        this._gas_sum = 0;
        this._gas_limit = _gas_limit;
        this._finish_flag = _finish_flag;
        this._traced = _traced;
        this._refresh_roots();
    }
    gas_check() {
        this._gas_sum++;
        if (this._gas_sum > this._gas_limit)
            throw new Error('out of gas!');
    }
    end() {
        this._finish_flag = true;
    }
    _check_traced() {
        const now_index = this._state_roots.length - 1;
        if (this._traced.length > 0 && this._state_roots[now_index] != this._traced[now_index])
            throw new Error('TraceError:' + now_index.toString());
    }
    _refresh_roots() {
        this._gas_sum = 0;
        const hash_map = this._states.map(s => s.hash);
        this._state_roots.push(_.ObjectHash(this._states));
        this._check_traced();
    }
    get states() {
        return this._states;
    }
    get gas_sum() {
        return this._gas_sum;
    }
    get flag() {
        return this._finish_flag;
    }
    get state_roots() {
        return this._state_roots;
    }
    add_states(news) {
        if (news.some(s => s.hash != _.ObjectHash(s.contents)))
            throw new Error("invalid state hash");
        this._states = this._states.concat(news);
        this._refresh_roots();
    }
    change_states(pres, news) {
        if (news.some(s => s.hash != _.ObjectHash(s.contents)))
            throw new Error("invalid state hash");
        pres.forEach((p, i) => {
            const index = this._states.indexOf(p);
            this._states[index] = news[i];
        });
        this._refresh_roots();
    }
    delete_states(pres) {
        pres.forEach((p, i) => {
            const index = this._states.indexOf(p);
            if (index != -1)
                this._states.splice(index, 1);
        });
        this._refresh_roots();
    }
    create_state(owner, token, amount, data, product) {
        const contents = {
            owner: owner,
            token: token,
            amount: amount,
            data: data,
            product: product
        };
        const hash = _.ObjectHash(contents);
        return {
            hash: hash,
            contents: contents
        };
    }
}
exports.vreath_vm_state = vreath_vm_state;
class vreath_vm_run {
    constructor(_code) {
        this._code = _code;
        this.finish_flag = true;
        this._code = code;
    }
    end() {
        this.finish_flag = false;
    }
    run(_vreath_state) {
        const vreath_state = _vreath_state;
        if (this.finish_flag) {
            this.run(vreath_state);
        }
        return vreath_state.state_roots;
    }
}
exports.vreath_vm_run = vreath_vm_run;
