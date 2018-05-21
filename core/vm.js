"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
//const {promisify} = require("util");
const fs = __importStar(require("fs"));
//const readFile = promisify(fs.readFile);
const sexpression = require('sexpression');
function get_opecodes(s_expression) {
    let result = [];
    let i;
    s_expression.forEach((get, i, array) => {
        //console.log("e");
        //console.log(get);
        if (!Array.isArray(get)) {
            //console.log(get);
            result = result.concat(get);
        }
        else {
            result = result.concat(get_opecodes(get));
        }
    });
    //console.log(":"+result);
    return result;
}
function change_param(name, kind, input) {
    const code1 = "(local " + name + " " + kind + ")";
    const code2 = "(set_local " + name + " (" + kind + ".const" + " " + input + "))";
    return get_opecodes(sexpression.parse(code1).concat(sexpression.parse(code2)));
}
function choose_func(result, name) {
    let add_func = [];
    for (let i in result) {
        let val = result[i];
        i = Number(i);
        if (val.name != null && result[i + 1].name != null && val.name == 'func' && result[i + 1].name == '$' + name) {
            let sliced = result.slice(i);
            let next_index = sliced.reduce((num, symbol, i) => {
                if (symbol.name == 'func')
                    num = i;
                return num;
            }, sliced.length);
            let targets = sliced.slice(0, next_index);
            add_func = targets.reduce((result, val, i, array) => {
                if (val.name != null && val.name == 'export' && array[i + 1] == name) {
                    result.splice(i, 2);
                    return result;
                }
                else
                    return result;
            }, targets);
            break;
        }
    }
    return add_func;
}
const wasm = fs.readFile("./adder.wasm", (err, data) => {
    //console.log(data)
});
const opecode = fs.readFile("./adder.wat", (err, data) => {
    const s_expression = sexpression.parse(data.toString());
    //console.log(s_expression[0]);
    const result = get_opecodes(s_expression);
    //WebAssembly.instantiate(data, {}).then(source => console.log(source));
    /*for(let i=0; i<=s_expression.length-1; i++;){
      let get = s_expression[i];
  
    }
    const opecodes = s_expression.reduce((result,get)=>{
      return get_opecodes(result,get);
    },[])*/
    //console.log(result);
    const add_func = choose_func(result, 'add');
    /*const edited = add_func.reduce((result,val,i:number,array)=>{
      if(val.name!=null&&array[i+1]!=null&&val.name=='param'){
        if(array[i+1].match(/^\$/)){
          const name = array[i+1];
  
        }
        else if(array[i+1]=="i32"||"i64"||"f32"||"64"||"anyfunc"){
  
        }
  
      }
    },[add_func,0]);*/
    /*exec('cd ./wabt/bin/wat2wasm ../../adder.wast -o ./wabt/bin/wat2wasm ../../adder.wasm',(err,stdout,stderr)=>{
  
    });*/
    console.log(add_func);
    return result;
    //console.dir(sexpression.parse(data.toString())[1][5][1]);
});
/*
readFile("./adder.wasm").
    then(buf => WebAssembly.instantiate(buf, {})).
    then(source => console.log(source.instance.exports.add(10, 20)));*/
