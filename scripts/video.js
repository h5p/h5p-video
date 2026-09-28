/** @namespace H5P */
H5P.Video = (function ($, ContentCopyrights, MediaCopyright, handlers) {

  const THREESIXTY_EVENT_THROTLE_TIME = 10;
  const THREESIXTY_DRAG_SENSITIVITY = 700;
  const THREESIXTY_MOUSE_SENSITIVITY = 2;

  /**
   * The ultimate H5P video player!
   *
   * @class
   * @param {Object} parameters Options for this library.
   * @param {Object} parameters.visuals Visual options
   * @param {Object} parameters.playback Playback options
   * @param {Object} parameters.a11y Accessibility options
   * @param {Boolean} [parameters.startAt] Start time of video
   * @param {Number} id Content identifier
   * @param {Object} [extras] Extra parameters.
   */
  function Video(parameters, id, extras = {}) {
    var self = this;
    self.$container = null;
    self.oldTime = extras.previousState?.time;
    self.contentId = id;
    self.uniqueId = crypto.getRandomValues(new Uint16Array(1))[0];
    self.WAS_RESET = false;
    self.startAt = parameters.startAt || 0;
    self.hasNoAutoPause = parameters.playback?.hasNoAutoPause || false;

    // Ref youtube.js - ipad & youtube - issue
    self.pressToPlay = false;

    self.firstPlay = true;

    // 360 video related props
    self.user360Draging = false;
    self.user360DragingLastLocation = null;
    self.is360EventSlotOpen = true;
    // Event overflow prevention - only process next event (X)ms after last successful one
    self.eventThrottleTime = parameters?.threeSixty?.eventThrottleTime || THREESIXTY_EVENT_THROTLE_TIME;
    self.dragEnabled = false;
    // Sensitivity for drag events - lower value -> higher sensitivity.
    self.dragSensitivity = Math.max(300, Math.min(parameters?.threeSixty?.dragSensitivity || THREESIXTY_DRAG_SENSITIVITY, 1500));
    self.mouseControlSensitivity = Math.max(1, Math.min(parameters?.threeSixty?.mouseControlSensitivity || THREESIXTY_MOUSE_SENSITIVITY, 8));


    // Reference to the handler
    var handlerName = '';

    // Initialize event inheritance
    H5P.EventDispatcher.call(self);

    // Default language localization
    parameters = $.extend(true, parameters, {
      l10n: {
        name: 'Video',
        loading: 'Video player loading...',
        noPlayers: 'Found no video players that supports the given video format.',
        noSources: 'Video source is missing.',
        aborted: 'Media playback has been aborted.',
        networkFailure: 'Network failure.',
        cannotDecode: 'Unable to decode media.',
        formatNotSupported: 'Video format not supported.',
        mediaEncrypted: 'Media encrypted.',
        unknownError: 'Unknown error.',
        vimeoPasswordError: 'Password-protected Vimeo videos are not supported.',
        vimeoPrivacyError: 'The Vimeo video cannot be used due to its privacy settings.',
        vimeoLoadingError: 'The Vimeo video could not be loaded.',
        invalidYtId: 'Invalid YouTube ID.',
        unknownYtId: 'Unable to find video with the given YouTube ID.',
        restrictedYt: 'The owner of this video does not allow it to be embedded.'
      }
    });

    parameters.a11y = parameters.a11y || [];
    parameters.playback = parameters.playback || {};
    parameters.visuals = $.extend(
      true, { disableFullscreen: false }, parameters.visuals
    );

    /** @private */
    var sources = [];
    if (parameters.sources) {
      for (var i = 0; i < parameters.sources.length; i++) {
        // Clone to avoid changing of parameters.
        var source = $.extend(true, {}, parameters.sources[i]);

        // Create working URL without html entities.
        source.path = $cleaner.html(source.path).text();
        sources.push(source);
      }
    }

    /** @private */
    var tracks = [];
    parameters.a11y.forEach(function (track) {
      // Clone to avoid changing of parameters.
      var clone = $.extend(true, {}, track);

      // Create working URL without html entities
      if (clone.track && clone.track.path) {
        clone.track.path = $cleaner.html(clone.track.path).text();
        tracks.push(clone);
      }
    });

    /**
     * Handle autoplay. If autoplay is disabled, it will still autopause when
     * video is not visible.
     *
     * @param {*} $container
     */
    const handleAutoPlayPause = function ($container) {
      // Keep the current state
      let state;
      self.on('stateChange', function(event) {
        state = event.data;
      });

      // Keep record of autopauses.
      // I.e: we don't wanna autoplay if the user has excplicitly paused.
      self.autoPaused = !self.pressToPlay;

      new IntersectionObserver(function (entries) {
        const entry = entries[0];

        // This video element became visible
        if (entry.isIntersecting) {
          // Autoplay if autoplay is enabled and it was not explicitly
          // paused by a user
          if (parameters.playback.autoplay && self.autoPaused) {
            self.autoPaused = false;
            self.play();
          }
        }
        else if (state !== Video.PAUSED && state !== Video.ENDED && !self.hasNoAutoPause) {
          self.autoPaused = true;
          self.pause();
        }
      }, {
        root: null,
        threshold: [0, 1] // Get events when it is shown and hidden
      }).observe($container.get(0));
    };

    /**
     * Attaches the video handler to the given container.
     * Inserts text if no handler is found.
     *
     * @public
     * @param {jQuery} $container
     */
    self.attach = function ($container) {
      self.$container = $container;

      $container.addClass('h5p-video h5p-theme').html('');

      if (self.appendTo !== undefined) {
        self.appendTo($container);

        // Avoid autoplaying in authoring tool
        if (window.H5PEditor === undefined) {
          handleAutoPlayPause($container);
        }
      }
      else if (sources.length) {
        $container.text(parameters.l10n.noPlayers);
      }
      else {
        $container.text(parameters.l10n.noSources);
      }
    };

    /**
     * Get name of the video handler
     *
     * @public
     * @returns {string}
     */
    self.getHandlerName = function() {
      return handlerName;
    };

    /**
    * @public
    * Get current state for resume support.
    *
    * @returns {object} Current state.
    */
    self.getCurrentState = function () {
      if (self.getCurrentTime) {
        return {
          time: self.getCurrentTime() || self.oldTime,
        };
      }
    };

    /**
     * The two functions below needs to be defined in this base class,
     * since it is used in this class even if no handler was found.
     */
    self.seek = () => {};
    self.pause = () => {};

    /**
    * @public
    * Reset current state (time).
    *
    */
    self.resetTask = function () {
      delete self.oldTime;
      self.resetPlayback(parameters.startAt || 0);
    };

    /**
     * Default implementation of resetPlayback. May be overridden by sub classes.
     *
     * @param {*} startAt
     */
    self.resetPlayback = startAt => {
      self.seek(startAt);
      self.pause();
      self.WAS_RESET = true;
    };

    /**
     * Check if loaded video is a 360 degree video. Default implementation, may be overridden by sub classes.
     * 
     * @return {Boolean | null} Is loaded video 360 video.
     */
    self.is360 = () => {
      return false;
    };

    /**
     * Check if this API supports 360 degree video controls. Default implementation, may be overridden by sub classes.
     * 
     * @public
     * @return {Boolean} 360 controls availability.
     */
    self.canControl360 = () => {
      return false;
    };

    /**
     * Return current 360 view properties. Default implementation, may be overridden by sub classes.
     *
     * @public
     * @return {Object | null} Current 360 view properties.
     */
    self.get360ViewProperties = () => {
      return null;
    };

    /**
     * Update 360 degree view properties. Default implementation, may be overridden by sub classes.
     *
     * @public
     * @param {Object} properties Updated 360 view properties.
     */
    self.set360ViewProperties = async (properties) => {
      self.trigger('360ViewPropertiesChange', properties);
      return;
    };

    /**
     * Return offset data for control UI elements.
     * 
     * @public
     * @return {Object} CSS properties for absolute offset.
     */
    self.get360ControlsOffset = () => {
      return {left: '20px', top: '20px'};
    };

    /**
     * Create 360 view mouse control UI and attach listeners.
     *
     * @public
     */
    self.create360Controls = () => {
      if (self.$container === null || document.getElementsByClassName('h5p-video-360-mouse-controls-container-' + (self.uniqueId ?? '')).length) {
        return;
      }

      const mouseControlContainerElement = document.createElement('div');
      mouseControlContainerElement.classList.add('h5p-video-360-mouse-controls-container-' + self.uniqueId);

      const controlsOffsetData = self.get360ControlsOffset();

      Object.keys(controlsOffsetData).forEach((cssProperty) => {
        mouseControlContainerElement.style[cssProperty] = controlsOffsetData[cssProperty];
      });

      mouseControlContainerElement.innerHTML = `
        <div class="h5p-video-360-mouse-controls-row">
          <div></div>
          <div>
            <button class="h5p-video-360-mouse-controls-button-${self.uniqueId}" data-direction="u">↑</button>
          </div>
          <div></div>
        </div>
        <div class="h5p-video-360-mouse-controls-row">
          <div>
            <button class="h5p-video-360-mouse-controls-button-${self.uniqueId}" data-direction="l">←</button>
          </div>
          <div>
            <button class="h5p-video-360-mouse-controls-drag-toggle-button-${self.uniqueId}">D</button>
          </div>
          <div>
            <button class="h5p-video-360-mouse-controls-button-${self.uniqueId}" data-direction="r">→</button>
          </div>
        </div>
        <div class="h5p-video-360-mouse-controls-row">
          <div></div>
          <div>
            <button class="h5p-video-360-mouse-controls-button-${self.uniqueId}" data-direction="d">↓</button>
          </div>
          <div></div>
        </div>
      `;

      self.$container.append(mouseControlContainerElement);

      const updateView = (direction, sensitivity) => {
        const viewProps = self.get360ViewProperties();

        switch (direction) {
          case 'u':
            viewProps.pitch += sensitivity;
            break;
          case 'd':
            viewProps.pitch -= sensitivity;
            break;
          case 'l':
            viewProps.yaw += sensitivity;
            break;
          case 'r':
            viewProps.yaw -= sensitivity;
            break;
        }

        if (viewProps.yaw > 360) {
          viewProps.yaw %= 360;
        }
        else {
          viewProps.yaw = viewProps.yaw % 360 < 0 ? (viewProps.yaw + 360) : viewProps.yaw;
        }

        viewProps.pitch = Math.max(-90, Math.min(viewProps.pitch, 90));

        self.set360ViewProperties(viewProps);
      };

      const buttonHoldRepeater = (button, action, delay) => {
        let t;
        const repeat = () => {
          action();
          t = setTimeout(repeat, delay);
        };

        button.onmousedown = () => {
          repeat();
        };

        button.onmouseup = () => {
          clearTimeout(t);
        };

        button.onmouseleave = () => {
          clearTimeout(t);
        };
      };

      Array.from(document.getElementsByClassName('h5p-video-360-mouse-controls-button-' + self.uniqueId)).forEach((buttonElement) => {
        buttonHoldRepeater(
          buttonElement,
          () => updateView(buttonElement.dataset.direction, self.mouseControlSensitivity),
          self.eventThrottleTime
        );
      });

      document.getElementsByClassName('h5p-video-360-mouse-controls-drag-toggle-button-' + self.uniqueId)[0].addEventListener('click', () => {
        self.dragEnabled = !self.dragEnabled;

        document.getElementsByClassName('h5p-video-360-overlay-' + self.uniqueId)[0].hidden = !self.dragEnabled;
        Array.from(document.getElementsByClassName('h5p-video-360-mouse-controls-button-' + self.uniqueId)).forEach((element) => {
          element.disabled = self.dragEnabled;
        });

        if (self.dragEnabled) {
          document.getElementsByClassName('h5p-video-360-mouse-controls-drag-toggle-button-' + self.uniqueId)[0].classList.add('h5p-video-360-mouse-controls-drag-toggle-button-active');
        }
        else {
          document.getElementsByClassName('h5p-video-360-mouse-controls-drag-toggle-button-' + self.uniqueId)[0].classList.remove('h5p-video-360-mouse-controls-drag-toggle-button-active');
        }
      });
    };

    /**
     * Create drag overlay and attach listeners for 360 video drag events.
     *
     * @public
     */
    self.create360Overlay = () => {
      if (!self.$container || document.getElementsByClassName('h5p-video-360-overlay-' + (self.uniqueId ?? '')).length) {
        return;
      }

      const overlayContainerElement = document.createElement('div');
      overlayContainerElement.classList.add('h5p-video-360-overlay-container-' + self.uniqueId);
      
      const overlayElement = document.createElement('div');
      overlayElement.classList.add('h5p-video-360-overlay-' + self.uniqueId, 'h5p-video-360-overlay-default');
      overlayElement.hidden = !self.dragEnabled;
      overlayContainerElement.append(overlayElement);

      self.$container.append(overlayContainerElement);

      const start360Drag = (x, y) => {
        self.user360Draging = true;
        self.user360DragingLastLocation = {x, y};
      };

      const update360Drag = async (x, y) => {
        if (!self.is360EventSlotOpen || !self.user360Draging || self.user360DragingLastLocation === null) {
          return;
        }

        const current360ViewProps = self.get360ViewProperties();

        if (current360ViewProps === null) {
          return;
        }

        self.is360EventSlotOpen = false;

        const diffX = x - self.user360DragingLastLocation.x;
        const diffY = y - self.user360DragingLastLocation.y;
        const sensitivity = current360ViewProps.fov / self.dragSensitivity;

        let normalizedYaw = current360ViewProps.yaw - (diffX * sensitivity);

        if (normalizedYaw > 360) {
          normalizedYaw %= 360;
        }
        else {
          normalizedYaw = normalizedYaw % 360 < 0 ? (normalizedYaw + 360) : normalizedYaw;
        }

        const correctedPitch = Math.max(-90, Math.min(90, (current360ViewProps.pitch + (diffY * sensitivity))));

        await self.set360ViewProperties({
          yaw: normalizedYaw,
          pitch: correctedPitch,
          roll: current360ViewProps.roll,
          fov: current360ViewProps.fov
        });

        self.user360DragingLastLocation = {x, y};

        setTimeout(() => {
          self.is360EventSlotOpen = true;
        }, self.eventThrottleTime);
      };

      const stop360Drag = () => {
        self.user360Draging = false;
        self.is360EventSlotOpen = true;
      };

      document.getElementsByClassName('h5p-video-360-overlay-container-' + self.uniqueId)[0].addEventListener('mousedown', (event) => {
        start360Drag(event.clientX, event.clientY);
      });
        
      document.getElementsByClassName('h5p-video-360-overlay-container-' + self.uniqueId)[0].addEventListener('touchstart', (event) => {
        event.preventDefault();
        start360Drag(event.touches[0].clientX, event.touches[0].clientY);
      });

      window.addEventListener('mousemove', (event) => {
        update360Drag(event.clientX, event.clientY);
      });

      window.addEventListener('touchmove', (event) => {
        update360Drag(event.touches[0].clientX, event.touches[0].clientY);
      });

      ['mouseup', 'touchcancel', 'touchend'].forEach((eventType) => {
        window.addEventListener(eventType, () => { stop360Drag(); });
      });
    };

    // Resize the video when we know its aspect ratio
    self.on('loaded', function () {
      self.trigger('resize');

      // reset time if wasn't done immediately
      if (self.WAS_RESET) {
        self.seek(parameters.startAt || 0);
        if (!parameters.playback.autoplay) {
          self.pause();
        }
        self.WAS_RESET = false;
      }
    });

    self.on('stateChange', (event) => {
      if (event.data === H5P.Video.PLAYING) {
        if (self.firstPlay && self.is360 && self.canControl360) {
          self.create360Overlay();
          self.create360Controls();
        }
        self.firstPlay = false;
      }
    });

    // Find player for video sources
    if (sources.length) {
      const options = {
        controls: parameters.visuals.controls,
        autoplay: parameters.playback.autoplay,
        loop: parameters.playback.loop,
        fit: parameters.visuals.fit,
        poster: parameters.visuals.poster === undefined ? undefined : parameters.visuals.poster,
        tracks: tracks,
        disableRemotePlayback: parameters.visuals.disableRemotePlayback === true,
        disableFullscreen: parameters.visuals.disableFullscreen === true,
        deactivateSound: parameters.playback.deactivateSound,
      }
      if (!self.WAS_RESET) {
        options.startAt = self.oldTime !== undefined ? self.oldTime : (parameters.startAt || 0);
      }

      var html5Handler;
      for (var i = 0; i < handlers.length; i++) {
        var handler = handlers[i];
        if (handler.canPlay !== undefined && handler.canPlay(sources)) {
          handler.call(self, sources, options, parameters.l10n);
          handlerName = handler.name;
          return;
        }

        if (handler === H5P.VideoHtml5) {
          html5Handler = handler;
          handlerName = handler.name;
        }
      }

      // Fallback to trying HTML5 player
      if (html5Handler) {
        html5Handler.call(self, sources, options, parameters.l10n);
      }
    }
  }

  // Extends the event dispatcher
  Video.prototype = Object.create(H5P.EventDispatcher.prototype);
  Video.prototype.constructor = Video;

  // Player states
  /** @constant {Number} */
  Video.ENDED = 0;
  /** @constant {Number} */
  Video.PLAYING = 1;
  /** @constant {Number} */
  Video.PAUSED = 2;
  /** @constant {Number} */
  Video.BUFFERING = 3;
  /**
   * When video is queued to start
   * @constant {Number}
   */
  Video.VIDEO_CUED = 5;


  // Used to convert between html and text, since URLs have html entities.
  var $cleaner = H5P.jQuery('<div/>');

  /**
   * Help keep track of key value pairs used by the UI.
   *
   * @class
   * @param {string} label
   * @param {string} value
   */
  Video.LabelValue = function (label, value) {
    this.label = label;
    this.value = value;
  };

 /**
  * Determine whether video can be autoplayed.
  * @returns {Promise<boolean>} Whether autoplay is allowed.
  */
  Video.isAutoplayAllowed = async () => {
   if (document.featurePolicy?.allowsFeature('autoplay')) {
     return true; // Browser supports `featurePolicy` and can tell directly
   }

   const video = document.createElement('video');

   /*
    * Without a video source, the play Promise will be rejected with an error
    * if it cannot be autoplayed, but not resolve at all if it can be
    * autoplayed. Using a timeout to detect the latter case here.
    */
   const timeoutMs = 50; // If play promise rejects, then within few ms

   const timeoutPromise = new Promise((resolve) => {
     window.setTimeout(() => {
       resolve(true); // Timeout reached, autoplay is allowed
     }, timeoutMs);
   });

   let result;
   try {
     result = (await Promise.race([video.play(), timeoutPromise])) ?? true;
   } catch (error) {
     result = false;
   }

   return result;
 };

  /** @constant {Boolean} */
  Video.IE11_PLAYBACK_RATE_FIX = (navigator.userAgent.match(/Trident.*rv[ :]*11\./) ? true : false);

  return Video;
})(H5P.jQuery, H5P.ContentCopyrights, H5P.MediaCopyright, H5P.videoHandlers || []);
