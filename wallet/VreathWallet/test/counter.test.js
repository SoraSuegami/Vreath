"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsverify_1 = require("jsverify");
const cyclejs_test_helpers_1 = require("cyclejs-test-helpers");
const cycle_onionify_1 = __importDefault(require("cycle-onionify"));
const htmlLooksLike = require('html-looks-like');
const toHtml = require('snabbdom-to-html'); //snabbdom-to-html's typings are broken
const xstream_1 = __importDefault(require("xstream"));
const dom_1 = require("@cycle/dom");
const testOptions_1 = require("./testOptions");
const counter_1 = require("../src/components/counter");
exports.expectedHTML = (count) => `
    <div>
        <h2>My Awesome Cycle.js app - Page 1</h2>
        <span>Counter: ${count}</span>
        <button>Increase</button>
        <button>Decrease</button>
        <button>Page 2</button>
    </div>
`;
const createTest = (usePrev) => () => {
    const property = jsverify_1.forall(cyclejs_test_helpers_1.diagramArbitrary, cyclejs_test_helpers_1.diagramArbitrary, jsverify_1.nat, (addDiagram, subtractDiagram, count) => cyclejs_test_helpers_1.withTime(Time => {
        const add$ = Time.diagram(addDiagram);
        const subtract$ = Time.diagram(subtractDiagram);
        const DOM = dom_1.mockDOMSource({
            '.add': { click: add$ },
            '.subtract': { click: subtract$ }
        });
        const app = cycle_onionify_1.default(usePrev ? cyclejs_test_helpers_1.addPrevState(counter_1.Counter, { count }) : counter_1.Counter)({ DOM });
        const html$ = app.DOM.map(toHtml);
        const expected$ = xstream_1.default
            .merge(add$.mapTo(+1), subtract$.mapTo(-1))
            .fold((acc, curr) => acc + curr, usePrev ? count : counter_1.defaultState.count)
            .map(exports.expectedHTML);
        Time.assertEqual(html$, expected$, htmlLooksLike);
    }));
    return jsverify_1.assert(property, testOptions_1.testOptions);
};
describe('counter tests', () => {
    it('should work without prevState', createTest(true));
    it('should work with prevState', createTest(false));
    it('should navigate', () => {
        const property = jsverify_1.forall(cyclejs_test_helpers_1.diagramArbitrary, clickDiagram => cyclejs_test_helpers_1.withTime(Time => {
            const click$ = Time.diagram(clickDiagram);
            const DOM = dom_1.mockDOMSource({
                '[data-action="navigate"]': { click: click$ }
            });
            const app = cycle_onionify_1.default(counter_1.Counter)({ DOM });
            const router$ = app.router;
            const expected$ = click$.mapTo('/p2');
            Time.assertEqual(router$, expected$);
        }));
        return jsverify_1.assert(property, testOptions_1.testOptions);
    });
});
