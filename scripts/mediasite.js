/** @namespace H5P */
H5P.VideoMediasite = (function ($) {

  /**
   * YouTube video player for H5P.
   *
   * @class
   * @param {Array} sources Video files to use
   * @param {Object} options Settings for the player
   * @param {Object} l10n Localization strings
   */
  function Mediasite(sources, options, l10n) {
    var self = this;

    var player;
    var id = 'h5p-mediasite-' + numInstances;
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

      // 1 video
      // var url = "https://mediasite.ntnu.no/Mediasite/Play/96517566bd5f4e989c628563e16959121d";
      // 2 videos
      // var url = "https://mediasite.ntnu.no/Mediasite/Play/39113612851e4ba3a5136837e8aad7661d";
      // 3 videos
      var url = "https://mediasite.ntnu.no/Mediasite/Play/8b2148aa6b66439a9de5b7e53f74cdbc1d";

      var stringToCode = {
        'opening': H5P.Video.BUFFERING,
        'buffering': H5P.Video.BUFFERING,
        'paused': H5P.Video.PAUSED,
        'playing': H5P.Video.PLAYING,
        'mediaended': H5P.Video.ENDED
      }

      player = new window.Mediasite.Player(id, {
        url: url + (url.indexOf("?") == -1 ? "?" : "&") + "player=MediasiteIntegration",
        layoutOptions: {
          ForceBalanced: false,
          SideBias: "Left"
        },
        events: {
          ready: function () {
            self.trigger('ready');
            self.trigger('loaded');
          },
          playstatechanged: function (eventData) {
            self.trigger('stateChange', stringToCode[eventData.playState]);
          },
          durationchanged: function (eventData) {
            // TODO
          }
        }
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
    * Appends the video player to the DOM.
    *
    * @public
    * @param {jQuery} $container
    */
    self.appendTo = function ($container) {
      $container.addClass('h5p-mediasite').append($wrapper);
      create();
    };

    /**
     * Get list of available qualities. Not available until after play.
     *
     * @public
     * @returns {Array}
     */
    self.getQualities = function () { /* Not supported */ };

    /**
     * Get current playback quality. Not available until after play.
     *
     * @public
     * @returns {String}
     */
    self.getQuality = function () { /* Not supported */ };

    /**
     * Set current playback quality. Not available until after play.
     * Listen to event "qualityChange" to check if successful.
     *
     * @public
     * @params {String} [quality]
     */
    self.setQuality = function (quality) { /* Not supported */ };

    /**
     * Start the video.
     *
     * @public
     */
    self.play = function () {
      if (!player || !player.play) {
        //self.on('ready', self.play);
        return;
      }

      player.play();
    };

    /**
     * Pause the video.
     *
     * @public
     */
    self.pause = function () {
      //self.off('ready', self.play);
      if (!player || !player.pause) {
        return;
      }
      player.pause();
    };

    /**
     * Seek video to given time.
     *
     * @public
     * @param {Number} time
     */
    self.seek = function (time) {
      if (!player || !player.seekTo) {
        return;
      }

      player.seekTo(time, true);
    };

    /**
     * Get elapsed time since video beginning.
     *
     * @public
     * @returns {Number}
     */
    self.getCurrentTime = function () {
      if (!player || !player.getCurrentTime) {
        return;
      }

      return player.getCurrentTime();
    };

    /**
     * Get total video duration time.
     *
     * @public
     * @returns {Number}
     */
    self.getDuration = function () {
      if (!player || !player.getDuration) {
        return;
      }

      var dur = player.getDuration();;
      console.log('duration', dur);

      return 538;
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
    var kk = true;
    self.mute = function () {
      if (!player || !player.mute) {
        return;
      }

      console.log(player.getChapters());
      console.log(player.getCaptions());
      console.log(player.getCurrentSlide());
      console.log(player.getPollsUri());
      console.log(player.getAllStreams());
      console.log(player.getLiveStatus());
      console.log(player.getSlides());
      console.log(player.getLinks());

      player.setLayoutOptions({
        /*BackgroundColor: '#ffffff',*/
        /*ForceBalanced: true ,*/
        /*SideBias: "Right"*/
      });

      kk = !kk;
      player.setVisibleStreamTypes([ kk ? 4 : 0 ]);

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

    /**
     * Get list of available playback rates.
     *
     * @public
     * @returns {Array} available playback rates
     */
    self.getPlaybackRates = function () {
      // Not supported
      return [];
    };

    /**
     * Get current playback rate.
     *
     * @public
     * @returns {Number} such as 0.25, 0.5, 1, 1.25, 1.5 and 2
     */
    self.getPlaybackRate = function () {
      if (!player || !player.getPlaybackRate) {
        return;
      }

      return player.getPlaybackRate();
    };

    /**
     * Set current playback rate.
     * Listen to event "playbackRateChange" to check if successful.
     *
     * @public
     * @params {Number} suggested rate that may be rounded to supported values
     */
    self.setPlaybackRate = function (playbackRate) {
      // Not supported
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

      //player.setSize(width, height);
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
  Mediasite.canPlay = function (sources) {
    // Hardcoded for now
    return true;
  };

  /** @constant {Object} */
  var LABELS = {
    highres: '2160p',
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

  var PLAYBACK_RATES = [0.25, 0.5, 1, 1.25, 1.5, 2];

  return Mediasite;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoMediasite);
