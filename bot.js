var Telegraf = require('telegraf');
var { Telegram, Markup, Router } = require('telegraf')
var config;
try { config = require('./config') } catch (err) {
    config = {
        telegraf_token: process.env.TOKEN,
        holiday: process.env.HOLIDAY
    }
}
var request = require('request');
var moment = require('moment');
var mongoose = require('mongoose');
var Chat = mongoose.model('Chat');
var schedule = require('node-schedule');
var bot = new Telegraf(config.telegraf_token);
var telegram = new Telegram(config.telegraf_token, null)
const crypto = require('crypto');
var firebase = require("firebase");
var username;

var menus = undefined;

bot.telegram.getMe().then((bot_informations) => {
    bot.options.username = bot_informations.username;
    console.log("Server has initialized bot nickname. Nick: " + bot_informations.username);
    username = '@' + bot_informations.username;
    firebase.initializeApp(config.firebaseConfig);
    database = firebase.database().ref().child('menus');
    database.on('value', snap => {
        menus = snap.val();
    })
});

bot.command(['start', 'help'], (ctx) => {
    logAction(ctx, 'Started bot');
    return ctx.reply('Benvenuto a unimealbot.\nQuesto bot ti permette di consultare il menù del giorno delle mense universitarie di Trento\n\nElenco comandi disponibili:\n/lesto pasto lesto del giorno\n/menu menù intero del giorno\n/notifiche\n\nIn caso di problemi con il bot contattate @albertoxamin\n\nContribuisci allo sviluppo su https://github.com/albertoxamin/unimeal-bot\n\nOppure puoi offrirmi un caffè http://buymeacoff.ee/Xamin')
});

bot.command(['lesto', 'menu'], (ctx) => {
    if (config.holiday)
        return ctx.reply('Il bot tornerà operativo al riprendere delle lezioni 🔜');
    serveMenu(ctx, null, ctx.message.text.replace('/', '').replace(username, ''));
});

const buildMessage = function (kind) {
    let today = menus[new Buffer(moment().format('YYYY-MM-DD')).toString('base64')];
    if (today == undefined)
        return "Nessun menu disponibile per oggi.";
    let message = "";
    let selected = (kind == 'lesto') ? today.lesto : today.completo;
    if (kind == 'lesto' && selected != undefined)
        return "Il menu *lesto* 🐰 di oggi è:\nPrimo: 🍝 `" + selected.primo[0] + "`\nSecondo: 🥩 `" + selected.secondo[0] + "`\nContorno: 🥦 `" + selected.contorno[0] + "`";
    else if (kind == 'menu' || kind == 'intero' && selected != undefined) {
        message = "Il menu *completo* di oggi è:\n";
        selected.primo.forEach(function (element) {
            message += "\n🍝 `" + element + "`";
        }, this);
        message += '\n';
        selected.secondo.forEach(function (element) {
            message += "\n🥩 `" + element + "`";
        }, this);
        message += '\n';
        selected.contorno.forEach(function (element) {
            message += "\n🥦 `" + element + "`";
        }, this);
    } else if (kind == 'lesto') {
        return "Nessun menu lesto oggi, consulta il menu completo con il comando /menu";
    } else {
        return "Nessun menu disponibile per oggi.";
    }
    return message;
}

function serveMenu(ctx, chatId, kind) {
    let message = buildMessage(kind);
    if (ctx) {
        logAction(ctx, "served a " + kind);
        return ctx.replyWithMarkdown(message).catch((err) => { console.log(err); return null; });
    } else {
        telegram.sendMessage(chatId, message, Object.assign({ 'parse_mode': 'Markdown' }));
    }
}

bot.on('inline_query', async ({ inlineQuery, answerInlineQuery }) => {
    let lesto = buildMessage('lesto');
    let menu = buildMessage('menu');
    let result = [{
        type: 'article',
        id: crypto.createHash('md5').update(lesto).digest('hex'),
        title: "Lesto",
        description: lesto,
        input_message_content: {
            message_text: lesto,
            parse_mode: 'Markdown'
        }
    }, {
        type: 'article',
        id: crypto.createHash('md5').update(menu).digest('hex'),
        title: "Menu intero",
        description: menu,
        input_message_content: {
            message_text: menu,
            parse_mode: 'Markdown'
        }
    }];
    return answerInlineQuery(result)
}
);

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
    logAction(ctx, 'Setting notifications ');

    Chat.findOne({ chatId: ctx.message.chat.id.toString() }, function (err, chat) {
        if (err) {
            console.log(err);
            return;
        }
        if (chat) {
            let replyOptions = Markup.inlineKeyboard([
                Markup.callbackButton(`Lesto ${(chat.subLesto ? '✅' : '❌')}`, 'not_lesto'),
                Markup.callbackButton(`Intero ${(chat.subMenu ? '✅' : '❌')}`, 'not_menu')
            ]).extra()
            return ctx.replyWithMarkdown('Ti invierò un messaggio ogni giorno, scegli il menù che vuoi ricevere\n(toccando nuovamente il menù non riceverai più le notifiche)', replyOptions);
        } else {
            console.log('ERROR: chat is null on the db');
        }
    });
});

bot.command('/status', (ctx) => {
    // if (mongoose.connection.readyState)
    //     return ctx.reply('☣️ Impossibile connetersi al db ☣️');
    Chat.count({}, (err, c) => {
        return ctx.replyWithMarkdown('Il bot ha attualmente `' + c + '` utenti\nPeriodo di vacanza: *' + (config.holiday || 'non attivo') + "*");
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

var notifiche = schedule.scheduleJob('30 9 * * *', function () {
    if (config.holiday)
        return;
    updateMenu(() => {
        Chat.find({ $or: [{ subMenu: true }, { subLesto: true }] }, (err, chats) => {
            if (err) {
                console.log(err);
                return;
            }
            if (chats) {
                chats.forEach((chat) => {
                    if (chat.subLesto)
                        serveMenu(null, chat.chatId, 'lesto');
                    if (chat.subMenu)
                        serveMenu(null, chat.chatId, 'intero');
                })
                return;
            }
        });
    });
});

bot.startPolling();