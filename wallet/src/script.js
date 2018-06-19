"use strict";
const { ipcRenderer } = require('electron');
let app = new Vue({
    el: "#app",
    data: {
        password: "phoenix",
        address: "",
        destination: "PHe2f1056b8ce2db356e74d14af106ae",
        amount: 10,
        balance: 0,
        message: "",
        msg_list: []
    },
    computed: {},
    methods: {
        set_address: () => {
            ipcRenderer.on('R_GetAddress', (event, address) => {
                app.address = address;
                ipcRenderer.on('R_GetBalance', (event, balance) => {
                    app.balance = balance;
                    ipcRenderer.on('new_message', (event, msg) => {
                        app.msg_list = msg;
                    });
                });
                ipcRenderer.send('GetBalance', app.address);
            });
            ipcRenderer.send('GetAddress', app.password);
        },
        send: () => {
            ipcRenderer.send('CreateUnit', [app.password, [app.message], app.destination]);
            app.message = "";
        },
        remit: () => {
            ipcRenderer.on('R_CreateRequestTx', (event, arg) => {
            });
            ipcRenderer.send('CreateRequestTx', [app.password, app.amount, app.destination]);
        }
    }
});
