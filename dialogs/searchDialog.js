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

const { LuisRecognizer } = require('botbuilder-ai');

const { ComponentDialog, 
        DialogSet, 
        DialogTurnStatus, 
        TextPrompt, 
        WaterfallDialog 
} = require('botbuilder-dialogs');

const {
    RESULT_DIALOG,
    ResultDialog
} = require('./resultDialog');

const RESULT_TEXT = 'RESULT_TEXT';
const SEARCH_DIALOG = 'SEARCH_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';

// Secondary dialog, manages the reservation of a new seminar by composing an email
class SearchDialog extends ComponentDialog {
    constructor(luisRecognizer) {
        super(SEARCH_DIALOG);

        this.luisRecognizer = luisRecognizer;
        // Adding used dialogs
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ResultDialog(luisRecognizer, RESULT_TEXT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.inputStep.bind(this),
            this.searchStep.bind(this),
            this.resultStep.bind(this),
            this.branchStep.bing(this),
            this.loopStep.bind(this),
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
                url: 'http://api.themoviedb.org/3/genre/movie/list?api_key=c3fca9451dd83145763b68b068f2fdc2&language=it-IT',
                headers: {
                'Content-Type': 'application/json',
                }}, function (error, response, body) {
                //console.log('Status:', response.statusCode);
                //console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
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
                    url: 'http://api.themoviedb.org/3/genre/tv/list?api_key=c3fca9451dd83145763b68b068f2fdc2&language=it-IT',
                    headers: {
                    'Content-Type': 'application/json',
                    }}, function (error, response, body) {
                    //console.log('Status:', response.statusCode);
                    //console.log('Headers:', JSON.stringify(response.headers));
                    console.log('Response:', body);
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
                    url: 'https://api.themoviedb.org/3/search/keyword?api_key=c3fca9451dd83145763b68b068f2fdc2&query=' + s,
                    headers: {
                    'Content-Type': 'application/json',
                    }}, function (error, response, body) {
                    //console.log('Status:', response.statusCode);
                    //console.log('Headers:', JSON.stringify(response.headers));
                    //console.log('Response:', body);
                    var obj = JSON.parse(body);
                    var i = 0;
                    while(obj.results[i]) {
                        if(obj.results[i].name == s) {
                            console.log("TROVATA");
                            key = obj.results[i];
                            break;
                        }
                    }
                    resolve(key);
                });
            });
        }

    getResult(urlString) {
        var res = [];
        return new Promise(function(resolve, reject) {
            request({
              method: 'GET',
             url: urlString,
             headers: {
             'Content-Type': 'application/json',
             }}, function (error, response, body) {
             var obj = JSON.parse(body);
             var i = 0;
             while(obj.results[i]) {
                var s = JSON.stringify(obj.results[i].title);
                res.push(s.substring(1, s.length - 1));
                if(i == 6) {
                    break;
                }
                i++;
             }
             resolve(res);
         });
     });
    }

    async searchStep(step) {

            const reply = {
                type: ActivityTypes.Message
            };
            const luis = step.result;
            const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
            const res = await this.luisRecognizer.getMediaEntities(luisResult);
            //console.log("risultato: " + res.Media + " " + res.Generi[0]);
            switch (res.Media) {
                case 'film': {

                    var gen = await this.getGenresMovies();

                    console.log("RESULT: " + gen.genres[0].id);
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
                                var obj = await getKeyword("biography");
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
                                var obj = await getKeyword("cult");  
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
                                    stringaGeneri.push(",");
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
                                var obj = await getKeyword("noir");
                                  
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
                                var obj = getKeyword("police");
                                  
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  console.log(stringa);
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaGeneri = stringaGeneri.concat(temp2);
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
                                var obj = this.getKeyword("superhero");
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  console.log(stringa);
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaGeneri = stringaGeneri.concat(temp2);
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
                            default: break;
                        }
                        i++;
                    }
                    
                    console.log("CHIAVI: " + stringaChiavi);
                    console.log("GENERI: " + stringaGeneri);
                    var reqQuery;

                    if(stringaChiavi == "") {
                        reqQuery = "https://api.themoviedb.org/3/discover/movie?api_key=c3fca9451dd83145763b68b068f2fdc2&language=it-IT&with_genres=" + stringaGeneri + "&page=1";
                    } else if(stringaGeneri == "") {
                        reqQuery = "https://api.themoviedb.org/3/discover/movie?api_key=c3fca9451dd83145763b68b068f2fdc2&language=it-IT&with_keywords=" + stringaChiavi + "&page=1";
                    } else {
                        reqQuery = "https://api.themoviedb.org/3/discover/movie?api_key=c3fca9451dd83145763b68b068f2fdc2&language=it-IT&with_keywords=" + stringaChiavi + "&with_genres=" + stringaGeneri + "&page=1"
                    }
                    console.log(reqQuery);
                    var result = await this.getResult(reqQuery);
                    console.log(result);
                    return await step.beginDialog(RESULT_DIALOG, result);    
                }
                case 'serie tv': {

                    var gen = this.getGenresShows();

                    console.log("RESULT: " + gen.genres[0].id);
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
                                var obj = await getKeyword("biography");
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);
                                  countC++;
                                break; }
                            case "storico": { 
                                //history
                                var obj = await getKeyword("history");
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
                                var obj = await getKeyword("cult");  
                                  if(countC != 0) {
                                    stringaChiavi.push(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);        
                                break; }
                            case "documentario": { 
                                //documentario
                                var obj = await getKeyword("documentario");
                                  
                                    if(countC != 0) {
                                        stringaChiavi = stringaChiavi.concat(",");
                                    }
                                    countC++;
                                    var temp2 = JSON.stringify(obj.id);
                                    stringaChiavi = stringaChiavi.concat(temp2);        
                                break; }
                            case "horror": { 
                               //horror
                                var obj = await getKeyword("horror");
                                  
                                    if(countC != 0) {
                                        stringaChiavi = stringaChiavi.concat(",");
                                    }
                                    countC++;
                                    var temp2 = JSON.stringify(obj.id);
                                    stringaChiavi = stringaChiavi.concat(temp2);        
                                break; }
                            case "noir": {
                                //noir
                                var obj = await getKeyword("noir");
                                  
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaChiavi = stringaChiavi.concat(temp2);        
                                break; }
                            case "poliziesco": { 
                                //police
                                var obj = getKeyword("police");
                                  
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaGeneri = stringaGeneri.concat(temp2);
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
                                var obj = this.getKeyword("superhero");
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaGeneri = stringaGeneri.concat(temp2);
                                break; }
                            case "thriller": {
                                //thriller
                                var obj = this.getKeyword("thriller");
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaGeneri = stringaGeneri.concat(temp2);
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
                                var obj = this.getKeyword("romance");
                                  if(countC != 0) {
                                    stringaChiavi = stringaChiavi.concat(",");
                                  }
                                  countC++;
                                  var temp2 = JSON.stringify(obj.id);
                                  stringaGeneri = stringaGeneri.concat(temp2);
                                break; }
                            default: break;
                        }
                        i++;
                    }

                    console.log("CHIAVI: " + stringaChiavi);
                    console.log("GENERI: " + stringaGeneri);
                    var reqQuery;

                    if(stringaChiavi == "") {
                        reqQuery = "https://api.themoviedb.org/3/discover/tv?api_key=c3fca9451dd83145763b68b068f2fdc2&language=it-IT&with_genres=" + stringaGeneri + "&page=1";
                    } else if(stringaGeneri == "") {
                        reqQuery = "https://api.themoviedb.org/3/discover/tv?api_key=c3fca9451dd83145763b68b068f2fdc2&language=it-IT&with_keywords=" + stringaChiavi + "&page=1";
                    } else {
                        reqQuery = "https://api.themoviedb.org/3/discover/tv?api_key=c3fca9451dd83145763b68b068f2fdc2&language=it-IT&with_keywords=" + stringaChiavi + "&with_genres=" + stringaGeneri + "&page=1"
                    }
                    console.log(reqQuery);
                    var result = await this.getResult(reqQuery);
                    console.log(result);
                    return await step.beginDialog(RESULT_DIALOG, result);    
                } default: {
                     // The user did not enter input that this bot was built to handle.
                    reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
                    await step.context.sendActivity(reply)
                }
            return await step.replaceDialog(this.id);
        }
    }
    
    async loopStep(step) {
        return await step.replaceDialog(this.id);
    }
}
module.exports.SearchDialog = SearchDialog;
module.exports.SEARCH_DIALOG = SEARCH_DIALOG;