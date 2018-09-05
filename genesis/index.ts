import {genesis_state} from './state'
import {genesis_candidates} from './candidates'
import {genesis_block} from './block'

export const state = genesis_state;
export const roots = {
    stateroot:"5e67c96a8d4a580a15417dd11406bd68bf824ceba43ecfaf656c93dd59126f7b",
    locationroot:"56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
};
export const candidates = genesis_candidates;
export const block= genesis_block;