"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const run_1 = require("@cycle/run");
const isolate_1 = __importDefault(require("@cycle/isolate"));
/// #if DEVELOPMENT
const cycle_restart_1 = require("cycle-restart");
/// #endif
const drivers_1 = require("./drivers");
const app_1 = require("./components/app");
const main = drivers_1.wrapMain(app_1.App);
/// #if PRODUCTION
run_1.run(main, drivers_1.buildDrivers(([k, t]) => [k, t()]));
/// #else
const mkDrivers = () => drivers_1.buildDrivers(([k, t]) => {
    if (k === 'DOM') {
        return [k, cycle_restart_1.restartable(t(), { pauseSinksWhileReplaying: false })];
    }
    if (k === 'time' || k === 'router') {
        return [k, t()];
    }
    return [k, cycle_restart_1.restartable(t())];
});
const rerun = cycle_restart_1.rerunner(run_1.setup, mkDrivers, isolate_1.default);
rerun(main);
if (module.hot) {
    module.hot.accept('./components/app', () => {
        const newApp = require('./components/app').App;
        rerun(drivers_1.wrapMain(newApp));
    });
}
/// #endif
