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
const state_1 = require("./state");
class vreath_vm_state {
    constructor(_states, _gas_limit, _finish_flag = false, _traced = []) {
        this._states = _states;
        this._gas_limit = _gas_limit;
        this._finish_flag = _finish_flag;
        this._traced = _traced;
        this._gas_sum = 0;
        this._state_roots = [];
        this._states = _states;
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
        const hashed = this._states.map(s => _.ObjectHash(s));
        this._state_roots.push(_.ObjectHash(hashed));
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
        this._states = this._states.concat(news);
        this._refresh_roots();
    }
    change_states(pres, news) {
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
    create_state(nonce, owner, token, amount, data, product) {
        return state_1.CreateState(nonce, owner, token, amount, data, product);
    }
}
exports.vreath_vm_state = vreath_vm_state;
