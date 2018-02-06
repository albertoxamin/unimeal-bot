var mongoose = require('mongoose');
const _ = require('lodash');
const fs = require('fs');
try { config = require('./config') } catch (err) {
    config = {
        db_connection: process.env.DB_CONNECTION
    }
}

mongoose.connect(config.db_connection, { useMongoClient: true, promiseLibrary: global.Promise });

fs.readdir('./models', function (err, models) {
    if (err) {
        logger.error('ERROR LOADING MODELS: ' + err);
        return;
    }
    _.each(models, function (model) {
        if (model === '.DS_Store')
            return;
        require('./models/' + model);
        console.log('[DEBUG] Model ' + model + ' loaded.');
    });
    console.log("[INFO] Models loaded successfully!");

    require('./bot');
});