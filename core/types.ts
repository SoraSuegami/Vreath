export type StateContent = {
  owner: string[];
  token: string;
  amount: number;
  data: {[key:string]: string;};
  product: string[];
};

export type State = {
  hash: string;
  contents: StateContent;
};

export type Token = {
  token: string;
  issued: number;
  committed: string[];
  developer: string[];
};


export type TxKind = 'request' | 'refresh';
export type TxTypes = 'issue' | 'change' | 'scrap' | 'create';

export type TxRaw = {
  signature:string[];
  raw:string[];
  log:string[];
}

export type Relation = {
  flag:boolean,
  hash:string
}

/*export type RequestData = {
  address:string[];
  pub_key:string[];
  timestamp:number;
  gas:number;
  solvency:string;
  type:TxTypes;
  token:string;
  base:string[];
  commit:string[];
  input:string[];
  log_hash:string[];
}

export type RequestMeta = {
  kind:"request";
  version:number;
  purehash:string;
  pre:Relation;
  next:Relation;
  feeprice:number;
  data:RequestData;
}

export type RequestTx = {
  hash:string;
  meta:RequestMeta;
  raw:TxRaw;
}

export type RefreshMeta = {
  kind:"refresh";
  version:number;
  address:string[];
  pub_key:string[];
  nonce:number;
  feeprice:number;
  timestamp:number;
  request:string;
  index:number;
  payee:string;
  output:string[];
  trace:string[];
  log_hash:string[];
}

export type RefreshTx = {
  hash:string;
  meta:RefreshMeta;
  raw:TxRaw;
}

export type TxPure = {
  hash:string;
  meta:RequestMeta | RefreshMeta;
}*/

//export type Tx = RequestTx | RefreshTx;
export type TxData = {
  address:string[];
  pub_key:string[];
  timestamp:number;
  log_hash:string[];
  gas:number;
  solvency:string;
  type:TxTypes;
  token:string;
  base:string[];
  commit:string[];
  input:string[];
  request:string;
  index:number;
  payee:string;
  output:string[];
  trace:string[];
}

export type TxMeta = {
  kind:TxKind,
  version:number;
  purehash:string;
  nonce:number;
  pre:Relation;
  next:Relation;
  feeprice:number;
  data:TxData;
}

export type TxPure = {
  hash:string;
  meta:TxMeta;
}

export type Tx = {
  hash:string;
  meta:TxMeta;
  raw:TxRaw;
}

export type Location = {
  state:'yet' | 'already';
  index:number;
  hash:string;
}

export type Candidates = {
  address: string;
  amount: number;
}

export type FraudInfo = {
  flag:boolean;
  index: number;
  hash: string;
  step: number;
  data: string;
}

export type FraudData = {
  states:State[],
  inputs:any[]
}

export type BlockKind = "key" | "micro"

export type BlockMeta = {
  version:number;
  shard_id:number;
  kind:BlockKind;
  index:number;
  parenthash:string;
  timestamp: number;
  fraud:FraudInfo;
  pow_target:number;
  pos_diff:number;
  validator: string;
  token:string;
  validatorPub: string[];
  candidates: string;
  stateroot: string;
  locationroot: string;
  tx_root: string;
  fee_sum:number;
}

export type BlockPure = {
  hash:string,
  validatorSign: string[];
  meta:BlockMeta;
}

export type Block = {
  hash:string,
  validatorSign: string[];
  meta:BlockMeta;
  txs:TxPure[];
  raws:TxRaw[];
  fraudData:FraudData;
}

export type Pool = {
  [key:string]:Tx;
}
