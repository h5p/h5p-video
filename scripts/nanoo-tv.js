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

    var player;
    var playbackRate = 1;
    /** TODO: Check if global ID is a problem in case of multiple nanoo.tv videos on the same page */
    id = 'h5p-nanootv-' + numInstances;
    numInstances++;

    var $wrapper = $('<div/>');
    var $placeholder = $('<div/>', {
      id: id,
      text: l10n.loading
    }).appendTo($wrapper);

    /**
     * Use the YouTube API to create a new player
     *
     * @private
     */
    var create = function () {
      if (!$placeholder.is(':visible') || player !== undefined) {
        return;
      }

      var width = $wrapper.width();
      if (width < 200) {
        width = 200;
      }

      // Queries the url to a player without controls.
      var videoPath = getPath(sources[0].path);

      // Create iframe holding the nanoo.tv player.
      player = $('<iframe/>', {
            id: id,
            src: videoPath,
            width: width,
            height: width * (9/16),
            allow: "accelerometer; autoplay; fullscreen",
        });
      $placeholder.replaceWith(player);


      // Initialize the duration value before actually declaring the player as loaded.
      player.load(function() {
        var listenLoaded = function(data) {
          // As long as the nanoo player is not loaded completely, the duration will be returned as NaN.
          if (!isNaN(data.data.value)) {
            duration = data.data.value;
            // The current event listener is no longer needed.
            window.removeEventListener("message", listenLoaded, false);
            // Initialize relevant variables, event listeners and a heartbeat for querying the currentTime.
            self.loaded(id);
            self.trigger('loaded');
            self.trigger('ready');
          } else {
            // Retry to query the duration after a short break.
            setTimeout(document.getElementById(id).contentWindow.postMessage({
              command: 'get_duration'}, 'https://www.nanoo.tv'), 50);
          }
        };
        window.addEventListener("message", listenLoaded, false);

        document.getElementById(id).contentWindow.postMessage({
          command: 'get_duration'}, 'https://www.nanoo.tv');
      });
    };

    /**
     * Indicates if the video must be clicked for it to start playing.
     * For instance YouTube videos on iPad must be pressed to start playing.
     *
     * @public
     */
    self.pressToPlay = navigator.userAgent.match(/iPad/i) ? true : false;

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
      window.setInterval(function() {
        document.getElementById(id).contentWindow.postMessage({
          command: 'get_current_position'}, 'https://www.nanoo.tv');
      }, 250);
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
      if (!player || playerloaded === undefined) {
        self.on('ready', self.play);
        return;
      }

      document.getElementById(id).contentWindow.postMessage({
        command: 'play' }, 'https://www.nanoo.tv');
      self.trigger('stateChange', H5P.Video.PLAYING);
    };

    /**
     * Pause the video.
     *
     * @public
     */
    self.pause = function () {
      self.off('ready', self.play);
      if (!player || playerloaded === undefined) {
        return;
      }

      document.getElementById(id).contentWindow.postMessage({
          command: 'pause' }, 'https://www.nanoo.tv');
      self.trigger('stateChange', H5P.Video.PAUSED);
    };

    /**
     * Seek video to given time.
     *
     * @public
     * @param {Number} time
     */
    self.seek = function (time) {
      if (!player || playerloaded === undefined) {
        return;
      }

      document.getElementById(id).contentWindow.postMessage({
        command: 'seek', argument: time }, 'https://www.nanoo.tv');
    };

    /**
     * Get elapsed time since video beginning.
     *
     * @public
     * @returns {Number}
     */
    self.getCurrentTime = function () {
      if (!player || playerloaded === undefined) {
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
      if (!player || playerloaded === undefined) {
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
      if (!player || playerloaded === undefined) {
        return;
      }

      document.getElementById(id).contentWindow.postMessage(
          { command: 'mute', argument: true }, 'https://www.nanoo.tv' )
    };

    /**
     * Turn on video sound.
     *
     * @public
     */
    self.unMute = function () {
      if (!player || playerloaded === undefined) {
        return;
      }

      document.getElementById(id).contentWindow.postMessage(
          { command: 'mute', argument: false }, 'https://www.nanoo.tv' )
    };

    /**
     * Check if video sound is turned on or off.
     *
     * @public
     * @returns {Boolean}
     */
    self.isMuted = function () {
      if (!player || !player.isMuted) {
        return;
      }

      return player.isMuted();
    };

    /**
     * Return the video sound level.
     *
     * @public
     * @returns {Number} Between 0 and 100.
     */
    self.getVolume = function () {
      if (!player || playerloaded === undefined) {
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
      if (!player || playerloaded === undefined) {
        return;
      }

      document.getElementById(id).contentWindow.postMessage(
          { command: 'volume', argument: level/100 }, 'https://www.nanoo.tv' );
    };

    /**
     * Get list of available playback rates.
     *
     * @public
     * @returns {Array} available playback rates
     */
    self.getPlaybackRates = function () {
      if (!player || playerloaded === undefined) {
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
      if (!player || playerloaded === undefined) {
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
      if (!player || playerloaded === undefined) {
        return;
      }

      document.getElementById(id).contentWindow.postMessage(
          { command: 'playback_rate', argument: newPlaybackRate }, 'https://www.nanoo.tv' )
      document.getElementById(id).contentWindow.postMessage(
          { command: 'get_playback_rate'}, 'https://www.nanoo.tv' )
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

      if (!player) {
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

      player.css({
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
    /** TODO: Make sure it only procs for nanoo.tv videos and also that html5 does not get called! */
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
    var matches = url.match(/(nanoo.tv\/link\/(v|w)\/)([A-Za-z0-9_-]+)/i);
    if (matches && matches[3]) {
      return "https:\/\/nanoo.tv\/link\/W\/".concat(matches[3]);
    }
  };

  /** @private */
  var numInstances = 0;
  var playerloaded;
  /** TODO: Make array */
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
