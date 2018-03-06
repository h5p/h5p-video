/** @namespace H5P */
H5P.VideoXAPI = (function ($) {

  /**
   * Xapi video statement generator for H5P.
   *
   * @class
   * @param {Object} instance Parent H5P.Video{YouTube|Html5|Flash}
   *                          video object generating xAPI statements
   */
  function XAPI(instance) {
    var self = this;

    /**
     * Variables to track time values from the video player.
     *
     * @public
     */
    self.previousTime = 0;
    self.seeking = false;
    self.seekedTo = 0;
    self.duration = 0;

    /**
     * Variables to track internal video state.
     *
     * @private
     */
    var videoInstance = instance;
    var seekStart = null;
    var playedSegments = [];
    var playedSegmentsSegmentStart =0;
    var playedSegmentsSegmentEnd;
    var volumeChangedOn = null;
    var volumeChangedAt = 0;
    var sessionID = H5P.createUUID();
    var currentTime = 0;


    /**
     * Generates "initialized" xAPI statement (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#231-initialized
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @param {Number} width width of the current screen
     * @param {Number} height height of the current video screen
     * @param {Number} rate playback rate
     * @param {number} volume level of volume
     * @param {Boolean} ccEnabled boolean whether closed captions are enabled
     * @param {String} ccLanguage language of closed captions
     * @param {String} quality quality rating of resolution
     * @returns {Object} JSON xAPI statement
     *
     */
    self.getArgsXAPIInitialized = function (currentTime, width, height, rate, volume, ccEnabled, ccLanguage, quality) {
      // Set default value for quality.
      quality = typeof quality !== 'undefined' ? quality : Math.min(width, height);

      // Variables used in compiling xAPI results.
      var dateTime = new Date();
      var timeStamp = dateTime.toISOString();
      var resultExtTime = formatFloat(currentTime);
      var screenSize = screen.width + "x" + screen.height;
      var playbackSize = (width !== undefined && width !== '' ) ? width + "x" + height : "undetermined";
      var playbackRate = rate;
      var volume = formatFloat(volume);
      var userAgent = navigator.userAgent;
      var state = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen || false;

      var extensions = {};
      if (typeof state !== "undefined" && state != false) {
        extensions["https://w3id.org/xapi/video/extensions/full-screen"] = state
      }
      if (typeof screenSize !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/screen-size"] = screenSize
      }
      if (typeof playbackSize !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/video-playback-size"] = playbackSize
      }
      if (typeof sessionID !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/session-id"] = sessionID
      }
      if (typeof quality !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/quality"] = quality
      }
      if (typeof ccEnabled !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/cc-enabled"] = ccEnabled
      }
      if (typeof playbackRate !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/speed"] = playbackRate
      }
      if (typeof userAgent !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/user-agent"] = userAgent
      }
      if (typeof volume !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/volume"] = volume
      }

      return {
        "verb": {
          "id": "http://adlnet.gov/expapi/verbs/initialized",
          "display": {
            "en-US": "initialized"
          }
        },
        "object": getXAPIObject(),
        "context" : {
          "contextActivities": {
            "category": [{
              "id": "https://w3id.org/xapi/video"
            }]
          },
          "extensions": extensions
        },
        "timestamp": timeStamp
      };
    };

    /**
     * Generates "played" xAPI statement.
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#232-played
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPIPlayed = function (currentTime) {
      var dateTime = new Date();
      var timeStamp = dateTime.toISOString();

      var resultExtTime = formatFloat(currentTime);

      playedSegmentsSegmentStart = resultExtTime;
      seekStart = null;

      return {
        "verb": {
          "id": "https://w3id.org/xapi/video/verbs/played",
          "display": {
            "en-US": "played"
          }
        },
        "object": getXAPIObject(),
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
            "https://w3id.org/xapi/video/extensions/session-id": sessionID
          }
        },
        "timestamp": timeStamp
      };
    };

    /**
     * Generates "paused" xAPI statement (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#233-paused
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @param {Number} duration length of the video in seconds
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPIPaused = function (currentTime, duration) {
      var dateTime = new Date();
      var timeStamp = dateTime.toISOString();

      var resultExtTime = formatFloat(currentTime);

      var progress = self.getProgress(currentTime, duration);

      playedSegmentsSegmentStart = resultExtTime;
      endPlayedSegment(resultExtTime);

      var extensions = {};
      if (typeof resultExtTime !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/time"] = resultExtTime
      }
      if (typeof progress !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/progress"] = progress
      }
      if (typeof playedSegments !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/played-segments"] = playedSegments
      }

      return {
        "verb": {
          "id": "https://w3id.org/xapi/video/verbs/paused",
          "display": {
            "en-US": "paused"
          }
        },
        "object": getXAPIObject(),
        "result": {
          "extensions": extensions
        },
        "context": {
          "contextActivities": {
            "category": [{
              "id": "https://w3id.org/xapi/video"
            }]
          },
          "extensions": {
            "https://w3id.org/xapi/video/extensions/session-id": sessionID
          }
        },
        "timestamp" : timeStamp
      };
    };

    /**
     * Generates "seeked" xAPI statement (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#234-seeked
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPISeeked = function (currentTime) {
      var dateTime = new Date();
      var timeStamp = dateTime.toISOString();
      var resultExtTime = formatFloat(currentTime);
      seekStart = resultExtTime;
      endPlayedSegment(self.previousTime.toFixed(2));
      playedSegmentsSegmentStart = seekStart.toFixed(2);

      return {
        "verb": {
          "id": "https://w3id.org/xapi/video/verbs/seeked",
          "display": {
            "en-US": "seeked"
          }
        },
        "object": getXAPIObject(),
        "result": {
          "extensions" : {
            "https://w3id.org/xapi/video/extensions/time-from": self.previousTime.toFixed(2),
            "https://w3id.org/xapi/video/extensions/time-to": seekStart.toFixed(2)
          }
        },
        "context": {
          "contextActivities": {
            "category": [{
              "id": "https://w3id.org/xapi/video"
            }]
          },
          "extensions": {
            "https://w3id.org/xapi/video/extensions/session-id": sessionID
          }
        },
        "timestamp" : timeStamp
      };
    };

    /**
     * Generates "interacted" xAPI statement when volume changes (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#235-interacted
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @param {Boolean} muted indicates whether video is currently muted
     * @param {Number} volume indicates the volume level
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPIVolumeChanged = function (currentTime, muted, volume) {
     var dateTime = new Date();
      var timeStamp = dateTime.toISOString();
      volumeChangedAt = formatFloat(currentTime);
      var isMuted = muted;
      var volumeChange;
      if (isMuted === true) {
        volumeChange = 0;
      } else {
        volumeChange = formatFloat(volume);
      }

      return {
        "verb": {
          "id": "http://adlnet.gov/expapi/verbs/interacted",
          "display": {
            "en-US": "interacted"
          }
        },
        "object": getXAPIObject(),
        "result" : {
          "extensions": {
            "https://w3id.org/xapi/video/extensions/time": volumeChangedAt
          }
        },
        "context": {
          "contextActivities": {
            "category": [{
              "id": "https://w3id.org/xapi/video"
            }]
          },
          "extensions": {
            "https://w3id.org/xapi/video/extensions/session-id": sessionID,
            "https://w3id.org/xapi/video/extensions/volume": volumeChange
          }
        },
        "timestamp" : timeStamp
      };
    };

    /**
     * Generates "interacted" xAPI statement when fullscreen entered (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#235-interacted
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @param {Number} width width of the current video screen (pixels)
     * @param {Number} height height of the current video screen (pixels)
     * @param {Boolean} fullscreen indicates whether user is watching in full screen mode or not
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPIFullScreen = function (currentTime, width, height, fullscreen = false) {
      var dateTime = new Date();
      var timeStamp = dateTime.toISOString();
      var resultExtTime = formatFloat(currentTime);
      var state = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen || fullscreen;
      var screenSize = screen.width + "x" + screen.height;
      var playbackSize = width + "x" + height;

      var extensions = {};
      if (typeof sessionID !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/session-id"] = sessionID
      }
      if (typeof state !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/full-screen"] = state
      }
      if (typeof screenSize !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/screen-size"] = screenSize
      }
      if (typeof playbackSize !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/video-playback-size"] = playbackSize
      }

      return {
        "verb": {
          "id": "http://adlnet.gov/expapi/verbs/interacted",
          "display": {
            "en-US": "interacted"
          }
        },
        "object": getXAPIObject(),
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
          "extensions": extensions
        },
        "timestamp" : timeStamp
      };
    };

    /**
     * Generates "completed" xAPI statement (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#236-completed
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @param {Number} duration length of the current video in seconds
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPICompleted = function (currentTime, duration) {
      var progress = self.getProgress(currentTime, duration);
      var resultExtTime = formatFloat(currentTime);
      var dateTime = new Date();
      endPlayedSegment(resultExtTime);
      var timeStamp = dateTime.toISOString();

      var extensions = {};
      if (typeof resultExtTime !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/time"] = resultExtTime
      }
      if (typeof progress !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/progress"] = progress
      }
      if (typeof playedSegments !== "undefined") {
        extensions["https://w3id.org/xapi/video/extensions/played-segments"] = playedSegments
      }

      return {
        "verb": {
          "id": "http://adlnet.gov/expapi/verbs/completed",
          "display": {
            "en-US": "completed"
          }
        },
        "object": getXAPIObject(),
        "result": {
          "extensions": extensions,
          "success" : true,
          "duration" : secondsToISO8601Duration(duration)
        },
        "context": {
          "contextActivities": {
            "category": [{
              "id": "https://w3id.org/xapi/video"
            }]
          },
          "extensions": {
            "https://w3id.org/xapi/video/extensions/session-id": sessionID
          }
        },
        "timestamp" : timeStamp
      };
    };

    /**
     * Calculate video progress.
     *
     * @public
     * @param {Number} currentTime current time of the video in seconds
     * @param {Number} duration length of the video in seconds
     * @returns {Number} Progress between 0..1
     */
    self.getProgress = function (currentTime, duration) {
      var arr, arr2;
      endPlayedSegment(currentTime);
      playedSegmentsSegmentStart = currentTime;
      // Get played segments array.
      arr = playedSegments == "" ? [] : playedSegments.split("[,]");
      if (playedSegmentsSegmentStart != null) {
        arr.push(playedSegmentsSegmentStart + "[.]" + formatFloat(currentTime));
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
     * @private
     * @param {Number} endTime When the current played segment ended
     */
    var endPlayedSegment = function (endTime) {
      var arr;
      // Need to not push in segments that happen from multiple triggers during scrubbing
      if (Math.abs(endTime - playedSegmentsSegmentStart) > 1) {
        // Don't run if called too closely to each other.
        arr = playedSegments == "" ? [] : playedSegments.split("[,]");
        arr.push(formatFloat(playedSegmentsSegmentStart) + "[.]" + formatFloat(endTime));
        playedSegments = arr.join("[,]");
        playedSegmentsSegmentEnd = endTime;
        playedSegmentsSegmentStart = null;
      }
    };

    /**
     * Append extra data to the XAPI statement's default object definition.
     *
     * @private
     * @returns {Object} "Object" portion of JSON xAPI statement
     */
    var getXAPIObject = function () {
      var event = new H5P.XAPIEvent();
      event.setObject(videoInstance);
      var xAPIObject = event.data.statement.object;

      // Add definition type (required by xAPI Video Profile).
      // @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#241-definition
      xAPIObject.definition.type = "https://w3id.org/xapi/video/activity-type/video";

      // Add definition description (if video has a description).
      if (videoInstance.contentId && H5PIntegration && H5PIntegration.contents && H5PIntegration.contents['cid-' + videoInstance.contentId].jsonContent) {
        var videoData = JSON.parse(H5PIntegration.contents['cid-' + videoInstance.contentId].jsonContent);
        if (videoData && videoData.interactiveVideo && videoData.interactiveVideo.video && videoData.interactiveVideo.video.startScreenOptions && videoData.interactiveVideo.video.startScreenOptions.shortStartDescription) {
          xAPIObject.definition.description = {
            "en-US": videoData.interactiveVideo.video.startScreenOptions.shortStartDescription
          };
        }
      }

      return xAPIObject;
    };
  }

  /**
   * Format parameter as float (or null if invalid).
   * Used when making arguments sent with video xAPI statments.
   *
   * @private
   * @param {string} Number to convert to float
   */
  var formatFloat = function (number) {
    if (number == null) {
      return null;
    }

    return +(parseFloat(number).toFixed(2));
  };

  /**
   * Convert duration in seconds to an ISO8601 duration string.
   *
   * @private
   * @param {Number} time Duration in seconds
   * @returns {String} Duration in ISO8601 duration format
   */
  var secondsToISO8601Duration = function (time) {
    var units = {
      "Y" : (365*24*3600),
      "D" :     (24*3600),
      "H" :         3600,
      "M" :           60,
      "S" :            1,
    }
    var timeUnits = [ "H", "M", "S" ];
    var iso8601Duration = "P";
    var isTime = false;
    for (var unitName in units  ) {
      var unit = units[unitName];
      var quot = Math.floor(time / unit);
      var time = time - (quot * unit);
      unit = quot;
      if (unit > 0) {
        if (!isTime && (timeUnits.indexOf(unitName) > -1)) {
          iso8601Duration += "T";
          isTime = true;
        }
        iso8601Duration += '' + unit + '' + unitName;
      }
    }

    return iso8601Duration;
  }

  return XAPI;
})(H5P.jQuery);
