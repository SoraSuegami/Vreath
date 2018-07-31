export type StateContent = {
  nonce:number;
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
  nonce:number;
  token: string;
  issued: number;
  deposited:number;
  committed: string[];
  code:string;
  developer: string[];
};


export type TxKind = 'request' | 'refresh';
export type TxTypes = 'issue' | 'change' | 'scrap' | 'create' | 'update';

export type TxRaw = {
  signature:string[];
  raw:string[];
  log:string[];
}

export type Relation = {
  flag:boolean,
  hash:string
}

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
  unit_price:number;
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
  address: string[];
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
  natives:TxPure[];
  units:TxPure[];
}

export type Block = {
  hash:string,
  validatorSign: string[];
  meta:BlockMeta;
  txs:TxPure[];
  natives:TxPure[];
  units:TxPure[];
  raws:TxRaw[];
  fraudData:FraudData;
}

export type Pool = {
  [key:string]:Tx;
}
