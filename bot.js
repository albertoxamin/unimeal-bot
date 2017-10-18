const Telegraf = require('telegraf');
const { Telegram } = require('telegraf')
const config = require('./config');
var request = require('request');
var moment = require('moment');
var mongoose = require('mongoose');
var Chat = mongoose.model('Chat');

const bot = new Telegraf(config.telegraf_token);

var telegram = new Telegram(config.telegraf_token, null)



bot.telegram.getMe().then((bot_informations) => {
    bot.options.username = bot_informations.username;
    console.log("Server has initialized bot nickname. Nick: "+bot_informations.username);
});

bot.command('start', (ctx) => ctx.reply('Benvenuto a unimealbot.\nQuesto bot ti permette di consultare il menù del giorno delle mense universitarie di Trento\n\nElenco comandi disponibili:\n/lesto pasto lesto del giorno\n/menu menù intero del giorno'));

var todayString ="";
var todayMenu;

bot.command('/lesto', (ctx) => {
    request('https://unimeal-baa88.firebaseapp.com/menu2.txt', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var m = moment().utcOffset(0);
            m.set({hour:0,minute:0,second:0,millisecond:0})
            var todayString =m.unix().toString() + "000";
            var res = JSON.parse(body);
            var today = res[todayString];
            var message ="";
            if (today != undefined && today.length == 3)
                message = "Il menu lesto 🐰 di oggi è:\nPrimo: " +  today[0] + "\nSecondo: " + today[1] + "\nContorno: " + today[2];
            else if (today != undefined && today.length > 0)
            {
                message = "Il menu lesto 🐰 di oggi è:";
                today.forEach(function(element) {
                    message += "\n🍲 " +element;
                }, this);
            }else{
                message = "Nessun menu lesto oggi, consulta il menu completo con il comando /menu";
            }
            logAction(ctx,"served a lesto");
            return ctx.reply(message).catch((err) => {console.log(err);return null;});
        }
    });
});

bot.command('/menu', (ctx) => {
    var m = moment().utcOffset(0);
    m.set({hour:0,minute:0,second:0,millisecond:0})
    var todayUnix =m.unix().toString() + "000";
    
    if (todayUnix != todayString || todayMenu == undefined){
        todayString = todayUnix;
        request('https://unimeal-baa88.firebaseapp.com/menu1.txt', function (error, response, body) {
            if (!error && response.statusCode == 200) {
                
                var res = JSON.parse(body);
                var today = res[todayString];
                todayMenu = today;
                var message = "Nel menu intero oggi puoi scegliere";
    
                today.forEach(function(element) {
                    message += "\n🍲 " +element;
                }, this);
    
                logAction(ctx,"served an intero");
    
                return ctx.reply(message).catch((err) => {console.log(err);return null;});
            }
        });
    }else{
        var message = "Nel menu intero oggi puoi scegliere";
        if (todayMenu){
        todayMenu.forEach(function(element) {
            message += "\n🍲 " +element;
        }, this);
        }
    
        logAction(ctx,"served an intero");
    
        return ctx.reply(message).catch((err) => {console.log(err);return null;});
    }
});

bot.on('sticker', (ctx) => {
    // console.log(ctx.chat);
    telegram.sendSticker(ctx.chat.id,'CAADBAADkwUAAqVv9AapiPdrGAeddAI');
    
    return ctx.reply("Non sono programmato per comprendere gli sticker :(");
});

bot.hears('ping', (ctx)=>ctx.reply('pong'));

bot.command('/euthanize', (ctx)=>{
    return ctx.reply("Sei proprio sicuro di voler disattivare l'AI in questo server?");
});

var echoChatID;
var masterID;

bot.hears('deeznuts', (ctx)=>{
    echoChatID = ctx.chat.id;
    return ctx.reply('ha got him!');
});

bot.hears('I am your master', (ctx)=>{
    if (masterID == undefined)
        masterID = ctx.chat.id;
    return ctx.reply('I hail you');
});

bot.command('/say', (ctx)=>{
    if (ctx.chat.id == masterID){
        var msg = ctx.message.text.toString();
        telegram.sendMessage(echoChatID, msg.replace('/say', ''), null);
    }
});

bot.on('text',(ctx) => {
    Chat.find({chatID:ctx.chat.id}, function (err, chat){
        if (err){
            console.log(err);
            return;
        }
        if (chat){
            return;
        }else{
            let newChat = new Chat();
            newChat.chatId = ctx.chat.id
            newChat.save(function (err, obj){
                if (err)
                    console.log(err);
                return;
            });
        }
    });
});

function logAction(ctx, actionMessage){
    if (ctx.message.chat.type == "group")
        console.log(moment().format() +  " " + actionMessage + " on group " + ctx.chat.title)
    else
        console.log(moment().format() +  " " + actionMessage + " on " + ctx.chat.id + " aka @" + ctx.message.chat.username);
}

bot.catch((err) => {
  console.log('Ooops', err);
});


bot.startPolling();