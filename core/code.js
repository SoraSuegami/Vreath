"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const esp = __importStar(require("esprima"));
const esc = __importStar(require("escodegen"));
const est = __importStar(require("estraverse"));
const vm_class_1 = require("./vm_class");
const _ = __importStar(require("./basic"));
const vm2_1 = require("vm2");
//const code = "var a=23; let a_1 = 10; const b =10;function c(x,y){return x+y;} const fn = ()=>{return 1}; fn(); if(a>1){a_1=10} for(let i=0;i<10;i++){a_1=i} class d{constructor(z){this.z=z;}} const cl = new d(2);";
const code = "const a = 11;";
const option = {
    noColor: false
};
const parsed = esp.parse(code);
const check = (parsed, identifier = [], dependence = {}) => {
    est.traverse(parsed, {
        enter: (node, parent) => {
            if (node.type === "VariableDeclarator")
                identifier.push(node.id.name);
            else if (node.type === "FunctionDeclaration") {
                identifier.push(node.id.name);
                node.params.forEach(p => identifier.push(p.name));
            }
            else if (node.type === "FunctionExpression") {
                identifier.push(node.id.name);
                node.params.forEach(p => identifier.push(p.name));
            }
            else if (node.type === "ClassDeclaration") {
                identifier.push(node.id.name);
                if (dependence[node.id.name] == null)
                    dependence[node.id.name] = [];
                dependence[node.id.name] = node.body.body.map(b => b.key.name);
            }
            else if (node.type === "ObjectExpression") {
                console.log(parent);
                if (dependence[parent.id.name] == null)
                    dependence[parent.id.name] = [];
                node.properties.forEach(p => { dependence[parent.id.name].push(p.key.name); });
            }
            else if (node.type === "MethodDefinition") {
                identifier.push(node.key.name);
                node.value.params.forEach(p => identifier.push(p.name));
            }
            else if (node.type === "MemberExpression") {
                identifier.push(node.property.name);
            }
            else if (node.type === "LabeledStatement") {
                identifier.push(node.label.name);
            }
            else if (node.type === "Property")
                identifier.push(node.key.name);
        },
        leave: (node, parent) => {
            if (node.type === "Identifier" && identifier.indexOf(node.name) === -1)
                throw new Error(node.name + " is not declared!");
            else if (node.type === "CallExpression" && identifier.indexOf(node.callee.name) === -1) {
                throw new Error(node.name + " is not declared!");
            }
            else if (node.type === "MemberExpression" && (dependence[node.object.name] == null || dependence[node.object.name].indexOf(node.property.name) === -1)) {
                throw new Error(node.object.name + " doesn't have property " + node.property.name);
            }
        }
    });
    return parsed;
};
const edit = (editted, states, gas_limit) => {
    const vreath_class = esp.parse(vm_class_1.vreath_vm_state.toString() + "const vreath_instance = new vreath_vm_state([],10);").body;
    const call_gas_checker = esp.parse("vreath_instance.gas_check();").body[0];
    est.traverse(editted, {
        enter: (node, parent) => {
            if (node.hasOwnProperty("body") && Array.isArray(node.body)) {
                node.body.forEach((b, i) => node.body.splice(i - 1, 0, call_gas_checker));
                if (node.body.length === 0)
                    node.body[0] = call_gas_checker;
            }
        },
        leave: (node, parent) => {
        }
    });
    return editted;
};
exports.RunVM = async (code, states, gas_limit) => {
    try {
        const checked = check(esp.parse(code));
        const editted = edit(checked, states, gas_limit);
        const generated = esc.generate(editted);
        console.log(generated);
        const vm = new vm2_1.VM();
        const vreath_instance = new vm_class_1.vreath_vm_state(states, gas_limit);
        vm.freeze(vreath_instance, "vreath_instance");
        vm.run(generated);
        const result = vreath_instance.state_roots;
        return result;
    }
    catch (e) {
        console.log(e);
        return [_.ObjectHash(states)];
    }
};
/*(async ()=>{
    RunVM(code,[],10)
})();*/ 
