//
//  Open university of Cyprus
//  Information and Communication Systems
//  Panagiotis Chalatsakos (c) 2017
//  Student Id: 11300837
//
var restify = require('restify');
var builder = require('botbuilder');
var axios   = require('axios');

var ScuttleZanetti = require( 'scuttlezanetti' ).api;
var stopWords = require( 'scuttlezanetti' ).stopWords;
var strtotime = require('./strtotime/strtotime');

var model = process.argv[2];  // ADD YOUR ENDPOINT-URL HERE!

// init ScuttleZanetti
var sz = new ScuttleZanetti({
  stopWords: stopWords,   //default 
  tokenizePattern: undefined, //default 
  tokenizeMethod: function( s ) {
    return s.replace(/[^\w\s-]/, "").split( " " );
  } //default 
});

// Init message restful server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(`${server.name} listening to ${server.url}`);
});

// Init Bot Connector
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Init Bot
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// Use LUIS
// var model = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/625349e9-bea7-4fa3-8b3e-58d7a8b557a8?subscription-key=18478fcbdc654700ad34dcc9f6055f4d&verbose=true&timezoneOffset=0&q=';

var recognizer = new builder.LuisRecognizer(model);

// Start Intent-to-Dialog service with LUIS
var dialog = new builder.IntentDialog({recognizers: [recognizer]});
bot.dialog('/', dialog);

// dialog matching
//dialog.matches("builtin.intent.weather.check_weather", [
dialog.matches("Weather.GetForecast", [
    (session, args, next) => {

        // Entity Recognition
        var location = builder.EntityRecognizer.findEntity(args.entities, 'Weather.Location');
        var date     = builder.EntityRecognizer.resolveTime(args.entities);
    
        // Add entities as parameters
        var weatherData = session.dialogData.weatherData = {
            location: location ? location.entity : null,
            date: date ? date.getTime() : null
        }

        // Check for missing entity: Location
        if (!weatherData.location) {
            // Query User for location
            builder.Prompts.text(session, 'In which location?');
        } else {
            // Go to next dialog point
            next();
        }
    },
    (session, results, next) => {
        // Save location to session
        var weatherData = session.dialogData.weatherData;
        if (results.response) {
            weatherData.location = sz.removeStopWords(results.response);
        }

        // Check for Date
        if (weatherData.location && !weatherData.date) {
            // Query user for date.
            builder.Prompts.text(session, 'When?');
        } else {
            // Go to next dialog point
            next();
        }

    },
    (session, results) => {

        // Update weatherData and session
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

            // Generate context and content in natural language
            session.send(`The weather in ${weatherData.location} would be ${temperature} degrees.`);
        }).catch((e) => {
            // Error check for both google reverse code and forecast.io
            if (e.code === 'ENOTFOUND') {
                console.log('Unable to connect to API server');
            } else {
                console.log(e.message);
            }
        });
    } // end of intent dialog.
]);