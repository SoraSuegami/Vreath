"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const xstream_1 = __importDefault(require("xstream"));
const isolate_1 = __importDefault(require("@cycle/isolate"));
const cyclejs_utils_1 = require("cyclejs-utils");
const drivers_1 = require("../drivers");
const routes_1 = require("../routes");
exports.defaultState = {
    counter: { count: 5 },
    speaker: undefined //use default state of component
};
function App(sources) {
    const initReducer$ = xstream_1.default.of(prevState => (prevState === undefined ? exports.defaultState : prevState));
    const match$ = sources.router.define(routes_1.routes);
    const componentSinks$ = match$.map(({ path, value }) => {
        const { component, scope } = value;
        return isolate_1.default(component, scope)(Object.assign({}, sources, { router: sources.router.path(path) }));
    });
    const sinks = cyclejs_utils_1.extractSinks(componentSinks$, drivers_1.driverNames);
    return Object.assign({}, sinks, { onion: xstream_1.default.merge(initReducer$, sinks.onion) });
}
exports.App = App;
