// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

require('dotenv').config({ path: 'C:\Users\Simona\Desktop\stream-adv\.env' });

const { LuisRecognizer } = require('botbuilder-ai');

// Import required types from libraries
const {
    ActionTypes,
    ActivityTypes,
    CardFactory
} = require('botbuilder');

const { ComponentDialog, 
        DialogSet, 
        DialogTurnStatus, 
        TextPrompt, 
        WaterfallDialog 
} = require('botbuilder-dialogs');

const {
    WATCHLISTDELETE_DIALOG,
    WatchlistDeleteDialog
} = require('./watchlistDeleteDialog');

const {
    WATCHLISTSHOW_DIALOG,
    WatchlistShowDialog
} = require('./watchlistShowDialog');

const {
    LOGIN_DIALOG,
    LoginDialog
} = require('./loginDialog');

const {
    DELETEALL_DIALOG,
    DeleteAllDialog
} = require('./deleteAllDialog');

const WATCHLISTMENU_DIALOG = 'WATCHLISTMENU_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
var login;
var count = 0;

class WatchlistMenuDialog extends ComponentDialog {
    constructor(luisRecognizer, userProfileAccessor) {
        super(WATCHLISTMENU_DIALOG);

        this.userProfileAccessor = userProfileAccessor;
        this.luisRecognizer = luisRecognizer;
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new LoginDialog(this.userProfileAccessor));
        this.addDialog(new DeleteAllDialog(this.userProfileAccessor));
        this.addDialog(new WatchlistDeleteDialog(this.luisRecognizer, this.userProfileAccessor));
        this.addDialog(new WatchlistShowDialog(this.luisRecognizer, this.userProfileAccessor));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.checkStep.bind(this),
            this.menuStep.bind(this),
            this.optionsStep.bind(this),
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

    async checkStep(step) {
        if(count == 0) {
            login = step.options.login;
            count++;
        }
        if(login == undefined) {
            await step.context.sendActivity(`**Per gestire la tua watchlist, devi fare il login.**`); 
            return await step.beginDialog(LOGIN_DIALOG); 
        } else {
            return await step.next();
        }
    }

        async menuStep(step) {
            if(login == undefined) {
                login = step.result.login;
            }
                const reply = {
                    type: ActivityTypes.Message
                };
                var buttons = [{
                        type: ActionTypes.ImBack,
                        title: 'La tua watchlist',
                        value: 'show'
                    }, {},
                    {
                        type: ActionTypes.ImBack,
                        title: 'Cancella un elemento',
                        value: 'delete'
                    }, {},
                    {
                        type: ActionTypes.ImBack,
                        title: 'Cancella tutta la lista',
                        value: 'deleteAll'
                    }, {},
                    {
                        type: ActionTypes.ImBack,
                        title: 'Torna indietro',
                        value: 'back'
                    }
                    
                ];

                const card = CardFactory.heroCard(
                    '',
                    undefined,
                    buttons, {
                        text: 'Watchlist\'s menu'
                    }
                );
                reply.attachments = [card];
                await step.context.sendActivity(reply);
                return await step.prompt(TEXT_PROMPT, {
                    prompt: 'Seleziona un\'opzione dal menu o dimmi cosa vorresti fare per proseguire!'
                });
        }

     // Forwards to the correct dialog based on the menu option or the intent recognized by LUIS
     async optionsStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        console.log("WATCHLIST MENU");
        console.log(luisResult);
        if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Search' || LuisRecognizer.topIntent(luisResult, 'None', 0.6) === 'SearchAdvanced') {
            reply.text = '**Per fare una ricerca devi tornare al menu principale!**';
            await step.context.sendActivity(reply);
            count = 0;
            return await step.endDialog({ res : "MAIN", login: login }); 
        } else if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LoginAction') {
            reply.text = '**Hai già effettuato il login.**';
            await step.context.sendActivity(reply)    
        } else if(option === 'logout' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LogoutAction') {
            reply.text = '**Per fare il logout devi tornare al menu principale!**';
            await step.context.sendActivity(reply);
            count = 0;
            return await step.endDialog({ res : "MAIN", login: login }); 
        } else if(option === 'deleteAll' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'DeleteAll') {
            return await step.beginDialog(DELETEALL_DIALOG, { login:login }); 
        } else if(option == "show" || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistShow') {
            console.log("SONO NEL POSTO GIUSTO");
            console.log(login);
            return await step.beginDialog(WATCHLISTSHOW_DIALOG, { login: login });
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistAdd' ) {
            reply.text = '**Se vuoi aggiungere un elemento alla lista, devi prima fare una ricerca!**';
            await step.context.sendActivity(reply);
            count = 0;
            return await step.endDialog({ res : "MAIN", login: login });
        } else if (option === 'delete' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistDelete' ) {
            return await step.beginDialog(WATCHLISTDELETE_DIALOG, { login:login });    
        } else if(option === 'back' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Back' ) {
            count = 0;
            return await step.endDialog({ res : "BACK", login: login }); 
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Menu' ) {
            count = 0;
            return await step.endDialog({ res : "MAIN", login: login }); 
        } else {
            reply.text = '**Sembra che tu abbia digitato un comando che non conosco! Riprova.**';
            await step.context.sendActivity(reply);
        }
        return await step.replaceDialog(this.id);
    }

    async loopStep(step) {
        console.log("FINE WLMENU");
        console.log(login);
        if(step.result != undefined) {
            switch(step.result.res) {
                case "MAIN": {
                    login = step.result.login
                    count = 0;
                    return await step.endDialog({ res : "MAIN", login: login }); 
                }
                case "WATCHLIST": {
                    login = step.result.login;
                    break;
                }
                case "BACK": {
                    login = step.result.login
                    break;
                }
            }
            console.log(login);
            count++;
            return await step.replaceDialog(this.id);
        }
    }
}
module.exports.WatchlistMenuDialog = WatchlistMenuDialog;
module.exports.WATCHLISTMENU_DIALOG = WATCHLISTMENU_DIALOG;