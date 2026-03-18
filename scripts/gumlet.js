/** @namespace H5P */
H5P.VideoGumlet = (function ($) {

    let numInstances = 0;

    /**
     * Gumlet video player for H5P.
     * Uses the @gumlet/player.js SDK to control an embedded Gumlet iframe.
     *
     * @class
     * @param {Array} sources Video files to use
     * @param {Object} options Settings for the player
     * @param {Object} l10n Localization strings
     */
    function GumletPlayer(sources, options, l10n) {
        const self = this;

        let player;

        // Track state synchronously for the H5P.Video API
        let buffered = 0;
        let currentTime = 0;
        let duration = 0;
        let isMuted = false;
        let volume = 100;
        let playbackRate = 1;
        let ratio = 9 / 16;
        let isLoaded = false;
        let failedLoading = false;
        let loadingFailedTimeout;

        const LOADING_TIMEOUT_IN_SECONDS = 15;

        const instanceId = 'h5p-gumlet-' + (++numInstances);
        const $wrapper = $('<div/>');
        const $placeholder = $('<div/>', {
            id: instanceId,
            html: '<div class="h5p-video-loading" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block; z-index: 100;" aria-label="' + (l10n.loading || '') + '"></div>'
        }).css({
            position: 'relative',
            width: '100%',
            paddingBottom: '56.25%',
            overflow: 'hidden'
        }).appendTo($wrapper);

        /**
         * Create a new Gumlet player by inserting an iframe and wrapping it
         * with the player.js SDK.
         *
         * @private
         */
        var createGumletPlayer = function () {
            if (!$placeholder.is(':visible') || player !== undefined) {
                return;
            }

            // Mark creation as in-progress
            player = null;

            loadGumletPlayerSDK(function (playerjs) {
                var assetId = getId(sources[0].path);
                if (!assetId) {
                    failedLoading = true;
                    removeLoadingIndicator();
                    $wrapper.html('<p class="gumlet-failed-loading">' + (l10n.gumletLoadingError || 'The Gumlet video could not be loaded.') + '</p>');
                    self.trigger('error', l10n.gumletLoadingError || 'The Gumlet video could not be loaded.');
                    return;
                }

                // Parse original URL to preserve custom parameters (player_color, logo_*, etc.)
                var embedParams = '';
                try {
                    var urlObj = new URL(sources[0].path);
                    var params = urlObj.searchParams;
                    params.set('autoplay', 'false');
                    params.set('loop', options.loop ? 'true' : 'false');
                    params.set('disable_player_controls', options.controls ? 'false' : 'true');
                    params.append('disabled_player_control', 'play-large');
                    if (!params.has('background')) {
                        params.set('background', 'false');
                    }
                    embedParams = params.toString();
                }
                catch (e) {
                    embedParams = 'autoplay=false&loop=' + (options.loop ? 'true' : 'false') + '&disable_player_controls=' + (options.controls ? 'false' : 'true') + '&disabled_player_control=play-large&background=false';
                }

                var embedUrl = 'https://play.gumlet.io/embed/' + assetId + '?' + embedParams;

                // Create the iframe element
                var iframe = document.createElement('iframe');
                iframe.src = embedUrl;
                iframe.setAttribute('title', 'Gumlet video player');
                iframe.setAttribute('referrerpolicy', 'origin');
                iframe.setAttribute('allow', 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen');
                iframe.style.cssText = 'border: none; position: absolute; top: 0; left: 0; height: 100%; width: 100%;';

                // Placeholder already has the responsive 16:9 container styles
                $placeholder.empty();
                $placeholder.append(iframe);

                // Wrap with player.js for programmatic control
                var gumletPlayer = new playerjs.Player(iframe);

                // Set up failsafe timeout for loading
                loadingFailedTimeout = setTimeout(function () {
                    failedLoading = true;
                    removeLoadingIndicator();
                    $wrapper.html('<p class="gumlet-failed-loading">' + (l10n.gumletLoadingError || 'The Gumlet video could not be loaded.') + '</p>');
                    $wrapper.css({ width: null, height: null });
                    self.trigger('resize');
                    self.trigger('error', l10n.gumletLoadingError || 'The Gumlet video could not be loaded.');
                }, LOADING_TIMEOUT_IN_SECONDS * 1000);

                // Register ALL event listeners BEFORE ready — player.js queues them
                // and replays when the player becomes ready.
                // (Do NOT register inside ready to avoid silent async errors)

                gumletPlayer.on('play', function () {
                    self.trigger('stateChange', H5P.Video.PLAYING);
                });

                gumletPlayer.on('pause', function () {
                    self.trigger('stateChange', H5P.Video.PAUSED);
                });

                gumletPlayer.on('ended', function () {
                    self.trigger('stateChange', H5P.Video.ENDED);
                });

                gumletPlayer.on('timeupdate', function (data) {
                    currentTime = data.seconds;
                    if (data.duration) {
                        duration = data.duration;
                    }
                });

                gumletPlayer.on('progress', function (data) {
                    buffered = data.percent;
                });

                gumletPlayer.on('error', function () {
                    self.trigger('error', l10n.unknownError);
                });

                // The ready event — initialize duration and fire H5P events
                gumletPlayer.on('ready', function () {
                    clearTimeout(loadingFailedTimeout);
                    player = gumletPlayer;
                    isLoaded = true;

                    // Get duration via callback approach (not async/await)
                    gumletPlayer.getDuration(function (dur) {
                        duration = dur;

                        removeLoadingIndicator();

                        // Handle startAt
                        if (options.startAt) {
                            gumletPlayer.setCurrentTime(options.startAt);
                            currentTime = options.startAt;
                        }

                        self.trigger('ready');
                        self.trigger('loaded');
                        self.trigger('resize');
                    });
                });
            });
        };

        var removeLoadingIndicator = function () {
            $placeholder.find('div.h5p-video-loading').remove();
        };

        // Only require press-to-play if the browser blocks autoplay
        try {
            if (document.featurePolicy.allowsFeature('autoplay') === false) {
                self.pressToPlay = true;
            }
        }
        catch (err) {}

        /**
         * Appends the video player to the DOM.
         *
         * @public
         * @param {jQuery} $container
         */
        self.appendTo = function ($container) {
            $container.addClass('h5p-gumlet').append($wrapper);
            createGumletPlayer();
        };

        /**
         * Get list of available qualities.
         * @public
         * @returns {Array}
         */
        self.getQualities = function () { };

        /**
         * Get the current quality.
         * @returns {String}
         */
        self.getQuality = function () { };

        /**
         * Set the playback quality.
         * @public
         * @param {String} quality
         */
        self.setQuality = function (quality) { };

        /**
         * Start the video.
         * @public
         */
        var pendingPlay = false;
        self.play = function () {
            if (!player) {
                if (!pendingPlay) {
                    pendingPlay = true;
                    self.on('loaded', function () {
                        pendingPlay = false;
                        self.play();
                    });
                }
                return;
            }
            // If video is at the end, restart from beginning
            // (native HTML5 video does this automatically, iframe players don't)
            if (duration > 0 && currentTime >= duration) {
                player.setCurrentTime(0);
                currentTime = 0;
            }
            player.play();
        };

        /**
         * Pause the video.
         * @public
         */
        self.pause = function () {
            if (player) {
                player.pause();
            }
        };

        /**
         * Seek video to given time.
         * @public
         * @param {Number} time
         */
        self.seek = function (time) {
            if (!player) {
                return;
            }
            currentTime = time;
            player.setCurrentTime(time);
        };

        /**
         * @public
         * @returns {Number} Seconds elapsed since beginning of video
         */
        self.getCurrentTime = function () {
            // Kick off async refresh for next poll
            if (player && isLoaded) {
                player.getCurrentTime(function (time) {
                    currentTime = time;
                });
            }
            return currentTime;
        };

        /**
         * @public
         * @returns {Number} Video duration in seconds
         */
        self.getDuration = function () {
            return duration;
        };

        /**
         * Get percentage of video that is buffered.
         * @public
         * @returns {Number} Between 0 and 100
         */
        self.getBuffered = function () {
            return buffered;
        };

        /**
         * Mute the video.
         * @public
         */
        self.mute = function () {
            if (player) {
                player.mute();
                isMuted = true;
            }
        };

        /**
         * Unmute the video.
         * @public
         */
        self.unMute = function () {
            if (player) {
                player.unmute();
                isMuted = false;
            }
        };

        /**
         * Whether the video is muted.
         * @public
         * @returns {Boolean}
         */
        self.isMuted = function () {
            return isMuted;
        };

        /**
         * Whether the video is loaded.
         * @public
         * @returns {Boolean}
         */
        self.isLoaded = function () {
            return isLoaded;
        };

        /**
         * Get the video player's current sound volume.
         * @public
         * @returns {Number} Between 0 and 100.
         */
        self.getVolume = function () {
            return volume;
        };

        /**
         * Set the video player's sound volume.
         * @public
         * @param {Number} level Between 0 and 100.
         */
        self.setVolume = function (level) {
            if (player) {
                player.setVolume(level);
                volume = level;
            }
        };

        /**
         * Get list of available playback rates.
         * @public
         * @returns {Array}
         */
        self.getPlaybackRates = function () {
            return [0.5, 1, 1.5, 2];
        };

        /**
         * Get the current playback rate.
         * @public
         * @returns {Number}
         */
        self.getPlaybackRate = function () {
            return playbackRate;
        };

        /**
         * Set the current playback rate.
         * @public
         * @param {Number} rate
         */
        self.setPlaybackRate = function (rate) {
            if (player) {
                player.setPlaybackRate(rate);
                playbackRate = rate;
                self.trigger('playbackRateChange', rate);
            }
        };

        /**
         * Set current captions track.
         * @public
         * @param {H5P.Video.LabelValue} track
         */
        self.setCaptionsTrack = function (track) { };

        /**
         * Get current captions track.
         * @public
         * @returns {H5P.Video.LabelValue}
         */
        self.getCaptionsTrack = function () {
            return null;
        };

        self.on('resize', function () {
            if (failedLoading || !$wrapper.is(':visible')) {
                return;
            }

            if (player === undefined) {
                createGumletPlayer();
                return;
            }

            // Only set width to 100% to measure available space,
            // but keep the current height to avoid a visible collapse/jump.
            $wrapper.css('width', '100%');

            var width = $wrapper[0].clientWidth;
            var height = options.fit ? $wrapper[0].clientHeight : (width * ratio);

            if (height > 0) {
                $wrapper.css({
                    width: width + 'px',
                    height: height + 'px'
                });

                $placeholder.css({
                    paddingBottom: 0,
                    height: height + 'px'
                });
            }
        });
    }

    /**
     * Check to see if we can play any of the given sources.
     *
     * @public
     * @static
     * @param {Array} sources
     * @returns {Boolean}
     */
    GumletPlayer.canPlay = function (sources) {
        return getId(sources[0].path);
    };

    /**
     * Find asset ID of Gumlet video from given URL.
     *
     * @private
     * @param {String} url
     * @returns {String|undefined} Gumlet asset ID
     */
    var getId = function (url) {
        var matches = url.match(/^.*(?:play\.gumlet\.io\/embed|gumlet\.com\/watch)\/([a-f0-9]+)/);
        if (matches && matches[1]) {
            return matches[1];
        }
    };

    /**
     * Load the Gumlet Player.js SDK asynchronously.
     *
     * @private
     * @param {Function} callback Called with the playerjs global when loaded
     */
    var loadGumletPlayerSDK = function (callback) {
        if (window.playerjs) {
            callback(window.playerjs);
            return;
        }

        var tag = document.createElement('script');
        tag.src = 'https://cdn.jsdelivr.net/npm/@gumlet/player.js@3.0/dist/main.global.js';
        tag.onload = function () { callback(window.playerjs); };
        tag.onerror = function () { console.error('[GUMLET] Failed to load player.js SDK'); };
        var firstScript = document.querySelector('script');
        if (firstScript) {
            firstScript.parentNode.insertBefore(tag, firstScript);
        }
        else {
            document.head.appendChild(tag);
        }
    };

    return GumletPlayer;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoGumlet);
