//
//  Bot Framework Weathet App thesis Example
//  Use the Emulator after running npm start
//  to access the dialog system.
//
var restify = require('restify');
var builder = require('botbuilder');
var axios   = require('axios');

var ScuttleZanetti = require( 'scuttlezanetti' ).api;
var stopWords = require( 'scuttlezanetti' ).stopWords;
var strtotime = require('./strtotime/strtotime');

var sz = new ScuttleZanetti({
  stopWords: stopWords,   //default 
  tokenizePattern: undefined, //default 
  tokenizeMethod: function( s ) {
    return s.replace(/[^\w\s-]/, "").split( " " );
  } //default 
});

var capitalizeFirstLetter = (string) => {
    return string[0].toUpperCase() + string.slice(1);
}

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
            date: date ? date.getTime() : null
        }

        if (!weatherData.location) {
            builder.Prompts.text(session, 'In which location?');
        } else {
            next();
        }
    },
    (session, results, next) => {
        var weatherData = session.dialogData.weatherData;
        if (results.response) {
            weatherData.location = sz.removeStopWords(results.response);
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
            weatherData.date =  date ? date.getTime() : null
        }

        // url encode the location
        var encodedAddress = encodeURIComponent(weatherData.location);
        var geocodeURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}`;

        // first do a reverse geolocation from the location given
        return axios.get(geocodeURL).then((response) => {
            if (response.data.status === 'ZERO_RESULTS') {
                throw new Error('Unable to find that address');
            }
            var lat = response.data.results[0].geometry.location.lat;
            var lng = response.data.results[0].geometry.location.lng;

            // then do a weather forecast search to forecast.io
            var weatherURL = `https://api.darksky.net/forecast/39b78cd34c557b7ac589472a5c6a9c6b/${lat},${lng}?units=si`;
            return axios.get(weatherURL);
        }).then((response) => {
            // if the chained Promise succeeds then set the temperature to the context object
            var temperature = response.data.currently.temperature;
            var apparentTemperature = response.data.currently.apparentTemperature;

            session.send(`The weather in ${weatherData.location} would be ${temperature} degrees.`);
        }).catch((e) => {
            // Error check for both google reverse code and forecast.io
            if (e.code === 'ENOTFOUND') {
                console.log('Unable to connect to API server');
            } else {
                console.log(e.message);
            }
        });
    }
]);