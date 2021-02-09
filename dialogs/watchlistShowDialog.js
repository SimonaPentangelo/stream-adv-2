// Read environment variables from .env file
const path = require('path');
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({
    path: ENV_FILE
});

const CosmosClient = require("@azure/cosmos").CosmosClient;
const endpoint = process.env.CosmosDBEndpoint;
const key = process.env.CosmosDBKey;
const client = new CosmosClient({ endpoint, key });

// Import required types from libraries
const {
    ActionTypes,
    ActivityTypes,
    CardFactory,
    MessageFactory,
    InputHints
} = require('botbuilder');

const { ComponentDialog, 
    DialogSet, 
    DialogTurnStatus, 
    TextPrompt, 
    WaterfallDialog 
} = require('botbuilder-dialogs');

const WATCHLISTSHOW_DIALOG = 'WATCHLISTSHOW_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';

const database = client.database('botdb');
const user = database.container('User');
const media = database.container('Media');

var rM;

class WatchlistShowDialog extends ComponentDialog {
    constructor(userProfileAccessor) {
        super(WATCHLISTSHOW_DIALOG);

        this.userProfileAccessor = userProfileAccessor
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.showStep.bind(this),
            this.endStep.bind(this),
            this.loopStep.bind(this)
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
    
    async showStep(step) {
        let userProfile = await this.userProfileAccessor.get(step.context);
        
        const queryUser = {
            query: "SELECT * FROM User u WHERE  u.email = @email",
            parameters: [
              {
                name: "@email",
                value: userProfile.email
              }
            ]
        };
        
        const { resources: resultUser } = await user.items.query(queryUser).fetchAll();
        if (resultUser.length == 1) {
            
            var queryMedia = { query: "", parameters: [] };
            var queryString = "SELECT * FROM Media m WHERE "
            console.log("sono qui a caso");
            var i = 0;
            while(i < resultUser[0].watchlist.length) {
                queryString = queryString.concat("m.id_tmdb = @id" + i + " ");
                if(i + 1 < resultUser[0].watchlist.length) {
                    queryString = queryString.concat("OR ")
                }
                queryMedia.query = queryString;
                queryMedia.parameters.push({ name: "@id" + i, value: resultUser[0].watchlist[i] });
                i++;
            }

            const { resources : resultMedia } = await media.items.query(queryMedia).fetchAll();
            rM = resultMedia;
            var buttons = [];
            var j = 0;
    
            const reply = {
                type: ActivityTypes.Message
            };
    
            while(j < resultMedia.length) {
                console.log(resultMedia[j].title);
                buttons.push({
                    type: ActionTypes.ImBack,
                    title: resultMedia[j].title,
                    value: resultMedia[j].title
                });
                j++;
            }

            const card = CardFactory.heroCard(
                '',
                undefined,
                buttons, {
                    text: 'Ecco la tua watchlist:'
                }
            );

            reply.attachments = [card];
            await step.context.sendActivity(reply);
            return await step.prompt(TEXT_PROMPT, {
                prompt: 'Scrivi "back" per tornare indietro o clicca su uno dei titoli per vedere i dettagli.'
            });
        } 
    }

    async endStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        console.log(option);
        if(option === 'back' /*|| LuisRecognizer.topIntent(luisResult) === 'watchlist'*/) {
            return await step.endDialog();
        } else {
            var i = 0;
            while(i < rM.length) {
                if(rM[i].title === option) {
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
                                                "url": rM[i].image,
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
                                                "text": "" + rM[i].title,
                                                "weight": "Bolder",
                                                "size": "Medium"
                                            },
                                            {
                                                "type": "TextBlock",
                                                "text": "" + rM[i].snippet,
                                                "isSubtle": true,
                                                "wrap": true
                                            },
                                            {
                                                "type": "TextBlock",
                                                "text": "" + rM[i].streaming,
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
                                "title": "Torna indietro",
                                "data": "back"
                            }
                        ]
                    }
            
                    var adptvCard = CardFactory.adaptiveCard(card);
            
                    const messageText = 'Clicca su "back" per tornare alla tua watchlist.';
                    const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            
                    await step.context.sendActivity({
                        text: "Ecco il risultato:",
                        attachments: [adptvCard]
                    });

                    return await step.prompt(TEXT_PROMPT, promptMessage);
                } else {
                    i++;
                }
            }

            reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
            await step.context.sendActivity(reply)
        }
        return await step.replaceDialog(this.id);
    }

    async loopStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        console.log(option);
        if(option === 'back' /*|| LuisRecognizer.topIntent(luisResult) === 'watchlist'*/) {
            return await step.replaceDialog(this.id);
        } else {
            reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
            await step.context.sendActivity(reply);
            return await step.replaceDialog(this.id);
        }
    }
 }
module.exports.WatchlistShowDialog = WatchlistShowDialog;
module.exports.WATCHLISTSHOW_DIALOG = WATCHLISTSHOW_DIALOG;