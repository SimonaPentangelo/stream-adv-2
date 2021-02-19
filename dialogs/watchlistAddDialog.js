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
var uS;
var rM;
var login;

const database = client.database('botdb');
const user = database.container('User');
const media = database.container('Media');

class WatchlistAddDialog extends ComponentDialog {
    constructor(luisRecognizer, userProfileAccessor) {
        super(WATCHLISTADD_DIALOG);

        this.userProfileAccessor = userProfileAccessor;
        this.luisRecognizer = luisRecognizer;
        this.addDialog(new WatchlistMenuDialog(this.luisRecognizer, this.userProfileAccessor));
        this.addDialog(new WatchlistDeleteDialog(this.luisRecognizer, this.userProfileAccessor));
        this.addDialog(new LoginDialog(this.userProfileAccessor));
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
        login = step.options.login;
        m = step.options.media;
        console.log(m);
        if(login == undefined) {
            await step.context.sendActivity(`**Per aggiungerlo alla tua watchlist, devi fare il login.**`); 
            return await step.beginDialog(LOGIN_DIALOG); 
        } else {
            return await step.next();
        }
    }
    
    async addStep(step) {
        if(login == undefined) {
            login = step.result.login;
        }
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

            console.log("AGGIUNGOOOOOOO")
            var u = {
                "name": userProfile.name,
                "email": userProfile.email,
                "watchlist": [ m.id_tmdb ]
            };

            const { resource: createdUser } = await user.items.create(u);

            await step.context.sendActivity('**Watchlist aggiornata con successo.**');
            return await step.beginDialog(WATCHLISTMENU_DIALOG, { login : login });
        } else {
            var i = 0;
            while(i < resultUser[0].watchlist.length) {
                if(m.id_tmdb == resultUser[0].watchlist[i]) {
                    await step.context.sendActivity('**Media già presente nella watchlist.**');
                    return await step.endDialog({ res : "RESULT", login : login });
                }
                i++;
            }

            if(resultUser[0].watchlist.length == 10) {
                uS = resultUser;
                rM = resultMedia;
                await step.context.sendActivity('**Hai troppi elementi nella tua watchlist.**');
                return await step.beginDialog(WATCHLISTDELETE_DIALOG, { user : resultUser[0], login : login });
            } else {
                if(resultMedia.length == 0) {
                    const { resource: createdItem } = await media.items.create(m);
                }

                resultUser[0].watchlist.push(m.id_tmdb);
                const { resource : updatedUser } = await user.items.upsert(resultUser[0]);
                await step.context.sendActivity('**Watchlist aggiornata con successo.**');
                return await step.beginDialog(WATCHLISTMENU_DIALOG, { login: login });
            }
        }
    }

    async endStep(step) {
        console.log("FINE WLADD");
        console.log(login);
        if(step.result != undefined) {
            switch(step.result.res) {
                case "BACK": {
                    login = step.result.login;
                    return await step.endDialog({ res : "RESULT", login : login });
                }
                case "WATCHLIST": {
                    login = step.result.login;
                    return await step.endDialog({ res : "RESULT", login : login });
                }
                case "DELETE": {
                    console.log(uS);
                    login = step.result.login;
                    if(rM.length == 0) {
                        const { resource: createdItem } = await media.items.create(m);
                    }
    
                    /*var adding = {
                        "media": m.id_tmdb
                    }*/
    
                    uS[0].watchlist.push(m.id_tmdb);
                    const { resource : updatedUser } = await user.items.upsert(uS[0]);
                    await step.context.sendActivity('**Watchlist aggiornata con successo.**');
                    return await step.endDialog({ res : "RESULT", login: login });
                }
                case "NOTDELETE": {
                    login = step.result.login;
                    await step.context.sendActivity('**La watchlist non è stata modificata.**');
                    return await step.endDialog({ res : "RESULT", login: login });
                }
                case "MAIN": {
                    login = step.result.login;
                    return await step.endDialog({ res : "MAIN", login : login });
                }
            }
        }
    }
 }
module.exports.WatchlistAddDialog = WatchlistAddDialog;
module.exports.WATCHLISTADD_DIALOG = WATCHLISTADD_DIALOG;