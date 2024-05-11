/** @namespace Echo */
H5P.VideoEchoVideo = (() => {

  let numInstances = 0;

  /**
   * EchoVideo video player for H5P.
   *
   * @class
   * @param {Array} sources Video files to use
   * @param {Object} options Settings for the player
   * @param {Object} l10n Localization strings
   */
  function EchoPlayer(sources, options, l10n) {
    // State variables for the Player.
    let player = undefined;
    let buffered = 0;
    let currentQuality;
    let currentTextTrack;
    let currentTime = 0;
    let duration = 0;
    let isMuted = false;
    let loadingComplete = false;
    let volume = 1;
    let playbackRate = 1;
    let qualities = [];
    let loadingFailedTimeout;
    let failedLoading = false;
    let ratio = 9 / 16;
    let currentState = H5P.Video.VIDEO_CUED;

    // Player specific immutable variables.
    const LOADING_TIMEOUT_IN_SECONDS = 30;
    const id = `h5p-echo-${++numInstances}`;
    const wrapperElement = document.createElement('div');
    const placeholderElement = document.createElement('div');

    wrapperElement.setAttribute('id', id);
    placeholderElement.innerHTML = `<div class="h5p-video-loading" style="height: 100%; min-height: 200px; display: block; z-index: 100; border: none;" aria-label="${l10n.loading}"></div>`;
    wrapperElement.append(placeholderElement);

    /**
     * Remove all elements from the placeholder dom element.
     *
     * @private
     */
    const removeLoadingIndicator = () => {
      placeholderElement.replaceChildren();
    };

    /**
     * Generate an array of objects for use in a dropdown from the list of resolutions.
     * @private
     * @param {Array} qualityLevels - list of objects with supported qualities for the media
     * @returns {Array} list of objects with label and name properties
     */
    const mapQualityLevels = (qualityLevels) => {
      const qualities = qualityLevels.map((quality) => {
        return { label: quality.label.toLowerCase(), name: quality.value };
      });
      return qualities;
    };

    /**
     * Register event listeners on the given Echo player.
     *
     * @private
     * @param {HTMLElement} player
     */
    const registerEchoPlayerEventListeneners = (player) => {
      player.resolveLoading = null;
      player.loadingPromise = new Promise((resolve) => {
        player.resolveLoading = resolve;
      });
      player.onload = async () => {
        clearTimeout(loadingFailedTimeout);
        player.loadingPromise.then(() => {
          this.trigger('ready');
          this.trigger('loaded');
          this.loadingComplete = true;
          this.trigger('resize');

          if (
            options.autoplay && (
              !document.featurePolicy ||
              document.featurePolicy?.allowsFeature('autoplay')
            )
          ) {
            this.play();
            changeState(H5P.Video.PLAYING);
          }

          return true;
        });
      };
      window.addEventListener('message', (event) => {
        let message = '';
        try {
          message = JSON.parse(event.data);
        }
        catch (e) {
          return;
        }
        if (message.context !== 'Echo360') {
          return;
        }

        if (message.event === 'init') {
          duration = message.data.duration;
          currentTime = message.data.currentTime ?? 0;
          qualities = mapQualityLevels(message.data.qualityOptions);
          currentQuality = qualities[0].name;
          player.resolveLoading();
          this.trigger('qualityChange', currentQuality);
          this.trigger('resize');
          if (message.data.playing) {
            changeState(H5P.Video.PLAYING);
          }
        }
        else if (message.event === 'timeline') {
          duration = message.data.duration ?? this.getDuration();
          currentTime = message.data.currentTime ?? 0;

          /*
           * Should work, but it was better if the player itself clearly sent
           * the state (playing, paused, ended) instead of us having to infer
           */
          if (
            currentState === H5P.Video.PLAYING &&
            Math.round(currentTime) >= Math.floor(duration)
          ) {
            changeState(H5P.Video.ENDED);

            if (options.loop) {
              this.seek(0);
              this.play();
            }
            return;
          }

          if (message.data.playing) {
            changeState(H5P.Video.PLAYING);
          }
          else if (currentState === H5P.Video.PLAYING) {
            // Condition prevents video to be paused on startup
            changeState(H5P.Video.PAUSED);
          }
        }
      });
    };

    /**
     * Change state of the player.
     * @param {number} state State id (H5P.Video[statename]).
     */
    const changeState = (state) => {
      if (state !== currentState) {
        currentState = state;
        this.trigger('stateChange', state);
      }
    };

    /**
     * Determine if the element is visible by computing the styles.
     *
     * @private
     * @param {HTMLElement} node - the element to check.
     * @returns {Boolean} true if it is visible.
     */
    const isNodeVisible = (node) => {
      let style = window.getComputedStyle(node);

      if (node.offsetWidth === 0) {
        return false;
      }

      return ((style.display !== 'none') && (style.visibility !== 'hidden'));
    };

    /**
     * Create a new player by embedding an iframe.
     *
     * @private
     * @returns {Promise}
     */
    const createEchoPlayer = async () => {
      if (!isNodeVisible(placeholderElement) || player !== undefined) {
        return;
      }
      // Since the SDK is loaded asynchronously below, explicitly set player to
      // null (unlike undefined) which indicates that creation has begun. This
      // allows the guard statement above to be hit if this function is called
      // more than once.
      player = null;
      let queryString = '?';
      if (options.controls) {
        queryString += 'controls=true&';
      }
      if (options.disableFullscreen) {
        queryString += 'disableFullscreen=true&';
      }
      if (options.deactivateSound) {
        queryString += 'deactivateSound=true&';
      }
      if (options.startAt) {
        // Implicit conversion to millis
        queryString += `startTimeMillis=${options.startAt * 1000}&`;
      }

      wrapperElement.innerHTML = `<iframe src="${sources[0].path}${queryString}" style="display: inline-block; width: 100%; height: 100%;" allow="autoplay; fullscreen" frameborder="0" scrolling="no"></iframe>`;
      player = wrapperElement.firstChild;
      // Create a new player
      registerEchoPlayerEventListeneners(player);
      loadingFailedTimeout = setTimeout(() => {
        failedLoading = true;
        removeLoadingIndicator();
        wrapperElement.innerHTML = `<p class="echo-failed-loading">${l10n.unknownError}</p>`;
        wrapperElement.style.cssText = 'width: null; height: null;';
        this.trigger('resize');
        this.trigger('error', l10n.unknownError);
      }, LOADING_TIMEOUT_IN_SECONDS * 1000);
    };

    /**
     * Appends the video player to the DOM.
     *
     * @public
     * @param {jQuery} $container
     */
    this.appendTo = ($container) => {
      $container.addClass('h5p-echo').append(wrapperElement);
      createEchoPlayer();
    };

    /**
     * Determine if the video has loaded.
     *
     * @public
     * @returns {Boolean}
     */
    this.isLoaded = () => {
      return loadingComplete;
    };

    /**
     * Get list of available qualities.
     *
     * @public
     * @returns {Array}
     */
    this.getQualities = () => {
      return qualities;
    };

    /**
     * Get the current quality.
     *
     * @public
     * @returns {String} Current quality identifier
     */
    this.getQuality = () => {
      return currentQuality;
    };

    /**
     * Set the playback quality.
     *
     * @public
     * @param {String} quality
     */
    this.setQuality = async (quality) => {
      this.post('quality', quality);
      currentQuality = quality;
      this.trigger('qualityChange', currentQuality);
    };

    /**
     * Start the video.
     *
     * @public
     */
    this.play = () => {
      if (!player) {
        this.on('ready', this.play);
        return;
      }
      this.post('play', 0);
    };

    /**
     * Pause the video.
     *
     * @public
     */
    this.pause = () => {
      this.post('pause', 0);
    };

    /**
     * Seek video to given time.
     *
     * @public
     * @param {Number} time
     */
    this.seek = (time) => {
      this.post('seek', time);
      currentTime = time;
    };

    /**
     * Post a window message to the iframe.
     *
     * @public
     * @param event
     * @param data
     */
    this.post = (event, data) => {
      if (player) {
        player.contentWindow.postMessage(JSON.stringify({ event: event, data: data }), '*');
      }
    };

    /**
     * Return the current play position.
     *
     * @public
     * @returns {Number} Seconds elapsed since beginning of video
     */
    this.getCurrentTime = () => {
      return currentTime;
    };

    /**
     * Return the video duration.
     *
     * @public
     * @returns {?Number} Video duration in seconds
     */
    this.getDuration = () => {
      if (duration > 0) {
        return duration;
      }
      return null;
    };

    /**
     * Get percentage of video that is buffered.
     *
     * @public
     * @returns {Number} Between 0 and 100
     */
    this.getBuffered = () => {
      return buffered;
    };

    /**
     * Mute the video.
     *
     * @public
     */
    this.mute = () => {
      this.post('mute', 0);
      isMuted = true;
    };

    /**
     * Unmute the video.
     *
     * @public
     */
    this.unMute = () => {
      this.post('unmute', 0);
      isMuted = false;
    };

    /**
     * Whether the video is muted.
     *
     * @public
     * @returns {Boolean} True if the video is muted, false otherwise
     */
    this.isMuted = () => {
      return isMuted;
    };

    /**
     * Get the video player's current sound volume.
     *
     * @public
     * @returns {Number} Between 0 and 100.
     */
    this.getVolume = () => {
      return volume;
    };

    /**
     * Set the video player's sound volume.
     *
     * @public
     * @param {Number} level
     */
    this.setVolume = (level) => {
      this.post('volume', level);
      volume = level;
    };

    /**
     * Get list of available playback rates.
     *
     * @public
     * @returns {Array} Available playback rates
     */
    this.getPlaybackRates = () => {
      return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    };

    /**
     * Get the current playback rate.
     *
     * @public
     * @returns {Number} e.g. 0.5, 1, 1.5 or 2
     */
    this.getPlaybackRate = () => {
      return playbackRate;
    };

    /**
     * Set the current playback rate.
     *
     * @public
     * @param {Number} rate Must be one of available rates from getPlaybackRates
     */
    this.setPlaybackRate = async (rate) => {
      const echoRate = parseFloat(rate);
      this.post('playbackrate', echoRate);
      playbackRate = rate;
      this.trigger('playbackRateChange', rate);
    };

    /**
     * Set current captions track.
     *
     * @public
     * @param {H5P.Video.LabelValue} track Captions to display
     */
    this.setCaptionsTrack = (track) => {
      if (!track) {
        this.post('texttrack', null);
        currentTextTrack = null;
      }
      this.post('texttrack', track.value);
      currentTextTrack = track;
    };

    /**
     * Get current captions track.
     *
     * @public
     * @returns {H5P.Video.LabelValue}
     */
    this.getCaptionsTrack = () => {
      return currentTextTrack;
    };

    this.on('resize', () => {
      if (failedLoading || !isNodeVisible(wrapperElement)) {
        return;
      }
      if (player === undefined) {
        // Player isn't created yet. Try again.
        createEchoPlayer();
        return;
      }
      // Use as much space as possible
      wrapperElement.style.cssText = 'width: 100%; height: 100%;';
      const width = wrapperElement.clientWidth;
      const height = options.fit ? wrapperElement.clientHeight : (width * (ratio));
      // Validate height before setting
      if (height > 0) {
        // Set size
        wrapperElement.style.cssText = 'width: ' + width + 'px; height: ' + height + 'px;';
      }
    });
  }

  /**
   * Find id of video from given URL.
   *
   * @private
   * @param {String} url
   * @returns {String} Echo video identifier
   */
  const getId = (url) => {
    const matches = url.match(/^[^/]+:\/\/(echo360[^/]+)\/media\/([^/]+)\/h5p.*$/i);
    if (matches && matches.length === 3) {
      return [matches[2], matches[2]];
    }
  };

  /**
   * Check to see if we can play any of the given sources.
   *
   * @public
   * @static
   * @param {Array} sources
   * @returns {Boolean}
   */
  EchoPlayer.canPlay = (sources) => {
    return getId(sources[0].path);
  };
  return EchoPlayer;
})(H5P.jQuery);

// Register video handler
H5P.videoHandlers = H5P.videoHandlers || [];
H5P.videoHandlers.push(H5P.VideoEchoVideo);
