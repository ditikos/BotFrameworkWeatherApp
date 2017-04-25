var restify = require('restify');
var builder = require('botbuilder');

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(`${server.name} listening to ${server.url}`);
});

var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// bot.dialog('/', function (session) {
//     session.send("Hello World");
// });

bot.dialog('/', [
    (session, args, next) => {
        if (!session.userData.name) {
            session.beginDialog('/profile');
        } else {
            next();
        }
    },
    (session, results) => {
        session.send(`Hello ${session.userData.name}`);
    }
]);

bot.dialog('/profile', [
    (session) => {
        builder.Prompts.text(session, 'Hi! what is your name?');
    },
    (session, results) => {
        session.userData.name = results.response;
        session.endDialog();
    }
]);