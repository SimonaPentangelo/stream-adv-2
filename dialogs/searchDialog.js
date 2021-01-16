// Read environment variables from .env file
const path = require('path');
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({
    path: ENV_FILE
});

const Trakt = require('trakt.tv');
let options = {
    client_id: 'f2d030349ead1ed9db71d85429467c2ad832c669b59ec569f0d625a17df687ae',
    client_secret: '32437dfddf1ccbe13b212711d069355866a7bdfc0fdddb54a54a5f4ded928b69',
    redirect_uri: null,   // defaults to 'urn:ietf:wg:oauth:2.0:oob'
    api_url: null,        // defaults to 'https://api.trakt.tv'
    useragent: null,      // defaults to 'trakt.tv/<version>'
    pagination: true      // defaults to false, global pagination (see below)
  };

const trakt = new Trakt(options);
const traktAuthUrl = trakt.get_url();

// Import required types from libraries
// Import required types from libraries
const {
    ActivityTypes,
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

const SEARCH_DIALOG = 'SEARCH_DIALOG';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
const TEXT_PROMPT = 'TEXT_PROMPT';

// Secondary dialog, manages the reservation of a new seminar by composing an email
class SearchDialog extends ComponentDialog {
    constructor(luisRecognizer) {
        super(SEARCH_DIALOG);

        this.luisRecognizer = luisRecognizer;

        // Adding used dialogs
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.inputStep.bind(this),
            this.resultStep.bind(this),
            this.loopStep.bind(this),
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

    async inputStep(step) {
        if (!this.luisRecognizer.isConfigured) {
            const messageText = 'NOTE: LUIS is not configured. To enable all capabilities, add `LuisAppId`, `LuisAPIKey` and `LuisAPIHostName` to the .env file.';
            await step.context.sendActivity(messageText, null, InputHints.IgnoringInput);
            return await step.next();
        }
        const messageText = step.options.restartMsg ? step.options.restartMsg : `Cosa stai cercando? Scrivi se vuoi un film o una serie ed il/i generi che cerchi.`;
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await step.prompt(TEXT_PROMPT, { prompt: promptMessage });
    }

    async resultStep(step) {
        //trakt.exchange_code('code', 'csrf token (state)').then(result => {
            // contains tokens & session information
            // API can now be used with authorized requests
            const reply = {
                type: ActivityTypes.Message
            };

            const luisResult = await this.luisRecognizer.executeLuisQuery(step.context);
            switch (LuisRecognizer.topIntent(luisResult)) {
                case 'MediaFilm': {
                    const filmEntity = this.luisRecognizer.getMediaEntities(luisResult);
                    const messageText = filmEntity[0].genere;
                    console.log(messageText);
                    trakt.search.text({
                        query: 'genres=action',
                        type: 'movie'
                    }).then(response => {
                    
                    });
                }
                case 'MediaSerie': {
                    const serieEntity = this.luisRecognizer.getMediaEntities(luisResult);
                    const messageText = serieEntity.text;
                } default: {
                     // The user did not enter input that this bot was built to handle.
                    reply.text = 'Sembra che tu abbia digitato un comando che non conosco! Riprova.';
                    await step.context.sendActivity(reply)
                }
            /*
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
            }*/
            return await step.replaceDialog(this.id);
        //}
    }
    }

    async loopStep(step) {
        return await step.replaceDialog(this.id);
    }
}
module.exports.SearchDialog = SearchDialog;
module.exports.SEARCH_DIALOG = SEARCH_DIALOG;