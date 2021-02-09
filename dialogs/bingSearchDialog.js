// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

require('dotenv').config({ path: 'C:\Users\Simona\Desktop\stream-adv\.env' });

var request = require("request");

// Import required types from libraries
const {
    MessageFactory,
    ActivityTypes,
    CardFactory,
    InputHints
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
var url;
var image;
var snippet;
var streaming;
var id;
var idFound;

class BingDialog extends ComponentDialog {
    constructor(luisRecognizer, userProfileAccessor) {
        super(BING_DIALOG);
    
        this.luisRecognizer = luisRecognizer;
        this.userProfileAccessor = userProfileAccessor;
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WatchlistAddDialog(userProfileAccessor));
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
                var i = 0;
                while(i < searchResponse.webPages.value.length) {
                    if(searchResponse.webPages.value[i].displayUrl.includes(idFound) && searchResponse.webPages.value[i].displayUrl.includes(type) && !searchResponse.webPages.value[i].displayUrl.includes("season")) {
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
                } else if(s.results.IT != undefined){
                    var i = 0;
                    var str = "";
                    while(s.results.IT.flatrate[i] != undefined) {
                        if(i != 0) {
                            str = str.concat(", ");
                        }
                        str = str.concat(s.results.IT.flatrate[i].provider_name);
                        i++;
                    }
                    streaming = "In streaming su: " + str;
                }
                resolve(streaming);
            });
        });
    }

    async searchStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        if(count == 0) {
            result = step.options.title;
            type = step.options.media;
            idFound = step.options.id;
            var webPage = await this.getMedia();
            url = webPage.url;
            console.log("URL: " + url);
            id = idFound;
            console.log(webPage.openGraphImage.contentUrl.substring(21));
            if(webPage.openGraphImage.contentUrl.includes("bing")) {
                var img = webPage.openGraphImage.contentUrl.substring(21);
                image = "https://www.themoviedb.org/"
                image = image.concat(img);
            } else {
                image = webPage.openGraphImage.contentUrl;
            }
            console.log('IMMAGINE: ' + image);
            snippet = webPage.snippet;
            streaming = await this.getStreaming();
            count++;
        }
        var card = {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.0",
            "body": [
                {
                    "type": "ColumnSet",
                    "columns": [
                        {
                            "type": "Column",
                            "width": 1,
                            "items": [
                                {
                                    "type": "Image",
                                    "url": image,
                                    "size": "auto",
                                    "horizontalAlignment": "Right"
                                }
                            ]
                        },
                        {
                            "type": "Column",
                            "width": 2,
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": "" + result,
                                    "weight": "Bolder",
                                    "size": "Medium"
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "" + snippet,
                                    "isSubtle": true,
                                    "wrap": true
                                },
                                {
                                    "type": "TextBlock",
                                    "text": "" + streaming,
                                    "isSubtle": true,
                                    "wrap": true,
                                    "size": "Small",
                                    "weight": "Bolder"
                                }
                            ],
                            "horizontalAlignment": "Right"
                        }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.Submit",
                    "title": "Aggiungi alla watchlist",
                    "data": "add"
                },
                {
                    "type": "Action.Submit",
                    "title": "Fai una nuova ricerca",
                    "data": "search"
                },
                {
                    "type": "Action.Submit",
                    "title": "Torna indietro",
                    "data": "back"
                }
            ]
        }

        var adptvCard = CardFactory.adaptiveCard(card);

        const messageText = 'Seleziona un\'opzione.';
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);

        await step.context.sendActivity({
            text: "Ecco il risultato:",
            attachments: [adptvCard]
        });

        return await step.prompt(TEXT_PROMPT, promptMessage);
    }  

    async branchStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = JSON.stringify(step.context.activity.text);
        if (option === "\"search\"") {
            count = 0;
            console.log("search");
            return await step.endDialog({ res : "SEARCH" });
        } else if (option === "\"add\"") {
                var m = {
                    "id_tmdb": id,
                    "title": result,
                    "type": type,
                    "image": image,
                    "snippet": snippet,
                    "streaming": streaming
                }
                console.log("SEARCH " + JSON.stringify(m));
                return await step.beginDialog(WATCHLISTADD_DIALOG, { media : m });   
        } else if(option === "\"back\"") {
            count = 0;
            console.log("result");
            return await step.endDialog({ res : "RESULT" });
        } else {
            // The user did not enter input that this bot was built to handle.
            reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
            await step.context.sendActivity(reply)
        }
        return await step.replaceDialog(this.id);
    }

    async endStep(step) {
        console.log("END BING SEARCH");
        if(step.result != undefined) {
            if(step.result.res == "RESULT") {
                count = 0;
                return await step.endDialog({ res : "RESULT" });
            }
        } else {
            return await step.replaceDialog(this.id);
        }
    }

}
module.exports.BingDialog = BingDialog;
module.exports.BING_DIALOG = BING_DIALOG;
