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
var userProfile;

class MainDialog extends ComponentDialog {
    constructor(luisRecognizer, userState) {
        super(MAIN_DIALOG);
    
        if (!luisRecognizer) throw new Error('[MainDialog]: Missing parameter \'luisRecognizer\' is required');
        this.luisRecognizer = luisRecognizer;
        this.userState = this.userState;
        this.userProfileAccessor = userState.createProperty(USER_PROFILE_PROPERTY);
        this.addDialog(new SearchDialog(this.luisRecognizer, this.userProfileAccessor));
        this.addDialog(new LogoutDialog(this.userProfileAccessor));
        this.addDialog(new WatchlistMenuDialog(this.luisRecognizer, this.userProfileAccessor));
        this.addDialog(new LoginDialog(this.userProfileAccessor));
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.mainMenuStep.bind(this),
            this.mainOptionsStep.bind(this),
            this.mainLoopStep.bind(this)
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

        async mainMenuStep(step) {
            console.log("MENUSTEP");
            userProfile = await this.userProfileAccessor.get(step.context);
                const reply = {
                    type: ActivityTypes.Message
                };
                var buttons = [];

                console.log(userProfile);
                if(login == undefined) {
                    buttons = [{
                        type: ActionTypes.ImBack,
                        title: 'Ricerca',
                        value: 'search'
                        }, {},
                        {
                            type: ActionTypes.ImBack,
                            title: 'Login',
                            value: 'login'
                        }, {}
                    ];
                } else {
                    buttons = [{
                        type: ActionTypes.ImBack,
                        title: 'Ricerca',
                        value: 'search'
                        }, {},
                        {
                            type: ActionTypes.ImBack,
                            title: 'Watchlist',
                            value: 'manage'
                        }, {},
                        {
                            type: ActionTypes.ImBack,
                            title: 'Logout',
                            value: 'logout'
                        }
                    ];
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
                    prompt: 'Seleziona un\'opzione dal menu o dimmi cosa vorresti fare per proseguire!'
                });
        }

     async mainOptionsStep(step) {
        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        console.log(luisResult);
        if (option === 'search' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Search' || LuisRecognizer.topIntent(luisResult, 'None', 0.6) === 'SearchAdvanced') {
            return await step.beginDialog(SEARCH_DIALOG, {login : login});    
        } else if (option === 'login' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LoginAction') {
            if(login == undefined) {
                console.log("LOGIN");
                return await step.beginDialog(LOGIN_DIALOG, { login: login });    
            } else {
                reply.text = '**Hai già effettuato il login.**';
                await step.context.sendActivity(reply); 
            }
        } else if(option === 'manage') {
            return await step.beginDialog(WATCHLISTMENU_DIALOG, { login: login });
        } else if(option === 'logout' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LogoutAction') {
            if(login == undefined) {
                reply.text = '**Non hai ancora effettuato il login.**';
                await step.context.sendActivity(reply);
            } else {
                return await step.beginDialog(LOGOUT_DIALOG, { logout : login });  
            }
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'DeleteAll' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistShow' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistDelete') {
            return await step.beginDialog(WATCHLISTMENU_DIALOG, { login : login });
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistAdd' ) {
            reply.text = '**Se vuoi aggiungere un elemento alla lista, devi prima fare una ricerca!**';
            await step.context.sendActivity(reply)
            return await step.beginDialog(SEARCH_DIALOG, { login: login});
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Menu') { 
            return await step.replaceDialog(this.id);
        } else {
            reply.text = '**Sembra che tu abbia digitato un comando che non conosco! Riprova.**';
            await step.context.sendActivity(reply);
        }
        return await step.replaceDialog(this.id);
    }

    async mainLoopStep(step) {
        console.log("MAINLOOPSTEP");
        if(step.result != undefined) {
            switch(step.result.res) {
                case "LOGIN": {
                    login = step.result.login;
                    console.log(login);
                    break;
                }
                case "LOGOUT": {
                    login = undefined;
                    break;
                }
                default: {
                    console.log("default");
                    login = step.result.login;
                    console.log(login);
                    break;
                }
            }
            return await step.replaceDialog(this.id);
        }
    }
}
module.exports.MainDialog = MainDialog;
module.exports.MAIN_DIALOG = MAIN_DIALOG;