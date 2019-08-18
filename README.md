![banner](https://repository-images.githubusercontent.com/117532859/2e294f00-6ccf-11e9-93cf-247d357c6f10)

# Unimeal bot (unimeal-bot)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Falbertoxamin%2Funimeal-bot.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Falbertoxamin%2Funimeal-bot?ref=badge_shield)
[![](https://images.microbadger.com/badges/version/albertoxamin/unimeal-bot.svg)](https://microbadger.com/images/albertoxamin/unimeal-bot)
[![](https://images.microbadger.com/badges/image/albertoxamin/unimeal-bot.svg)](https://microbadger.com/images/albertoxamin/unimeal-bot)

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
    firebaseConfig : {
        apiKey: 'YOUR_FIREBASE_API_KEY',
        authDomain: 'unimeal-8e378.firebaseapp.com',
        databaseURL: 'https://unimeal-8e378.firebaseio.com',
        projectId: 'unimeal-8e378',
        storageBucket: 'unimeal-8e378.appspot.com',
        messagingSenderId: '648699973887'
    }
};
```

> The bot should work even without the db_connection and the firebase config

Once you've set up your API key, just type:
`npm start`
...done!

## Docker
For easier deployment you can also use the docker image

```bash
docker pull albertoxamin/unimeal-bot
docker run -it -v /path_in_host/config.js:/usr/src/app/config.js --name unimeal albertoxamin/unimeal-bot
```


## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Falbertoxamin%2Funimeal-bot.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Falbertoxamin%2Funimeal-bot?ref=badge_large)
