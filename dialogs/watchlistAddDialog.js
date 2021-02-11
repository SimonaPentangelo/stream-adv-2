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
    ActivityTypes
} = require('botbuilder');

const { ComponentDialog, 
        DialogSet, 
        DialogTurnStatus,
        WaterfallDialog 
} = require('botbuilder-dialogs');

const {
    LOGIN_DIALOG,
    LoginDialog
} = require('./loginDialog');

const { 
    WATCHLISTMENU_DIALOG,
    WatchlistMenuDialog 
} = require('./watchlistMenuDialog');

const { 
    WATCHLISTDELETE_DIALOG,
    WatchlistDeleteDialog 
} = require('./watchlistDeleteDialog');

const WATCHLISTADD_DIALOG = 'WATCHLISTADD_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
var m;
var u;
var rM;

const database = client.database('botdb');
const user = database.container('User');
const media = database.container('Media');

class WatchlistAddDialog extends ComponentDialog {
    constructor(userProfileAccessor) {
        super(WATCHLISTADD_DIALOG);

        this.userProfileAccessor = userProfileAccessor
        this.addDialog(new WatchlistMenuDialog(this.userProfileAccessor));
        this.addDialog(new LoginDialog(userProfileAccessor));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.checkStep.bind(this),
            this.addStep.bind(this),
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

    async checkStep(step) {
        console.log("ADD DIALOG CIAO!");
        m = step.options.media;
        console.log(m);
        let userProfile = await this.userProfileAccessor.get(step.context);
        console.log(userProfile == undefined);
        if(userProfile == undefined) {
                await step.context.sendActivity(`Per aggiungerlo alla tua watchlist, devi fare il login.`); 
                return await step.beginDialog(LOGIN_DIALOG); 
        } else {
            return await step.next();
        }
    }
    
    async addStep(step) {
        console.log("add step");
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

        const queryMedia = {
            query: "SELECT * FROM Media m WHERE m.id_tmdb = @id",
            parameters: [
              {
                name: "@id",
                value: m.id_tmdb
              }
            ]
        };
        
        console.log("HELP ME PLS");
        const { resources: resultUser } = await user.items.query(queryUser).fetchAll();
        const { resources: resultMedia } = await media.items.query(queryMedia).fetchAll();
        console.log(resultUser);
        console.log(resultUser.length == 0);
        if (resultUser.length == 0) {
            //devo aggiungere l'utente ed il media alla lista
            if(resultMedia.length == 0) {
                const { resource: createdItem } = await media.items.create(m);
            }

            var u = {
                "name": userProfile.name,
                "email": userProfile.email,
                "watchlist": [  m.id_tmd ]
            };

            const { resource: createdUser } = await user.items.create(u);

            await step.context.sendActivity('**Watchlist aggiornata con successo.**');
            return await step.beginDialog(WATCHLISTMENU_DIALOG);
        } else {

            var i = 0;
            while(i < resultUser[0].watchlist.length) {
                if(m.id_tmdb == resultUser[0].watchlist[i]) {
                    await step.context.sendActivity('**Media già presente nella watchlist.**');
                    return await step.endDialog({ res : "RESULT" });
                }
                i++;
            }

            if(resultUser[0].watchlist.length == 10) {
                u = resultUser[0];
                rM = resultMedia;
                await step.context.sendActivity('Hai troppi elementi nella tua watchlist.');
                return await step.beginDialog(WATCHLISTDELETE_DIALOG, { user : resultUser[0] });
            } else {
                if(resultMedia.length == 0) {
                    const { resource: createdItem } = await media.items.create(m);
                }

                resultUser[0].watchlist.push(m.id_tmdb);
                const { resource : updatedUser } = await user.items.upsert(resultUser[0]);
                await step.context.sendActivity('**Watchlist aggiornata con successo.**');
                return await step.beginDialog(WATCHLISTMENU_DIALOG);
            }
        }
    }

    async endStep(step) {
        if(step.result != undefined) {
            if(step.result.res == "WATCHLIST") {
                return await step.endDialog({ res : "RESULT" });
            } else if(step.result.res == "DELETE") {
                if(rM.length == 0) {
                    const { resource: createdItem } = await media.items.create(m);
                }

                var adding = {
                    "media": m.id_tmdb
                }

                u.watchlist.push(adding);
                const { resource : updatedUser } = await user.items.upsert(u);
                await step.context.sendActivity('**Watchlist aggiornata con successo.**');
                return await step.endDialog({ res : "RESULT" });
            } else if(step.result.res == "NOTDELETE") {
                await step.context.sendActivity('**La watchlist non è stata modificata.**');
                return await step.endDialog({ res : "RESULT" });
            }
        }
    }
 }
module.exports.WatchlistAddDialog = WatchlistAddDialog;
module.exports.WATCHLISTADD_DIALOG = WATCHLISTADD_DIALOG;