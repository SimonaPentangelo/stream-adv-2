
const { ComponentDialog, 
    DialogSet, 
    DialogTurnStatus, 
    WaterfallDialog,
    OAuthPrompt
} = require('botbuilder-dialogs');

const LOGOUT_DIALOG = 'LOGOUT_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
var logout;

class LogoutDialog extends ComponentDialog {
    constructor(userProfileAccessor) {
        super(LOGOUT_DIALOG);

        this.userProfileAccessor = userProfileAccessor;
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.logoutStep.bind(this)
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

    async logoutStep(step) {
        logout = step.options.logout;
        console.log(logout);
        await logout.signOutUser(step.context, process.env.connectionName);
        this.userProfileAccessor.set(step.context, undefined);
        await step.context.sendActivity('**Il logout è andato a buon fine.**');
        return await step.endDialog({ res : "LOGOUT" });
    }
}

module.exports.LogoutDialog = LogoutDialog;
module.exports.LOGOUT_DIALOG = LOGOUT_DIALOG;
