export type StateContent = {
  owner: string;
  token: string;
  tag: {[key:string]: any;};
  data: string;
  product: string;
};

export type State = {
  hash: string;
  amount: number;
  contents: StateContent;
};

export type Token = {
  token: string;
  issued: number;
  codehash:string;
  developer: string;
};


export type TxKind = 'request' | 'refresh';
export type TxTypes = 'issue' | 'change' | 'scrap' | 'create';

export type TxMeta = {
  hash:string;
  signature:string;
}

export type TxContents = {
  address:string;
  pub_key:string;
  timestamp:number;
  type:TxTypes;
  token:string;
  input:string[];
  output:State[];
  new_token:Token[];
  pre:string;
}

export type TxData = {
  purehash:string;
  contents:TxContents;
}

export type RequestData = {
  address:string;
  pub_key:string;
  timestamp:number;
  fee:number;
  solvency:string;
  type:TxTypes;
  token:string;
  base:string[];
  input_hash:string;
  output:State[];
  new_token:Token[];
}

export type RequestContents = {
  purehash:string;
  pre:string;
  next:string;
  data:RequestData;
}

export type RequestTx = {
  kind:"request";
  meta:TxMeta;
  contents:RequestContents;
  input_raw:any[];
  code:string[];
}

export type RefreshContents = {
  address:string;
  pub_key:string;
  timestamp:number;
  request:string;
  index:number;
  payee:string;
}

export type RefreshTx = {
  kind:"refresh";
  meta:TxMeta;
  contents:RefreshContents;
  evidence:string;
}

export type Tx = RequestTx | RefreshTx;

export type DataHash = {
  selfhash: string;
  ipfshash: string;
}

export type Input = {
  token_id: string[];
  options: any[];
}

export type Output = {
  tx: string[];
  app_rate: number;
  log: any;
}

export type Codetype = 'issue_code' | 'change_code' | 'scrap_code' | 'create_code';

export type RawData = {
  input: string[];
  output: string[];
}

export type UnitMeta = {
  nonce: string;
  hash: string;
  signature: string;
}

export type UnitContents = {
  data:RefreshContents;
  parenthash: string;
  difficulty:number;
  log_hash:string;
}

export type Unit = {
  meta: UnitMeta;
  contents: UnitContents;
  log_raw:any[];
}

export type ReleationInfo = {
  state:'yet' | 'already';
  index:number;
  hash:string;
}

export type RequestsAlias = {
  req:ReleationInfo;
  ref:ReleationInfo;
}

export type Candidates = {
  address: string;
  amount: number;
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
  request_root: string;
  //addressroot: string;
  //used_dagroot: string;
  //used_txroot: string;
  //evidences: string[];
  tx_root: string;
  fee:number;
  difficulty:number;
  validator: string;
  validatorPub: string;
  candidates: Candidates[];
}

export type Block = {
  meta:BlockMeta;
  contents:BlockContents;
  transactions: Tx[];
}

export type Pool = {
  [key:string]:Tx;
}
