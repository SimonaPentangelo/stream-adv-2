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
    CardFactory
} = require('botbuilder');

const { ComponentDialog, 
        DialogSet, 
        DialogTurnStatus,
        WaterfallDialog,
        TextPrompt
} = require('botbuilder-dialogs');


const WATCHLISTDELETE_DIALOG = 'WATCHLISTDELETE_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
var userRes;
var rM;

const database = client.database('botdb');
const user = database.container('User');
const media = database.container('Media');

class WatchlistDeleteDialog extends ComponentDialog {
    constructor(userProfileAccessor) {
        super(WATCHLISTDELETE_DIALOG);

        this.userProfileAccessor = userProfileAccessor
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.listStep.bind(this),
            this.deleteStep.bind(this),
            this.branchStep.bind(this)
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

    async listStep(step) {
        if(step.options.user == undefined) {
        let userProfile = await this.userProfileAccessor.get(step.context);
         //controllo se l'utente è nel db
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
        userRes = resultUser[0];
        console.log(userRes);
        console.log(userRes.watchlist);
        } else {
            userRes = step.options.user;
            console.log(userRes);
        } 

        if(userRes.watchlist.length == 0) {
            await step.context.sendActivity('Non hai elementi nella watchlist!');
            return await step.endDialog({ res : "NOTDELETE" });
        }
        var queryMedia = { query: "", parameters: [] };
        var queryString = "SELECT * FROM Media m WHERE "
        var i = 0;
        while(i < userRes.watchlist.length) {
            queryString = queryString.concat("m.id_tmdb = @id" + i + " ");
            if(i + 1 < userRes.watchlist.length) {
                queryString = queryString.concat("OR ")
            }
            queryMedia.query = queryString;
            queryMedia.parameters.push({ name: "@id" + i, value: userRes.watchlist[i] });
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
            prompt: 'Scrivi "**back**" per tornare indietro o clicca su uno dei titoli per cancellarlo.'
        });
    }

    async deleteStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        console.log(option);
        if(option === 'back' /*|| LuisRecognizer.topIntent(luisResult) === 'watchlist'*/) {
            return await step.endDialog({ res : "NOTDELETE" });
        } else {
            var i = 0;
            while(i < rM.length) {
                if(rM[i].title === option) {
                    const checkQuery = {
                        query: "SELECT COUNT(c) AS Count FROM c IN User.watchlist WHERE c = @id_tmdb",
                        parameters: [
                          {
                            name: "@id_tmdb",
                            value: rM[i].id_tmdb
                          }
                        ]
                    };
                   
                    var index = userRes.watchlist.indexOf(rM[i].id_tmdb);
                    console.log("Index: " + index);
                    userRes.watchlist.splice(index, 1);
                    const { resource : updatedUser } = await user.items.upsert(userRes);

                    const { resources: resultCheck } = await user.items.query(checkQuery).fetchAll();
                    console.log("Conteggio: " + resultCheck[0].Count);
                    if(resultCheck[0].Count == 0) {
                        const deleteResponse = await media.item(rM[i].id, rM[i].id_tmdb).delete();
                        console.log(deleteResponse.item.id);
                    }

                    await step.context.sendActivity('Watchlist aggiornata con successo.');
                    if(userRes.watchlist.length == 0) {
                        return await step.endDialog({ res : "DELETE" });
                    }
                    return await step.prompt(TEXT_PROMPT, {
                        prompt: 'Vuoi cancellare altri elementi? (**Sì**/**No**)'
                    });
                } else {
                    i++;
                }
            }
        }

        reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
        await step.context.sendActivity(reply);
        return await step.replaceDialog(this.id);
    }

    async branchStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        console.log(option);
        if(option === 'Sì' || option === "s" || option === "S" || option === "sì" || option === "si" || option === "SI" || option === "Si" /*|| LuisRecognizer.topIntent(luisResult) === 'watchlist'*/) {
            return await step.replaceDialog(this.id);
        } else if(option === 'No' || option === "n" || option === "N" || option === "no" || option === "NO") {
            return await step.endDialog({ res : "DELETE" });
        } 

        reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
        await step.context.sendActivity(reply);
        return await step.replaceDialog(this.id);
    }

}
module.exports.WatchlistDeleteDialog = WatchlistDeleteDialog;
module.exports.WATCHLISTDELETE_DIALOG = WATCHLISTDELETE_DIALOG;