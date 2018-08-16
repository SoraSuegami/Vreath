import {genesis_state} from './state'
import {genesis_candidates} from './candidates'
import {genesis_block} from './block'

export const state = genesis_state;
export const roots = {
    stateroot:"467dd369487cbf99225b9e7e32cccfb2d31b4955aa3fcb2d10278d1f44cf3682",
    locationroot:"56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"
};
export const candidates = genesis_candidates;
export const block = genesis_block;