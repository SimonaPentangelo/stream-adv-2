// Read environment variables from .env file
const path = require('path');
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({
    path: ENV_FILE
});

var request = require('request');

// Import required types from libraries
const {
    ActivityTypes,
    MessageFactory,
    InputHints
} = require('botbuilder');


const { ComponentDialog, 
        DialogSet, 
        DialogTurnStatus, 
        TextPrompt, 
        WaterfallDialog 
} = require('botbuilder-dialogs');

const { RESULT_DIALOG,
    ResultDialog } = require('./resultDialog');

const SEARCH_DIALOG = 'SEARCH_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const KEY_TMDB = process.env.TheMovieDBAPI;

// Secondary dialog, manages the reservation of a new seminar by composing an email
class SearchDialog extends ComponentDialog {
    constructor(luisRecognizer, userProfileAccessor) {
        super(SEARCH_DIALOG);

        this.luisRecognizer = luisRecognizer;
        this.userProfileAccessor = userProfileAccessor;
        // Adding used dialogs
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ResultDialog(this.luisRecognizer, this.userProfileAccessor));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.inputStep.bind(this),
            this.searchStep.bind(this),
            this.loopStep.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }
    
    
    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    async inputStep(step) {
        if (!this.luisRecognizer.isConfigured) {
            const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await step.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await step.next();
        }
        const messageText = step.options.restartMsg ? step.options.restartMsg : `Cosa stai cercando? Scrivi se vuoi un film o una serie ed il/i generi che cerchi.`;
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await step.prompt(TEXT_PROMPT, { prompt: promptMessage });
    }

    
    getGenresMovies() {
    var gen;
        return new Promise(function(resolve, reject) {
            request({
                method: 'GET',
                url: 'http://api.themoviedb.org/3/genre/movie/list?api_key=' + KEY_TMDB + '&language=it-IT',
                headers: {
                'Content-Type': 'application/json',
                }}, function (error, response, body) {
                gen = JSON.parse(body);
                resolve(gen);
            });
        });
    }

    getGenresShows() {
        var gen;
            return new Promise(function(resolve, reject) {
                request({
                    method: 'GET',
                    url: 'http://api.themoviedb.org/3/genre/tv/list?api_key=' + KEY_TMDB + '&language=it-IT',
                    headers: {
                    'Content-Type': 'application/json',
                    }
                }, function (error, response, body) {
                    gen = JSON.parse(body);
                    resolve(gen);
                });
            });
        }

    getKeyword(s) {
        var key;
            return new Promise(function(resolve, reject) {
                   request({
                     method: 'GET',
                    url: 'https://api.themoviedb.org/3/search/keyword?api_key=' + KEY_TMDB + '&query=' + s,
                    headers: {
                    'Content-Type': 'application/json',
                    }
                }, function (error, response, body) {
                    var obj = JSON.parse(body);
                    var i = 0;
                    console.log('https://api.themoviedb.org/3/search/keyword?api_key=' + KEY_TMDB + '&query=' + s);
                    while(obj.results[i]) {
                        console.log(obj.results[i]);
                        if(obj.results[i].name == s) {
                            console.log("TROVATA");
                            key = obj.results[i];
                            console.log("KEY: " + key);
                            break;
                        }
                        i++;
                    }
                    resolve(key);
                });
            });
        }

    getResult(urlString, type) {
        var res = [];
        return new Promise(function(resolve, reject) {
            request({
              method: 'GET',
             url: urlString,
             headers: {
             'Content-Type': 'application/json',
             }}, function (error, response, body) {
                 if(type == 'film') {
                    var obj = JSON.parse(body);
                    var i = 0;
                    while(obj.results[i]) {
                       var s = JSON.stringify(obj.results[i].title);
                       var ide = JSON.stringify(obj.results[i].id);
                       res.push({ name:s.substring(1, s.length - 1), id: ide });
                       if(i == 6) {
                           break;
                       }
                       i++;
                    }
                    resolve(res);
                 } else {
                    var obj = JSON.parse(body);
                    var i = 0;
                    while(obj.results[i]) {
                       var s = JSON.stringify(obj.results[i].name);
                       var ide = JSON.stringify(obj.results[i].id);
                       res.push({ name:s.substring(1, s.length - 1), id: ide });
                       if(i == 6) {
                           break;
                       }
                       i++;
                    }
                    console.log("SEARCH DIALOG: " + res);
                    resolve(res);
                 }
         });
     });
    }

    async searchStep(step) {

            const reply = {
                type: ActivityTypes.Message
            };
            
            const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
            const res = await this.luisRecognizer.getMediaEntities(luisResult);
            console.log("risultato: " + res.Media + " " + res.Generi[0]);
            /*const res = {
                Media: 'film',
                Generi: [
                    'crime'
                ]
            }*/
            switch (res.Media) {
                case 'film': {

                    var gen = await this.getGenresMovies();
                    console.log("STAMPA: " + gen.genres);
                    let i = 0;
                    let countG = 0;
                    let countC = 0;
                    let stringaGeneri = "";
                    let stringaChiavi = "";
                    while(res.Generi[i]) {
                        var s = JSON.stringify(res.Generi[i]);
                        s = s.substring(2, s.length - 2);
                        switch(s) {
                            case "crime": {
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Crime") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                }    
                                break; }
                            case "avventura": {
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Avventura") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                }  
                                break; }
                            case "fantasy": {
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                        var temp = JSON.stringify(gen.genres[j].name);
                                        var stringa = temp.substring(1, temp.length - 1)
                                    if(stringa == "Fantasy") {
                                        var temp2 = JSON.stringify(gen.genres[j].id);
                                        stringaGeneri = stringaGeneri.concat(temp2);
                                    }
                                    j++;
                                } 
                                break; }
                            case "animazione": { 
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Animazione") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "drama": { 
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Dramma") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "family": { 
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Famiglia") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "biografico": {
                                //biography
                                var obj = await this.getKeyword("biography");
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  console.log(stringa);
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);
                                  countC++;
                                break; }
                            case "storico": { 
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Storia") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "commedia": { 
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Commedia") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "cult": {
                                //cult
                                var obj = await this.getKeyword("cult");  
                                  if(countC != 0) {
                                    stringaChiavi.push(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);        
                                break; }
                            case "documentario": { 
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Documentario") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "horror": { 
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Horror") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "noir": {
                                //noir
                                var obj = await this.getKeyword("noir");
                                  
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  console.log(stringa);
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);        
                                break; }
                            case "poliziesco": { 
                                //police
                                var obj = await this.getKeyword("police");
                                  
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  console.log(stringa);
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);
                                break; }
                            case "sci-fi": {
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Fantascienza") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                 break; }
                            case "supereroi": {
                                //superhero 
                                var obj = await this.getKeyword("superhero");
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  console.log(stringa);
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);
                                break; }
                            case "thriller": {
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genresj[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Thriller") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                }  
                                break; }
                            case "western": { 
                                if(i != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Western") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "romantico": {
                                if(i != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Romance") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "giallo": {
                                   //giallo
                                var obj = await this.getKeyword("giallo");
                                if(countC != 0) {
                                  stringaChiavi = stringaChiavi.concat(",");
                                }
                                countC++;
                                console.log(stringa);
                                var temp2 = JSON.stringify(obj.id);
                                stringaChiavi = stringaChiavi.concat(temp2);
                              break; }
                            case "azione": {
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                        var temp = JSON.stringify(gen.genres[j].name);
                                        var stringa = temp.substring(1, temp.length - 1)
                                    if(stringa == "Azione") {
                                        var temp2 = JSON.stringify(gen.genres[j].id);
                                        stringaGeneri = stringaGeneri.concat(temp2);
                                    }
                                    j++;
                                } 
                                break; }
                            default: break;
                        }
                        i++;
                    }
                    
                    console.log("CHIAVI: " + stringaChiavi);
                    console.log("GENERI: " + stringaGeneri);
                    var reqQuery;
                    if(stringaChiavi.length == 0 && stringaGeneri == 0) {
                        reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
                    await step.context.sendActivity(reply)
                        return await step.replaceDialog(this.id);
                    }

                    if(stringaChiavi == "") {
                        reqQuery = "https://api.themoviedb.org/3/discover/movie?api_key=" + KEY_TMDB + "&language=it-IT&with_genres=" + stringaGeneri + "&page=1";
                    } else if(stringaGeneri == "") {
                        reqQuery = "https://api.themoviedb.org/3/discover/movie?api_key=" + KEY_TMDB + "&language=it-IT&with_keywords=" + stringaChiavi + "&page=1";
                    } else {
                        reqQuery = "https://api.themoviedb.org/3/discover/movie?api_key=" + KEY_TMDB + "&language=it-IT&with_keywords=" + stringaChiavi + "&with_genres=" + stringaGeneri + "&page=1"
                    }
                    console.log(reqQuery);
                    var result = await this.getResult(reqQuery, "film");
                    console.log(result);
                    return await step.beginDialog(RESULT_DIALOG, { type : 'movie', list : result });
                }
                case 'serie tv': {

                    var gen = await this.getGenresShows();
                    console.log("STAMPA: " + gen.genres);
                    let i = 0;
                    let countG = 0;
                    let countC = 0;
                    let stringaGeneri = "";
                    let stringaChiavi = "";
                    console.log("SONO QUI");
                    console.log(res.Generi[i]);
                    while(res.Generi[i]) {
                        var s = JSON.stringify(res.Generi[i]);
                        s = s.substring(2, s.length - 2);
                        console.log(s);
                        switch(s) {
                            case "crime": {
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Crime") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                }    
                                break; }
                            case "avventura": {
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Action & Adventure") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                }  
                                break; }
                            case "fantasy": {
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                        var temp = JSON.stringify(gen.genres[j].name);
                                        var stringa = temp.substring(1, temp.length - 1)
                                    if(stringa == "Sci-Fi & Fantasy") {
                                        var temp2 = JSON.stringify(gen.genres[j].id);
                                        stringaGeneri = stringaGeneri.concat(temp2);
                                    }
                                    j++;
                                } 
                                break; }
                            case "animazione": { 
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Animazione") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "drama": { 
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Dramma") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "family": { 
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Famiglia") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "biografico": {
                                //biography
                                var obj = await this.getKeyword("biography");
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);
                                  countC++;
                                break; }
                            case "storico": { 
                                //history
                                console.log('QUI QUO QUA');
                                var obj = await this.getKeyword("history");
                                if(countC != 0) {
                                  stringaChiavi = stringaChiavi.concat(",");
                                }
                                var temp2 = JSON.stringify(obj.id);
                                stringaChiavi = stringaChiavi.concat(temp2);
                                countC++;
                              break; }
                            case "commedia": { 
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Commedia") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "cult": {
                                //cult
                                var obj = await this.getKeyword("cult");  
                                  if(countC != 0) {
                                    stringaChiavi.push(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);        
                                break; }
                            case "documentario": { 
                                //documentario
                                var obj = await this.getKeyword("documentario");
                                  
                                    if(countC != 0) {
                                        stringaChiavi = stringaChiavi.concat(",");
                                    }
                                    countC++;
                                    var temp2 = JSON.stringify(obj.id);
                                    stringaChiavi = stringaChiavi.concat(temp2);        
                                break; }
                            case "horror": { 
                               //horror
                                var obj = await this.getKeyword("horror");
                                  
                                    if(countC != 0) {
                                        stringaChiavi = stringaChiavi.concat(",");
                                    }
                                    countC++;
                                    var temp2 = JSON.stringify(obj.id);
                                    stringaChiavi = stringaChiavi.concat(temp2);        
                                break; }
                            case "noir": {
                                //noir
                                var obj = await this.getKeyword("noir");
                                  
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);        
                                break; }
                            case "poliziesco": { 
                                //police
                                var obj = await this.getKeyword("police");
                                  
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);
                                break; }
                            case "sci-fi": {
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Sci-Fi & Fantasy") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                 break; }
                            case "supereroi": {
                                //superhero 
                                var obj = await this.getKeyword("superhero");
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);
                                break; }
                            case "thriller": {
                                //thriller
                                var obj = await this.getKeyword("thriller");
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);
                                break; }
                            case "western": { 
                                if(i != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                    var temp = JSON.stringify(gen.genres[j].name);
                                    var stringa = temp.substring(1, temp.length - 1)
                                if(stringa == "Western") {
                                    var temp2 = JSON.stringify(gen.genres[j].id);
                                    stringaGeneri = stringaGeneri.concat(temp2);
                                }
                                j++;
                                } 
                                break; }
                            case "romantico": {
                                //romance
                                var obj = await this.getKeyword("romance");
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);
                                break; }
                            case "giallo": {
                                    //giallo
                                 var obj = await this.getKeyword("giallo");
                                 if(countC != 0) {
                                   stringaChiavi = stringaChiavi.concat(",");
                                 }
                                 countC++;
                                 console.log(stringa);
                                 var temp2 = JSON.stringify(obj.id);
                                 stringaChiavi = stringaChiavi.concat(temp2);
                               break; }
                            case "azione": {
                                if(countG != 0) {
                                    stringaGeneri = stringaGeneri.concat(",");
                                }
                                countG++;
                                var j = 0;
                                while(gen.genres[j]) {
                                        var temp = JSON.stringify(gen.genres[j].name);
                                        var stringa = temp.substring(1, temp.length - 1)
                                    if(stringa == "Action & Adventure") {
                                        var temp2 = JSON.stringify(gen.genres[j].id);
                                        stringaGeneri = stringaGeneri.concat(temp2);
                                    }
                                    j++;
                                } 
                                break; }
                            default: break;
                        }
                        i++;
                    }

                    console.log("CHIAVI: " + stringaChiavi);
                    console.log("GENERI: " + stringaGeneri);
                    var reqQuery;

                    if(stringaChiavi.length == 0 && stringaGeneri == 0) {
                        reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
                    await step.context.sendActivity(reply)
                        return await step.replaceDialog(this.id);
                    }
                    
                    if(stringaChiavi == "") {
                        reqQuery = "https://api.themoviedb.org/3/discover/tv?api_key=" + KEY_TMDB + "&language=it-IT&with_genres=" + stringaGeneri + "&page=1";
                    } else if(stringaGeneri == "") {
                        reqQuery = "https://api.themoviedb.org/3/discover/tv?api_key=" + KEY_TMDB + "&language=it-IT&with_keywords=" + stringaChiavi + "&page=1";
                    } else {
                        reqQuery = "https://api.themoviedb.org/3/discover/tv?api_key=" + KEY_TMDB + "&language=it-IT&with_keywords=" + stringaChiavi + "&with_genres=" + stringaGeneri + "&page=1"
                    }
                    console.log(reqQuery);
                    var result = await this.getResult(reqQuery, "serie tv");
                    console.log(result);
                    return await step.beginDialog(RESULT_DIALOG, { type : 'tv', list : result });
                } default: {
                     // The user did not enter input that this bot was built to handle.
                    reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
                    await step.context.sendActivity(reply)
                }
            return await step.replaceDialog(this.id);
        }
    }
    
    async loopStep(step) {
        if(step.result != undefined) {
            if(step.result.res == "MAIN") {
                return await step.endDialog({ res: "MAIN"});
            } else if(step.result.res == "SEARCH") {
                return await step.replaceDialog(this.id);
            }
        }
    }
 }
module.exports.SearchDialog = SearchDialog;
module.exports.SEARCH_DIALOG = SEARCH_DIALOG;