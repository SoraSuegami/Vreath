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
const dom_1 = require("@cycle/dom");
const testOptions_1 = require("./testOptions");
const speaker_1 = require("../src/components/speaker");
exports.expectedHTML = (content) => `
    <div>
        <h2>My Awesome Cycle.js app - Page 2</h2>
        <textarea${content !== '' ? ` value="${content}"` : ''}></textarea>
        <button>Speak to Me!</button>
        <button>Page 1</button>
    </div>
`;
const createTest = (usePrev) => () => {
    const property = jsverify_1.forall(cyclejs_test_helpers_1.diagramArbitrary, jsverify_1.asciistring, (inputDiagram, str) => cyclejs_test_helpers_1.withTime(Time => {
        const text = str.replace(/"/, '');
        const input$ = Time.diagram(inputDiagram).map(s => ({
            target: { value: s }
        }));
        const DOM = dom_1.mockDOMSource({
            '#text': { input: input$ }
        });
        const app = cycle_onionify_1.default(usePrev ? cyclejs_test_helpers_1.addPrevState(speaker_1.Speaker, { text }) : speaker_1.Speaker)({ DOM });
        const html$ = app.DOM.map(toHtml);
        const expected$ = input$
            .map(ev => ev.target.value)
            .startWith(usePrev ? text : speaker_1.defaultState.text)
            .map(exports.expectedHTML);
        Time.assertEqual(html$, expected$, htmlLooksLike);
    }));
    return jsverify_1.assert(property, testOptions_1.testOptions);
};
describe('speaker tests', () => {
    it('should work without prevState', createTest(true));
    it('should work with prevState', createTest(false));
    it('should navigate', () => {
        const property = jsverify_1.forall(cyclejs_test_helpers_1.diagramArbitrary, clickDiagram => cyclejs_test_helpers_1.withTime(Time => {
            const click$ = Time.diagram(clickDiagram);
            const DOM = dom_1.mockDOMSource({
                '[data-action="navigate"]': { click: click$ }
            });
            const app = cycle_onionify_1.default(speaker_1.Speaker)({ DOM });
            const router$ = app.router;
            const expected$ = click$.mapTo('/');
            Time.assertEqual(router$, expected$);
        }));
        return jsverify_1.assert(property, testOptions_1.testOptions);
    });
    it('should output state on speech', () => {
        const property = jsverify_1.forall(cyclejs_test_helpers_1.diagramArbitrary, jsverify_1.asciistring, (clickDiagram, text) => cyclejs_test_helpers_1.withTime(Time => {
            const click$ = Time.diagram(clickDiagram);
            const DOM = dom_1.mockDOMSource({
                '[data-action="speak"]': { click: click$ }
            });
            const app = cycle_onionify_1.default(cyclejs_test_helpers_1.addPrevState(speaker_1.Speaker, { text }))({
                DOM
            });
            const speech$ = app.speech;
            const expected$ = click$.mapTo(text);
            Time.assertEqual(speech$, expected$);
        }));
        return jsverify_1.assert(property, testOptions_1.testOptions);
    });
});
