# Unimeal bot (unimeal-bot)

## What is this repository about?
This project is a Node.js Telegraf (Telegram) bot to access the menu of the university canteen managed by Opera Universitaria.

This is the code powering @unimeal-bot.

## Set-up
Once you cloned the repository:
you need to enter into project dir: `cd unimeal-bot`
and type `npm install` to install all dependencies.

Create a `config.js` file in the root of this project with the following info:
```javascript
module.exports = {
    // API key for Telegram
    telegraf_token:'YOUR_TELEGRAM_API_KEY',
    db_connection:'your_mongodb_connection_string'
};
```
For Telegram API key, check https://github.com/Finalgalaxy/telegram-telegraf-bot and follow README instructions about how to create a Telegram Bot.

Once you've set up your API key, just type:
`npm start`
...done!

## Docker
For easier deployment you can also use the docker image

```
docker pull albertoxamin/unimeal-bot
docker run -it -e "TOKEN=YOUR_TELEGRAM_API_KEY" \
    -e "DB_CONNECTION=your_mongodb_connection_string" \
    --name unimeal albertoxamin/unimeal-bot
```
