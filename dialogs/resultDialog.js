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
var type;

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
            type = step.options.type;
            info = step.options.list;
            count++;
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
                prompt: 'Seleziona un\'opzione per vederne i dettagli.\n\n\nScrivi "**search**" per fare una nuova ricerca.\n\n\nScrivi "**menu**" per tornare al menu principale.'
            });
    }

    async branchStep(step) {

        const reply = {
            type: ActivityTypes.Message
        };
        const option = step.result;
        //const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
        if (option === 'search' || option === "Search" || option == "SEARCH" /*|| LuisRecognizer.topIntent(luisResult) === 'search'*/) {
            count = 0;
            return await step.endDialog({ res: "SEARCH" });
        } else if(option === 'menu' || option === "Menu" || option == "MENU"/*|| LuisRecognizer.topIntent(luisResult) === 'menu'*/) { 
            count = 0;
            return await step.endDialog({ res: "MAIN" });
        } else {
            var i = 0;
            while(true) {
                if(info[i].name === option) {
                    console.log(info[i].id);
                   return await step.beginDialog(BING_DIALOG, { media: type, title : option, id: info[i].id }); 
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
                count = 0;
                return await step.endDialog({ res: "MAIN" });
            } else if(step.result.res == "SEARCH") {
                count = 0;
                return await step.endDialog({ res: "SEARCH" });
            } else if(step.result.res == "RESULT") {
                count++;
                return await step.replaceDialog(this.id);
            }
        }
    }
 }
module.exports.ResultDialog = ResultDialog;
module.exports.RESULT_DIALOG = RESULT_DIALOG;