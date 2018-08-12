<template>
    <div>
        <h2>Wallet</h2>
        <at-input placeholder="from" v-model="from"></at-input>
        <at-input placeholder="to" v-model="to"></at-input>
        <at-input placeholder="amount" v-model="amount"></at-input>
        <at-input placeholder="secret" type="password" v-model="secret"></at-input>
        <at-button v-on:click="remit">Remit</at-button>
        <h3>Balance:{{ balance }}</h3>
    </div>
</template>

<script lang="ts">
import {store} from '../script'
import * as T from '../../../core/types'
import {get_balance} from '../index'

export default {
    store:store,
    data:function(){
        return{
            from:this.$store.getters.my_address,
            to:"Vr:native:1181567ccfa945016eccca505107ec3b43f9541e158f87d8c9be0a678593995d",
            amount:"100",
            secret:this.$store.state.secret,
            balance:0
        }
    },
    created:async function(){
        this.balance = await get_balance(this.from)
    },
    methods:{
        /*remit:async function(){
            try{
                const pub_key:string[] = [localStorage.getItem("my_pub")]
                const from:string[] = [this.from];
                const to:string[] = this.to.split(',');
                const amount = this.amount;
                const pre_tx = TxSet.CreateRequestTx(pub_key,JSON.stringify(from),10,"scrap",native,[JSON.stringify(from)],["remit",JSON.stringify(to),"-"+amount],[],my_version,TxSet.empty_tx_pure().meta.pre,TxSet.empty_tx_pure().meta.next,10);
                const tx = TxSet.SignTx(pre_tx,this.secret,this.from);
                if(!await TxSet.ValidRequestTx(tx,my_version,native,unit,StateData,LocationData)) alert("invalid infomations");
                else{
                    alert("remit!")
                    socket.emit('tx', JSON.stringify(tx));
                    pool[tx.hash] = tx;
                }
            }
            catch(e){
                console.log(e);
            }
        }*/
    }
}
</script>