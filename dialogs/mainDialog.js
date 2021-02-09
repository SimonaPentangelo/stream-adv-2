// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

require('dotenv').config({ path: 'C:\Users\Simona\Desktop\stream-adv\.env' });

// Import required types from libraries
const {
    ActionTypes,
    ActivityTypes,
    CardFactory
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
    LOGIN_DIALOG,
    LoginDialog
} = require('./loginDialog');

const {
    WATCHLISTMENU_DIALOG,
    WatchlistMenuDialog
} = require('./watchlistMenuDialog');

const {
    LOGOUT_DIALOG,
    LogoutDialog
} = require('./logoutDialog');

const MAIN_DIALOG = 'MAIN_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const USER_PROFILE_PROPERTY = 'USER_PROFILE_PROPERTY';
var login;

class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, userState) {
        super(MAIN_DIALOG);
    
        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;
        this.userState = this.userState;
        this.userProfileAccessor = userState.createProperty(USER_PROFILE_PROPERTY);
        this.addDialog(new SearchDialog(this.luisRecognizer, this.userProfileAccessor));
        this.addDialog(new LogoutDialog(this.userProfileAccessor));
        this.addDialog(new WatchlistMenuDialog(this.userProfileAccessor));
        this.addDialog(new LoginDialog(this.userProfileAccessor));
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.mainMenuStep.bind(this),
            this.mainOptionsStep.bind(this),
            this.mainLoopStep.bind(this)
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
        console.log(results);
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

        async mainMenuStep(step) {
            console.log("MENUSTEP");
            let userProfile = await this.userProfileAccessor.get(step.context);
                const reply = {
                    type: ActivityTypes.Message
                };
                var buttons = [{
                        type: ActionTypes.ImBack,
                        title: 'Chiedimi di fare una ricerca per te',
                        value: 'search'
                    }
                ];

                console.log("PROFILE: " + userProfile);
                if(userProfile == undefined) {
                    buttons.push({
                        type: ActionTypes.ImBack,
                        title: 'Effettua il login',
                        value: 'login'
                    });
                } else {
                    buttons.push({
                        type: ActionTypes.ImBack,
                        title: 'Gestisci watchlist',
                        value: 'manage'
                    });

                    buttons.push({
                        type: ActionTypes.ImBack,
                        title: 'Logout',
                        value: 'logout'
                    });
                }
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
        }

     // Forwards to the correct dialog based on the menu option or the intent recognized by LUIS
     async mainOptionsStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        //const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if (option === 'search' /*|| LuisRecognizer.topIntent(luisResult) === 'search'*/) {
            return await step.beginDialog(SEARCH_DIALOG);    
        } else if (option === 'login' /*|| LuisRecognizer.topIntent(luisResult) === 'login'*/) {
            return await step.beginDialog(LOGIN_DIALOG);    
        } else if(option === 'manage' /*|| LuisRecognizer.topIntent(luisResult) === 'watchlist'*/) {
            return await step.beginDialog(WATCHLISTMENU_DIALOG);
        } else if(option === 'logout' /*|| LuisRecognizer.topIntent(luisResult) === 'logout'*/) {
            return await step.beginDialog(LOGOUT_DIALOG, { logout : login }); 
        } else {
            reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
            await step.context.sendActivity(reply)
        }
        return await step.replaceDialog(this.id);
    }

    async mainLoopStep(step) {
        if(step.result != undefined && step.result.res == "LOGIN") {
            login = step.result.login;
        } else if(step.result != undefined && step.result.res == "LOGOUT") {
            login = undefined;
            this.userProfileAccessor.set(step.context, undefined);
        }
        console.log(this.id);
        return await step.replaceDialog(this.id);
    }
}
module.exports.MainDialog = MainDialog;
module.exports.MAIN_DIALOG = MAIN_DIALOG;
