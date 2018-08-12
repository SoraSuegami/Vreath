<template>
    <div>
        <div v-if="menu_flag">
            <at-button><router-link to="/setting/account">Account</router-link></at-button><br>
            <at-button><router-link to="/setting/deposit">Deposit</router-link></at-button>
        </div>
        <div v-else>
            <at-button @click="back">Back</at-button>
            <router-view></router-view>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    computed:{
        menu_flag:function():boolean{
            return this.$route.path==="/setting"
        }
    },
    methods:{
        back:function(){
            router.go(-1);
        }
    }
}
</script>