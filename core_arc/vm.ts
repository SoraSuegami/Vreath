declare function require(x: string): any;

const VM = require('ethereumjs-vm');

const vm = new VM();
const code = "608060405234801561001057600080fd5b5061019e806100206000396000f300608060405260043610610041576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff168063e762c7c614610046575b600080fd5b34801561005257600080fd5b506100ad600480360381019080803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843782019150505050505091929192905050506100c7565b604051808215151515815260200191505060405180910390f35b600060405180807f48656c6c6f576f726c6400000000000000000000000000000000000000000000815250600a019050604051809103902060001916826040518082805190602001908083835b6020831015156101395780518252602082019150602081019050602083039250610114565b6001836020036101000a0380198251168184511680821785525050505050509050019150506040518091039020600019161490509190505600a165627a7a7230582037a149f14161f61e9e027a1b27c2571915a70ff5b76bb8d35687c3d47f38dacb0029"

vm.runCode({
  code: Buffer.from(code, 'hex'), // code needs to be a Buffer
  data: Buffer.from("HelloWorld",'hex')
  gasLimit: Buffer.from('55555555', 'hex')
}, function(err, results){
  if(err) console.log(err);
  console.log(results.gasUsed)
  console.log('returned: ' + results.return.toString('hex'));
})
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
