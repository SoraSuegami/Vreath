"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dom_1 = require("@cycle/dom");
const http_1 = require("@cycle/http");
const history_1 = require("@cycle/history");
const time_1 = require("@cycle/time");
const cyclic_router_1 = require("cyclic-router");
const cycle_onionify_1 = __importDefault(require("cycle-onionify"));
const cycle_storageify_1 = __importDefault(require("cycle-storageify"));
const switch_path_1 = __importDefault(require("switch-path"));
const storage_1 = __importDefault(require("@cycle/storage"));
const speech_1 = __importDefault(require("./drivers/speech"));
// Set of Drivers used in this App
const driverThunks = [
    ['DOM', () => dom_1.makeDOMDriver('#app')],
    ['HTTP', () => http_1.makeHTTPDriver()],
    ['time', () => time_1.timeDriver],
    ['history', () => history_1.makeHistoryDriver()],
    ['storage', () => storage_1.default],
    ['speech', () => speech_1.default]
];
exports.buildDrivers = (fn) => driverThunks
    .map(fn)
    .map(([n, t]) => ({ [n]: t }))
    .reduce((a, c) => Object.assign(a, c), {});
exports.driverNames = driverThunks
    .map(([n, t]) => n)
    .concat(['onion', 'router']);
function wrapMain(main) {
    return cyclic_router_1.routerify(cycle_onionify_1.default(cycle_storageify_1.default(main, {
        key: 'cycle-spa-state',
        debounce: 100 // wait for 100ms without state change before writing to localStorage
    })), switch_path_1.default);
}
exports.wrapMain = wrapMain;
