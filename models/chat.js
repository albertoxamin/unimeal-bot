var mongoose = require('mongoose');

var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;

var Chat = new Schema({
    chatId: {type:String,unique:true},
    name: String,
    subLesto : Boolean,
    subMenu : Boolean,
    serviceMessages:[ObjectId],
    isBotBlocked: Boolean,
    stopSticker: Boolean
});

Chat.methods = {

};

mongoose.model('Chat', Chat, 'chats');