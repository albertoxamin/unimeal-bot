const Telegraf = require('telegraf');
const { Telegram, Markup, Router } = require('telegraf')
const config = require('./config');
var request = require('request');
var moment = require('moment');
var mongoose = require('mongoose');
var Chat = mongoose.model('Chat');
var schedule = require('node-schedule');

const bot = new Telegraf(config.telegraf_token);

var telegram = new Telegram(config.telegraf_token, null)

bot.telegram.getMe().then((bot_informations) => {
    bot.options.username = bot_informations.username;
    console.log("Server has initialized bot nickname. Nick: " + bot_informations.username);
});

bot.command('start', (ctx) => ctx.reply('Benvenuto a unimealbot.\nQuesto bot ti permette di consultare il menù del giorno delle mense universitarie di Trento\n\nElenco comandi disponibili:\n/lesto pasto lesto del giorno\n/menu menù intero del giorno'));

var todayString = "";
var todayMenu, todayLesto;

function updateMenu(cb) {
    var m = moment().utcOffset(0);
    m.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
    var todayString = m.unix().toString() + "000";
    request('https://unimeal-baa88.firebaseapp.com/menu1.txt', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var res = JSON.parse(body);
            todayMenu = res[todayString];
            request('https://unimeal-baa88.firebaseapp.com/menu2.txt', function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    res = JSON.parse(body);
                    todayLesto = res[todayString];
                    cb();
                }
            });
        }
    });
}

bot.command('/lesto', (ctx) => {
    var m = moment().utcOffset(0);
    m.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
    var todayUnix = m.unix().toString() + "000";

    if (todayUnix != todayString || todayMenu == undefined) {
        todayString = todayUnix;
        updateMenu(() => {
            serveLesto(ctx);
        });
    } else {
        serveLesto(ctx);
    }
});

bot.command('/menu', (ctx) => {
    var m = moment().utcOffset(0);
    m.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
    var todayUnix = m.unix().toString() + "000";

    if (todayUnix != todayString || todayMenu == undefined) {
        todayString = todayUnix;
        updateMenu(() => {
            serveIntero(ctx);
        });
    } else {
        serveIntero(ctx);
    }
});

function serveIntero(ctx, chatId) {
    var message = "Nel menu intero oggi puoi scegliere";
    if (todayMenu) {
        todayMenu.forEach(function (element) {
            message += "\n🍲 " + element;
        }, this);
    }
    if (ctx) {
        logAction(ctx, "served an intero");
        return ctx.reply(message).catch((err) => { console.log(err); return null; });
    } else {
        telegram.sendMessage(chatId, message, null);
    }
}

function serveLesto(ctx, chatId) {
    var message = "";
    if (todayLesto != undefined && todayLesto.length == 3)
        message = "Il menu lesto 🐰 di oggi è:\nPrimo: " + todayLesto[0] + "\nSecondo: " + todayLesto[1] + "\nContorno: " + todayLesto[2];
    else if (todayLesto != undefined && todayLesto.length > 0) {
        message = "Il menu lesto 🐰 di oggi è:";
        todayLesto.forEach(function (element) {
            message += "\n🍲 " + element;
        }, this);
    } else {
        message = "Nessun menu lesto oggi, consulta il menu completo con il comando /menu";
    }
    if (ctx) {
        logAction(ctx, "served a lesto");
        return ctx.reply(message).catch((err) => { console.log(err); return null; });
    } else {
        telegram.sendMessage(chatId, message, null);
    }
}

bot.on('sticker', (ctx) => {
    if (ctx.message.chat.type != "group") {
        telegram.sendSticker(ctx.chat.id, 'CAADBAADkwUAAqVv9AapiPdrGAeddAI');
        return ctx.reply("Non sono programmato per comprendere gli sticker :(");
    }
    return;
});

bot.hears('ping', (ctx) => ctx.reply('pong'));

const replyOptions = Markup.inlineKeyboard([
    Markup.callbackButton('Lesto', 'not_lesto'),
    Markup.callbackButton('Intero', 'not_menu')
]).extra()

bot.on('callback_query', (ctx) => {
    console.log(ctx.callbackQuery);
    if (ctx.callbackQuery.data.indexOf('not_') != -1) {
        Chat.findOne({ chatId: ctx.callbackQuery.from.id.toString() }, function (err, chat) {
            if (err) {
                console.log(err);
                return;
            }
            if (chat) {
                if (ctx.callbackQuery.data == 'not_lesto')
                    chat.subLesto = !chat.subLesto || true;
                else if (ctx.callbackQuery.data == 'not_menu')
                    chat.subMenu = !chat.subMenu || true;
                chat.save(function (err, obj) {
                    if (err) {
                        console.log('Error: ' + err);
                    }
                    telegram.sendMessage(ctx.callbackQuery.from.id, 'Adesso riceverai le notifiche ogni giorno!', null);
                    return;
                });
                return;
            }
        });
    }
});

bot.command('/notifiche', (ctx) => {
    logAction(ctx, 'Setting notifications ')
    return ctx.reply('Ti invierò un messaggio ogni giorno, scegli il menù che vuoi ricevere', replyOptions);
});

bot.command('/say', (ctx) => {
    if (ctx.message.chat.username == 'albertoxamin') {
        var msg = ctx.message.text.toString();

        Chat.find({}, function (err, chat) {
            if (err) {
                console.log(err);
                return;
            }
            if (chat) {
                chat.forEach((element) => {
                    telegram.sendMessage(element.chatId, msg.replace('/say', ''), null);
                }, this);
            } else {
                return ctx.reply("errore");
            }
        });
    }
});

function logAction(ctx, actionMessage) {
    if (ctx.message.chat.type == "group")
        console.log(moment().format() + " " + actionMessage + " on group " + ctx.chat.title)
    else {
        console.log(moment().format() + " " + actionMessage + " on " + ctx.chat.id + " aka @" + ctx.message.chat.username);
    }
    Chat.findOne({ chatId: ctx.chat.id }, function (err, chat) {
        if (err) {
            console.log(err);
            return;
        }
        if (chat) {
            return;
        } else {
            let newChat = new Chat();
            newChat.chatId = ctx.chat.id
            newChat.save(function (err, obj) {
                if (err)
                    console.log(err);
                return;
            });
        }
    });
}

bot.catch((err) => {
    console.log('Ooops', err);
});

var lesti = schedule.scheduleJob('10 * * *', function () {
    updateMenu(() => {
        Chat.find({ subLesto: true }, (err, chats) => {
            if (err) {
                console.log(err);
                return;
            }
            if (chats) {
                chats.forEach((chat) => {
                    serveLesto(null, chat.chatId);
                })
                return;
            }
        });
    });
});

var interi = schedule.scheduleJob('9 * * *', function () {
    updateMenu(() => {
        Chat.find({ subMenu: true }, (err, chats) => {
            if (err) {
                console.log(err);
                return;
            }
            if (chats) {
                chats.forEach((chat) => {
                    serveIntero(null, chat.chatId);
                })
                return;
            }
        });
    });
});

bot.startPolling();