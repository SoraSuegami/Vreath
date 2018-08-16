const path = require('path');

module.exports = {
    mode: 'development',
    entry: './wallet/client/script.js',
    devtool: 'source-map',
    output:{
        filename: 'bundle.js',
        path: path.join(__dirname, 'wallet/client')
    },
    resolve: {
        alias: {
          vue: 'vue/dist/vue.js'
        }
    }
}