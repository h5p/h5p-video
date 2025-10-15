/** @namespace H5P */
H5P.VideoOttFlix = (function ($) {

    /** @private */
    var numInstances = 0;
    /** @private */
    var ottflixhost;

    /**
     * OttFlix video player for H5P.
     *
     * @class
     * @param {Array} sources Video files to use
     * @param {Object} options Settings for the player
     * @param {Object} l10n Localization strings
     */
    function OttFlix(sources, options, l10n) {
        var self = this;

        var id = 'h5p-ottflix-' + numInstances;
        var player;
        var identifier;
        numInstances++;

        var $wrapper = $(`<div id="${id}"></div>`);

        self.pressToPlay = false;

        /**
         * Use the OttFlix API to create a new player
         *
         * @private
         */
        var create = function () {
            if (!$wrapper.is(':visible') || player !== undefined) {
                console.trace("exit");
                return;
            }

            identifier = getId(sources[0].path);

            console.log(identifier);

            // Criação do elemento <div> com estilo
            var divIframe = document.createElement("div");
            divIframe.style.position = "relative";
            divIframe.style.overflow = "hidden";
            divIframe.style.width = "100%";
            divIframe.style.paddingTop = "56.34%";

            // Criação do elemento <iframe> com os atributos e estilo
            player = document.createElement("iframe");
            player.style.position = "absolute";
            player.style.top = "0";
            player.style.left = "0";
            player.style.bottom = "0";
            player.style.right = "0";
            player.style.width = "100%";
            player.style.height = "100%";
            player.frameBorder = "0";
            player.allowFullscreen = true;
            player.sandbox = "allow-scripts allow-popups allow-forms allow-same-origin allow-modals";
            player.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
            player.src = `https://${ottflixhost}/Share/player/${identifier}`;
            player.id = identifier;

            // Anexar o iframe ao container <div>
            divIframe.appendChild(player);

            document.getElementById(id).append(divIframe);
            var overlay = document.querySelector(`#${id} + div`);
            if (overlay) {
                overlay.style.display = "none";
            }

            window.addEventListener('message', e => {
                console.log(["receiveEvents", e.data]);
                var data = e.data;
                // console.log ( data );
                if (data.origem && data.origem == "OTTFLIX-player" && data.identifier == identifier) {
                    if (data.name == "progress") {
                        // Código para o evento 'progress'
                    } else if (data.name == "playing") {
                        // Código para o evento 'playing'
                    } else if (data.name == "timeupdate") {
                        // Código para o evento 'timeupdate'
                    } else if (data.name == "volumechange") {
                        // Código para o evento 'volumechange'
                    } else if (data.name == "seeking") {
                        // Código para o evento 'seeking'
                    } else if (data.name == "seeked") {
                        // Código para o evento 'seeked'
                    } else if (data.name == "ratechange") {
                        // Código para o evento 'ratechange'
                    } else if (data.name == "ended") {
                        // Código para o evento 'ended'
                    } else if (data.name == "enterfullscreen") {
                        // Código para o evento 'enterfullscreen'
                    } else if (data.name == "exitfullscreen") {
                        // Código para o evento 'exitfullscreen'
                    } else if (data.name == "captionsenabled") {
                        // Código para o evento 'captionsenabled'
                    } else if (data.name == "captionsdisabled") {
                        // Código para o evento 'captionsdisabled'
                    } else if (data.name == "languagechange") {
                        // Código para o evento 'languagechange'
                    }
                }
            });
        };

        /**
         * send OttFlix Command
         *
         * @param {string} action
         * @param {Number|boolean} value
         */
        function sendOttFlixCommand(action, value) {
            if (!player || !player.contentWindow) {
                return;
            }
            const msg = {type: 'OttFlix', action, value};
            console.log(msg);
            player.contentWindow.postMessage(msg, "*");
        }

        /**
         * Appends the video player to the DOM.
         *
         * @public
         * @param {jQuery} $container
         */
        self.appendTo = function ($container) {
            $container.addClass('h5p-OttFlix').append($wrapper);
            setTimeout(create, 3)
        };

        /**
         * Get list of available qualities. Not available until after play.
         *
         * @public
         * @returns {Array}
         */
        self.getQualities = function () {
            // disabled
        };

        /**
         * Get current playback quality. Not available until after play.
         *
         * @public
         * @returns {String}
         */
        self.getQuality = function () {
            // disabled
        };

        /**
         * Set current playback quality. Not available until after play.
         * Listen to event "qualityChange" to check if successful.
         *
         * @public
         * @params {String} [quality]
         */
        self.setQuality = function (quality) {
            // disabled
        };

        /**
         * Start the video.
         *
         * @public
         */
        self.play = function () {
            sendOttFlixCommand('play');
        };

        /**
         * Pause the video.
         *
         * @public
         */
        self.pause = function () {
            sendOttFlixCommand('pause');
        };

        /**
         * Seek video to given time.
         *
         * @public
         * @param {Number} time
         */
        self.seek = function (time) {
            sendOttFlixCommand('seek', time);
        };

        /**
         * Get elapsed time since video beginning.
         *
         * @public
         * @returns {Number}
         */
        self.getCurrentTime = function () {
            // disabled
        };

        /**
         * Get total video duration time.
         *
         * @public
         * @returns {Number}
         */
        self.getDuration = function () {
            // disabled
        };

        /**
         * Get percentage of video that is buffered.
         *
         * @public
         * @returns {Number} Between 0 and 100
         */
        self.getBuffered = function () {
            // disabled
        };

        /**
         * Turn off video sound.
         *
         * @public
         */
        self.mute = function () {
            sendOttFlixCommand('mute', true);
        };

        /**
         * Turn on video sound.
         *
         * @public
         */
        self.unMute = function () {
            sendOttFlixCommand('mute', false);
        };

        /**
         * Check if video sound is turned on or off.
         *
         * @public
         * @returns {Boolean}
         */
        self.isMuted = function () {
            // disabled
        };

        /**
         * Return the video sound level.
         *
         * @public
         * @returns {Number} Between 0 and 100.
         */
        self.getVolume = function () {
            // disabled
        };

        /**
         * Set video sound level.
         *
         * @public
         * @param {Number} level Between 0 and 100.
         */
        self.setVolume = function (level) {
            sendOttFlixCommand('volume', level);
        };

        /**
         * Get list of available playback rates.
         *
         * @public
         * @returns {Array} available playback rates
         */
        self.getPlaybackRates = function () {
            // disabled
        };

        /**
         * Get current playback rate.
         *
         * @public
         * @returns {Number} such as 0.25, 0.5, 1, 1.25, 1.5 and 2
         */
        self.getPlaybackRate = function () {
            // disabled
        };

        /**
         * Set current playback rate.
         * Listen to event "playbackRateChange" to check if successful.
         *
         * @public
         * @params {Number} suggested rate that may be rounded to supported values
         */
        self.setPlaybackRate = function (newPlaybackRate) {
            sendOttFlixCommand('speed', newPlaybackRate);
        };

        /**
         * Set current captions track.
         *
         * @param {H5P.Video.LabelValue} Captions track to show during playback
         */
        self.setCaptionsTrack = function (track) {
            // disabled
        };

        /**
         * Figure out which captions track is currently used.
         *
         * @return {H5P.Video.LabelValue} Captions track
         */
        self.getCaptionsTrack = function () {
            // disabled
        };
    }

    /**
     * Check to see if we can play any of the given sources.
     *
     * @public
     * @static
     * @param {Array} sources
     * @returns {Boolean}
     */
    OttFlix.canPlay = function (sources) {
        return getId(sources[0].path);
    };

    /**
     * Find id of OttFlix video from given URL.
     *
     * @private
     * @param {String} url
     * @returns {String} OttFlix video identifier
     */
    var getId = function (url) {
        console.log(url);
        var regex = /^https:\/\/([^/]+)\/Assets\/detail\/(\w+)/;
        const matches = url.match(regex);
        console.log(matches);
        if (matches && matches.length === 3) {
            ottflixhost = matches[1];

            console.log("Vamos....");
            return matches[2];
        }
    };

    return OttFlix;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoOttFlix);
