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

const { User } = require('./User');

const LOGIN_DIALOG = 'LOGIN_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const OAUTH_PROMPT = 'OAUTH_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
var prompt;

class LoginDialog extends ComponentDialog {
    constructor(userProfileAccessor) {
        super(LOGIN_DIALOG, process.env.connectionName);

        if (!userProfileAccessor) throw new Error('Missing parameter.  userProfileAccessor is required');
        this.userProfileAccessor = userProfileAccessor;

        prompt = new OAuthPrompt(OAUTH_PROMPT, {
            connectionName: process.env.connectionName,
            text: 'Clicca per essere rendirizzato al login:',
            title: 'Login',
            timeout: 300000
        });
        this.addDialog(prompt);
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.welcomeStep.bind(this),
            this.loginStep.bind(this)
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
        this.userProfileAccessor.set(step.context, new User());
        return await step.beginDialog(OAUTH_PROMPT);
    }

    async loginStep(step) {
        let userProfile = await this.userProfileAccessor.get(step.context);
        const tokenResponse = step.result;
        if (tokenResponse) {
            var nome = await OAuthHelpers.listMe(step.context, tokenResponse)
            var email = await OAuthHelpers.listEmailAddress(step.context, tokenResponse);
            userProfile.name = nome;
            userProfile.email = email;
            await this.userProfileAccessor.set(step.context, userProfile);
            await step.context.sendActivity('Il login è andato a buon fine.');
        } else {
            await step.context.sendActivity('Il login non è andato a buon fine.');
        }
        return await step.endDialog({ res : prompt });
    }
}
module.exports.LoginDialog = LoginDialog;
module.exports.LOGIN_DIALOG = LOGIN_DIALOG;
