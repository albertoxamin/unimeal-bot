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

bot.command('start', (ctx) => {
    logAction(ctx, 'Started bot');
    return ctx.reply('Benvenuto a unimealbot.\nQuesto bot ti permette di consultare il menù del giorno delle mense universitarie di Trento\n\nElenco comandi disponibili:\n/lesto pasto lesto del giorno\n/menu menù intero del giorno\n/notifiche\n\nIn caso di problemi con il bot contattate @albertoxamin')
});

var todayString = "";
var todayMenu, todayLesto;

function updateMenu(cb) {
    var m = moment().utcOffset(0);
    m.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
    var todayString = m.unix().toString() + "000";
    
    request({url:'https://unimeal-baa88.firebaseapp.com/menu1.txt',json:true}, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            body = body.trim();
            var res = JSON.parse(body);
            todayMenu = res[todayString];
            request({url:'https://unimeal-baa88.firebaseapp.com/menu2.txt',json:true}, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    body = body.trim();
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
    var message = "Nel menu *intero* oggi puoi scegliere";
    if (todayMenu) {
        todayMenu.forEach(function (element) {
            message += "\n🍲 " + element;
        }, this);
    }
    if (ctx) {
        logAction(ctx, "served an intero");
        return ctx.replyWithMarkdown(message).catch((err) => { console.log(err); return null; });
    } else {
        telegram.sendMessage(chatId, message, Object.assign({ 'parse_mode': 'Markdown' }));
    }
}


function serveLesto(ctx, chatId) {
    var message = "";
    if (todayLesto != undefined && todayLesto.length == 3)
        message = "Il menu *lesto* 🐰 di oggi è:\nPrimo: `" + todayLesto[0] + "`\nSecondo: `" + todayLesto[1] + "`\nContorno: `" + todayLesto[2]+"`";
    else if (todayLesto != undefined && todayLesto.length > 0) {
        message = "Il menu *lesto* 🐰 di oggi è:";
        todayLesto.forEach(function (element) {
            message += "\n🍲 " + element;
        }, this);
    } else {
        message = "Nessun menu lesto oggi, consulta il menu completo con il comando /menu";
    }
    if (ctx) {
        logAction(ctx, "served a lesto");
        return ctx.replyWithMarkdown(message).catch((err) => { console.log(err); return null; });
    } else {
        telegram.sendMessage(chatId, message, Object.assign({ 'parse_mode': 'Markdown' }));
    }
}

bot.on('sticker', (ctx) => {
    if (ctx.message.chat.type != "group") {

        Chat.findOne({ chatId: ctx.chat.id.toString() }, function (err, chat) {
            if (err) {
                console.log(err);
                return;
            }
            if (chat) {
                if (chat.stopSticker != true) {
                    telegram.sendSticker(ctx.chat.id, 'CAADBAADkwUAAqVv9AapiPdrGAeddAI');
                    return ctx.reply("Non sono programmato per comprendere gli sticker :(");
                }
                return;
            } else {
                console.log('ERROR: chat is null on the db');
            }
        });
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
        Chat.findOne({ chatId: ctx.callbackQuery.message.chat.id.toString() }, function (err, chat) {
            if (err) {
                console.log(err);
                return;
            }
            if (chat) {
                if (ctx.callbackQuery.data == 'not_lesto')
                    chat.subLesto = !(chat.subLesto);
                else if (ctx.callbackQuery.data == 'not_menu')
                    chat.subMenu = !(chat.subMenu);
                chat.save(function (err, obj) {
                    if (err) {
                        console.log('Error: ' + err);
                    }
                    //TODO: notificare l'utente delle notifiche che riceve es: a cosa e' iscritto
                    telegram.sendMessage(obj.chatId, 'Impostazioni attuali di notifica:\nLesto:' + (obj.subLesto ? '✅' : '❌') + '\nIntero:' + (obj.subMenu ? '✅' : '❌'), null);
                    return;
                });
                return;
            } else {
                console.log('ERROR: chat is null on the db');
            }
        });
    }
});

bot.command('/notifiche', (ctx) => {
    logAction(ctx, 'Setting notifications ')
    return ctx.replyWithMarkdown('Ti invierò un messaggio ogni giorno, scegli il menù che vuoi ricevere\n(toccando nuovamente il menù non riceverai più le notifiche)', replyOptions);
});

bot.command('/status', (ctx)=>{
    Chat.count({}, (err, c) => {
        return ctx.replyWithMarkdown('Il bot ha attualmente `' + c + '` utenti');    
   });
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

bot.command('/nosticker', (ctx) => {
    Chat.findOne({ chatId: ctx.message.chat.id.toString() }, function (err, chat) {
        if (err) {
            console.log(err);
            return;
        }
        if (chat) {
            chat.stopSticker = true;
            chat.save(function (err, obj) {
                if (err) {
                    console.log('Error: ' + err);
                }
                return;
            });
            return;
        } else {
            console.log('ERROR: chat is null on the db');
        }
    });
});

bot.command('/stop', (ctx) => {
    console.log('stopped by ' + ctx.message.chat.username);
    Chat.findOne({ chatId: ctx.message.chat.id.toString() }, function (err, chat) {
        if (err) {
            console.log(err);
            return;
        }
        if (chat) {
            chat.subLesto = false;
            chat.subMenu = false;
            chat.isBotBlocked = true;
            chat.save(function (err, obj) {
                if (err) {
                    console.log('Error: ' + err);
                }
                return;
            });
            return;
        } else {
            console.log('ERROR: chat is null on the db');
        }
    });
});

function logAction(ctx, actionMessage) {
    if (ctx.message.chat.type == "group")
        console.log(moment().format() + " " + actionMessage + " on " + ctx.chat.id + " aka group " + ctx.chat.title)
    else {
        console.log(moment().format() + " " + actionMessage + " on " + ctx.chat.id + " aka @" + ctx.message.chat.username);
    }
    Chat.findOne({ chatId: ctx.chat.id }, function (err, chat) {
        if (err) {
            console.log(err);
            return;
        }
        if (chat) {
            if (chat.isBotBlocked) {
                chat.isBotBlocked = false;
                chat.save(function (err, obj) {
                    if (err) {
                        console.log('Error: ' + err);
                    }
                    return;
                });
            }
            return;
        } else {
            let newChat = new Chat();
            newChat.chatId = ctx.chat.id
            newChat.subLesto = false;
            newChat.subMenu = false;
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

var lesti = schedule.scheduleJob('0 10 * * *', function () {
    updateMenu(() => {
        if (todayLesto) {
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
        }
    });
});

var interi = schedule.scheduleJob('0 9 * * *', function () {
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