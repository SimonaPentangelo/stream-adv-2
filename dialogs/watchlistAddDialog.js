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


const WATCHLISTADD_DIALOG = 'WATCHLISTADD_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
var database;
var user;
var media;

/*const { WATCHLISTMENU_DIALOG,
    WatchlistMenuDialog } = require('./watchlistMenuDialog');*/
class WatchlistAddDialog extends ComponentDialog {
    constructor(userProfileAccessor) {
        super(WATCHLISTADD_DIALOG);

        this.userProfileAccessor = userProfileAccessor
        //this.addDialog(new WatchlistMenuDialog(this.userProfileAccessor));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.addStep.bind(this)
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

        database = await client.databases.createIfNotExists({ id: 'botdb' });
        user  = await database.containers.createIfNotExists({ id: 'User' });
        media = await database.containers.createIfNotExists({ id: 'Media' });

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }
    
    async addStep(step) {
        let userProfile = await this.userProfileAccessor.get(step.context);
        var m = step.option.media;

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
            query: "SELECT * FROM Media m WHERE m.id_tmbd = @id",
            parameters: [
              {
                name: "@id",
                value: m.id_tmdb
              }
            ]
        };
        
        const { resources: resultUser } = await user.items.query(queryUser).fetchAll();
        const { resources: resultMedia } = await user.items.query(queryMedia).fetchAll();

        if (resultUser.length == 0) {
            //devo aggiungere l'utente ed il media alla lista
            if(resultMedia.length == 0) {
                await new Promise(function(resolve, reject) {
                    resolve(media.container.create(m));
                });
            }

            var u = {
                "name": userProfile.name,
                "email": userProfile.email,
                "watchlist": [
                    {
                        "media": m.id_tmdb
                    }
                ]
            };

            await new Promise(function(resolve, reject) {
                resolve(user.container.create(u));
            });

            await step.context.sendActivity('Watchlist aggiornata con successo.');
            //return await step.beginDialog(WATCHLISTMENU_DIALOG);
        } else {
            if(resultUser[0].watchlist.length == 10) {
                await step.context.sendActivity('Hai troppi elementi nella tua watchlist.');
                //return await step.beginDialog(WATCHLISTMENU_DIALOG);
            } else {
                if(resultMedia.length == 0) {
                    await new Promise(function(resolve, reject) {
                        resolve(media.container.create(m));
                    });
                }

                var adding = {
                    "media": m.id_tmdb
                }

                resultUser[0].watchlist.push(adding);
                const { resource: updatedUser } = await user.items.upsert(resultUser[0]);
                await step.context.sendActivity('Watchlist aggiornata con successo.');
                //return await step.beginDialog(WATCHLISTMENU_DIALOG);
            }
            //se sono 10, gli dico che non può aggiungerne altri e lo rimando allo show watchlist
            //altrimenti aggiungo il media
        }
    }
 }
module.exports.WatchlistAddDialog = WatchlistAddDialog;
module.exports.WATCHLISTADD_DIALOG = WATCHLISTADD_DIALOG;