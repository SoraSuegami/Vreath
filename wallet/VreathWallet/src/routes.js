"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const counter_1 = require("./components/counter");
const speaker_1 = require("./components/speaker");
exports.routes = {
    '/': { component: counter_1.Counter, scope: 'counter' },
    '/p2': { component: speaker_1.Speaker, scope: 'speaker' }
};
exports.initialRoute = '/';
