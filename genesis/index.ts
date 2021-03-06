import {genesis_state} from './state'
import {genesis_candidates} from './candidates'
import {genesis_block} from './block'

export const state = genesis_state;
export const roots = {
    stateroot:"f3a7e29e01052eeea4b84db142243d08839b0d87828d75c4615b40db4571e07f",
    locationroot:"56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
};
export const candidates = genesis_candidates;
export const block= genesis_block;