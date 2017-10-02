var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var Chat = new Schema({
    chatId: String,
    name: String,
    subLesto : Boolean,
    subMenu : Boolean,
    serviceMessages:[ObjectId]
});

Chat.methods = {

};

mongoose.model('Chat', Chat);