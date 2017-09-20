const Telegraf = require('telegraf');
const config = require('./config'); // Holds Telegram API token plus YouTube API token
var request = require('request');
var moment = require('moment');

// var youtube = require('./models/youtube');  // Provides easy access to YouTube API

const bot = new Telegraf(config.telegraf_token);

bot.telegram.getMe().then((bot_informations) => {
    bot.options.username = bot_informations.username;
    console.log("Server has initialized bot nickname. Nick: "+bot_informations.username);
});

bot.command('start', (ctx) => ctx.reply('Benvenuto a unimealbot.\nQuesto bot ti permette di consultare il menù del giorno delle mense universitarie di Trento\n\nElenco comandi disponibili:\n/lesto pasto lesto del giorno\n/menu menù intero del giorno'));

bot.command('/lesto', (ctx) => {
    request('https://unimeal-baa88.firebaseapp.com/menu2.txt', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var m = moment().utcOffset(0);
            m.set({hour:0,minute:0,second:0,millisecond:0})
            var todayString =m.unix().toString() + "000";
            var res = JSON.parse(body);
            var today = res[todayString];
            var message = "Il menu lesto 🐰 di oggi è:\nPrimo: " +  today[0] + "\nSecondo: " + today[1] + "\nContorno: " + today[2];

            return ctx.reply(message);
        }
    });
});

bot.command('/menu', (ctx) => {
    request('https://unimeal-baa88.firebaseapp.com/menu1.txt', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var m = moment().utcOffset(0);
            m.set({hour:0,minute:0,second:0,millisecond:0})
            var todayString =m.unix().toString() + "000";
            var res = JSON.parse(body);
            var today = res[todayString];
            var message = "Nel menu intero oggi puoi scegliere";

            today.forEach(function(element) {
                message += "\n🍲 " +element;
            }, this);

            return ctx.reply(message);
        }
    });
});




bot.startPolling();