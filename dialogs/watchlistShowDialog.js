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
    CardFactory,
} = require('botbuilder');

const { ComponentDialog, 
    DialogSet, 
    DialogTurnStatus, 
    TextPrompt, 
    WaterfallDialog 
} = require('botbuilder-dialogs');

const {
    DELETEALL_DIALOG,
    DeleteAllDialog
} = require('./deleteAllDialog');

const WATCHLISTSHOW_DIALOG = 'WATCHLISTSHOW_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';

const database = client.database('botdb');
const user = database.container('User');
const media = database.container('Media');
var login;
var rM;
var userRes;

class WatchlistShowDialog extends ComponentDialog {
    constructor(luisRecognizer, userProfileAccessor) {
        super(WATCHLISTSHOW_DIALOG);

        this.userProfileAccessor = userProfileAccessor
        this.luisRecognizer = luisRecognizer;
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new DeleteAllDialog(this.userProfileAccessor));
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
        login = step.options.login;
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
        console.log(resultUser);
        if (resultUser.length == 1) {
            userRes = resultUser[0];
            if(resultUser[0].watchlist.length == 0) {
                await step.context.sendActivity('**La tua watchlist è vuota.**');
                return await step.endDialog({ res:"BACK", login:login });
            } 
            
            var queryMedia = { query: "", parameters: [] };
            var queryString = "SELECT * FROM Media m WHERE "
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

                buttons.push({});
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
                prompt: 'Dimmi cosa fare, chiedimi di cancellare tutta la lista o clicca su uno dei titoli per vedere i dettagli.'
            });
        } else {
            await step.context.sendActivity('**La tua watchlist è vuota.**');
            return await step.endDialog({ res:"BACK", login:login });
        }
    }

    async endStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        console.log(login);
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Search' || LuisRecognizer.topIntent(luisResult, 'None', 0.6) === 'SearchAdvanced') {
            reply.text = '**Per fare una ricerca devi tornare al menu principale!**';
            await step.context.sendActivity(reply);
            return await step.endDialog({ res : "MAIN", login: login }); 
        } else if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LoginAction') {
            if(login == undefined) {
                reply.text = '**Per effettuare il login, devi tornare al menu principale.**';
                await step.context.sendActivity(reply); 
                return await step.endDialog({ res : "MAIN", login: login });
            } else {
                reply.text = '**Hai già effettuato il login.**';
                await step.context.sendActivity(reply); 
            }
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LogoutAction') {
            if(login == undefined) {
                reply.text = '**Non hai ancora effettuato il login.**';
                await step.context.sendActivity(reply);
            } else {
                reply.text = '**Per fare il logout devi tornare al menu principale!**';
                await step.context.sendActivity(reply);
                return await step.endDialog({ res : "MAIN", login: login });
            } 
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'DeleteAll') {
            return await step.beginDialog(DELETEALL_DIALOG, { login:login, user:userRes }); 
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistShow') {
            return await step.replaceDialog(this.id);
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistAdd' ) {
            reply.text = '**Se vuoi aggiungere un elemento alla lista, devi prima fare una ricerca!**';
            await step.context.sendActivity(reply);
            return await step.endDialog({ res : "MAIN", login: login });
        } else if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistDelete' ) {
            reply.text = '**Se vuoi eliminare un elemento dalla lista, devi tornare al menu per la watchlist!**';
            await step.context.sendActivity(reply);
            return await step.endDialog({ res : "WATCHLIST", login: login });  
        } else if(option === 'back' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Back' ) {
            return await step.endDialog({ res : "BACK", login: login }); 
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Menu' ) {
            return await step.endDialog({ res : "MAIN", login: login }); 
        } else {
            var i = 0;
            while(i < rM.length) {
                if(rM[i].title === option) {
                            
                    var buttons = [{
                        type: ActionTypes.ImBack,
                        title: 'Torna indietro',
                        value: 'back'
                    }
                    ];

                    const coso = '📌';
                    const tele = '📺';
                    const pen = '🖊️';

                    const card = CardFactory.heroCard(
                        coso + ' ' + rM[i].title,
                        [rM[i].image],
                        buttons, {
                            text:pen + ' ' + 'Trama: ' + rM[i].snippet + '\n\n' + tele + ' ' + rM[i].streaming
                        }
                    );
    
                    reply.attachments = [card];
                    await step.context.sendActivity(reply);
                    return await step.prompt(TEXT_PROMPT, {
                        prompt: 'Ecco il risultato!'
                    });
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
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        console.log(option);
        if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Search' || LuisRecognizer.topIntent(luisResult, 'None', 0.6) === 'SearchAdvanced') {
            reply.text = '**Per fare una ricerca devi tornare al menu principale!**';
            await step.context.sendActivity(reply);
            return await step.endDialog({ res : "MAIN", login: login }); 
        } else if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LoginAction') {
            reply.text = '**Hai già effettuato il login.**';
            await step.context.sendActivity(reply); 
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LogoutAction') {
            reply.text = '**Per fare il logout devi tornare al menu principale!**';
            await step.context.sendActivity(reply);
            return await step.endDialog({ res : "MAIN", login: login }); 
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'DeleteAll') {
            return await step.beginDialog(DELETEALL_DIALOG, { login:login });
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistShow') {
            return await step.replaceDialog(this.id);
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistAdd' ) {
            reply.text = '**Se vuoi aggiungere un elemento alla lista, devi prima fare una ricerca!**';
            await step.context.sendActivity(reply);
            return await step.endDialog({ res : "MAIN", login: login });
        } else if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistDelete' ) {
            reply.text = '**Se vuoi eliminare un elemento dalla lista, devi tornare al menu per la watchlist!**';
            await step.context.sendActivity(reply);
            return await step.endDialog({ res : "WATCHLIST", login: login });  
        } else if(option === 'back' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Back' ) {
            return await step.replaceDialog(this.id);
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Menu' ) {
            return await step.endDialog({ res : "MAIN", login: login }); 
        } else {
            reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
            await step.context.sendActivity(reply);
        }
        return await step.replaceDialog(this.id);
    }
 }
module.exports.WatchlistShowDialog = WatchlistShowDialog;
module.exports.WATCHLISTSHOW_DIALOG = WATCHLISTSHOW_DIALOG;