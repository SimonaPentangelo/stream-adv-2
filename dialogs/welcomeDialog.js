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

const { LuisRecognizer } = require('botbuilder-ai');

const { ComponentDialog, 
        DialogSet, 
        DialogTurnStatus, 
        TextPrompt, 
        WaterfallDialog 
} = require('botbuilder-dialogs');

const {
    MAIN_DIALOG,
    MainDialog
} = require('./mainDialog');


const WELCOME_DIALOG = 'WELCOME_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

class WelcomeDialog extends ComponentDialog {
    constructor(luisRecognizer, userState) {
        super(WELCOME_DIALOG);
    
        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;
        this.userState = userState;
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new MainDialog(this.luisRecognizer, this.userState));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.welcomeStep.bind(this)
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

    async welcomeStep(step) {
        if (!this.luisRecognizer.isConfigured) {
            const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await step.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await step.next();
        }
        const uno = '🎥';
        const due = '🎞️';
        await step.context.sendActivity(uno + ' **Ciao, sono il tuo StreamAdvisor!** ' + due);
        var testo = "🔎 Con la funzionalità **ricerca** potrai trovare nuovi film e serie tv da vedere." +
            "\n\n📼 Ti indicherò le piattaforme di streaming da cui guardarle." +
            "\n\n📜 Se effettuerai il **login**, potrai salvare i media che preferisci in una **watchlist**." +
            "\n\n👁️ Potrai consultare e aggiornare la lista quando preferisci!"
        await step.context.sendActivity(testo);
        return await step.beginDialog(MAIN_DIALOG);
    }
}
module.exports.WelcomeDialog = WelcomeDialog;
module.exports.WELCOME_DIALOG = WELCOME_DIALOG;