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
var result = [];
var count = 0;

class ResultDialog extends ComponentDialog {
    constructor(luisRecognizer) {
        super(RESULT_DIALOG);

        this.luisRecognizer = luisRecognizer;
        this.addDialog(new BingDialog(luisRecognizer));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.resultStep.bind(this),
            this.branchStep.bind(this),
            this.endStep.bing(this)
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
        var info = [];
        if(count == 0) {
            info = step.options.list;
            result = step.options.list;
        } else {
            info = result;
        }
        console.log("CIAO");
    
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
            count = 0;
            return await step.endDialog({ res : -1 });
        } else {
            console.log(result[0]);
            var i = 0;
            while(true) {
                if(result[i] === option) {
                   return await step.beginDialog(BING_DIALOG, { title : option }); 
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
        if(step.results == 1) {
            return await step.replaceDialog(this.id);
        }
    }
 }
module.exports.ResultDialog = ResultDialog;
module.exports.RESULT_DIALOG = RESULT_DIALOG;