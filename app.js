var mongoose = require('mongoose');
var _ = require('lodash');
var fs = require('fs');

mongoose.connect('mongodb://51.15.199.193/unimealbot', { useMongoClient: true, promiseLibrary: global.Promise });

fs.readdir('./models', function(err, models) {
    if (err) {
        logger.error('ERROR LOADING MODELS: ' + err);
        return;
    }
    _.each(models, function(model)  {
        if (model === '.DS_Store')
            return;
        require('./models/' + model);
        console.log('[DEBUG] Model ' + model + ' loaded.');
    });
    console.log("[INFO] Models loaded successfully!");
});

require('./bot');