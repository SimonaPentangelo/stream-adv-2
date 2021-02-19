// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

require('dotenv').config({ path: 'C:\Users\Simona\Desktop\stream-adv\.env' });
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

const { LuisRecognizer } = require('botbuilder-ai');

var request = require("request");

// Import required types from libraries
const {
    ActivityTypes,
    CardFactory,
    ActionTypes
} = require('botbuilder');


const { ComponentDialog, 
        DialogSet, 
        DialogTurnStatus, 
        WaterfallDialog, 
        TextPrompt
} = require('botbuilder-dialogs');

const {
    LOGIN_DIALOG,
    LoginDialog
} = require('./loginDialog');

const {
    WATCHLISTADD_DIALOG,
    WatchlistAddDialog
} = require('./watchlistAddDialog');


const BING_DIALOG = 'BING_DIALOG';;
const TEXT_PROMPT = 'TEXT_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const BING_KEY = process.env.BingSearchAPI;
const CUSTOM_CONFIG = '513afd06-f664-4de9-b2a1-8664cb1e9990';
const KEY_TMDB = process.env.TheMovieDBAPI;
var count = 0;
var type;
var result;
var title;
var image;
var snippet;
var streaming;
var id;
var idFound;
var login;

class BingDialog extends ComponentDialog {
    constructor(luisRecognizer, userProfileAccessor) {
        super(BING_DIALOG);
    
        this.luisRecognizer = luisRecognizer;
        this.userProfileAccessor = userProfileAccessor;
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WatchlistAddDialog(this.luisRecognizer, this.userProfileAccessor));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.searchStep.bind(this),
            this.branchStep.bind(this),
            this.endStep.bind(this)
        ]));
        this.initialDialogId = WATERFALL_DIALOG;
    }

    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);
        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    getMedia() {
        var webPage;
        return new Promise(function(resolve, reject) {
            var info = {
                url: 'https://api.bing.microsoft.com/v7.0/custom/search?' + 
                    'q=' + idFound + '&customconfig=' + CUSTOM_CONFIG + '&mkt=en-US',
                headers: {
                    'Ocp-Apim-Subscription-Key' : BING_KEY
                }
            }
            request(info, function(error, response, body){
                var searchResponse = JSON.parse(body);
                console.log(searchResponse);
                var i = 0;
                while(i < searchResponse.webPages.value.length) {
                    if(searchResponse.webPages.value[i].displayUrl.includes(idFound) && searchResponse.webPages.value[i].displayUrl.includes(type) && !searchResponse.webPages.value[i].displayUrl.includes("season") && !searchResponse.webPages.value[i].displayUrl.includes("discuss")) {
                        webPage = searchResponse.webPages.value[i];
                        break;
                    } else {
                        i++;
                    }
                }
                console.log("QUESTO DOVREBBE ESSE IL RISULTATO: " + JSON.stringify(webPage));
                resolve(webPage);
            });
        });
    }

    getStreaming() {
        var streaming;
        return new Promise(function(resolve, reject) {
            request({
                method: 'GET',
                url: 'https://api.themoviedb.org/3/' + type + '/' + id + '/watch/providers?api_key=' + KEY_TMDB,
                headers: {
                'Content-Type': 'application/json',
                }}, function (error, response, body) {
                console.log('https://api.themoviedb.org/3/' + type + '/' + id + '/watch/providers?api_key=' + KEY_TMDB);
                var s = JSON.parse(body);
                if(s.results == undefined || s.results.IT == undefined || s.results.IT.flatrate == undefined) {
                    streaming = "Streaming non disponibile.";
                    console.log(streaming);
                } else if(s.results.IT != undefined){
                    var i = 0;
                    var str = "";
                    console.log("SONO PRIMA DEL WHILE");
                    while(s.results.IT.flatrate[i] != undefined) {
                        if(i != 0) {
                            str = str.concat(", ");
                        }
                        str = str.concat(s.results.IT.flatrate[i].provider_name);
                        i++;
                    }
                    streaming = "In streaming su: " + str;
                    console.log(streaming);
                }
                resolve(streaming);
            });
        });
    }

    checkUrl(url) 
    {
        var http = new XMLHttpRequest();
        http.open('HEAD', url, false);
        http.send();
        return http.status!=404;
    }

    async searchStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        if(count == 0) {
            login = step.options.login;
            result = step.options.media;
            idFound = result.id;
            id = result.id;
            title = result.name;
            type = result.type;
            if(this.checkUrl(result.image)) {
                image = result.image;
            } else {
                image = "Locandina non disponibile.";
            }
            console.log('IMMAGINE: ' + image);
            snippet = result.snippet;
            streaming = await this.getStreaming();
            count++;
        }

        var buttons = [{
            type: ActionTypes.ImBack,
            title: 'Aggiungi alla watchlist',
            value: 'add'
            },{},{
                type: ActionTypes.ImBack,
                title: 'Nuova ricerca',
                value: 'search'
            },{},{
                type: ActionTypes.ImBack,
                title: 'Torna indietro',
                value: 'back'
            }
        ];

        if(image === "Locandina non disponibile.") {
            const coso = '📌';
            const tele = '📺';
            const pen = '🖊️';
            const card = CardFactory.heroCard(
                image + '\n\n' + coso + ' ' + title,
                undefined,
                buttons, {
                    text: pen + ' ' + 'Trama: ' + snippet + '\n\n' + tele + ' ' + streaming
                }
            );

            reply.attachments = [card];
            await step.context.sendActivity(reply);
            return await step.prompt(TEXT_PROMPT, {
                prompt: 'Seleziona un\'opzione dal menu per proseguire!'
            });
        } else {
            const coso = '📌';
            const tele = '📺';
            const pen = '🖊️';
            const card = CardFactory.heroCard(
                coso + ' ' + title,
                [image],
                buttons, {
                    text: pen + ' ' + 'Trama: ' + snippet + '\n\n' + tele + ' ' + streaming
                }
            );

            reply.attachments = [card];
            await step.context.sendActivity(reply);
            return await step.prompt(TEXT_PROMPT, {
                prompt: 'Seleziona un\'opzione dal menu per proseguire!'
            });
        }
    }  

    async branchStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        //const option = JSON.stringify(step.context.activity.text);
        const option = step.result;
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        console.log(option);
        if (option === 'search' ||LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Search' || LuisRecognizer.topIntent(luisResult, 'None', 0.6) === 'SearchAdvanced') {
            count = 0;
            console.log("search");
            return await step.endDialog({ res : "SEARCH", login: login });
        } else if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LoginAction') {
            count = 0;
            reply.text = '**Devi tornare al menu principale per effettuare il login.**';
            await step.context.sendActivity(reply); 
            return await step.endDialog({ res : "MAIN", login: login });
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LogoutAction') {
            count = 0;
            reply.text = '**Per fare il logout devi tornare al menu principale!**';
            await step.context.sendActivity(reply);
            return await step.endDialog({ res : "MAIN", login: login }); 
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'DeleteAll') {

        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistShow') {
           
        } else if(option === 'add' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistAdd' ) {
            count = 0;
            var m = {
                "id_tmdb": id,
                "title": title,
                "type": type,
                "image": image,
                "snippet": snippet,
                "streaming": streaming
            }
            console.log("SEARCH " + JSON.stringify(m));
            return await step.beginDialog(WATCHLISTADD_DIALOG, { login: login, media : m });   
        } else if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistDelete') {
            count = 0;
            reply.text = '**Se vuoi eliminare un elemento dalla lista, devi tornare al menu per la watchlist!**';
            await step.context.sendActivity(reply);
            return await step.endDialog({ res : "MAIN", login: login });  
        } else if(option === 'back' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Back' ) {
            count = 0;
            console.log("result");
            return await step.endDialog({ res : "RESULT", login: login });
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Menu' ) {
            count = 0;
            return await step.endDialog({ res : "MAIN", login: login }); 
        } else {
            reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
            await step.context.sendActivity(reply);
        }
        return await step.replaceDialog(this.id);
    }

    async endStep(step) {
        console.log("FINE BSEARCH");
        console.log(login);
        if(step.result != undefined) {
            if(step.result.res == "RESULT") {
                count = 0;
                return await step.endDialog({ res : "RESULT", login: login });
            } else if(step.result.res == "MAIN") {
                count = 0;
                return await step.endDialog({ res : "MAIN", login: login });
            } else if(step.result.res == "BACK") {
                return await step.replaceDialog(this.id);
            }
        } else {
            return await step.replaceDialog(this.id);
        }
    }

}
module.exports.BingDialog = BingDialog;
module.exports.BING_DIALOG = BING_DIALOG;