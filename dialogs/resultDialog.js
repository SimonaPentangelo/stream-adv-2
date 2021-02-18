  
// Read environment variables from .env file
const path = require('path');
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({
    path: ENV_FILE
});

var request = require('request');

// Import required types from libraries
const {
    CardFactory,
    ActionTypes,
    ActivityTypes
} = require('botbuilder');

const { LuisRecognizer } = require('botbuilder-ai');

const { ComponentDialog, 
        DialogSet, 
        DialogTurnStatus,
        WaterfallDialog 
} = require('botbuilder-dialogs');

const { BING_DIALOG,
        BingDialog 
} = require('./bingSearchDialog');

const RESULT_DIALOG = 'RESULT_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';
var info = [];
var count = 0;
var login;

class ResultDialog extends ComponentDialog {
    constructor(luisRecognizer, userProfileAccessor) {
        super(RESULT_DIALOG);

        this.luisRecognizer = luisRecognizer;
        this.userProfileAccessor = userProfileAccessor
        this.addDialog(new BingDialog(luisRecognizer, userProfileAccessor));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.resultStep.bind(this),
            this.branchStep.bind(this),
            this.endStep.bind(this)
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
    
    async resultStep(step) {
        if(count == 0) {
            login = step.options.login;
            info = step.options.list;
        } 
        console.log("CIAO");
        console.log(info);
        var buttons = [];
        var i = 0;

        const reply = {
            type: ActivityTypes.Message
        };

        while(info[i]) {
            buttons.push({
                type: ActionTypes.ImBack,
                title: info[i].name,
                value: info[i].name
            });

            if(i == 5) {
                break;
            }
            i++;
        }
        console.log(buttons);
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
                prompt: 'Seleziona un\'opzione per vederne i dettagli, altrimenti dimmi cos\'altro posso fare per te.'
            });
    }

    async branchStep(step) {

        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        console.log(option);
        const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Search' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'SearchAdvanced') {
            count = 0;
            return await step.endDialog({ res: "SEARCH", login: login });   
        } else if (LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LoginAction') {
            if(login == undefined) {
                count = 0;
                reply.text = '**Per effettuare il login, devi tornare al menu principale.**';
                await step.context.sendActivity(reply); 
                return await step.endDialog({ res : "MAIN", login: login });  
            } else {
                reply.text = '**Hai già effettuato il login.**';
                await step.context.sendActivity(reply); 
            }
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'LogoutAction') {
            console.log(login == undefined);
            if(userProfile == undefined) {
                reply.text = '**Non hai ancora effettuato il login.**';
                await step.context.sendActivity(reply);
            } else {
                count = 0;
                reply.text = '**Per fare il logout devi tornare al menu principale!**';
                await step.context.sendActivity(reply);
                return await step.endDialog({ res : "MAIN", login: login }); 
            }
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'DeleteAll' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistShow' || LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistDelete') {
            count = 0;
            reply.text = '**Per gestire la tua watchlist, devi prima accedere al menu apposito**';
            await step.context.sendActivity(reply)
            return await step.endDialog({ res: "MAIN", login : login });
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'WatchlistAdd' ) {
            reply.text = '**Seleziona un elemento da aggiungere!**';
            await step.context.sendActivity(reply)
            return await step.replaceDialog(this.id);
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Menu') { 
            count = 0;
            return await step.endDialog({ res: "MAIN", login: login });
        } else if(LuisRecognizer.topIntent(luisResult, 'None', 0.7) === 'Back') { 
            count = 0;
            return await step.endDialog({ res: "BACK", login: login });
        } else {
            var i = 0;
            while(true) {
                if(info[i].name === option) {
                    console.log(info[i].id);
                   return await step.beginDialog(BING_DIALOG, { login: login, media: info[i] }); 
                } else {
                    i++;
                    if(i == 6) {
                        break;
                    }
                }
            }

            if(i == 6) {
                count++;
                reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
                await step.context.sendActivity(reply)
            }
        }
        return await step.replaceDialog(this.id);
    }

    async endStep(step) {
        console.log(step.result);
        if(step.result != undefined) {
            if(step.result.res == "MAIN") {
                login = step.result.login;
                count = 0;
                return await step.endDialog({ res: "MAIN", login: login });
            } else if(step.result.res == "SEARCH") {
                login = step.result.login;
                count = 0;
                return await step.endDialog({ res: "SEARCH", login: login });
            } else if(step.result.res == "RESULT") {
                login = step.result.login;
                count++;
                return await step.replaceDialog(this.id);
            } else if(step.result.res == "BACK") {
                login = step.result.login;
                count++;
                return await step.replaceDialog(this.id);
            }
        }
    }
 }
module.exports.ResultDialog = ResultDialog;
module.exports.RESULT_DIALOG = RESULT_DIALOG;

