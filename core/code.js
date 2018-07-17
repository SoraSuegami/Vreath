"use strict";
/*import * as P from 'Parsimmon'

let gas_sum = 0;
const gas_limit = 1;

const check_gas = ()=>{
    gas_sum++;
    console.log(gas_sum);
    if(gas_sum>gas_limit) throw new Error("out of gas!");
}


const Lang = P.createLanguage({
    whole:(r)=>{
        return r.value.sepBy(P.optWhitespace)
    },
    value:(r)=>{
        return P.alt(
            r.reserved,
            r.string,
            r.number,
            r.operator,
            r.list
        )
    },
    reserved:()=>{
        return P.alt(
            P.string("let"),
            P.string("const"),
            P.string("dif"),
            P.string("call"),
            P.string("if"),
            P.string("for")
        )
    },
    string:()=>{
        return P.regex(/[a-z]+/);
    },
    number:()=>{
        return P.regexp(/[0-9]+/).map(Number);
    },
    operator:()=>{
        return P.regexp(/\+|\-|\*|\/|\%|\=|\=\=|\<|\>|\<\=|\>\=|\=\>/);
    },
    term:(r)=>{
        P.seq(
            r.operator,
            r.number
        )
        return P.regex(/^(\+|\-|\*|\/|\%|\=|\=\=|\<|\>|\<\=|\>\=){0,1}[0-9]+/);
    },
    list:(r)=>{
        return P.regex(/^(\(|\{|\[|\')/)
            .then(P.seq(
                P.regex(/^(\(|\{|\[|\')/),
                r.whole,
                P.regex(/(\)|\}|\]|\')$/)
            ))
            .skip(P.regex(/(\)|\}|\]|\')$/))
    }
});

try{
    const compiled = Lang.whole.tryParse("2*(1+3)");
    console.log(compiled)
    const edit = (compiled)=>{
        let funcs:string[] = [];
        let editted = compiled;
        for(let i in compiled){
            let code = compiled[i];
            if(code==='dif') funcs.push(code);
            else if(code==='call'){
                let ori = funcs.indexOf(code);
                if(ori===-1) throw new Error("invalid function");
                editted = compiled.filter((val,i:number)=>{
                    return i!=ori;
                });
            }
        }
    }

    const code_reduce = (compiled)=>{
        let result = "";
        for(let code of compiled){
            if(Array.isArray(code)) result += code_reduce(code)+" ";
            else result += code+" ";
        }
        return result;
    }
    console.log(code_reduce(compiled));
}
catch(e){console.log(e)}*/
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
const pj = __importStar(require("prettyjson"));
//const code = "var a=23; let a_1 = 10; const b =10;function c(x,y){return x+y;} const fn = ()=>{return 1}; fn(); if(a>1){a_1=10} for(let i=0;i<10;i++){a_1=i} class d{constructor(z){this.z=z;}} const cl = new d(2);";
const code = "class d{constructor(z){this.z=z;}}";
const option = {
    noColor: false
};
const parsed = esp.parse(code);
const call_gas_checker = {
    type: "ExpressionStatement",
    expression: {
        type: "CallExpression",
        callee: {
            type: "Identifier",
            name: "Vreath_gas_check_function"
        },
        arguments: []
    }
};
const add_gas_checker = (parsed) => {
    try {
        const checked = Object.entries(parsed).reduce((result, part, index) => {
            const key = part[0];
            const val = part[1];
            if (val instanceof Object && !Array.isArray(val)) {
                result[key] = add_gas_checker(val);
                /*Object.entries(val).forEach((p,i)=>{
                    const k = p[0];
                    const val = p[1];
                    result[key][k] = add_gas_checker(val);
                });*/
            }
            else if (key === "body" || key === "declarations" && Array.isArray(val)) {
                //console.log(val);
                result[key] = add_gas_checker(val);
                /*val.forEach((v,i)=>{
                    result[key][i] = add_gas_checker(v);
                })*/
                val.forEach(((p, i) => { result[key].splice(i, 0, call_gas_checker); }));
                //console.log(key+":"+result[key])
            }
            return result;
        }, parsed);
    }
    catch (e) {
        console.log(e);
    }
};
/*console.log(pj.render(add_gas_checker(parsed),option));
console.log(esc.generate(add_gas_checker(parsed)));*/
const edit = (parsed, identifier = [], dependence = {}) => {
    /*const dec_gas_checker = esp.parse("function Vreath_gas_check_function(){gas_sum++; if(gas_sum>gas_limit)throw new Error('out of gas!')}").body[0];
    const call_gas_checker = {
        type:"ExpressionStatement",
        expression:{
            type:"CallExpression",
            callee:{
                type:"Identifier",
                name:"Vreath_gas_check_function"
            },
            arguments:[]
        }
    };*/
    let i = 0;
    est.traverse(parsed, {
        enter: (node, parent) => {
            console.log(i);
            console.log("enter");
            i++;
            console.log(pj.render(node, option));
            if (node.type === "VariableDeclarator" && node.id != null && node.id.name != null)
                identifier.push(node.id.name);
            else if (node.type === "FunctionDeclaration" && node.id != null && node.id.name != null) {
                identifier.push(node.id.name);
                node.params.forEach(p => identifier.push(p.name));
            }
            else if (node.type === "FunctionExpression" && node.id != null && node.id.name != null) {
                identifier.push(node.id.name);
                node.params.forEach(p => identifier.push(p.name));
            }
            else if (node.type === "ClassDeclaration" && node.id != null && node.id.name != null)
                identifier.push(node.id.name);
            else if (node.type === "MethodDefinition" && node.key != null && node.key.name != null) {
                identifier.push(node.key.name);
                node.value.params.forEach(p => identifier.push(p.name));
            }
            else if (node.type === "MemberExpression" && node.property != null && node.property.name != null)
                identifier.push(node.property.name);
            else if (node.type === "LabeledStatement" && node.label != null && node.label.name != null)
                identifier.push(node.label.name);
            else if (node.type === "Property" && node.key != null && node.key.name != null)
                identifier.push(node.key.name);
        },
        leave: (node, parent) => {
            console.log(i);
            console.log("leave");
            i++;
            console.log(pj.render(node, option));
            if (node.type === "Identifier" && node.name != null && identifier.indexOf(node.name) === -1)
                throw new Error(node.name + " is not declared!");
            else if (node.type === "CallExpression" && node.callee != null && node.callee.name != null && identifier.indexOf(node.callee.name) === -1)
                throw new Error(node.name + " is not declared!");
        }
    });
    //parsed.body.unshift(dec_gas_checker);
    //console.log(pj.render(parsed),option)
    return parsed;
};
/*
const edit = (parsed,identifier:string[]=[])=>{
    let my_levels = ["Vreath_gas_check_function"];
    const  editted = parsed.reduce((result,part,index:number)=>{
        if(part.type==="VariableDeclaration"&&part.declarations.type==="VariableDeclarator"){
            if(my_levels.indexOf(part.declarations.id.name)!=-1) throw new Error(part.declarations.id.name+" is already declared as variable");
            identifier.push(part.declarations.id.name);
            my_levels.push(part.declarations.id.name);
            //result.splice(index-1,0,call_gas_checker);
            if(part.init.type==="ArrowFunctionExpression"){
                const recursion = edit(part.body.body,identifier);
                result[index].body.body = recursion[0];
                identifier = recursion[1];
            }
        }
        else if(part.type==="FunctionDeclaration"){
            if(my_levels.indexOf(part.id.name)!=-1) throw new Error(part.id.name+" is already declared as function");
            identifier.push(part.id.name);
            my_levels.push(part.id.name);
            //result.splice(index-1,0,call_gas_checker);
            const recursion = edit(part.body.body,identifier);
            result[index].body.body = recursion[0];
            identifier = recursion[1];
        }
        else if(part.type==="ClassDeclaration"){
            if(my_levels.indexOf(part.id.name)!=-1) throw new Error(part.id.name+" is already declared as class");
            identifier.push(part.id.name);
            my_levels.push(part.id.name);
            //result.splice(index-1,0,call_gas_checker);
            const recursion = edit(part.body.body.body,identifier);
            result[index].body.body.body = recursion[0];
            identifier = recursion[1];
        }
        else if(part.type==="ExpressionStatement"&&part.expression.type==="AssignmentExpression"){
            if(identifier.indexOf(part.expression.left.name)===-1) throw new Error(part.expression.left.name+" is not declared as variable");
            //result.splice(index-1,0,call_gas_checker);
        }
        else if(part.type==="ExpressionStatement"&&part.expression.type==="CallExpression"){
            if(identifier.indexOf(part.expression.callee.name)===-1) throw new Error(part.expression.callee.name+" is not declared as function");
            //result.splice(index-1,0,call_gas_checker);
        }
        else if(part.type==="FunctionExpression"&&part.expression.type==="FunctionExpression"){
            if(identifier.indexOf(part.id.name)!=-1) throw new Error(part.id.name+" is already declared as function");
            identifier.push(part.id.name);
            //result.splice(index-1,0,call_gas_checker);
            const recursion = edit(part.body.body,identifier);
            result[index].body.body = recursion[0];
            identifier = recursion[1];
        }
        else if(part.type==="IfStatement"){
            //result.splice(index-1,0,call_gas_checker);
        }
        else if(part.type==="ForStatement"){
            //result.splice(index-1,0,call_gas_checker);
            result.body.body.unshift(call_gas_checker);
        }
        result.splice(index-1,0,call_gas_checker);
        return result;
    },parsed);
    return [editted,identifier];
}*/
const editted = edit(esp.parse(code));
//console.log(pj.render(editted,option))
//edit(esp.parse(code));
try {
    console.log(esc.generate(editted));
}
catch (e) {
    console.log(e);
}
/*(async ()=>{
    let sandbox = {time:0}
    vm.createContext(sandbox);
    vm.runInContext('const date = new Date(); time=date.getTime()',sandbox);
    console.log()
})();*/ 
