// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

require('dotenv').config({ path: 'C:\Users\Simona\Desktop\stream-adv\.env' });

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

const {
    SEARCH_DIALOG,
    SearchDialog
} = require('./searchDialog');

const {
    LOGIN_DIALOG,
    LoginDialog
} = require('./loginDialog');

/*
const {
    WATCHLISTDELETE_DIALOG,
    WatchlistDeleteDialog
} = require('./watchlistDeleteDialog');
 */

/*
const {
    WATCHLISTSHOW_DIALOG,
    WatchlistShowDialog
} = require('./watchlistShowDialog');
 */

const WATCHLISTMENU_DIALOG = 'MAIN_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const USER_PROFILE_PROPERTY = 'USER_PROFILE_PROPERTY';
var login;

class MainDialog extends ComponentDialog {
    constructor(userProfileAccessor) {
        super(WATCHLISTMENU_DIALOG);

        this.userProfileAccessor = userProfileAccessor;

        this.addDialog(new TextPrompt(TEXT_PROMPT));
        //this.addDialog(new WatchlistDeleteDialog(this.userProfileAccessor));
        //this.addDialog(new WatchlistShowDialog(this.userProfileAccessor));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.menuStep.bind(this),
            this.optionsStep.bind(this),
            this.loopStep.bind(this)
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
        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

        async menuStep(step) {
                const reply = {
                    type: ActivityTypes.Message
                };
                var buttons = [{
                        type: ActionTypes.ImBack,
                        title: 'Guarda la tua watchlist.',
                        value: 'watchlist'
                    },
                    {
                        type: ActionTypes.ImBack,
                        title: 'Cancella un elemento dalla lista.',
                        value: 'delete'
                    },
                    {
                        type: ActionTypes.ImBack,
                        title: 'Torna indietro.',
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
                    prompt: 'Seleziona un\'opzione dal menu per proseguire!'
                });
        }

     // Forwards to the correct dialog based on the menu option or the intent recognized by LUIS
     async optionsStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        // Call LUIS and gather user request.
        //const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if (option === 'watchlist' /*|| LuisRecognizer.topIntent(luisResult) === 'search'*/) {
            //return await step.beginDialog(WATCHLISTSHOW_DIALOG);    
        } else if (option === 'delete' /*|| LuisRecognizer.topIntent(luisResult) === 'login'*/) {
            //return await step.beginDialog(WATCHLISTDELETE_DIALOG);    
        } else if(option === 'back' /*|| LuisRecognizer.topIntent(luisResult) === 'watchlist'*/) {
            return await step.endDialog({ res : -1 });
        } else {
            // The user did not enter input that this bot was built to handle.
            reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
            await step.context.sendActivity(reply)
        }
        return await step.replaceDialog(this.id);
    }

    async loopStep(step) {
        return await step.replaceDialog(this.id);
    }
}
module.exports.WatchlistMenuDialog = WatchlistMenuDialog;
module.exports.WATCHLISTMENU_DIALOG = WATCHLISTMENU_DIALOG;
