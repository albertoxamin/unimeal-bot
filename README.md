# Unimeal bot (unimeal-bot)

## What is this repository about?
This project is a Node.js Telegraf (Telegram) bot to access the menu of the university canteen managed by Opera Universitaria.

This is the code powering @unimeal-bot.

## How it works?
Black magic

## tl;dr?
Once you cloned the repository: `git clone https://github.com/Finalgalaxy/yt-search-bot`,
you need to enter into project dir: `cd yt-search-bot`
and type `npm install` to install all dependencies.

Create a `config.js` file in the root of this project with the following info:
```javascript
module.exports = {
    // API key for Telegram
    telegraf_token:'YOUR_TELEGRAM_API_KEY'
};
```
For Telegram API key, check https://github.com/Finalgalaxy/telegram-telegraf-bot and follow README instructions about how to create a Telegram Bot.

Once you've set up your API key, just type:
`npm start`
...done!