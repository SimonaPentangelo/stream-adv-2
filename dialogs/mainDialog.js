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
    SEARCH_DIALOG,
    SearchDialog
} = require('./searchDialog');

const MAIN_DIALOG = 'MAIN_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const USER_PROFILE_PROPERTY = 'USER_PROFILE_PROPERTY';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, userState) {
        super(MAIN_DIALOG);
    
        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;
        this.userState = userState;
        this.userProfileAccessor = this.userState.createProperty(USER_PROFILE_PROPERTY);
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new SearchDialog(luisRecognizer));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.welcomeStep.bind(this),
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
    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a booking request, like "book me a flight from Paris to Berlin on march 22"
     * Note that the sample LUIS model will only recognize Paris, Berlin, New York and London as airport cities.
     */
    async welcomeStep(step) {
        if (!this.luisRecognizer.isConfigured) {
            const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await step.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await step.next();
        }
        const messageText = step.options.restartMsg ? step.options.restartMsg : `Come posso aiutarti?\n\nSe vuoi sapere cosa posso fare per te scrivi "menu"`;
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await step.prompt(TEXT_PROMPT, { prompt: promptMessage });
    }
    /**
     * Second step in the waterfall.  This will use LUIS to attempt to extract the origin, destination and travel dates.
     * Then, it hands off to the bookingDialog child dialog to collect any remaining details.
     */
        // Shows the menu or forward the text to next step
        async menuStep(step) {
            const message = step.result;
            if (message === 'menu') {
                const reply = {
                    type: ActivityTypes.Message
                };
                const buttons = [{
                        type: ActionTypes.ImBack,
                        title: 'Chiedimi di fare una ricerca per te',
                        value: 'search'
                    },
                    {
                        type: ActionTypes.ImBack,
                        title: 'Effettua il login',
                        value: 'login'
                    },
                    {
                        type: ActionTypes.ImBack,
                        title: 'Registrati',
                        value: 'registration'
                    }
                ];
                const card = CardFactory.heroCard(
                    '',
                    undefined,
                    buttons, {
                        text: 'StreamAdvisors\'s menu'
                    }
                );
                reply.attachments = [card];
                await step.context.sendActivity(reply);
                return await step.prompt(TEXT_PROMPT, {
                    prompt: 'Seleziona un\'opzione dal menu per proseguire!'
                });
            } else {
                return await step.next(message);
            }
        }

     // Forwards to the correct dialog based on the menu option or the intent recognized by LUIS
     async optionsStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        // Call LUIS and gather user request.
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if (option === 'search' || LuisRecognizer.topIntent(luisResult) === 'search') {
            return await step.beginDialog(SEARCH_DIALOG);    
        } else if (option === 'login' || LuisRecognizer.topIntent(luisResult) === 'login') {
            //aaa
        } else if (option === 'registration' || LuisRecognizer.topIntent(luisResult) === 'registration') {    
            //aaa
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
module.exports.MainDialog = MainDialog;
module.exports.MAIN_DIALOG = MAIN_DIALOG;
