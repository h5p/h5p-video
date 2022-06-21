/** @namespace H5P */
H5P.VideoWarpwire = (function ($) {

  /**
   * Warpwire video player for H5P.
   *
   * @class
   * @param {Array} sources Video files to use
   * @param {Object} options Settings for the player
   * @param {Object} l10n Localization strings
   */
  function Warpwire(sources, options, l10n) {
    var self = this;
    var player;
    var playbackRate = 1;
    var id = 'h5p-warpwire-' + numInstances;
    var warpwireVideoId = 'h5p-warpwire-video-' + numInstances;
    var warpwireSourceIndex = numInstances;
    numInstances++;
    var $wrapper = $('<div/>');

    // Create Warpwire video placeholder
    var localUrl = new URL(sources[0].path);
    localUrl.searchParams.set('controls', (options.controls ? 1 : 0));
    localUrl.searchParams.set('share', 0);
    localUrl.searchParams.set('title', 0);
    localUrl.searchParams.set('loop', (options.loop ? 1 : 0));    
    localUrl.searchParams.set('rel', 0);    
    localUrl.searchParams.set('autoplay', (options.autoplay ? 1 : 0));
    localUrl.searchParams.set('origin', encodeURIComponent(ORIGIN));

    var $placeholder = $('<iframe id="' + warpwireVideoId + '" data-ww-id="' + warpwireVideoId + '" type="text/html" width="100%" style="min-height: 360px;" src="' + localUrl.toString() + '" frameborder="0" allow="autoplay *; encrypted-media *; fullscreen *; picture-in-picture *;" allowfullscreen></iframe>').appendTo($wrapper);

    /**
     * Load the Warpwire API and create a placeholder that contains the resources
     *
     * @private
     */
    var create = function () {
      if (!$placeholder.is(':visible') || player !== undefined) {
        return;
      }

      if (window.WWApi === undefined) {
        // Load API first
        loadAPI(create, warpwireVideoId);
        return;
      }
      if (typeof window.WWApi(warpwireVideoId) === undefined || typeof window.warpwirePlayerReady == 'undefined' || window.warpwirePlayerReady[warpwireVideoId] !== true) {
        return;
      }

      var width = $wrapper.width();
      if (width < 200) {
        width = 200;
      }

      player = window.WWApi(warpwireVideoId); 

      // Captions are ready for loading
      self.trigger('ready');
      self.trigger('loaded');

       // Format track list into valid track options
       var trackOptions = [];
       trackList = player.getCaptions();
       if (trackList.length > 0) {
         for (var i = 0; i < trackList.length; i++) {
           trackOptions.push(new H5P.Video.LabelValue(trackList[i].label, trackList[i].label));
         }
         self.trigger('captions', trackOptions);
       }

       player.onStateChange = function(state) {
        if (state.data > -1 && state.data < 4) {
          // Fix for keeping playback rate in IE11
          if (H5P.Video.IE11_PLAYBACK_RATE_FIX && state.data === H5P.Video.PLAYING && playbackRate !== 1) {
            // YT doesn't know that IE11 changed the rate so it must be reset before it's set to the correct value
            player.setPlaybackRate(1);
            player.setPlaybackRate(playbackRate);
          }
          // End IE11 fix
          self.trigger('stateChange', state.data);
        }
       }

      player.onPlaybackRateChange = function (playbackRate) {
        self.trigger('playbackRateChange', playbackRate.data);
      };

      player.onError = function (error) {
        var message;
            switch (error.data) {
              case -1:
                message = 'Warpwire Player did not load';
                break;

              case 400:
                message = 'A bad request was attempted. Please try again.';
                break;

              default:
                message = l10n.unknownError + ' ' + error.data;
                break;
            }
            self.trigger('error', message);       
      }
    };

    /**
     * Indicates if the video must be clicked for it to start playing.
	 * Warpwire videos always require clicking to start.
     *
     * @public
     */
     self.pressToPlay = true;

    /**
    * Appends the video player to the DOM.
    *
    * @public
    * @param {jQuery} $container
    */
    self.appendTo = function ($container) {
      $container.addClass('h5p-warpwire').append($wrapper);
      create();
    };

    /**
     * Get list of available qualities. Not available until after play.
     *
     * @public
     * @returns {Array}
     */
    self.getQualities = function () {
    };

    /**
     * Get current playback quality. Not available until after play.
     *
     * @public
     * @returns {String}
     */
    self.getQuality = function () {
      return;
    };

    /**
     * Set current playback quality. Not available until after play.
     * Listen to event "qualityChange" to check if successful.
     *
     * @public
     * @params {String} [quality]
     */
    self.setQuality = function (quality) {
      return;
    };

    /**
     * Start the video.
     *
     * @public
     */
    self.play = function () {
      if (!player || !player.play) {
        self.on('ready', self.play);
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
      self.off('ready', self.play);
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

      player.seekTo(time);
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
      if (!player || !player.getMediaLoadedValue) {
        return;
      }

      return player.getMediaLoadedValue() * 100;
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

    /**
     * Get list of available playback rates.
     *
     * @public
     * @returns {Array} available playback rates
     */
    self.getPlaybackRates = function () {
      if (!player || !player.getAvailablePlaybackRates) {
        return;
      }

      var playbackRates = player.getAvailablePlaybackRates();
      if (!playbackRates.length) {
        return; // No rates, but the array should contain at least 1
      }

      return playbackRates;
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
    self.setPlaybackRate = function (newPlaybackRate) {
      if (!player || !player.setPlaybackRate) {
        return;
      }

      playbackRate = Number(newPlaybackRate);
      player.setPlaybackRate(playbackRate);
    };

    /**
     * Set current captions track.
     *
     * @param {H5P.Video.LabelValue} Captions track to show during playback
     */
    self.setCaptionsTrack = function (track) {
      if (!player || !player.setCaption) {
        return;
      }
      if (track == null) {
        player.setCaption('');
      } else {
        player.setCaption(track.value);
      }
    };

    /**
     * Figure out which captions track is currently used.
     *
     * @return {H5P.Video.LabelValue} Captions track
     */
    self.getCaptionsTrack = function () {
      if (!player || !player.getCaptions) {
        return;
      }
      trackList = player.getCaptions();
       if (trackList.length > 0) {
         for (var i = 0; i < trackList.length; i++) {
           if (trackList[i].enabled == true) {
            return (track.label ? new H5P.Video.LabelValue(track.label, track.label) : null);
           }
         }
      }
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

      if (!player || !player.getIframe) {
        return;
      }

      // Use as much space as possible
      $wrapper.css({
        width: '100%',
        height: '100%'
      });

      var width = $wrapper[0].clientWidth;
      var height = options.fit ? $wrapper[0].clientHeight : (width * (9/16));
      
      // Validate height before setting
      if (height > 0) {
        // Set size
        $wrapper.css({
          width: width + 'px',
          height: height + 'px'
        });

        iframe = player.getIframe();
        iframe.width = width;
        iframe.height = height;
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
  Warpwire.canPlay = function (sources) {
    return getId(sources[0].path);
  };

  /**
   * Find id of Warpwire video from given URL.
   *
   * @private
   * @param {String} url
   * @returns {String} Warpwire video identifier
   */

  var getId = function (url) {
    const matches = url.match(/^https?:\/\/([^\/]*\.[^\/]+)\/w\/([-_0-9a-zA-Z]{6,8})\/.*$/);
    if (matches && matches.length === 3) {
      return [matches[1], matches[2]];
    }
  };

  /**
   * Attach the API to previously loaded iFrame attributes
   */
  var loadAPI = function (loaded, warpwireVideoId) {
    if (typeof window.WWApi != undefined && window.onWarpwireReady !== undefined) {
      // Someone else is loading, hook in
      var original = window.onWarpwirePlayerAPIReady;
      window.onWarpwirePlayerAPIReady = function (id) {
        loaded(id);
        original(id);
      };
    }
    else {
      // Load the API our self
      window.onWarpwirePlayerAPIReady = function() {

        window.WWApi = new wwIframeApi();
        if (document.getElementById(warpwireVideoId) != null) {
          window.WWApi(warpwireVideoId).onReady = function(event) {
            if (window.warpwirePlayerReady == undefined) {
              window.warpwirePlayerReady = {};
            }
            window.warpwirePlayerReady[warpwireVideoId] = true;
            loaded(loaded);
          }
        }
        window.onWarpwirePlayerAPIReady = loaded;
      };
      // Load the API our self
      var tag = document.createElement('script');
      tag.src = 'https://www.warpwire.com/player_api/';
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
     
    }
  };

  /** @private */
  var numInstances = 0;

  // Extract the current origin (used for security)
  var ORIGIN = window.location.href.match(/http[s]?:\/\/[^\/]+/);
  ORIGIN = !ORIGIN || ORIGIN[0] === undefined ? undefined : ORIGIN[0];
  // ORIGIN = undefined is needed to support fetching file from device local storage

  return Warpwire;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoWarpwire);
