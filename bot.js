const Telegraf = require('telegraf')
const { Telegram, Markup, Router } = require('telegraf')
var config
try { config = require('./config') } catch (err) {
	config = {
		telegraf_token: process.env.TOKEN
	}
}
const fs = require('fs')
const request = require('request')
const moment = require('moment')
const mongoose = require('mongoose')
const schedule = require('node-schedule')
const bot = new Telegraf(config.telegraf_token)
const telegram = new Telegram(config.telegraf_token, null)
const crypto = require('crypto')
const firebase = require('firebase')

var Chat = mongoose.model('Chat')

var username
var menus = undefined

const isAdmin = (ctx) => ctx.message.chat.username === 'albertoxamin'

const KEYBOARD_NOTIFICATIONS = (chat) => Markup.inlineKeyboard([
	Markup.callbackButton(`Lesto ${(chat.subLesto ? '✅' : '❌')}`, 'not_lesto'),
	Markup.callbackButton(`Intero ${(chat.subMenu ? '✅' : '❌')}`, 'not_menu')
]).extra()

bot.telegram.getMe().then((bot_informations) => {
	bot.options.username = bot_informations.username
	console.log('Server has initialized bot nickname. Nick: ' + bot_informations.username)
	username = '@' + bot_informations.username
	firebase.initializeApp(config.firebaseConfig)
	database = firebase.database().ref().child('menus')
	database.on('value', snap => {
		menus = snap.val()
	})
})

bot.command(['start', 'help'], (ctx) => {
	logAction(ctx, 'Started bot')
	ctx.reply(
		'Benvenuto a unimealbot.\nQuesto bot ti permette di consultare il menù del giorno delle mense universitarie di Trento\n\n' +
		'Elenco comandi disponibili:\n/lesto pasto lesto del giorno\n/menu menù intero del giorno\n/notifiche\n\n' +
		'In caso di problemi con il bot contattate @albertoxamin\nBot per gli orari delle biblioteche @bibliotrentobot' +
		'\n\nContribuisci allo sviluppo su https://github.com/albertoxamin/unimeal-bot' +
		'\n\nOppure puoi offrirmi un caffè http://buymeacoff.ee/Xamin')
	ctx.replyWithChatAction('upload_document')
	fs.readFile('./tipi_menu.pdf', (err, data) => {
		ctx.replyWithDocument({ source: data, filename: 'Tipologie menù.pdf' })
	})
})

bot.command(['lesto', 'menu'], (ctx) => {
	ctx.replyWithChatAction('typing')
	if (config.holiday)
		return ctx.reply('Il bot tornerà operativo al riprendere delle lezioni 🔜')
	serveMenu(ctx, null, ctx.message.text.replace('/', '').replace(username, ''))
})

const buildMessage = function (kind) {
	let today = menus[new Buffer(moment().format('YYYY-MM-DD')).toString('base64')]
	if (today == undefined)
		return 'Nessun menu disponibile per oggi.'
	let message = ''
	let selected = (kind == 'lesto') ? today.lesto : today.completo
	if (kind == 'lesto' && selected != undefined && selected.primo[0] != '')
		return `Il menu *lesto* 🐰 di oggi è:\nPrimo: 🍝 \`${selected.primo[0]}\`\nSecondo: 🥩 \`${selected.secondo[0]}\`\nContorno: 🥦 \`${selected.contorno[0]}\``
	else if ((kind == 'menu' || kind == 'intero') && selected != undefined && selected.primo[0] != '') {
		let flatten = (arr, emoji) => {
			let message = ''
			arr.forEach((dish) => {
				if (element != '')
					message += `\n${emoji} \`${dish}\``
			})
			return message
		}
		message = `Il menu *completo* di oggi è:\n${flatten(selected.primo, '🍝')}\n${flatten(selected.secondo, '🥩')}\n${flatten(selected.contorno, '🥦')}`
	} else if (kind == 'lesto') {
		return 'Nessun menu lesto oggi, consulta il menu completo con il comando /menu'
	} else {
		return 'Nessun menu disponibile per oggi.'
	}
	return message
}

function serveMenu(ctx, chatId, kind) {
	let message = buildMessage(kind)
	if (ctx) {
		logAction(ctx, 'served a ' + kind)
		return ctx.replyWithMarkdown(message).catch((err) => { console.log(err); return null })
	} else {
		telegram.sendMessage(chatId, message, Object.assign({ 'parse_mode': 'Markdown' }))
	}
}

bot.on('inline_query', async ({ inlineQuery, answerInlineQuery }) => {
	let lesto = buildMessage('lesto')
	let menu = buildMessage('menu')
	let result = [{
		type: 'article',
		id: crypto.createHash('md5').update(lesto).digest('hex'),
		title: 'Lesto',
		description: lesto,
		input_message_content: {
			message_text: lesto,
			parse_mode: 'Markdown'
		}
	}, {
		type: 'article',
		id: crypto.createHash('md5').update(menu).digest('hex'),
		title: 'Menu intero',
		description: menu,
		input_message_content: {
			message_text: menu,
			parse_mode: 'Markdown'
		}
	}]
	return answerInlineQuery(result)
})

bot.on('callback_query', (ctx) => {
	console.log(ctx.callbackQuery)
	if (ctx.callbackQuery.data.indexOf('not_') != -1) {
		Chat.findOne({ chatId: ctx.callbackQuery.message.chat.id.toString() }, function (err, chat) {
			if (err) {
				console.log(err)
				return
			}
			if (chat) {
				if (ctx.callbackQuery.data == 'not_lesto')
					chat.subLesto = !(chat.subLesto)
				else if (ctx.callbackQuery.data == 'not_menu')
					chat.subMenu = !(chat.subMenu)
				chat.save(function (err, obj) {
					if (err) {
						console.log('Error: ' + err)
					}
					telegram.editMessageText(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id, null,
						'Ti invierò un messaggio ogni giorno, scegli il menù che vuoi ricevere\n(toccando nuovamente il menù non riceverai più le notifiche)',
						KEYBOARD_NOTIFICATIONS(obj))
					ctx.answerCbQuery('Impostazioni aggiornate!')
				})
			} else {
				console.log('ERROR: chat is null on the db')
			}
		})
	}
})

bot.command('notifiche', (ctx) => {
	logAction(ctx, 'Setting notifications ')
	Chat.findOne({ chatId: ctx.message.chat.id.toString() }, function (err, chat) {
		if (err) {
			console.log(err)
			return
		}
		if (chat) {
			return ctx.replyWithMarkdown('Ti invierò un messaggio ogni giorno, scegli il menù che vuoi ricevere\n(toccando nuovamente il menù non riceverai più le notifiche)', KEYBOARD_NOTIFICATIONS(chat))
		} else {
			console.log('ERROR: chat is null on the db')
		}
	})
})

bot.command('setholiday', (ctx) => {
	if (isAdmin(ctx)) {
		config.holiday = (config.holiday != undefined) ? !config.holiday : true
		ctx.reply(config.holiday)
	}
})

bot.command('status', (ctx) => {
	ctx.replyWithChatAction('typing')
	Chat.countDocuments({}, (err, c) => {
		Chat.countDocuments({ $or: [{ subMenu: true }, { subLesto: true }] }, (err, not_c) => {
			return ctx.replyWithMarkdown(`Il bot ha attualmente \`${c}\` utenti, \`${not_c}\` hanno le notifiche attive\nPeriodo di vacanza: *${(config.holiday || 'non attivo')}*`)
		})
	})
})

bot.command('say', (ctx) => {
	if (isAdmin(ctx)) {
		var msg = ctx.message.text.toString()
		Chat.find({}, function (err, chat) {
			if (err) {
				console.log(err)
				return
			}
			if (chat) {
				chat.forEach((element) => {
					telegram.sendMessage(element.chatId, msg.replace('/say', ''), null)
				}, this)
			} else {
				return ctx.reply('errore')
			}
		})
	}
})

bot.command('stop', (ctx) => {
	console.log('stopped by ' + ctx.message.chat.username)
	Chat.findOne({ chatId: ctx.message.chat.id.toString() }, function (err, chat) {
		if (err) {
			console.log(err)
			return
		}
		if (chat) {
			chat.subLesto = false
			chat.subMenu = false
			chat.isBotBlocked = true
			chat.save(function (err, obj) {
				if (err) {
					console.log('Error: ' + err)
				}
			})
		} else {
			console.log('ERROR: chat is null on the db')
		}
	})
})

function logAction(ctx, actionMessage) {
	if (ctx.message.chat.type == 'group')
		console.log(moment().format() + ' ' + actionMessage + ' on ' + ctx.chat.id + ' aka group ' + ctx.chat.title)
	else {
		console.log(moment().format() + ' ' + actionMessage + ' on ' + ctx.chat.id + ' aka @' + ctx.message.chat.username)
	}
	Chat.findOne({ chatId: ctx.chat.id }, function (err, chat) {
		if (err) {
			console.log(err)
			return
		}
		if (chat) {
			if (chat.isBotBlocked) {
				chat.isBotBlocked = false
				chat.save(function (err, obj) {
					if (err) {
						console.log('Error: ' + err)
					}
					return
				})
			}
			return
		} else {
			let newChat = new Chat()
			newChat.chatId = ctx.chat.id
			newChat.subLesto = false
			newChat.subMenu = false
			newChat.save(function (err, obj) {
				if (err)
					console.log(err)
				return
			})
		}
	})
}

bot.catch((err) => {
	console.log('Ooops', err)
})

var notifiche = schedule.scheduleJob('30 9 * * *', function () {
	if (config.holiday)
		return
	Chat.find({ $or: [{ subMenu: true }, { subLesto: true }] }, (err, chats) => {
		if (err) {
			console.log(err)
			return
		}
		if (chats) {
			chats.forEach((chat) => {
				if (chat.subLesto)
					serveMenu(null, chat.chatId, 'lesto')
				if (chat.subMenu)
					serveMenu(null, chat.chatId, 'intero')
			})
			return
		}
	})
})

bot.startPolling()