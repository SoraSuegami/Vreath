"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsverify_1 = require("jsverify");
const cyclejs_test_helpers_1 = require("cyclejs-test-helpers");
const cycle_onionify_1 = __importDefault(require("cycle-onionify"));
const cyclic_router_1 = require("cyclic-router");
const switch_path_1 = __importDefault(require("switch-path"));
const htmlLooksLike = require('html-looks-like');
const toHtml = require('snabbdom-to-html'); //snabbdom-to-html's typings are broken
const dom_1 = require("@cycle/dom");
const testOptions_1 = require("./testOptions");
const app_1 = require("../src/components/app");
const speaker_1 = require("../src/components/speaker");
exports.expectedHTML = (counter, state) => {
    const page = counter ? 1 : 2;
    const pageHTML = counter
        ? `<span>Counter: ${state}</span>`
        : `<textarea ${state === '' ? '' : `value="${state}"`}></textarea>`;
    return `
        <div>
            <h2>My Awesome Cycle.js app - Page ${page}</h2>
            {{ ... }}
            ${pageHTML}
            {{ ... }}
        </div>
    `;
};
const createTest = (usePrev) => () => {
    const property = jsverify_1.forall(cyclejs_test_helpers_1.diagramArbitrary, jsverify_1.nat, jsverify_1.asciistring, (navigationDiagram, count, str) => cyclejs_test_helpers_1.withTime(Time => {
        const DOM = dom_1.mockDOMSource({});
        const text = str.replace(/"/, '');
        const navigation$ = Time.diagram(navigationDiagram).fold(acc => !acc, true);
        const mockHistory$ = navigation$
            .map(b => (b ? '/' : '/p2'))
            .map(s => ({
            pathname: s,
            search: '',
            hash: '',
            locationKey: ''
        }));
        const app = cyclic_router_1.routerify(cycle_onionify_1.default(usePrev
            ? cyclejs_test_helpers_1.addPrevState(app_1.App, {
                counter: { count },
                speaker: { text }
            })
            : app_1.App), switch_path_1.default)({ DOM, history: mockHistory$ });
        const html$ = app.DOM.map(toHtml);
        const expected$ = navigation$.map(b => {
            if (usePrev) {
                if (b) {
                    return exports.expectedHTML(b, count);
                }
                return exports.expectedHTML(b, text);
            }
            if (b) {
                return exports.expectedHTML(b, app_1.defaultState.counter.count);
            }
            return exports.expectedHTML(b, speaker_1.defaultState.text);
        });
        Time.assertEqual(html$, expected$, htmlLooksLike);
    }));
    return jsverify_1.assert(property, testOptions_1.testOptions);
};
describe('app tests', () => {
    it('should work without prevState', createTest(false));
    it('should work with prevState', createTest(true));
});
