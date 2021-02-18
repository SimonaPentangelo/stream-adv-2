const { LuisRecognizer } = require('botbuilder-ai');
const { isRegExp } = require('util');

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
        let film, serie;
        let genere = [];
        let i = 0;   
        console.log("LUIS");
        console.log(result);  
        if(result.entities.Genere == undefined) {
            console.log("errore luis");
            return { Media: undefined, Generi: undefined };
        }  
        if(result.entities.Film) {
            while(result.entities.Genere[i]) {
                genere.push(result.entities.Genere[i]);
                i++;
            }
            film = "film"; 
            return { Media: film, Generi: genere };
        } else if (result.entities.SerieTv) {
            while(result.entities.Genere[i]) {
                genere.push(result.entities.Genere[i]);
                i++;
            }
            serie = "serie tv";
            return { Media: serie, Generi: genere };
        } else {
            console.log("errore luis");
            return { Media: undefined, Generi: undefined };
        }
    }
}

module.exports.StreamAdvLuis = StreamAdvLuis;