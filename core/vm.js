"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VM = require('ethereumjs-vm');
const vm = new VM();
const code = '7f4e616d65526567000000000000000000000000000000000000000000000000003055307f4e616d6552656700000000000000000000000000000000000000000000000000557f436f6e666967000000000000000000000000000000000000000000000000000073661005d2720d855f1d9976f88bb10c1a3398c77f5573661005d2720d855f1d9976f88bb10c1a3398c77f7f436f6e6669670000000000000000000000000000000000000000000000000000553360455560df806100c56000396000f3007f726567697374657200000000000000000000000000000000000000000000000060003514156053576020355415603257005b335415603e5760003354555b6020353360006000a233602035556020353355005b60007f756e72656769737465720000000000000000000000000000000000000000000060003514156082575033545b1560995733335460006000a2600033545560003355005b60007f6b696c6c00000000000000000000000000000000000000000000000000000000600035141560cb575060455433145b1560d25733ff5b6000355460005260206000f3';
vm.runCode({
    code: Buffer.from(code, 'hex'),
    gasLimit: Buffer.from('55555555', 'hex')
}, function (err, results) {
    if (err)
        console.log(err);
    console.log('returned: ' + results.return.toString('hex'));
});
//const {promisify} = require("util");
/*import * as fs from 'fs'
import * as exec from 'exec'
//const readFile = promisify(fs.readFile);
const sexpression = require('sexpression');

function get_opecodes(s_expression){
  let result = [];
  let i:number;
  s_expression.forEach((get,i:number,array)=>{
    //console.log("e");
    //console.log(get);
    if(!Array.isArray(get)){
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

function change_param(name:string,kind:string,input){
  const code1 = "(local "+name+" "+kind+")";
  const code2 = "(set_local "+name+" ("+kind+".const"+" "+input+"))";
  return get_opecodes(sexpression.parse(code1).concat(sexpression.parse(code2)));
}

function choose_func(result,name:string){
  let add_func = [];
  for(let i in result){
    let val = result[i];
    i = Number(i);
    if(val.name!=null&&result[i+1].name!=null&&val.name=='func'&&result[i+1].name=='$'+name){
      let sliced = result.slice(i);
      let next_index = sliced.reduce((num:number,symbol,i:number):number=>{
        if(symbol.name=='func') num = i;
        return num;
      },sliced.length);
      let targets = sliced.slice(0,next_index);
      add_func = targets.reduce((result,val,i:number,array)=>{
        if(val.name!=null&&val.name=='export'&&array[i+1]==name){
          result.splice(i,2);
          return result;
        }
        else return result;
      },targets);
      break;
    }
  }
  return add_func;
}

const wasm = fs.readFile("./adder.wasm",(err,data)=>{
  //console.log(data)
});

const opecode = fs.readFile("./adder.wat",(err,data)=>{
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
//const add_func = choose_func(result,'add');
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
/*console.log(add_func);
return result;
//console.dir(sexpression.parse(data.toString())[1][5][1]);
});*/
/*
readFile("./adder.wasm").
    then(buf => WebAssembly.instantiate(buf, {})).
    then(source => console.log(source.instance.exports.add(10, 20)));*/
