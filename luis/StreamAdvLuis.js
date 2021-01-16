const { LuisRecognizer } = require('botbuilder-ai');

class StreamAdvLuis {
    constructor(config) {
        const luisIsConfigured = config && config.applicationId && config.endpointKey && config.endpoint;
        if (luisIsConfigured) {
            const recognizerOptions = {
                apiVersion: 'v3'
            };

            this.recognizer = new LuisRecognizer(config, recognizerOptions);
        }
    }
    get isConfigured() {
        return (this.recognizer !== undefined);
    }

    /**
     * Returns an object with preformatted LUIS results for the bot's dialogs to consume.
     * @param {TurnContext} context
     */
    async executeLuisQuery(context) {
        return await this.recognizer.recognize(context);
    }

    getMediaEntities(result) {
        let film, serie, genere;
        let i = 0;
       console.log(result);
        
        while(result.entities.$instance.Genere[i]) {
            genere[i] = result.entities.$instance.Genere[i];
            i++;
        }
        if(result.entities.$instance.SerieTv) {
            serie = result.entities.$instance.SerieTv.text;
            return { Serie: serie, Generi: genere };
        } else if (result.entities.$instance.Film) {
            film = result.entities.$instance.Film.text;
            return { Serie: serie, Generi: genere };
        }   
    }
}

module.exports.StreamAdvLuis = StreamAdvLuis;