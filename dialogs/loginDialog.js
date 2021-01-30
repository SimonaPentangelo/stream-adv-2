// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

require('dotenv').config({ path: 'C:\Users\Simona\Desktop\stream-adv\.env' });
const { OAuthHelpers } = require('../helpers/OAuthHelpers');

const { ComponentDialog, 
        DialogSet, 
        DialogTurnStatus, 
        TextPrompt, 
        WaterfallDialog,
        OAuthPrompt,
        ConfirmPrompt
} = require('botbuilder-dialogs');


const LOGIN_DIALOG = 'LOGIN_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const OAUTH_PROMPT = 'OAUTH_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';

class LoginDialog extends ComponentDialog {
    constructor() {
        super(LOGIN_DIALOG, process.env.connectionName);
    
        this.addDialog(new OAuthPrompt(OAUTH_PROMPT, {
            connectionName: process.env.connectionName,
            text: 'Clicca per essere rendirizzato al login:',
            title: 'Login',
            timeout: 300000
        }));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.welcomeStep.bind(this),
            this.loginStep.bind(this),
            this.commandStep.bind(this),
            this.processStep.bind(this)
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
        return await step.beginDialog(OAUTH_PROMPT);
    }

    async loginStep(step) {
        const tokenResponse = step.result;
        if (tokenResponse) {
            await step.context.sendActivity('Login effettuato con successo.');
        } else {
            await step.context.sendActivity('Il login non è andato a buon fine.');
        }
        return await step.endDialog();
    }

    async commandStep(step) {
        step.values.command = step.result;

        // Call the prompt again because we need the token. The reasons for this are:
        // 1. If the user is already logged in we do not need to store the token locally in the bot and worry
        // about refreshing it. We can always just call the prompt again to get the token.
        // 2. We never know how long it will take a user to respond. By the time the
        // user responds the token may have expired. The user would then be prompted to login again.
        //
        // There is no reason to store the token locally in the bot because we can always just call
        // the OAuth prompt to get the token or get a new token if needed.
        return await step.beginDialog(OAUTH_PROMPT);
    }

    async processStep(step) {
        if (step.result) {
            // We do not need to store the token in the bot. When we need the token we can
            // send another prompt. If the token is valid the user will not need to log back in.
            // The token will be available in the Result property of the task.
            const tokenResponse = step.result;

            // If we have the token use the user is authenticated so we may use it to make API calls.
            if (tokenResponse && tokenResponse.token) {
                const command = (step.values.command || '').toLowerCase();

                switch (command) {
                case 'me':
                    await OAuthHelpers.listMe(step.context, tokenResponse);
                    break;
                case 'email':
                    await OAuthHelpers.listEmailAddress(step.context, tokenResponse);
                    break;
                default:
                    await step.context.sendActivity(`Your token is ${ tokenResponse.token }`);
                }
            }
        } else {
            await step.context.sendActivity('We couldn\'t log you in. Please try again later.');
        }

        return await step.endDialog();
    }
}
module.exports.LoginDialog = LoginDialog;
module.exports.LOGIN_DIALOG = LOGIN_DIALOG;
