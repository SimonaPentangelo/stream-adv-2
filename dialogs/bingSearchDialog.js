// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

require('dotenv').config({ path: 'C:\Users\Simona\Desktop\stream-adv\.env' });

var request = require("request");
var AdaptiveCards = require("adaptivecards");

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

class BingDialog extends ComponentDialog {
    constructor(luisRecognizer, userProfileAccessor) {
        super(BING_DIALOG);
    
        this.luisRecognizer = luisRecognizer;
        this.userProfileAccessor = userProfileAccessor;
        this.addDialog(new TextPrompt(TEXT_PROMPT));
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
                    'q=' + result + '&customconfig=' + CUSTOM_CONFIG + '&mkt=en-US',
                headers: {
                    'Ocp-Apim-Subscription-Key' : BING_KEY
                }
            }
            request(info, function(error, response, body){
                var searchResponse = JSON.parse(body);
                webPage = searchResponse.webPages.value[0];
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
                if(s.results == undefined || s.results.IT == undefined || s.results.IT.flatrate[0].provider_name == undefined) {
                    streaming = "Streaming non disponibile.";
                } else if(s.results.IT != undefined){
                    streaming = "In streaming su: " + s.results.IT.flatrate[0].provider_name;
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
            var webPage = await this.getMedia();
            url = webPage.url;
            console.log("URL: " + url);
            if(type == 'movie') {
                id = url.substring(33, 40);
                console.log('ID: ' + id);
            } else {
                id = url.substring(30, 34);
                console.log('ID: ' + id);
            }
            console.log(webPage.openGraphImage.contentUrl.substring(21));
            var img = webPage.openGraphImage.contentUrl.substring(21);
            image = "https://www.themoviedb.org/"
            image = image.concat(img);
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
        let userProfile = await this.userProfileAccessor.get(step.context);
        const reply = {
            type: ActivityTypes.Message
        };
        const option = JSON.stringify(step.context.activity.text);
        if (option === "\"search\"") {
            count = 0;
            return await step.endDialog({ res : -1 });
        } else if (option === "\"add\"") {
            if(userProfile != undefined) {
                //per ora nulla
            } else {
                reply.text = `Per aggiungerlo alla tua watchlist, devi fare il login.`;
                await step.context.sendActivity(reply); 
                return await step.beginDialog(LOGIN_DIALOG);   
            }
        } else if(option === "\"back\"") {
            count = 0;
            return await step.endDialog({ res : 1 });
        } else {
            // The user did not enter input that this bot was built to handle.
            reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
            await step.context.sendActivity(reply)
        }
        return await step.replaceDialog(this.id);
    }

    async endStep(step) {
        console.log(step.result.res);
        count = 0;
        if(step.result.res == 1) {
            return await step.replaceDialog(this.id);
        } else {
            return await step.endDialog({ res : 1 });
        }
    }

}
module.exports.BingDialog = BingDialog;
module.exports.BING_DIALOG = BING_DIALOG;
