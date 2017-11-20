/** @namespace H5P */
H5P.Video = (function ($, ContentCopyrights, MediaCopyright, handlers) {

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
   */
  function Video(parameters, id) {
    var self = this;

    // Ref youtube.js - ipad & youtube - issue
    self.pressToPlay = false;

    // Initialize event inheritance
    H5P.EventDispatcher.call(self);

    // Default language localization
    parameters = $.extend(true, parameters, {
      l10n: {
        name: 'Video',
        loading: 'Video player loading...',
        noPlayers: 'Found no video players that supports the given video format.',
        noSources: 'Video is missing sources.',
        aborted: 'Media playback has been aborted.',
        networkFailure: 'Network failure.',
        cannotDecode: 'Unable to decode media.',
        formatNotSupported: 'Video format not supported.',
        mediaEncrypted: 'Media encrypted.',
        unknownError: 'Unknown error.',
        invalidYtId: 'Invalid YouTube ID.',
        unknownYtId: 'Unable to find video with the given YouTube ID.',
        restrictedYt: 'The owner of this video does not allow it to be embedded.'
      }
    });

    parameters.a11y = parameters.a11y || [];
    parameters.playback = parameters.playback || {};
    parameters.visuals = parameters.visuals || {};

    /** @private */
    var sources = [];
    if (parameters.sources) {
      for (var i = 0; i < parameters.sources.length; i++) {
        // Clone to avoid changing of parameters.
        var source = $.extend(true, {}, parameters.sources[i]);

        // Create working URL without html entities.
        source.path = H5P.getPath($cleaner.html(source.path).text(), id);
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
        clone.track.path = H5P.getPath($cleaner.html(clone.track.path).text(), id);
        tracks.push(clone);
      }
    });

    /**
     * Attaches the video handler to the given container.
     * Inserts text if no handler is found.
     *
     * @public
     * @param {jQuery} $container
     */
    self.attach = function ($container) {
      $container.addClass('h5p-video').html('');

      if (self.appendTo !== undefined) {
        self.appendTo($container);
      }
      else {
        if (sources.length) {
          $container.text(parameters.l10n.noPlayers);
        }
        else {
          $container.text(parameters.l10n.noSources);
        }
      }
    };

    /**
     * Gather copyright information for the current video.
     *
     * @public
     * @returns {ContentCopyrights}
     */
    self.getCopyrights = function () {
      if (!sources[0] || !sources[0].copyright) {
        return;
      }

      // Use copyright information from H5P media field
      var info = new ContentCopyrights();
      info.addMedia(new MediaCopyright(sources[0].copyright));

      return info;
    };

    // Resize the video when we know its aspect ratio
    self.on('loaded', function () {
      self.trigger('resize');
    });

    // Find player for video sources
    if (sources.length) {
      var html5Handler;
      for (var i = 0; i < handlers.length; i++) {
        var handler = handlers[i];
        if (handler.canPlay !== undefined && handler.canPlay(sources)) {
          handler.call(self, sources, {
            controls: parameters.visuals.controls,
            autoplay: parameters.playback.autoplay,
            loop: parameters.playback.loop,
            fit: parameters.visuals.fit,
            poster: parameters.visuals.poster === undefined ? undefined : H5P.getPath(parameters.visuals.poster.path, id),
            startAt: parameters.startAt || 0,
            tracks: tracks,
            disableRemotePlayback: (parameters.visuals.disableRemotePlayback || false)
          }, parameters.l10n);
          return;
        }

        if (handler === H5P.VideoHtml5) {
          html5Handler = handler;
        }
      }

      // Fallback to trying HTML5 player
      if (html5Handler) {
        html5Handler.call(self, sources, {
          controls: parameters.visuals.controls,
          autoplay: parameters.playback.autoplay,
          loop: parameters.playback.loop,
          fit: parameters.visuals.fit,
          poster: parameters.visuals.poster === undefined ? undefined : H5P.getPath(parameters.visuals.poster.path, id),
          startAt: parameters.startAt || 0,
          tracks: tracks,
          disableRemotePlayback: (parameters.visuals.disableRemotePlayback || false)
        }, parameters.l10n);
      }
    }
  }

  /**
  * Generate a random GUID string used for seesionID with video xAPI statements.
  */
  Video.guid = function () {
    var s4 = function () {
     return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    };
   return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  };

  /**
   * Format parameter as float (or null if invalid).
   *
   * @param {string} number Number to convert to float
   * used when making arguments sent with video xAPI statments
   */
  Video.formatFloat = function (number) {
    if (number == null) {
      return null;
    }
    return +(parseFloat(number).toFixed(3));
  };

  /**
  * Track xAPI statement data for video events.
  * @private
  */
  Video.previousTime = 0;
  Video.seekStart = null;
  Video.playedSegments = [];
  Video.playedSegmentsSegmentStart =0;
  Video.playedSegmentsSegmentEnd;
  Video.volumeChangedOn = null;
  Video.volumeChangedAt = 0;
  Video.seeking = false;
  Video.sessionID = Video.guid();
  Video.currentTime = 0;
  Video.seekedTo = 0;

 /**
  * Calculate video progress.
  */
 Video.getProgress = function (currentTime, duration) {
   var arr, arr2;

   // Get played segments array.
   arr = Video.playedSegments == "" ? [] : Video.playedSegments.split("[,]");
   if (Video.playedSegmentsSegmentStart != null) {
     arr.push(Video.playedSegmentsSegmentStart + "[.]" + Video.formatFloat(currentTime));
   }

   arr2 = [];
   arr.forEach(function (v,i) {
     arr2[i] = v.split("[.]");
     arr2[i][0] *= 1;
     arr2[i][1] *= 1;
   });

   // Sort the array.
   arr2.sort(function (a,b) {
     return a[0] - b[0];
   });

   // Normalize the segments.
   arr2.forEach(function (v,i) {
     if (i > 0) {
       // Overlapping segments: this segment's starting point is less than last segment's end point.
       if (arr2[i][0] < arr2[i-1][1]) {
         arr2[i][0] = arr2[i-1][1];
         if (arr2[i][0] > arr2[i][1]) {
           arr2[i][1] = arr2[i][0];
         }
       }
     }
   });

   // Calculate progress length.
   var progressLength = 0;
   arr2.forEach(function (v,i) {
     if (v[1] > v[0]) {
       progressLength += v[1] - v[0];
     }
   });

   var progress = 1 * (progressLength / duration ).toFixed(2);

   return progress;
 };

  /**
   * Add a played segment to the array of already played segments.
   *
   * @param {int} endTime When the current played segment ended
   */
  Video.endPlayedSegment = function (endTime) {
    var arr;
    // Need to not push in segments that happen from multiple triggers during scrubbing
    if (endTime !== Video.playedSegmentsSegmentStart && Math.abs(endTime - Video.playedSegmentsSegmentStart) > 1 ) {
      // Don't run if called too closely to each other.
      arr = Video.playedSegments == "" ? [] : Video.playedSegments.split("[,]");
      arr.push(Video.formatFloat(Video.playedSegmentsSegmentStart) + "[.]" + Video.formatFloat(endTime));
      Video.playedSegments = arr.join("[,]");
      Video.playedSegmentsSegmentEnd = endTime;
      Video.playedSegmentsSegmentStart = null;
    }
  };

  /**
   * Video.getArgsXAPIPaused
   *
   * @param {type} currentTime
   * @returns {json object}
   */
  Video.getArgsXAPIPaused = function (currentTime, duration) {
    var dateTime = new Date();
    var timeStamp = dateTime.toISOString();
    var resultExtTime = Video.formatFloat(currentTime);
    Video.endPlayedSegment(resultExtTime);
    Video.playedSegmentsSegmentStart = resultExtTime;
    var progress = Video.getProgress(currentTime, duration);

    return {
      "result": {
        "extensions": {
          "https://w3id.org/xapi/video/extensions/time": resultExtTime,
          "https://w3id.org/xapi/video/extensions/progress": progress,
          "https://w3id.org/xapi/video/extensions/played-segments": Video.playedSegments
        }
      },
      "context": {
        "contextActivities": {
          "category": [{
            "id": "https://w3id.org/xapi/video"
          }]
        },
        "extensions": {
          "https://w3id.org/xapi/video/extensions/session-id": Video.sessionID
        }
      },
      "timestamp" : timeStamp
    };
  };

  /**
   * Video.getArgsXAPIPlayed
   *
   * @param { float } currentTime time of the video currently
   *
   * used to retun json object sent with event to be triggered by xAPI event
   */
  Video.getArgsXAPIPlayed = function (currentTime) {
    var dateTime = new Date();
    var timeStamp = dateTime.toISOString();
    var resultExtTime = Video.formatFloat(currentTime);
    Video.playedSegmentsSegmentStart = resultExtTime;
    Video.seekStart = null;

    return {
      "result": {
        "extensions": {
          "https://w3id.org/xapi/video/extensions/time": resultExtTime,
        }
      },
      "context": {
        "contextActivities": {
          "category": [{
            "id": "https://w3id.org/xapi/video"
          }]
        },
        "extensions": {
          "https://w3id.org/xapi/video/extensions/session-id": Video.sessionID
        }
      },
      "timestamp": timeStamp
    };
  };

   /**
   * Video.getArgsXAPISeeked
   *
   * @param { float } currentTime time of the video currently
   *
   * used to retun json object sent with seeked event to be triggered by xAPI event
   */
  Video.getArgsXAPISeeked = function (currentTime) {
    var dateTime = new Date();
    var timeStamp = dateTime.toISOString();
    var resultExtTime = Video.formatFloat(currentTime);
    Video.seekStart = resultExtTime;
    Video.endPlayedSegment(Video.previousTime);
    Video.playedSegmentsSegmentStart = Video.seekStart;

    return {
      "result": {
        "extensions" : {
          "https://w3id.org/xapi/video/extensions/time-from": Video.previousTime,
          "https://w3id.org/xapi/video/extensions/time-to": Video.seekStart
        }
      },
      "context": {
        "contextActivities": {
          "category": [{
            "id": "https://w3id.org/xapi/video"
          }]
        },
        "extensions": {
          "https://w3id.org/xapi/video/extensions/session-id": Video.sessionID
        }
      },
      "timestamp" : timeStamp
    };
  };

  /**
   * Video.getArgsXAPIVolumeChanged
   *
   * @param { float } currentTime time of the video currently
   *
   * used to retun json object sent with volume change event to be triggered by xAPI event
   */
  Video.getArgsXAPIVolumeChanged = function (currentTime, muted, volume) {
   var dateTime = new Date();
    var timeStamp = dateTime.toISOString();
    Video.volumeChangedAt = Video.formatFloat(currentTime);
    var isMuted = muted;
    var volumeChange;
    if (isMuted === true) {
      volumeChange = 0;
    } else {
      volumeChange = Video.formatFloat(volume);
    }

    return {
      "result" : {
        "extensions": {
          "https://w3id.org/xapi/video/extensions/time": Video.volumeChangedAt
        }
      },
      "context": {
        "contextActivities": {
          "category": [{
            "id": "https://w3id.org/xapi/video"
          }]
        },
        "extensions": {
          "https://w3id.org/xapi/video/extensions/session-id": Video.sessionID,
          "https://w3id.org/xapi/video/extensions/volume": volumeChange
        }
      },
      "timestamp" : timeStamp
    };
  };

  /**
   * Video.getArgsXAPICompleted
   *
   * @param { float } currentTime time of the video currently
   *
   * used to retun json object sent with complete event to be triggered by xAPI event
   */
  Video.getArgsXAPICompleted = function (currentTime, duration) {
    var progress = Video.getProgress(currentTime, duration);
    var resultExtTime = Video.formatFloat(currentTime);
    var dateTime = new Date();
    Video.endPlayedSegment(resultExtTime);
    var timeStamp = dateTime.toISOString();

    return {
      "result": {
        "extensions": {
          "https://w3id.org/xapi/video/extensions/time": resultExtTime,
          "https://w3id.org/xapi/video/extensions/progress": progress,
          "https://w3id.org/xapi/video/extensions/played-segments": Video.playedSegments
        }
      },
      "context": {
        "contextActivities": {
          "category": [{
            "id": "https://w3id.org/xapi/video"
          }]
        },
        "extensions": {
          "https://w3id.org/xapi/video/extensions/session-id": Video.sessionID
        }
      },
      "timestamp" : timeStamp
    };
  };

  /**
   * Video.getArgsXAPIFullScreen
   *
   * @param { float } currentTime time of the video currently
   *
   * used to retun json object sent with full screen change event to be triggered by xAPI event
   */
  Video.getArgsXAPIFullScreen = function (currentTime, width, height, fullscreen = false) {
    var dateTime = new Date();
    var timeStamp = dateTime.toISOString();
    var resultExtTime = Video.formatFloat(currentTime);
    var state = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen || fullscreen;
    var screenSize = screen.width + "x" + screen.height;
    var playbackSize = width + "x" + height;

    return {
      "result": {
        "extensions": {
          "https://w3id.org/xapi/video/extensions/time": resultExtTime
        }
      },
      "context": {
        "contextActivities": {
          "category": [{
            "id": "https://w3id.org/xapi/video"
          }]
        },
        "extensions": {
          "https://w3id.org/xapi/video/extensions/session-id": Video.sessionID,
          "https://w3id.org/xapi/video/extensions/full-screen": state,
          "https://w3id.org/xapi/video/extensions/screen-size": screenSize,
          "https://w3id.org/xapi/video/extensions/video-playback-size": playbackSize
        }
      },
      "timestamp" : timeStamp
    };
  };

  /**
   * Video.getArgsXAPIInitialized
   *
   * @param { float } currentTime time of the video currently
   *
   * used to retun json object sent with full screen change event to be triggered by xAPI event
   */
  Video.getArgsXAPIInitialized = function (currentTime, width, height, rate, volume, ccEnabled, ccLanguage, quality) {
    // Set default value for quality.
    quality = typeof quality !== 'undefined' ? quality : Math.min(width, height);

    // Variables used in compiling xAPI results.
    var dateTime = new Date();
    var timeStamp = dateTime.toISOString();
    var resultExtTime = Video.formatFloat(currentTime);
    var screenSize = screen.width + "x" + screen.height;
    var playbackSize = (width !== undefined && width !== '' ) ? width + "x" + height : "undetermined";
    var playbackRate = rate;
    var volume = Video.formatFloat(volume);
    var userAgent = navigator.userAgent;
    var state = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen || false;

    return {
      "context" : {
        "contextActivities": {
          "category": [{
            "id": "https://w3id.org/xapi/video"
          }]
        },
        "extensions": {
          "https://w3id.org/xapi/video/extensions/full-screen": state,
          "https://w3id.org/xapi/video/extensions/screen-size": screenSize,
          "https://w3id.org/xapi/video/extensions/video-playback-size": playbackSize,
          "https://w3id.org/xapi/video/extensions/quality": quality,
          "https://w3id.org/xapi/video/extensions/cc-enabled": ccEnabled,
          "https://w3id.org/xapi/video/extensions/cc-subtitle-lang": ccLanguage,
          "https://w3id.org/xapi/video/extensions/speed": playbackRate + "x",
          "https://w3id.org/xapi/video/extensions/user-agent": userAgent,
          "https://w3id.org/xapi/video/extensions/volume": volume,
          "https://w3id.org/xapi/video/extensions/session-id": Video.sessionID
        }
      },
      "timestamp": timeStamp
    };
  };

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

  /** @constant {Boolean} */
  Video.IE11_PLAYBACK_RATE_FIX = (navigator.userAgent.match(/Trident.*rv[ :]*11\./) ? true : false);

  return Video;
})(H5P.jQuery, H5P.ContentCopyrights, H5P.MediaCopyright, H5P.videoHandlers || []);
