"use strict";
// Minimal speech driver - just speech, no options or events
//
// Limited availablity see caniuse
//
// TODO Add fallback or error
Object.defineProperty(exports, "__esModule", { value: true });
function speechDriver(speechText$) {
    speechText$.addListener({
        next: what => {
            if (window.speechSynthesis !== undefined) {
                const utterance = new SpeechSynthesisUtterance(what);
                window.speechSynthesis.speak(utterance);
            }
        }
    });
}
exports.default = speechDriver;
