/** @namespace H5P */
H5P.VideoXAPI = (function ($) {
  'use strict';

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

    /**
     * Variables to track internal video state.
     *
     * @private
     */
    var videoInstance = instance;
    var playedSegments = [];
    var playingSegmentStart = 0;
    var volumeChangedOn = null;
    var volumeChangedAt = 0;
    var sessionID = H5P.createUUID();
    var currentTime = 0;
    var xAPIObject = null;

    /**
     * Generate common xAPI statement elements (Video Profile).

     * @param {Object} params - Parameters.
     * @param {string} params.verb - Verb for the xAPI statement.
     * @param {Object} [params.result] - Extensions for the object.
     * @param {Object} [params.extensionsContext] - Extensions for the context.
     * @return {Object} JSON xAPI statement
     */
    self.getArgsXAPI = function (params) {
      params.extensionsContext = params.extensionsContext || {};

      var dateTime = new Date();
      var timeStamp = dateTime.toISOString();

      return {
        'verb': {
          'id': params.verb,
          'display': {'en-US': params.verb.substr(params.verb.lastIndexOf('/') + 1)}
        },
        'object': getXAPIObject(),
        'result': params.result,
        'context': {
          'contextActivities': {'category': [{'id': 'https://w3id.org/xapi/video'}]},
          'extensions': params.extensionsContext
        },
        'timestamp': timeStamp
      };
    };

    /**
     * Generates 'initialized' xAPI statement (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#231-initialized
     *
     * @public
     * @param {Number} width width of the current screen
     * @param {Number} height height of the current video screen
     * @param {Number} rate playback rate
     * @param {number} volume level of volume
     * @param {Boolean} ccEnabled boolean whether closed captions are enabled
     * @param {String} ccLanguage language of closed captions
     * @param {String} [quality] quality rating of resolution
     * @returns {Object} JSON xAPI statement
     *
     */
    self.getArgsXAPIInitialized = function (width, height, rate, volume, ccEnabled, ccLanguage, quality, videoLength) {
      // If quality isn't provided, set it to the height of the video.
      quality = typeof quality !== 'undefined' ? quality : height;
      videoLength = typeof videoLength !== 'undefined' ? parseFloat(videoLength).toFixed(3) : videoLength;

      // Variables used in compiling xAPI results.
      var screenSize = screen.width + 'x' + screen.height;
      var playbackSize = (width !== undefined && width !== '') ? width + 'x' + height : undefined;
      var playbackRate = rate;
      var userAgent = navigator.userAgent;
      var isFullscreen = document.fullscreenElement || document.mozFullScreen || document.webkitIsFullScreen || false;
      volume = formatFloat(volume);

      var extensions = {};

      if (typeof videoLength !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/length'] = videoLength;
      }
      if (typeof isFullscreen !== 'undefined' && isFullscreen) {
        extensions['https://w3id.org/xapi/video/extensions/full-screen'] = isFullscreen;
      }
      if (typeof screenSize !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/screen-size'] = screenSize;
      }
      if (typeof playbackSize !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/video-playback-size'] = playbackSize;
      }
      if (typeof sessionID !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/session-id'] = sessionID;
      }
      if (typeof quality !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/quality'] = quality;
      }
      if (typeof ccEnabled !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/cc-enabled'] = ccEnabled;
      }
      if (typeof playbackRate !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/speed'] = playbackRate;
      }
      if (typeof userAgent !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/user-agent'] = userAgent;
      }
      if (typeof volume !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/volume'] = volume;
      }
      if (typeof instance.finishedThreshold !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/completion-threshold'] = instance.finishedThreshold;
      }

      return self.getArgsXAPI({
        verb: 'http://adlnet.gov/expapi/verbs/initialized',
        extensionsContext: extensions
      });
    };

    /**
     * Generates 'played' xAPI statement.
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#232-played
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPIPlayed = function (currentTime) {
      var resultExtTime = formatFloat(currentTime);
      playingSegmentStart = resultExtTime;

      return self.getArgsXAPI({
        verb: 'https://w3id.org/xapi/video/verbs/played',
        result: {extensions: {
          'https://w3id.org/xapi/video/extensions/time': resultExtTime}
        },
        extensionsContext: {
          'https://w3id.org/xapi/video/extensions/session-id': sessionID
        }
      });
    };

    /**
     * Generates 'paused' xAPI statement (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#233-paused
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @param {Number} duration length of the video in seconds
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPIPaused = function (currentTime, duration) {
      var resultExtTime = formatFloat(currentTime);
      var progress = self.getProgress(currentTime, duration);
      endPlayingSegment(resultExtTime);

      var extensions = {};
      if (typeof resultExtTime !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/time'] = resultExtTime;
      }
      if (typeof progress !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/progress'] = progress;
      }
      if (typeof playedSegments !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/played-segments'] = stringifyPlayedSegments();
      }

      return self.getArgsXAPI({
        verb: 'https://w3id.org/xapi/video/verbs/paused',
        result: {extensions: extensions},
        extensionsContext: {
          'https://w3id.org/xapi/video/extensions/session-id': sessionID
        }
      });
    };

    /**
     * Generates 'seeked' xAPI statement (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#234-seeked
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPISeeked = function (currentTime) {
      var resultExtTime = formatFloat(currentTime);
      endPlayingSegment(formatFloat(instance.previousTime));
      playingSegmentStart = resultExtTime;

      return self.getArgsXAPI({
        verb: 'https://w3id.org/xapi/video/verbs/seeked',
        result: {
          extensions: {
            'https://w3id.org/xapi/video/extensions/time-from': formatFloat(instance.previousTime),
            'https://w3id.org/xapi/video/extensions/time-to': playingSegmentStart
          }
        },
        extensionsContext: {
          'https://w3id.org/xapi/video/extensions/session-id': sessionID
        }
      });
    };

    /**
     * Generates 'interacted' xAPI statement when volume changes (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#235-interacted
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @param {Boolean} muted indicates whether video is currently muted
     * @param {Number} volume indicates the volume level
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPIVolumeChanged = function (currentTime, muted, volume) {
      volumeChangedAt = formatFloat(currentTime);
      volume = muted ? 0 : formatFloat(volume);

      return self.getArgsXAPI({
        verb: 'http://adlnet.gov/expapi/verbs/interacted',
        result: {extensions: {
          'https://w3id.org/xapi/video/extensions/time': volumeChangedAt}
        },
        extensionsContext: {
          'https://w3id.org/xapi/video/extensions/session-id': sessionID,
          'https://w3id.org/xapi/video/extensions/volume': volume
        }
      });
    };

    /**
     * Generates 'interacted' xAPI statement when fullscreen entered (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#235-interacted
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @param {Number} width width of the current video screen (pixels)
     * @param {Number} height height of the current video screen (pixels)
     * @param {Boolean} [fullscreen] indicates whether user is watching in full screen mode or not
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPIFullScreen = function (currentTime, width, height, fullscreen) {
      fullscreen = typeof fullscreen !== 'undefined' ? fullscreen : false;
      var isFullscreen = document.fullscreenElement || document.mozFullScreen || document.webkitIsFullScreen || fullscreen;
      var screenSize = screen.width + 'x' + screen.height;
      var playbackSize = width + 'x' + height;

      var resultExtTime = formatFloat(currentTime);

      var extensions = {};
      if (typeof sessionID !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/session-id'] = sessionID;
      }
      if (typeof isFullscreen !== 'undefined' && isFullscreen) {
        extensions['https://w3id.org/xapi/video/extensions/full-screen'] = isFullscreen;
      }
      if (typeof screenSize !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/screen-size'] = screenSize;
      }
      if (typeof playbackSize !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/video-playback-size'] = playbackSize;
      }

      return self.getArgsXAPI({
        verb: 'http://adlnet.gov/expapi/verbs/interacted',
        result: {extensions: {
          'https://w3id.org/xapi/video/extensions/time': resultExtTime}
        },
        extensionsContext: extensions
      });
    };

    /**
     * Generates 'completed' xAPI statement (Video Profile).
     * @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#236-completed
     *
     * @public
     * @param {Number} currentTime time of the video currently
     * @param {Number} duration length of the current video in seconds
     * @param {Number} progress Number between 0.000 and 1.000 indicating percentage of video watched
     * @returns {Object} JSON xAPI statement
     */
    self.getArgsXAPICompleted = function (currentTime, duration, progress) {
      var resultExtTime = formatFloat(currentTime);
      endPlayingSegment(resultExtTime);
      playingSegmentStart = 0;

      var extensions = {};
      if (typeof resultExtTime !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/time'] = resultExtTime;
      }
      if (typeof progress !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/progress'] = progress;
      }
      if (typeof playedSegments !== 'undefined') {
        extensions['https://w3id.org/xapi/video/extensions/played-segments'] = stringifyPlayedSegments();
      }

      return self.getArgsXAPI({
        verb: 'http://adlnet.gov/expapi/verbs/completed',
        result: {
          'extensions': extensions,
          'completion': true,
          'duration': secondsToISO8601Duration(duration)
        },
        extensionsContext: {
          'https://w3id.org/xapi/video/extensions/session-id': sessionID
        }
      });
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
      // If we're currently playing a segment, end it so it's included in our
      // calculations below.
      endPlayingSegment(currentTime);

      // Create a copy of the played segments array so we can manipulate it.
      var parsedPlayedSegments = JSON.parse(JSON.stringify(playedSegments));

      // Sort the array (so we can detect overlapping segments).
      parsedPlayedSegments.sort(function (a, b) {
        return a.start - b.start;
      });

      // Calculate total time watched from played segments.
      var timePlayed = 0;
      parsedPlayedSegments.forEach(function (currentValue, i, segments) {
        // If a segment overlaps, discard the overlap (otherwise our progress
        // count would be artificially inflated).
        if (i > 0 && segments[i].start < segments[i-1].end) {
          segments[i].start = segments[i-1].end;
          // This segment may have been inside the previous segment, so be sure
          // to update its end timestamp so we don't have a negative range).
          segments[i].end = Math.max(segments[i].start, segments[i].end);
        }
        // Add this segment's length to our cumulative progress counter.
        timePlayed += segments[i].end - segments[i].start;
      });

      // Progress (percentage) is encoded as a decimal between 0.000 and 1.000.
      // @see: https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#2544-progress
      return formatFloat(timePlayed / duration);
    };

    /**
     * Adds a played segment to the array of already played segments.
     *
     * @private
     * @param {Number} endTime When the currently playing segment ended
     */
    var endPlayingSegment = function (endTime) {
      // Scrubbing the video will fire this function many times, so only record
      // segments 500ms or longer (ignore any segments less than 500ms and
      // negative play segments).
      if (endTime - playingSegmentStart > 0.5) {
        playedSegments.push({
          start: formatFloat(playingSegmentStart),
          end: formatFloat(endTime)
        });
        playingSegmentStart = endTime;
      }
    };

    /**
     * Converts an array of played segments to the string representation defined
     * in the xAPI Video Profile spec.
     * @see  https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#2545-played-segments
     *
     * @private
     * @return {String} Played segments string, e.g., '0.000[.]12.000[,]14.000[.]21.000'
     */
    var stringifyPlayedSegments = function () {
      var stringPlayedSegments = '';
      if (playedSegments.length > 0) {
        stringPlayedSegments = playedSegments.map(function (segment) {
          return segment.start.toFixed(3) + '[.]' + segment.end.toFixed(3);
        }).reduce(function (accumulator, segment) {
          return accumulator + '[,]' + segment;
        });
      }

      return stringPlayedSegments;
    };

    /**
     * Append extra data to the XAPI statement's default object definition.
     *
     * @private
     * @returns {Object} 'Object' portion of JSON xAPI statement
     */
    var getXAPIObject = function () {
      if (xAPIObject !== null) {
        return xAPIObject;
      }

      var event = new H5P.XAPIEvent();

      if (videoInstance && videoInstance.contentId && H5PIntegration && H5PIntegration.contents && H5PIntegration.contents['cid-' + videoInstance.contentId]) {
        event.setObject(videoInstance);
        xAPIObject = event.data.statement.object;

        // Add definition type (required by xAPI Video Profile).
        // @see https://liveaspankaj.gitbooks.io/xapi-video-profile/content/statement_data_model.html#241-definition
        xAPIObject.definition.type = 'https://w3id.org/xapi/video/activity-type/video';

        // Add definition description (if video has a description).
        if (H5PIntegration.contents['cid-' + videoInstance.contentId].jsonContent) {
          var videoData = JSON.parse(H5PIntegration.contents['cid-' + videoInstance.contentId].jsonContent);
          if (videoData && videoData.interactiveVideo && videoData.interactiveVideo.video && videoData.interactiveVideo.video.startScreenOptions && videoData.interactiveVideo.video.startScreenOptions.shortStartDescription) {
            xAPIObject.definition.description = {
              'en-US': videoData.interactiveVideo.video.startScreenOptions.shortStartDescription
            };
          }
        }
      }
      return xAPIObject;
    };
  }

  /**
   * Returns a floating point value with up to 3 decimals of precision (or null
   * if invalid). Used when making arguments sent with video xAPI statments.
   *
   * @private
   * @param {string} Number to convert to float
   * @returns {Number} Floating point with up to 3 decimals of precision
   */
  var formatFloat = function (number) {
    if (number === null) {
      return null;
    }

    return +(parseFloat(number).toFixed(3));
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
      'Y': (365*24*3600),
      'D':     (24*3600),
      'H':         3600,
      'M':           60,
      'S':            1,
    };
    var timeUnits = ['H', 'M', 'S'];
    var iso8601Duration = 'P';
    var isTime = false;
    for (var unitName in units) {
      var unit = units[unitName];
      var quot = Math.floor(time / unit);
      time = time - (quot * unit);
      unit = quot;
      if (unit > 0) {
        if (!isTime && (timeUnits.indexOf(unitName) > -1)) {
          iso8601Duration += 'T';
          isTime = true;
        }
        iso8601Duration += '' + unit + '' + unitName;
      }
    }

    return iso8601Duration;
  };

  return XAPI;
})(H5P.jQuery);
