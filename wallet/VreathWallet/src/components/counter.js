"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const xstream_1 = __importDefault(require("xstream"));
exports.defaultState = {
    count: 30
};
function Counter({ DOM, onion }) {
    const action$ = intent(DOM);
    const vdom$ = view(onion.state$);
    const routes$ = DOM.select('[data-action="navigate"]')
        .events('click')
        .mapTo('/p2');
    return {
        DOM: vdom$,
        onion: action$,
        router: routes$
    };
}
exports.Counter = Counter;
function intent(DOM) {
    const init$ = xstream_1.default.of(prevState => (prevState === undefined ? exports.defaultState : prevState));
    const add$ = DOM.select('.add')
        .events('click')
        .mapTo(state => (Object.assign({}, state, { count: state.count + 1 })));
    const subtract$ = DOM.select('.subtract')
        .events('click')
        .mapTo(state => (Object.assign({}, state, { count: state.count - 1 })));
    return xstream_1.default.merge(init$, add$, subtract$);
}
function view(state$) {
    return state$.map(({ count }) => (<div>
            <h2>My Awesome Cycle.js app - Page 1</h2>
            <span>{'Counter: ' + count}</span>
            <button type="button" className="add">
                Increase
            </button>
            <button type="button" className="subtract">
                Decrease
            </button>
            <button type="button" data-action="navigate">
                Page 2
            </button>
        </div>));
}
