"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const state_1 = require("./state");
class vreath_vm_state {
    constructor(_states, _gas_limit) {
        this._states = _states;
        this._gas_limit = _gas_limit;
        this._gas_sum = 0;
        this._states = _states;
        this._gas_limit = _gas_limit;
    }
    gas_check() {
        this._gas_sum++;
        if (this._gas_sum > this._gas_limit)
            throw new Error('out of gas!');
    }
    get states() {
        return this._states;
    }
    get gas_sum() {
        return this._gas_sum;
    }
    add_states(news) {
        this._states = this._states.concat(news);
    }
    change_states(pres, news) {
        news.forEach((n, i) => {
            this._states[i] = n;
        });
    }
    delete_states(pres) {
        pres.forEach((p, i) => {
            const index = this._states.indexOf(p);
            if (index != -1)
                this._states.splice(index, 1);
        });
    }
    create_state(nonce, owner, token, amount, data, product) {
        return state_1.CreateState(nonce, owner, token, amount, data, product);
    }
}
exports.vreath_vm_state = vreath_vm_state;
