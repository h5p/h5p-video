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

      var videoPath = getPath(sources[0].path);

      player = $('<iframe/>', {
            id: id,
            src: videoPath,
            width: width,
            height: width * (9/16),
            allow: "autoplay; fullscreen",
            controls: "",
        });
      $placeholder.replaceWith(player);

      player.load(function() {
        playerloaded = true;
        self.trigger('ready');
        var listenLoaded = function(data) {
          if (!isNaN(data.data.value)) {
            duration = data.data.value;
            window.removeEventListener("message", listenLoaded, false);
            self.loaded(id);
            self.trigger('loaded');
          } else {
            document.getElementById(id).contentWindow.postMessage({
              command: 'get_duration'}, 'https://www.nanoo.tv');
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
      window.addEventListener("message", function(data) {
        if (data.data.key === "current_position") {
          currentTime = data.data.value;
        }
        if (data.data.key === "duration") {
          duration = data.data.value;
        }
      }, false);
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
      if (!player || !player.getAvailableQualityLevels) {
        return;
      }

      var qualities = player.getAvailableQualityLevels();
      if (!qualities.length) {
        return; // No qualities
      }

      // Add labels
      for (var i = 0; i < qualities.length; i++) {
        var quality = qualities[i];
        var label = (LABELS[quality] !== undefined ? LABELS[quality] : 'Unknown'); // TODO: l10n
        qualities[i] = {
          name: quality,
          label: LABELS[quality]
        };
      }

      return qualities;
    };

    /**
     * Get current playback quality. Not available until after play.
     *
     * @public
     * @returns {String}
     */
    self.getQuality = function () {
      if (!player || !player.getPlaybackQuality) {
        return;
      }

      var quality = player.getPlaybackQuality();
      return quality === 'unknown' ? undefined : quality;
    };

    /**
     * Set current playback quality. Not available until after play.
     * Listen to event "qualityChange" to check if successful.
     *
     * @public
     * @params {String} [quality]
     */
    self.setQuality = function (quality) {
      if (!player || !player.setPlaybackQuality) {
        return;
      }

      player.setPlaybackQuality(quality);
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
      if (!player || !player.getVideoLoadedFraction) {
        return;
      }

      return player.getVideoLoadedFraction() * 100;
    };

    /**
     * Turn off video sound.
     *
     * @public
     */
    self.mute = function () {
      if (!player || !player.mute) {
        return;
      }

      player.mute();
    };

    /**
     * Turn on video sound.
     *
     * @public
     */
    self.unMute = function () {
      if (!player || !player.unMute) {
        return;
      }

      player.unMute();
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
      if (!player || !player.getVolume) {
        return;
      }

      return player.getVolume();
    };

    /**
     * Set video sound level.
     *
     * @public
     * @param {Number} level Between 0 and 100.
     */
    self.setVolume = function (level) {
      if (!player || !player.setVolume) {
        return;
      }

      player.setVolume(level);
    };

    // /**
    //  * Get list of available playback rates.
    //  *
    //  * @public
    //  * @returns {Array} available playback rates
    //  */
    // self.getPlaybackRates = function () {
    //   // if (!player || !player.getAvailablePlaybackRates) {
    //   //   return;
    //   // }
    //   //
    //   // var playbackRates = player.getAvailablePlaybackRates();
    //   // if (!playbackRates.length) {
    //   //   return; // No rates, but the array should contain at least 1
    //   // }
    //   //
    //   // return playbackRates;
    // };
    //
    // /**
    //  * Get current playback rate.
    //  *
    //  * @public
    //  * @returns {Number} such as 0.25, 0.5, 1, 1.25, 1.5 and 2
    //  */
    // self.getPlaybackRate = function () {
    //   // if (!player || !player.getPlaybackRate) {
    //   //   return;
    //   // }
    //   //
    //   // return player.getPlaybackRate();
    // };
    //
    // /**
    //  * Set current playback rate.
    //  * Listen to event "playbackRateChange" to check if successful.
    //  *
    //  * @public
    //  * @params {Number} suggested rate that may be rounded to supported values
    //  */
    // self.setPlaybackRate = function (newPlaybackRate) {
    //   // if (!player || !player.setPlaybackRate) {
    //   //   return;
    //   // }
    //   //
    //   // playbackRate = Number(newPlaybackRate);
    //   // player.setPlaybackRate(playbackRate);
    // };

    /**
     * Set current captions track.
     *
     * @param {H5P.Video.LabelValue} Captions track to show during playback
     */
    self.setCaptionsTrack = function (track) {
      player.setOption('captions', 'track', track ? {languageCode: track.value} : {});
    };

    /**
     * Figure out which captions track is currently used.
     *
     * @return {H5P.Video.LabelValue} Captions track
     */
    self.getCaptionsTrack = function () {
      var track = player.getOption('captions', 'track');
      return (track.languageCode ? new H5P.Video.LabelValue(track.displayName, track.languageCode) : null);
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
      return "https:\/\/nanoo.tv\/link\/w\/".concat(matches[3]);
    }
  };

  /** @constant {Object} */
  var LABELS = {
    highres: '2160p', // Old API support
    hd2160: '2160p', // (New API)
    hd1440: '1440p',
    hd1080: '1080p',
    hd720: '720p',
    large: '480p',
    medium: '360p',
    small: '240p',
    tiny: '144p',
    auto: 'Auto'
  };

  /** @private */
  var numInstances = 0;
  var playerloaded;
  /** TODO: Make array */
  var currentTime = 0;
  var duration = 0;

  // Extract the current origin (used for security)
  var ORIGIN = window.location.href.match(/http[s]?:\/\/[^\/]+/);
  ORIGIN = !ORIGIN || ORIGIN[0] === undefined ? undefined : ORIGIN[0];
  // ORIGIN = undefined is needed to support fetching file from device local storage

  return NanooTv;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoNanooTv);
