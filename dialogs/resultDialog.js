// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const path = require('path');
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({
    path: ENV_FILE
});

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
    SEARCH_DIALOG,
    SearchDialog
} = require('./searchDialog');

const {
    BING_DIALOG,
    BingDialog
} = require('./bingSearchDialog');

const RESULT_DIALOG = 'RESULT_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const BING_PARAM = 'BING_PARAM';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

class ResultDialog extends ComponentDialog {
    constructor(luisRecognizer, result) {
        super(RESULT_DIALOG);

        this.luisRecognizer = luisRecognizer;
        this.result = result;
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        //this.addDialog(new BingDialog(BING_PARAM));
        this.addDialog(new SearchDialog(luisRecognizer));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.resultStep.bind(this),
            this.branchStep.bind(this),
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
    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a booking request, like "book me a flight from Paris to Berlin on march 22"
     * Note that the sample LUIS model will only recognize Paris, Berlin, New York and London as airport cities.
     */
    async resultStep(step) {
        const info = this.result;
        var buttons = [];
        var i = 0;

        const reply = {
            type: ActivityTypes.Message
        };

        while(info[i]) {
            buttons.push({
                type: ActionTypes.ImBack,
                title: info[i],
                value: info[i]
            });

            if(i == 5) {
                break;
            }
            i++;
        }
        
        const card = CardFactory.heroCard(
            '',
            undefined,
            buttons, {
                text: 'Ecco i risultati:'
                }
            );

            reply.attachments = [card];
            await step.context.sendActivity(reply);
            return await step.prompt(TEXT_PROMPT, {
                prompt: 'Seleziona un\'opzione per vederne i dettagli, o scrivi "search" per fare una nuova ricerca.'
            });
    }

    async branchStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if (option === 'search' || LuisRecognizer.topIntent(luisResult) === 'search') {
            return await step.beginDialog(SEARCH_DIALOG);    
        } else {
            const info = step.values.res;
            var i = 0;
            while(info[i]) {
                if(i < 6 && info[i] === option) {
                   // return await step.beginDialog(BING_DIALOG);  
                } else {
                     // The user did not enter input that this bot was built to handle.
                    reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
                    await step.context.sendActivity(reply)
                }
                i++;
            }
        }
        return await step.replaceDialog(this.id);
    }

    async loopStep(step) {
        return await step.replaceDialog(this.id);
    }
}
module.exports.ResultDialog = ResultDialog;
module.exports.RESULT_DIALOG = RESULT_DIALOG;
