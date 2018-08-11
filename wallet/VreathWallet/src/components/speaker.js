"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const xstream_1 = __importDefault(require("xstream"));
const sampleCombine_1 = __importDefault(require("xstream/extra/sampleCombine"));
exports.defaultState = { text: 'Edit me!' };
// Actions
const SPEECH = 'speech', NAVIGATE = 'navigate', UPDATE = 'update';
function Speaker({ DOM, onion }) {
    const action$ = intent(DOM);
    return {
        DOM: view(onion.state$),
        speech: speech(action$, onion.state$),
        onion: onionFn(action$),
        router: router(action$)
    };
}
exports.Speaker = Speaker;
function router(action$) {
    return action$.filter(({ type }) => type === NAVIGATE).mapTo('/');
}
function speech(action$, state$) {
    return action$
        .filter(({ type }) => type === SPEECH)
        .compose(sampleCombine_1.default(state$))
        .map(([_, s]) => s.text);
}
function intent(DOM) {
    const updateText$ = DOM.select('#text')
        .events('input')
        .map((ev) => ev.target.value)
        .map((value) => ({
        type: UPDATE,
        reducer: () => ({ text: value })
    }));
    const speech$ = DOM.select('[data-action="speak"]')
        .events('click')
        .mapTo({ type: SPEECH });
    const navigation$ = DOM.select('[data-action="navigate"]')
        .events('click')
        .mapTo({ type: NAVIGATE });
    return xstream_1.default.merge(updateText$, speech$, navigation$);
}
function onionFn(action$) {
    const init$ = xstream_1.default.of(prevState => (prevState === undefined ? exports.defaultState : prevState));
    const update$ = action$
        .filter(({ type }) => type === UPDATE)
        .map((action) => action.reducer);
    return xstream_1.default.merge(init$, update$);
}
function view(state$) {
    return state$.map(({ text }) => (<div>
            <h2>My Awesome Cycle.js app - Page 2</h2>
            <textarea id="text" rows="3" value={text}/>
            <button type="button" data-action="speak">
                Speak to Me!
            </button>
            <button type="button" data-action="navigate">
                Page 1
            </button>
        </div>));
}
