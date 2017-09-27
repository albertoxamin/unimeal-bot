const Telegraf = require('telegraf');
const { Telegram } = require('telegraf')
const config = require('./config'); // Holds Telegram API token plus YouTube API token
var request = require('request');
var moment = require('moment');

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
            console.log("served a lesto");
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
    
                console.log("served an intero");
    
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
    
        console.log("served an intero");
    
        return ctx.reply(message).catch((err) => {console.log(err);return null;});
    }
});

bot.on('sticker', (ctx) => {
    // console.log(ctx.chat);
    telegram.sendSticker(ctx.chat.id,'CAADBAADkwUAAqVv9AapiPdrGAeddAI');
    
    return ctx.reply("Non sono programmato per comprendere gli sticker :(");
});

bot.hears('ping', (ctx)=>ctx.reply('pong'));

bot.catch((err) => {
  console.log('Ooops', err);
});


bot.startPolling();