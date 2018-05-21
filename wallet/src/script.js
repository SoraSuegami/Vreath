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
        msg_list: ["Messages"]
    },
    computed: {},
    methods: {
        set_address: () => {
            ipcRenderer.on('R_GetAddress', (event, arg) => {
                app.address = arg;
                ipcRenderer.on('R_GetBalance', (event, arg) => {
                    app.balance = arg;
                });
                ipcRenderer.send('GetBalance', app.address);
            });
            ipcRenderer.send('GetAddress', app.password);
        },
        send: () => {
            app.msg_list.push(app.message);
            app.message = "";
            ipcRenderer.on('R_CreateUnit', (event, arg) => {
                console.dir(arg);
                app.address = arg;
            });
            ipcRenderer.send('CreateUnit', [app.password, [app.message]]);
        },
        remit: () => {
            ipcRenderer.on('R_CreateRequestTx', (event, arg) => {
                console.dir(arg);
            });
            ipcRenderer.send('CreateRequestTx', [app.password, app.amount, app.destination]);
        }
    }
});
