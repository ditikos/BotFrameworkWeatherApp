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

var model = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/c413b2ef-382c-45bd-8ff0-f76d60e2a821?subscription-key=18478fcbdc654700ad34dcc9f6055f4d&q=';
var recognizer = new builder.LuisRecognizer(model);
var dialog = new builder.IntentDialog({recognizers: [recognizer]});

// bot.dialog('/', function (session) {
//     session.send("Hello World");
// });

bot.dialog('/', dialog);

// dialog matching
dialog.matches("builtin.intent.weather.check_weather", [
    (session, args, next) => {
        var location = builder.EntityRecognizer.findEntity(args.entities, 'builtin.weather.absolute_location');
        var date     = builder.EntityRecognizer.resolveTime(args.entities);
    
        var weatherData = session.dialogData.weatherData = {
            location: location ? location.entity : null,
            date: date ? date : null
        }

        console.log(`Data: ${JSON.stringify(weatherData, undefined, 2)}`);

        if (!weatherData.location) {
            builder.Prompts.text(session, 'In which location?');
        } else {
            next();
        }
    },
    (session, results, next) => {
        var weatherData = session.dialogData.weatherData;
        if (results.response) {
            weatherData.location = results.response;
        }

        if (weatherData.location && !weatherData.date) {
            builder.Prompts.text(session, 'When?');
        } else {
            next();
        }

    },
    (session, results) => {
        var weatherData = session.dialogData.weatherData;
        if (results.response) {
            var date = builder.EntityRecognizer.resolveTime([results.response]);
            weatherData.date =  date ? date : null

            

        }
        session.send('The weather would be 23 degrees.');
    }
]);