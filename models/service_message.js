var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var ServiceMessage = new Schema({
    text : String,
    expiration : Date
});

ServiceMessage.methods = {

};

mongoose.model('ServiceMessage', ServiceMessage);