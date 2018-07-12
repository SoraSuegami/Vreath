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

export type RequestData = {
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
  address:string[];
  pub_key:string[];
  nonce:number;
  feeprice:number;
  timestamp:number;
  request:string;
  index:number;
  payee:string;
  output:string[];
  log_hash:string[];
}

export type RefreshTx = {
  hash:string;
  meta:RefreshMeta;
  raw:TxRaw;
}

export type TxPure = RequestMeta | RefreshMeta;
export type Tx = RequestTx | RefreshTx;

export type LocationInfo = {
  state:'yet' | 'already';
  index:number;
  hash:string;
}

export type Location = {
  req:LocationInfo;
  ref:LocationInfo;
}

export type Candidates = {
  address: string;
  amount: number;
}

export type FraudInfo = {
  index: number;
  hash: string;
  step: string;
}

export type BlockMeta = {
  hash: string;
  validatorSign: string;
}

export type BlockContents = {
  index:number;
  parenthash:string;
  timestamp: number;
  stateroot: string;
  locationroot: string;
  tx_root: string;
  fee_sum:number;
  pow_target:number;
  stake_diff:number;
  validator: string;
  validatorPub: string;
  candidates: string;
  fraud:FraudInfo;
}

export type Block = {
  meta:BlockMeta;
  contents:BlockContents;
  txs: TxPure[];
  raws: TxRaw[];
}

export type Pool = {
  [key:string]:Tx;
}
