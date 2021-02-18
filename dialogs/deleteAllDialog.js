// Read environment variables from .env file
const path = require('path');
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({
    path: ENV_FILE
});

const { LuisRecognizer } = require('botbuilder-ai');

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


const DELETEALL_DIALOG = 'DELETEALL_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
var login;
var flag;
var userRes;
var rM;

const database = client.database('botdb');
const user = database.container('User');
const media = database.container('Media');

class DeleteAllDialog extends ComponentDialog {
    constructor(userProfileAccessor) {
        super(DELETEALL_DIALOG);

        this.userProfileAccessor = userProfileAccessor
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.listStep.bind(this),
            this.deleteStep.bind(this),
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
        login = step.options.login;
        if(step.options.user == undefined) {
        flag = false;
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
            flag = true;
            userRes = step.options.user;
            console.log(userRes);
        } 

        if(userRes.watchlist.length == 0) {
            await step.context.sendActivity('**Non hai elementi nella watchlist!**');
            return await step.endDialog({ res : "NOTDELETE", login:login });
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
        return await step.next();
    }

    async deleteStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        
        var i = 0;
        while(i < rM.length) {
                
            const checkQuery = {
                query: "SELECT COUNT(c) AS Count FROM c IN User.watchlist WHERE c = @id_tmdb",
                parameters: [
                        {
                            name: "@id_tmdb",
                            value: rM[i].id_tmdb
                        }
                    ]
                };

                const { resources: resultCheck } = await user.items.query(checkQuery).fetchAll();
                console.log("Conteggio: " + resultCheck[0].Count);
                if(resultCheck[0].Count == 1) {
                    const deleteResponse = await media.item(rM[i].id, rM[i].id_tmdb).delete();
                    console.log(deleteResponse.item.id);
                }
                i++;
        }

        
        userRes.watchlist = [];
        const { resource : updatedUser } = await user.items.upsert(userRes);
        await step.context.sendActivity('**Watchlist cancellata con successo.**');
        return await step.endDialog({ res:"DELETE", login:login });
    }
}
module.exports.DeleteAllDialog = DeleteAllDialog;
module.exports.DELETEALL_DIALOG = DELETEALL_DIALOG;