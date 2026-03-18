/** @namespace H5P */
H5P.VideoBunny = (function ($) {

    let numInstances = 0;

    /**
     * Bunny Stream video player for H5P.
     * Uses the player.js SDK to control an embedded Bunny Stream iframe.
     *
     * @class
     * @param {Array} sources Video files to use
     * @param {Object} options Settings for the player
     * @param {Object} l10n Localization strings
     */
    function BunnyPlayer(sources, options, l10n) {
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

        const instanceId = 'h5p-bunny-' + (++numInstances);
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
         * Create a new Bunny player by inserting an iframe and wrapping it
         * with the player.js SDK.
         *
         * @private
         */
        var createBunnyPlayer = function () {
            if (!$placeholder.is(':visible') || player !== undefined) {
                return;
            }

            // Mark creation as in-progress
            player = null;

            loadBunnyPlayerSDK(function (playerjs) {
                var bunnyInfo = getId(sources[0].path);
                if (!bunnyInfo) {
                    failedLoading = true;
                    removeLoadingIndicator();
                    $wrapper.html('<p class="bunny-failed-loading">' + (l10n.bunnyLoadingError || 'The Bunny Stream video could not be loaded.') + '</p>');
                    self.trigger('error', l10n.bunnyLoadingError || 'The Bunny Stream video could not be loaded.');
                    return;
                }

                // Build embed URL with parameters
                var embedUrl = 'https://iframe.mediadelivery.net/embed/' + bunnyInfo.libraryId + '/' + bunnyInfo.videoId;
                var params = [];
                params.push('autoplay=false');
                params.push('loop=' + (options.loop ? 'true' : 'false'));
                params.push('preload=true');
                if (embedUrl.indexOf('?') === -1) {
                    embedUrl += '?' + params.join('&');
                } else {
                    embedUrl += '&' + params.join('&');
                }

                // Create the iframe element
                var iframe = document.createElement('iframe');
                iframe.src = embedUrl;
                iframe.setAttribute('title', 'Bunny Stream video player');
                iframe.setAttribute('referrerpolicy', 'origin');
                iframe.setAttribute('allow', 'accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen');
                iframe.style.cssText = 'border: none; position: absolute; top: 0; left: 0; height: 100%; width: 100%;';

                // Placeholder already has the responsive 16:9 container styles
                $placeholder.empty();
                $placeholder.append(iframe);

                // Wrap with player.js for programmatic control
                var bunnyPlayer = new playerjs.Player(iframe);

                // Set up failsafe timeout for loading
                loadingFailedTimeout = setTimeout(function () {
                    failedLoading = true;
                    removeLoadingIndicator();
                    $wrapper.html('<p class="bunny-failed-loading">' + (l10n.bunnyLoadingError || 'The Bunny Stream video could not be loaded.') + '</p>');
                    $wrapper.css({ width: null, height: null });
                    self.trigger('resize');
                    self.trigger('error', l10n.bunnyLoadingError || 'The Bunny Stream video could not be loaded.');
                }, LOADING_TIMEOUT_IN_SECONDS * 1000);

                // Register ALL event listeners BEFORE ready — player.js queues them
                // and replays when the player becomes ready.

                bunnyPlayer.on('play', function () {
                    self.trigger('stateChange', H5P.Video.PLAYING);
                });

                bunnyPlayer.on('pause', function () {
                    self.trigger('stateChange', H5P.Video.PAUSED);
                });

                bunnyPlayer.on('ended', function () {
                    self.trigger('stateChange', H5P.Video.ENDED);
                });

                bunnyPlayer.on('timeupdate', function (data) {
                    currentTime = data.seconds;
                    if (data.duration) {
                        duration = data.duration;
                    }
                });

                bunnyPlayer.on('progress', function (data) {
                    buffered = data.percent * 100;
                });

                bunnyPlayer.on('error', function () {
                    self.trigger('error', l10n.unknownError);
                });

                // The ready event — initialize duration and fire H5P events
                bunnyPlayer.on('ready', function () {
                    clearTimeout(loadingFailedTimeout);
                    player = bunnyPlayer;
                    isLoaded = true;

                    // Get duration via callback approach
                    bunnyPlayer.getDuration(function (dur) {
                        duration = dur;

                        removeLoadingIndicator();

                        // Handle startAt
                        if (options.startAt) {
                            bunnyPlayer.setCurrentTime(options.startAt);
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
            $container.addClass('h5p-bunny').append($wrapper);
            createBunnyPlayer();
        };

        /**
         * Get list of available qualities.
         * @public
         * @returns {Array}
         */
        self.getQualities = function () {};

        /**
         * Get the current quality.
         * @returns {String}
         */
        self.getQuality = function () {};

        /**
         * Set the playback quality.
         * @public
         * @param {String} quality
         */
        self.setQuality = function (quality) {};

        /**
         * Start the video.
         * @public
         */
        var pendingPlay = false;
        self.play = function () {
            if (!player) {
                // Player not ready yet — queue play for when it's loaded
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
        self.setCaptionsTrack = function (track) {};

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
                createBunnyPlayer();
                return;
            }

            // Set width to 100% to measure available space,
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
    BunnyPlayer.canPlay = function (sources) {
        return getId(sources[0].path);
    };

    /**
     * Find library ID and video ID from a Bunny Stream URL.
     *
     * @private
     * @param {String} url
     * @returns {Object|undefined} { libraryId, videoId }
     */
    var getId = function (url) {
        // Match: iframe.mediadelivery.net/embed/{libraryId}/{videoId}
        var matches = url.match(/(?:iframe\.mediadelivery\.net\/embed)\/(\d+)\/([a-f0-9-]+)/);
        if (matches && matches[1] && matches[2]) {
            return { libraryId: matches[1], videoId: matches[2] };
        }
    };

    /**
     * Load the Bunny Player.js SDK asynchronously.
     *
     * @private
     * @param {Function} callback Called with the playerjs global when loaded
     */
    var loadBunnyPlayerSDK = function (callback) {
        if (window.playerjs) {
            callback(window.playerjs);
            return;
        }

        var tag = document.createElement('script');
        tag.src = 'https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js';
        tag.onload = function () { callback(window.playerjs); };
        tag.onerror = function () { console.error('[H5P.Video] Failed to load Bunny player.js SDK'); };
        var firstScript = document.querySelector('script');
        if (firstScript) {
            firstScript.parentNode.insertBefore(tag, firstScript);
        }
        else {
            document.head.appendChild(tag);
        }
    };

    return BunnyPlayer;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoBunny);
