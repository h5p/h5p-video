/** @namespace H5P */
H5P.VideoPanopto = (function ($) {

  /**
   * Panopto video player for H5P.
   *
   * @class
   * @param {Array} sources Video files to use
   * @param {Object} options Settings for the player
   * @param {Object} l10n Localization strings
   */
  function Panopto(sources, options, l10n) {
    var self = this;

    var player;
    var playbackRate = 1;
    var id = 'h5p-panopto-' + numInstances;
    numInstances++;

    var $wrapper = $('<div/>');
    var $placeholder = $('<div/>', {
      id: id,
      text: l10n.loading
    }).appendTo($wrapper);

    /**
     * Use the Panopto API to create a new player
     *
     * @private
     */
    var create = function () {
      if (!$placeholder.is(':visible') || player !== undefined) {
        return;
      }

      if (window.EmbedApi === undefined) {
        // Load API first
        loadAPI(create);
        return;
      }

      var width = $wrapper.width();
      if (width < 200) {
        width = 200;
      }

      const videoId = getId(sources[0].path);

      player = new EmbedApi(id, {
        width: width,
        height: width * (9/16),
        serverName: videoId[0],
        sessionId: videoId[1],
        videoParams: { // Optional
          interactivity: 'none',
          showtitle: false,
          autohide: true,
          offerviewer: false,
          autoplay: false,
          showbrand: false,
          start: 0
        },
        events: {
          onIframeReady: function () {
            console.log('onIframeReady');
            //player.loadVideo();
          },
          onReady: function () {
            console.log('onReady');
            //self.trigger('ready');
            //self.trigger('loaded');
          },
          onStateChange: function (state) {
            console.log('onStateChange', state);
            // TODO: Playback rate fix for IE11?
            /*
            if (state.data > -1 && state.data < 4) {
              self.trigger('stateChange', state.data);
            }
            */
            console.log(window.PlayerState);
          },
          onPlaybackRateChange: function () {
            console.log('onPlaybackRateChange', arguments);
          },
          onError: function () {
            console.log('onError', arguments);
          }
        }
      });
    };

    /**
     * Indicates if the video must be clicked for it to start playing.
     * For instance Panopto videos on iPad must be pressed to start playing.
     *
     * @public
     */
    self.pressToPlay = navigator.userAgent.match(/iPad/i) ? true : false; // TODO: Check if this is true for Panopto

    /**
    * Appends the video player to the DOM.
    *
    * @public
    * @param {jQuery} $container
    */
    self.appendTo = function ($container) {
      $container.addClass('h5p-panopto').append($wrapper);
      create();
    };

    /**
     * Get list of available qualities. Not available until after play.
     *
     * @public
     * @returns {Array}
     */
    self.getQualities = function () {
      // Not available for Panopto
    };

    /**
     * Get current playback quality. Not available until after play.
     *
     * @public
     * @returns {String}
     */
    self.getQuality = function () {
      // Not available for Panopto
    };

    /**
     * Set current playback quality. Not available until after play.
     * Listen to event "qualityChange" to check if successful.
     *
     * @public
     * @params {String} [quality]
     */
    self.setQuality = function (quality) {
      // Not available for Panopto
    };

    /**
     * Start the video.
     *
     * @public
     */
    self.play = function () {
      if (!player || !player.playVideo) {
        //self.on('ready', self.play); // TODO: Figure out if this will work
        return;
      }

      player.playVideo();
    };

    /**
     * Pause the video.
     *
     * @public
     */
    self.pause = function () {
      //self.off('ready', self.play); // TODO: Figure out if this will work
      if (!player || !player.pauseVideo) {
        return;
      }
      player.pauseVideo();
    };

    /**
     * Seek video to given time.
     *
     * @public
     * @param {Number} time
     */
    self.seek = function (time) {
      if (!player || !player.setPosition) {
        return;
      }

      player.setPosition(time);
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

      return player.getDuration();
    };

    /**
     * Get percentage of video that is buffered.
     *
     * @public
     * @returns {Number} Between 0 and 100
     */
    self.getBuffered = function () {
      // Not available for Panopto
    };

    /**
     * Turn off video sound.
     *
     * @public
     */
    self.mute = function () {
      if (!player || !player.muteVideo) {
        return;
      }

      player.muteVideo();
    };

    /**
     * Turn on video sound.
     *
     * @public
     */
    self.unMute = function () {
      if (!player || !player.unmuteVideo) {
        return;
      }

      player.unmuteVideo();
    };

    /**
     * Check if video sound is turned on or off.
     *
     * @public
     * @returns {Boolean}
     */
    self.isMuted = function () {
      if (!player || !player.getIsMuted) {
        return;
      }

      return player.getIsMuted();
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

      return player.getVolume() * 100;
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
      return [0.25, 0.5, 1, 1.25, 1.5, 2];
    };

    /**
     * Get current playback rate.
     *
     * @public
     * @returns {Number} such as 0.25, 0.5, 1, 1.25, 1.5 and 2
     */
    self.getPlaybackRate = function () {
      if (!player || !player.getSpeed) {
        return;
      }

      return player.getSpeed();
    };

    /**
     * Set current playback rate.
     * Listen to event "playbackRateChange" to check if successful.
     *
     * @public
     * @params {Number} suggested rate that may be rounded to supported values
     */
    self.setPlaybackRate = function (newPlaybackRate) {
      if (!player || !player.setSpeed) {
        return;
      }

      player.setSpeed(newPlaybackRate);
    };

    /**
     * Set current captions track.
     *
     * @param {H5P.Video.LabelValue} Captions track to show during playback
     */
    self.setCaptionsTrack = function (track) {
      if (captionsEnabled) {
        player.disableCaptions();
        captionsEnabled = false;
      }
      else {
        player.enableCaptions();
        captionsEnabled = true;
      }
    };

    /**
     * Figure out which captions track is currently used.
     *
     * @return {H5P.Video.LabelValue} Captions track
     */
    self.getCaptionsTrack = function () {
      return captionsEnabled ? captions[0] : null;
    };

    // Respond to resize events by setting the player size.
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
    });

    let captionsEnabled;
    const captions = [
      new H5P.Video.LabelValue('On', 0)
    ];

    self.on('loaded', function () {
      self.trigger('captions', captions);
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
  Panopto.canPlay = function (sources) {
    return getId(sources[0].path);
  };

  /**
   * Find id of YouTube video from given URL.
   *
   * @private
   * @param {String} url
   * @returns {String} YouTube video identifier
   */
  var getId = function (url) {
    const matches = url.match(/^[^\/]+:\/\/([^\/]+).+\?id=(.+)$/);
    if (matches && matches.length === 3) {
      return [matches[1], matches[2]];
    }
  };

  /**
   * Load the IFrame Player API asynchronously.
   */
  var loadAPI = function (loaded) {
    if (window.onPanoptoEmbedApiReady !== undefined) {
      // Someone else is loading, hook in
      var original = window.onPanoptoEmbedApiReady;
      window.onPanoptoEmbedApiReady = function (id) {
        loaded(id);
        original(id);
      };
    }
    else {
      // Load the API our self
      var tag = document.createElement('script');
      tag.src = 'https://developers.panopto.com/scripts/embedapi.min.js';
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onPanoptoEmbedApiReady = loaded;
    }
  };

  /** @private */
  var numInstances = 0;

  return Panopto;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoPanopto);
