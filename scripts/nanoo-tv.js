/** @namespace H5P */
H5P.VideoNanooTv = (function ($) {

  /**
   * Nanoo.tv video player for H5P.
   *
   * @class
   * @param {Array} sources Video files to use
   * @param {Object} options Settings for the player
   * @param {Object} l10n Localization strings
   */
  function NanooTv(sources, options, l10n) {
    var self = this;

    var playbackRate = 1;

    id = 'h5p-nanootv-' + numInstances;
    numInstances++;

    var $wrapper = $('<div/>');
    var $placeholder = $('<div/>', {
      id: id,
      text: l10n.loading
    }).appendTo($wrapper);

    // Initialize pressToPlay in order to hide squash overlay in case of a login redirect.
    self.pressToPlay = true;

    self.post = function (params) {
      self.player[0].contentWindow.postMessage(params, 'https://www.nanoo.tv');
    };

    /**
     * Create a new nanoo.tv player
     *
     * @private
     */
    var create = function () {
      if (!$placeholder.is(':visible') || self.player !== undefined) {
        return;
      }

      var width = $wrapper.width();
      if (width < 200) {
        width = 200;
      }

      // Queries the url to a player without controls.
      var videoPath = getPath(sources[0].path);

      // Create iframe holding the nanoo.tv player.
      self.player = $('<iframe/>', {
            id: id,
            src: videoPath,
            width: width,
            height: width * (9/16),
            allow: "accelerometer; fullscreen",
        });
      $placeholder.replaceWith(self.player);


      // Initialize the duration value before actually declaring the player as loaded.
      self.player.load(function() {
        var listenLoaded = function(data) {
          // As long as the nanoo player is not loaded completely, the duration will be returned as NaN.
          if (!isNaN(data.data.value)) {
            duration = data.data.value;
            // The current event listener is no longer needed.
            window.removeEventListener("message", listenLoaded, false);
            // Reset pressToPlay to false in order to show overlays again, after player has loaded.
            self.pressToPlay = false;
            // Initialize relevant variables, event listeners and a heartbeat for querying the currentTime.
            self.loaded(id);
            self.trigger('loaded');
            self.trigger('ready');
            // Trigger stateChange will case the Interactive video overlay to be shown.
            self.trigger('stateChange');
          } else {
            // Retry to query the duration after a short break.
            setTimeout(self.post.bind(self, { command: 'get_duration'}), 50);
          }
        };
        window.addEventListener("message", listenLoaded, false);

        self.post({ command: 'get_duration'});
      });
    };

    /**
     * Registers event listeners for communication with the player in the nested iframe.
     */
    self.loaded = function(id) {
      playerloaded = true;
      // This event listener saves the data returned from the nanoo.tv player after queries through postMessage calls.
      window.addEventListener("message", function(data) {
        switch (data.data.key) {
          case "current_position":
            currentTime = data.data.value;
            if (currentTime === duration) {
              self.trigger('stateChange', H5P.Video.ENDED);
            }
            break;
          case "duration":
            duration = data.data.value;
            break;
          case "playback_rate":
            playbackRate = data.data.value;
            self.trigger('playbackRateChange', playbackRate);
            break;
        }
      }, false);
      // Heartbeat for querying the currentTime of the player.
      window.setInterval(self.post.bind(self, { command: 'get_current_position'}), 250);
    };

    /**
    * Appends the video player to the DOM.
    *
    * @public
    * @param {jQuery} $container
    */
    self.appendTo = function ($container) {
      $container.addClass('h5p-nanootv').append($wrapper);
      create();
    };

    /**
     * Get list of available qualities. Not available until after play.
     *
     * @public
     * @returns {Array}
     */
    self.getQualities = function () {
      // Currently not supported.
    };

    /**
     * Get current playback quality. Not available until after play.
     *
     * @public
     * @returns {String}
     */
    self.getQuality = function () {
      // Currently not supported.
    };

    /**
     * Set current playback quality. Not available until after play.
     * Listen to event "qualityChange" to check if successful.
     *
     * @public
     * @params {String} [quality]
     */
    self.setQuality = function (quality) {
      // Currently not supported.
    };

    /**
     * Start the video.
     *
     * @public
     */
    self.play = function () {
      if (!self.player || playerloaded === undefined) {
        self.on('ready', self.play);
        return;
      }

      self.post({ command: 'play' });
      self.trigger('stateChange', H5P.Video.PLAYING);
    };

    /**
     * Pause the video.
     *
     * @public
     */
    self.pause = function () {
      self.off('ready', self.play);
      if (!self.player || playerloaded === undefined) {
        return;
      }

      self.post({ command: 'pause' });
      self.trigger('stateChange', H5P.Video.PAUSED);
    };

    /**
     * Seek video to given time.
     *
     * @public
     * @param {Number} time
     */
    self.seek = function (time) {
      if (!self.player || playerloaded === undefined) {
        return;
      }

      self.post({ command: 'seek', argument: time });
    };

    /**
     * Get elapsed time since video beginning.
     *
     * @public
     * @returns {Number}
     */
    self.getCurrentTime = function () {
      if (!self.player || playerloaded === undefined) {
        return;
      }

      return currentTime;
    };

    /**
     * Get total video duration time.
     *
     * @public
     * @returns {Number}
     */
    self.getDuration = function () {
      if (!self.player || playerloaded === undefined) {
        return;
      }

      return duration;
    };

    /**
     * Get percentage of video that is buffered.
     *
     * @public
     * @returns {Number} Between 0 and 100
     */
    self.getBuffered = function () {
      // Currently not supported.
    };

    /**
     * Turn off video sound.
     *
     * @public
     */
    self.mute = function () {
      if (!self.player || playerloaded === undefined) {
        return;
      }

      self.post( { command: 'mute', argument: true } )
    };

    /**
     * Turn on video sound.
     *
     * @public
     */
    self.unMute = function () {
      if (!self.player || playerloaded === undefined) {
        return;
      }

      self.post( { command: 'mute', argument: false } )
    };

    /**
     * Check if video sound is turned on or off.
     *
     * @public
     * @returns {Boolean}
     */
    self.isMuted = function () {
      if (!self.player || !self.player.isMuted) {
        return;
      }

      return self.player.isMuted();
    };

    /**
     * Return the video sound level.
     *
     * @public
     * @returns {Number} Between 0 and 100.
     */
    self.getVolume = function () {
      if (!self.player || playerloaded === undefined) {
        return;
      }

      return 100;
    };

    /**
     * Set video sound level.
     *
     * @public
     * @param {Number} level Between 0 and 100.
     */
    self.setVolume = function (level) {
      if (!self.player || playerloaded === undefined) {
        return;
      }

      self.post( { command: 'volume', argument: level/100 } );
    };

    /**
     * Get list of available playback rates.
     *
     * @public
     * @returns {Array} available playback rates
     */
    self.getPlaybackRates = function () {
      if (!self.player || playerloaded === undefined) {
        return;
      }

      return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    };

    /**
     * Get current playback rate.
     *
     * @public
     * @returns {Number} such as 0.25, 0.5, 1, 1.25, 1.5 and 2
     */
    self.getPlaybackRate = function () {
      if (!self.player || playerloaded === undefined) {
        return;
      }

      return playbackRate;
    };

    /**
     * Set current playback rate.
     * Listen to event "playbackRateChange" to check if successful.
     *
     * @public
     * @params {Number} suggested rate that may be rounded to supported values
     */
    self.setPlaybackRate = function (newPlaybackRate) {
      if (!self.player || playerloaded === undefined) {
        return;
      }

      self.post( { command: 'playback_rate', argument: newPlaybackRate } )
      self.post( { command: 'get_playback_rate'} )
    };

    /**
     * Set current captions track.
     *
     * @param {H5P.Video.LabelValue} Captions track to show during playback
     */
    self.setCaptionsTrack = function (track) {
      // Currently not supported.
    };

    /**
     * Figure out which captions track is currently used.
     *
     * @return {H5P.Video.LabelValue} Captions track
     */
    self.getCaptionsTrack = function () {
      // Currently not supported.
    };

    // Respond to resize events by setting the YT player size.
    self.on('resize', function () {
      if (!$wrapper.is(':visible')) {
        return;
      }

      if (!self.player) {
        // Player isn't created yet. Try again.
        create();
        return;
      }

      // Use as much space as possible
      $wrapper.css({
        width: '100%',
        height: '100%'
      });

      var width = $wrapper[0].clientWidth;
      var height = options.fit ? $wrapper[0].clientHeight : (width * (9/16));

      // Set size
      $wrapper.css({
        width: width + 'px',
        height: height + 'px'
      });

      self.player.css({
        width: width + 'px',
        height: height + 'px'
      });
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
  NanooTv.canPlay = function (sources) {
    var canPlay = getPath(sources[0].path);
    return canPlay;
  };

  /**
   * Find path to embed video of Nanoo.tv video from given URL.
   *
   * @private
   * @param {String} url
   * @returns {String} Nanoo.tv embed video url
   */

  var getPath = function (url) {
    var matches = url.match(/(nanoo.tv\/link\/(v|w|W)\/)([A-Za-z0-9_-]+)/i);
    if (matches && matches[3]) {
      return "https:\/\/nanoo.tv\/link\/W\/".concat(matches[3]);
    }
  };

  /** @private */
  var numInstances = 0;
  var playerloaded;
  var currentTime = 0;
  var duration = 0;
  var playbackRate = 1.0;

  // Extract the current origin (used for security)
  var ORIGIN = window.location.href.match(/http[s]?:\/\/[^\/]+/);
  ORIGIN = !ORIGIN || ORIGIN[0] === undefined ? undefined : ORIGIN[0];
  // ORIGIN = undefined is needed to support fetching file from device local storage

  return NanooTv;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoNanooTv);
