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
var backupMenu = undefined

const isAdmin = (ctx) => ctx.message.chat.username === 'albertoxamin'

const updateBackupMenu = () => request('https://api-mensa-unitn.herokuapp.com', (err, res, body) => {
	if (!err && res.statusCode === 200)
		backupMenu = JSON.parse(body)
})

const getLastOperaUpdateTime = () => {
	let mostRecentDate = new Date(0)
	for (var key in menus) {
		if (menus.hasOwnProperty(key)) {
			let decoded = Buffer.from(key, 'base64').toString()
			let keyDate = moment(decoded, 'YYYY-MM-DD').toDate()
			if (keyDate > mostRecentDate)
				mostRecentDate = keyDate
		}
	}
	return `L'ultimo menu caricato dall'opera universitaria è del ${moment(mostRecentDate).format('DD/MM/YYYY')} ovvero ${moment(mostRecentDate).fromNow()}`
}

const KEYBOARD_NOTIFICATIONS = (chat) => Markup.inlineKeyboard([
	[Markup.callbackButton(`Lesto ${(chat.subLesto ? '✅' : '❌')}`, 'not_lesto'),
	Markup.callbackButton(`Intero ${(chat.subMenu ? '✅' : '❌')}`, 'not_menu')],
	[Markup.callbackButton(`Weekends ${chat.weekend ? '✅' : '❌'}`, 'not_weekend')]
]).extra()

const getChat = (chatId, callback, notFoundCallback) => {
	Chat.findOne({ chatId: chatId }, function (err, chat) {
		if (err) return console.log(err)
		if (chat) {
			callback(chat)
		} else if (notFoundCallback) {
			notFoundCallback()
		} else {
			console.log('ERROR: chat is null on the db')
		}
	})
}

bot.telegram.getMe().then((bot_informations) => {
	bot.options.username = bot_informations.username
	console.log('Server has initialized bot nickname. Nick: ' + bot_informations.username)
	username = '@' + bot_informations.username
	firebase.initializeApp(config.firebaseConfig)
	database = firebase.database().ref().child('menus')
	database.on('value', snap => {
		console.log('Firebase updated!')
		menus = snap.val()
	})
	updateBackupMenu()
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

const getMessage = (menuSource, kind) => {
	let index = new Buffer(moment().format('YYYY-MM-DD')).toString('base64')
	let today = menuSource[index]
	if (!today) today = backupMenu[index]
	if (!today) return ''
	let selected = (kind == 'lesto') ? today.lesto : today.completo
	let message = ''
	if (kind == 'lesto' && selected != undefined && selected.primo[0] != '')
		return `Il menu *lesto* 🐰 di oggi è:\nPrimo: 🍝 \`${selected.primo[0]}\`\nSecondo: 🥩 \`${selected.secondo[0]}\`\nContorno: 🥦 \`${selected.contorno[0]}\``
	else if ((kind == 'menu' || kind == 'intero') && selected != undefined && selected.primo[0] != '') {
		let flatten = (arr, emoji) => {
			let message = ''
			arr.forEach((dish) => {
				if (dish != '')
					message += `\n${emoji} \`${dish}\``
			})
			return message
		}
		message = `Il menu *completo* di oggi è:\n${flatten(selected.primo, '🍝')}\n${flatten(selected.secondo, '🥩')}\n${flatten(selected.contorno, '🥦')}`
	}
	return message
}

const buildMessage = function (kind) {
	let message = menus ? getMessage(menus, kind) : ''
	if (message !== '')
		return message;
	message = backupMenu ? getMessage(backupMenu, kind) : ''
	if (message !== '')
		return message;
	if (kind == 'lesto')
		return 'Nessun menu lesto oggi, consulta il menu completo con il comando /menu\n' + getLastOperaUpdateTime()
	return 'Nessun menu disponibile per oggi.\n' + getLastOperaUpdateTime()
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
	if (ctx.callbackQuery.data.indexOf('not_') != -1) {
		getChat(ctx.callbackQuery.message.chat.id.toString(), (chat) => {
			if (ctx.callbackQuery.data == 'not_lesto')
				chat.subLesto = !(chat.subLesto)
			else if (ctx.callbackQuery.data == 'not_menu')
				chat.subMenu = !(chat.subMenu)
			else if (ctx.callbackQuery.data == 'not_weekend')
				chat.weekend = !(chat.weekend)
			chat.save(function (err, obj) {
				if (err) {
					console.log('Error: ' + err)
				}
				telegram.editMessageText(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id, null,
					'Ti invierò un messaggio ogni giorno, scegli il menù che vuoi ricevere\n(toccando nuovamente il menù non riceverai più le notifiche)',
					KEYBOARD_NOTIFICATIONS(obj))
				ctx.answerCbQuery('Impostazioni aggiornate!')
			})
		})
	}
})

bot.command('notifiche', (ctx) => {
	logAction(ctx, 'Setting notifications ')
	getChat(ctx.message.chat.id.toString(),
		(chat) =>
			ctx.replyWithMarkdown('Ti invierò un messaggio ogni giorno, scegli il menù che vuoi ricevere\n' +
				'(toccando nuovamente il menù non riceverai più le notifiche)',
				KEYBOARD_NOTIFICATIONS(chat)))
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
			return ctx.replyWithMarkdown(`Il bot ha attualmente \`${c}\` utenti, \`${not_c}\` hanno le notifiche attive\nPeriodo di vacanza: *${(config.holiday || 'non attivo')}*\n${getLastOperaUpdateTime()}`)
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
	getChat(ctx.message.chat.id.toString(), (chat) => {
		chat.subLesto = false
		chat.subMenu = false
		chat.isBotBlocked = true
		chat.save(function (err, obj) {
			if (err) {
				console.log('Error: ' + err)
			}
		})
	})
})

function logAction(ctx, actionMessage) {
	if (ctx.message.chat.type == 'group')
		console.log(moment().format() + ' ' + actionMessage + ' on ' + ctx.chat.id + ' aka group ' + ctx.chat.title)
	else {
		console.log(moment().format() + ' ' + actionMessage + ' on ' + ctx.chat.id + ' aka @' + ctx.message.chat.username)
	}
	getChat(ctx.chat.id, (chat) => {
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
	}, () => {
		let newChat = new Chat()
		newChat.chatId = ctx.chat.id
		newChat.subLesto = false
		newChat.subMenu = false
		newChat.save(function (err, obj) {
			if (err)
				console.log(err)
			return
		})
	})
}

bot.catch((err) => {
	console.log('Ooops', err)
})

var notifiche = schedule.scheduleJob('30 9 * * *', function () {
	if (config.holiday)
		return
	updateBackupMenu()
	Chat.find({ $or: [{ subMenu: true }, { subLesto: true }] }, (err, chats) => {
		if (err) {
			console.log(err)
			return
		}
		if (chats) {
			chats.forEach((chat) => {
				if (moment().weekday() > 5 && !(chat.weekend))
					return
				if (chat.subLesto)
					serveMenu(null, chat.chatId, 'lesto')
				if (chat.subMenu)
					serveMenu(null, chat.chatId, 'intero')
			})
		}
	})
})

bot.startPolling()